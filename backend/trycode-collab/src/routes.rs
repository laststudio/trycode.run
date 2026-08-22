use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
};
use sqlx::PgPool;
use std::sync::Arc;
use uuid::Uuid;

use crate::models::CollabDocument;
use trycode_auth::AuthExtractor;
use trycode_core::{CoreError, Result};

pub async fn get_collab_document(
    State(state): State<Arc<CollabState>>,
    auth: AuthExtractor,
    Path((project_id, file_path)): Path<(Uuid, String)>,
) -> Result<Json<CollabDocument>> {
    // Check project access
    if !check_project_access(&state.db, project_id, &auth.user).await {
        return Err(CoreError::Forbidden("Access denied".to_string()));
    }

    let doc = sqlx::query_as!(
        CollabDocument,
        "SELECT * FROM collab_documents WHERE project_id = $1 AND file_path = $2",
        project_id,
        file_path
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(CoreError::NotFound("Document not found".to_string()))?;

    Ok(Json(doc))
}

pub async fn create_collab_document(
    State(state): State<Arc<CollabState>>,
    auth: AuthExtractor,
    Path(project_id): Path<Uuid>,
    Json(payload): Json<CreateCollabDocumentRequest>,
) -> Result<(StatusCode, Json<CollabDocument>)> {
    // Check project write access
    if !check_project_write_access(&state.db, project_id, &auth.user).await {
        return Err(CoreError::Forbidden("Write access denied".to_string()));
    }

    let doc = sqlx::query_as!(
        CollabDocument,
        r#"
        INSERT INTO collab_documents (project_id, file_path, ydoc_state, version)
        VALUES ($1, $2, $3, 0)
        ON CONFLICT (project_id, file_path) DO UPDATE SET
            ydoc_state = EXCLUDED.ydoc_state,
            version = EXCLUDED.version,
            updated_at = NOW()
        RETURNING *
        "#,
        project_id,
        payload.file_path,
        payload.initial_state
    )
    .fetch_one(&state.db)
    .await?;

    Ok((StatusCode::CREATED, Json(doc)))
}

#[derive(serde::Deserialize)]
pub struct CreateCollabDocumentRequest {
    pub file_path: String,
    pub initial_state: Option<Vec<u8>>,
}

async fn check_project_access(db: &PgPool, project_id: Uuid, user: &trycode_auth::models::User) -> bool {
    let project = sqlx::query!("SELECT owner_id, visibility FROM projects WHERE id = $1", project_id)
        .fetch_optional(db)
        .await
        .ok()
        .flatten();

    if let Some(project) = project {
        if project.owner_id == user.id {
            return true;
        }

        let collab = sqlx::query!(
            "SELECT 1 FROM project_collaborators WHERE project_id = $1 AND user_id = $2 AND accepted_at IS NOT NULL",
            project_id, user.id
        )
        .fetch_optional(db)
        .await
        .ok()
        .flatten();

        if collab.is_some() {
            return true;
        }

        if project.visibility == "public" {
            return true;
        }
    }

    false
}

async fn check_project_write_access(db: &PgPool, project_id: Uuid, user: &trycode_auth::models::User) -> bool {
    let project = sqlx::query!("SELECT owner_id FROM projects WHERE id = $1", project_id)
        .fetch_optional(db)
        .await
        .ok()
        .flatten();

    if let Some(project) = project {
        if project.owner_id == user.id {
            return true;
        }

        let collab = sqlx::query!(
            "SELECT 1 FROM project_collaborators WHERE project_id = $1 AND user_id = $2 AND role IN ('editor', 'admin') AND accepted_at IS NOT NULL",
            project_id, user.id
        )
        .fetch_optional(db)
        .await
        .ok()
        .flatten();

        return collab.is_some();
    }

    false
}

pub struct CollabState {
    pub db: PgPool,
    pub broker: Arc<crate::broker::YrsBroker>,
}