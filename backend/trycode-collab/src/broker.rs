use chrono::{DateTime, Utc};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{mpsc, Mutex, RwLock};
use tracing::{debug, error, info, warn};
use uuid::Uuid;

use yrs::updates::decoder::Decode;
use yrs::{ReadTxn, StateVector, Transact};

use crate::models::{
    AwarenessMessage, AwarenessState, CollabDocument, CollabMessage, CollabMessageType,
    CollabSession, DocUpdateMessage, SyncMessage,
};
use trycode_core::{CoreError, Result};

pub struct YrsBroker {
    documents: Arc<RwLock<HashMap<(Uuid, String), Arc<Mutex<DocumentState>>>>>,
    sessions: Arc<RwLock<HashMap<Uuid, SessionState>>>,
    db: sqlx::PgPool,
    persistence_interval: std::time::Duration,
}

pub struct DocumentState {
    doc: yrs::Doc,
    awareness: yrs::sync::Awareness,
    sessions: HashMap<Uuid, SessionState>,
    last_persisted_version: i64,
    dirty: bool,
}

#[derive(Clone)]
struct SessionState {
    id: Uuid,
    user_id: Uuid,
    document_id: Uuid,
    awareness_state: AwarenessState,
    sender: mpsc::UnboundedSender<CollabMessage>,
    last_activity: DateTime<Utc>,
}

impl YrsBroker {
    pub fn new(db: sqlx::PgPool, persistence_interval: std::time::Duration) -> Self {
        Self {
            documents: Arc::new(RwLock::new(HashMap::new())),
            sessions: Arc::new(RwLock::new(HashMap::new())),
            db,
            persistence_interval,
        }
    }

    pub async fn get_or_create_document(&self, project_id: Uuid, file_path: String) -> Result<Arc<Mutex<DocumentState>>> {
        let mut docs = self.documents.write().await;
        
        let key = (project_id, file_path.clone());
        if let Some(state) = docs.get(&key) {
            return Ok(Arc::clone(state));
        }

        // Load from database
        let db_doc = sqlx::query_as::<_, CollabDocument>(
            "SELECT * FROM collab_documents WHERE project_id = $1 AND file_path = $2",
        )
        .bind(project_id)
        .bind(file_path.clone())
        .fetch_optional(&self.db)
        .await?;

        let doc = yrs::Doc::new();
        let awareness = yrs::sync::Awareness::new(doc.clone());

        if let Some(db_doc) = db_doc {
            if let Some(state_bytes) = db_doc.ydoc_state {
                match yrs::Update::decode_v1(&state_bytes) {
                    Ok(update) => {
                        let mut txn = doc.transact_mut();
                        txn.apply_update(update).ok();
                    }
                    Err(e) => {
                        warn!("Failed to decode Yjs state for {}/{}: {}", project_id, file_path, e);
                    }
                }
            }
        }

        let state = Arc::new(Mutex::new(DocumentState {
            doc,
            awareness,
            sessions: HashMap::new(),
            last_persisted_version: 0,
            dirty: false,
        }));

        docs.insert(key, Arc::clone(&state));
        
        // Start persistence task for this document
        self.start_persistence_task(Arc::clone(&state), project_id, file_path).await;

        Ok(state)
    }

    async fn start_persistence_task(
        &self,
        state: Arc<Mutex<DocumentState>>,
        project_id: Uuid,
        file_path: String,
    ) {
        let db = self.db.clone();
        let interval = self.persistence_interval;

        tokio::spawn(async move {
            let mut interval = tokio::time::interval(interval);
            
            loop {
                interval.tick().await;
                
                let should_persist = {
                    let mut guard = state.lock().await;
                    if guard.dirty {
                        guard.dirty = false;
                        true
                    } else {
                        false
                    }
                };

                if should_persist {
                    let state_bytes = {
                        let guard = state.lock().await;
                        let txn = guard.doc.transact();
                        txn.encode_diff_v1(&StateVector::default())
                    };

                    if let Err(e) = sqlx::query(
                        r#"
                        INSERT INTO collab_documents (project_id, file_path, ydoc_state, version, updated_at)
                        VALUES ($1, $2, $3, $4, NOW())
                        ON CONFLICT (project_id, file_path) DO UPDATE SET
                            ydoc_state = EXCLUDED.ydoc_state,
                            version = EXCLUDED.version,
                            updated_at = NOW()
                        "#,
                    )
                    .bind(project_id)
                    .bind(&file_path)
                    .bind(state_bytes)
                    .bind(0i64) // version would need to be tracked
                    .execute(&db)
                    .await {
                        error!("Failed to persist collab document: {}", e);
                    } else {
                        debug!("Persisted collab document {}/{}", project_id, file_path);
                    }
                }
            }
        });
    }

    pub async fn join_session(
        &self,
        document_id: Uuid,
        user_id: Uuid,
        user_name: String,
        sender: mpsc::UnboundedSender<CollabMessage>,
    ) -> Result<()> {
        let doc_state = self.get_document_state(document_id).await?;

        let session_id = Uuid::new_v4();
        let awareness_state = AwarenessState {
            user_id,
            user_name,
            user_color: generate_user_color(user_id),
            cursor: None,
            selection: None,
            last_seen: Utc::now(),
        };

        // Add to Yjs awareness
        {
            let guard = doc_state.lock().await;
            guard
                .awareness
                .set_local_state(serde_json::to_value(&awareness_state)?)
                .map_err(|e| CoreError::Internal(e.to_string()))?;
        }

        // Store session
        let session = SessionState {
            id: session_id,
            user_id,
            document_id,
            awareness_state: awareness_state.clone(),
            sender: sender.clone(),
            last_activity: Utc::now(),
        };

        {
            let mut sessions = self.sessions.write().await;
            sessions.insert(session_id, session);
        }

        // Store in database
        sqlx::query(
            r#"
            INSERT INTO collab_sessions (id, document_id, user_id, awareness_state, joined_at, last_activity_at)
            VALUES ($1, $2, $3, $4, NOW(), NOW())
            "#,
        )
        .bind(session_id)
        .bind(document_id)
        .bind(user_id)
        .bind(serde_json::to_value(&awareness_state)?)
        .execute(&self.db)
        .await?;

        // Broadcast user join
        self.broadcast_to_document(document_id, CollabMessage {
            message_type: CollabMessageType::UserJoin,
            document_id,
            user_id,
            payload: serde_json::to_value(&awareness_state)?,
            timestamp: Utc::now(),
        }).await;

        // Send current awareness states to new user
        let states = self.get_awareness_states(document_id).await;
        let _ = sender.send(CollabMessage {
            message_type: CollabMessageType::Awareness,
            document_id,
            user_id,
            payload: serde_json::to_value(AwarenessMessage { states })?,
            timestamp: Utc::now(),
        });

        // Send current document state
        let doc_state_guard = doc_state.lock().await;
        let state_bytes = doc_state_guard.doc.transact().encode_diff_v1(&StateVector::default());
        drop(doc_state_guard);

        let _ = sender.send(CollabMessage {
            message_type: CollabMessageType::Sync,
            document_id,
            user_id,
            payload: serde_json::to_value(SyncMessage {
                doc_state: Some(state_bytes),
                version: 0,
            })?,
            timestamp: Utc::now(),
        });

        Ok(())
    }

    pub async fn leave_session(&self, session_id: Uuid) -> Result<()> {
        let session = {
            let mut sessions = self.sessions.write().await;
            sessions.remove(&session_id)
        };

        if let Some(session) = session {
            // Remove from Yjs awareness
            if let Some((_, doc_state)) = self
                .documents
                .read()
                .await
                .iter()
                .find(|(key, _)| key.0 == session.document_id)
            {
                let guard = doc_state.lock().await;
                guard.awareness.remove_state(session.user_id.as_u128() as u64);
            }

            // Update database
            sqlx::query("DELETE FROM collab_sessions WHERE id = $1")
                .bind(session_id)
                .execute(&self.db)
                .await?;

            // Broadcast user leave
            self.broadcast_to_document(session.document_id, CollabMessage {
                message_type: CollabMessageType::UserLeave,
                document_id: session.document_id,
                user_id: session.user_id,
                payload: serde_json::json!({ "user_id": session.user_id }),
                timestamp: Utc::now(),
            }).await;
        }

        Ok(())
    }

    pub async fn handle_message(&self, session_id: Uuid, message: CollabMessage) -> Result<()> {
        let session = {
            let sessions = self.sessions.read().await;
            sessions.get(&session_id).cloned()
        };

        let session = match session {
            Some(s) => s,
            None => return Err(CoreError::NotFound("Session not found".to_string())),
        };

        // Update last activity
        {
            let mut sessions = self.sessions.write().await;
            if let Some(s) = sessions.get_mut(&session_id) {
                s.last_activity = Utc::now();
            }
        }

        match message.message_type {
            CollabMessageType::DocUpdate => {
                let update_msg: DocUpdateMessage = serde_json::from_value(message.payload)?;
                self.apply_doc_update(&session, update_msg).await?;
            }
            CollabMessageType::AwarenessUpdate => {
                let awareness_state: AwarenessState = serde_json::from_value(message.payload)?;
                self.update_awareness(&session, awareness_state).await?;
            }
            CollabMessageType::Sync => {
                self.send_sync(&session).await?;
            }
            _ => {}
        }

        Ok(())
    }

    async fn apply_doc_update(&self, session: &SessionState, update_msg: DocUpdateMessage) -> Result<()> {
        let doc_state = self.get_document_state(session.document_id).await?;
        
        {
            let update = yrs::Update::decode_v1(&update_msg.update)
                .map_err(|e| CoreError::Internal(e.to_string()))?;
            let mut guard = doc_state.lock().await;
            {
                let mut txn = guard.doc.transact_mut();
                txn.apply_update(update)
                    .map_err(|e| CoreError::Internal(e.to_string()))?;
            }
            guard.dirty = true;
        }

        // Broadcast to other users
        self.broadcast_to_document_except(session.document_id, session.user_id, CollabMessage {
            message_type: CollabMessageType::DocUpdate,
            document_id: session.document_id,
            user_id: session.user_id,
            payload: serde_json::to_value(update_msg)?,
            timestamp: Utc::now(),
        }).await;

        Ok(())
    }

    async fn update_awareness(&self, session: &SessionState, awareness_state: AwarenessState) -> Result<()> {
        let doc_state = self.get_document_state(session.document_id).await?;
        
        {
            let guard = doc_state.lock().await;
            guard
                .awareness
                .set_local_state(serde_json::to_value(&awareness_state)?)
                .map_err(|e| CoreError::Internal(e.to_string()))?;
        }

        // Update session state
        {
            let mut sessions = self.sessions.write().await;
            if let Some(s) = sessions.get_mut(&session.id) {
                s.awareness_state = awareness_state.clone();
            }
        }

        // Broadcast awareness update
        self.broadcast_to_document_except(session.document_id, session.user_id, CollabMessage {
            message_type: CollabMessageType::AwarenessUpdate,
            document_id: session.document_id,
            user_id: session.user_id,
            payload: serde_json::to_value(awareness_state)?,
            timestamp: Utc::now(),
        }).await;

        Ok(())
    }

    async fn send_sync(&self, session: &SessionState) -> Result<()> {
        let doc_state = self.get_document_state(session.document_id).await?;
        let state_bytes = {
            let guard = doc_state.lock().await;
            let txn = guard.doc.transact();
            txn.encode_diff_v1(&StateVector::default())
        };

        let _ = session.sender.send(CollabMessage {
            message_type: CollabMessageType::Sync,
            document_id: session.document_id,
            user_id: session.user_id,
            payload: serde_json::to_value(SyncMessage {
                doc_state: Some(state_bytes),
                version: 0,
            })?,
            timestamp: Utc::now(),
        });

        Ok(())
    }

    async fn broadcast_to_document(&self, document_id: Uuid, message: CollabMessage) {
        let sessions = self.sessions.read().await;
        for session in sessions.values() {
            if session.document_id == document_id {
                let _ = session.sender.send(message.clone());
            }
        }
    }

    async fn broadcast_to_document_except(&self, document_id: Uuid, except_user: Uuid, message: CollabMessage) {
        let sessions = self.sessions.read().await;
        for session in sessions.values() {
            if session.document_id == document_id && session.user_id != except_user {
                let _ = session.sender.send(message.clone());
            }
        }
    }

    async fn get_document_state(&self, document_id: Uuid) -> Result<Arc<Mutex<DocumentState>>> {
        let docs = self.documents.read().await;
        docs.values()
            .find(|d| {
                // We need a way to look up by document_id
                // For now, this is simplified
                true
            })
            .cloned()
            .ok_or(CoreError::NotFound("Document not found".to_string()))
    }

    async fn get_awareness_states(&self, document_id: Uuid) -> Vec<AwarenessState> {
        let sessions = self.sessions.read().await;
        sessions.values()
            .filter(|s| s.document_id == document_id)
            .map(|s| s.awareness_state.clone())
            .collect()
    }

    pub async fn cleanup_inactive_sessions(&self, max_age: std::time::Duration) {
        let cutoff = Utc::now() - chrono::Duration::from_std(max_age).unwrap();
        let mut to_remove = Vec::new();

        {
            let sessions = self.sessions.read().await;
            for (id, session) in sessions.iter() {
                if session.last_activity < cutoff {
                    to_remove.push(*id);
                }
            }
        }

        for id in to_remove {
            let _ = self.leave_session(id).await;
        }
    }
}

fn generate_user_color(user_id: Uuid) -> String {
    // Generate a consistent color based on user ID
    let hash = user_id.as_u128();
    let hue = (hash % 360) as u16;
    format!("hsl({}, 70%, 45%)", hue)
}