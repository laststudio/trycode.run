use chrono::{DateTime, Utc};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{mpsc, Mutex, RwLock};
use tracing::{debug, error, info, warn};
use uuid::Uuid;

use crate::models::{
    AwarenessMessage, AwarenessState, CollabDocument, CollabMessage, CollabMessageType,
    CollabSession, DocUpdateMessage, SyncMessage,
};
use trycode_core::{CoreError, Result};

pub struct YrsBroker {
    documents: Arc<RwLock<HashMap<Uuid, DocumentState>>>,
    sessions: Arc<RwLock<HashMap<Uuid, SessionState>>>,
    db: sqlx::PgPool,
    persistence_interval: std::time::Duration,
}

struct DocumentState {
    doc: yrs::Doc,
    awareness: yrs::Awareness,
    sessions: HashMap<Uuid, SessionState>,
    last_persisted_version: i64,
    dirty: bool,
}

struct SessionState {
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
        let db_doc = sqlx::query_as!(
            CollabDocument,
            "SELECT * FROM collab_documents WHERE project_id = $1 AND file_path = $2",
            project_id,
            file_path
        )
        .fetch_optional(&self.db)
        .await?;

        let doc = yrs::Doc::new();
        let awareness = yrs::Awareness::new(doc.clone());

        if let Some(db_doc) = db_doc {
            if let Some(state_bytes) = db_doc.ydoc_state {
                if let Err(e) = yrs::updates::decode_state(&doc, &state_bytes) {
                    warn!("Failed to decode Yjs state for {}/{}: {}", project_id, file_path, e);
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
                        yrs::updates::encode_state(&guard.doc)
                    };

                    if let Err(e) = sqlx::query!(
                        r#"
                        INSERT INTO collab_documents (project_id, file_path, ydoc_state, version, updated_at)
                        VALUES ($1, $2, $3, $4, NOW())
                        ON CONFLICT (project_id, file_path) DO UPDATE SET
                            ydoc_state = EXCLUDED.ydoc_state,
                            version = EXCLUDED.version,
                            updated_at = NOW()
                        "#,
                        project_id,
                        file_path,
                        state_bytes,
                        0 // version would need to be tracked
                    )
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
            let mut guard = doc_state.lock().await;
            let awareness = guard.awareness.clone();
            let mut local_awareness = awareness.lock();
            local_awareness.set_local_state(serde_json::to_value(&awareness_state)?);
        }

        // Store session
        let session = SessionState {
            user_id,
            document_id,
            awareness_state: awareness_state.clone(),
            sender,
            last_activity: Utc::now(),
        };

        {
            let mut sessions = self.sessions.write().await;
            sessions.insert(session_id, session);
        }

        // Store in database
        sqlx::query!(
            r#"
            INSERT INTO collab_sessions (id, document_id, user_id, awareness_state, joined_at, last_activity_at)
            VALUES ($1, $2, $3, $4, NOW(), NOW())
            "#,
            session_id,
            document_id,
            user_id,
            serde_json::to_value(&awareness_state)?
        )
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
        let state_bytes = yrs::updates::encode_state(&doc_state_guard.doc);
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
            if let Some(doc_state) = self.documents.read().await.get(&session.document_id) {
                let mut guard = doc_state.lock().await;
                let awareness = guard.awareness.clone();
                let mut local_awareness = awareness.lock();
                local_awareness.remove_user(session.user_id);
            }

            // Update database
            sqlx::query!("DELETE FROM collab_sessions WHERE id = $1", session_id)
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
            let mut guard = doc_state.lock().await;
            yrs::updates::decode_update(&guard.doc, &update_msg.update)?;
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
            let mut guard = doc_state.lock().await;
            let awareness = guard.awareness.clone();
            let mut local_awareness = awareness.lock();
            local_awareness.set_local_state(serde_json::to_value(&awareness_state)?);
        }

        // Update session state
        {
            let mut sessions = self.sessions.write().await;
            if let Some(s) = sessions.get_mut(&session_id) {
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
            yrs::updates::encode_state(&guard.doc)
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