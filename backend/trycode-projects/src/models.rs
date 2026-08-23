use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Project {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub visibility: ProjectVisibility,
    pub language: Option<String>,
    pub is_template: bool,
    pub forked_from: Option<Uuid>,
    pub stars_count: i32,
    pub forks_count: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, sqlx::Type)]
#[sqlx(type_name = "project_visibility", rename_all = "snake_case")]
pub enum ProjectVisibility {
    Private,
    Public,
    Unlisted,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ProjectFile {
    pub id: Uuid,
    pub project_id: Uuid,
    pub path: String,
    pub name: String,
    pub is_directory: bool,
    pub parent_id: Option<Uuid>,
    pub content: Option<Vec<u8>>,
    pub size: i64,
    pub mime_type: Option<String>,
    pub encoding: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ProjectCollaborator {
    pub id: Uuid,
    pub project_id: Uuid,
    pub user_id: Uuid,
    pub role: CollaboratorRole,
    pub invited_by: Option<Uuid>,
    pub invited_at: DateTime<Utc>,
    pub accepted_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, sqlx::Type)]
#[sqlx(type_name = "collaborator_role", rename_all = "snake_case")]
pub enum CollaboratorRole {
    Viewer,
    Editor,
    Admin,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ShareLink {
    pub id: Uuid,
    pub project_id: Uuid,
    pub created_by: Uuid,
    pub token: String,
    pub password_hash: Option<String>,
    pub expires_at: Option<DateTime<Utc>>,
    pub max_views: Option<i32>,
    pub view_count: i32,
    #[sqlx(json)]
    pub permissions: SharePermissions,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SharePermissions {
    pub run: bool,
    pub view: bool,
    pub fork: bool,
}

impl Default for SharePermissions {
    fn default() -> Self {
        Self {
            run: true,
            view: true,
            fork: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateProjectRequest {
    pub name: String,
    pub description: Option<String>,
    pub visibility: ProjectVisibility,
    pub language: Option<String>,
    pub is_template: Option<bool>,
    pub template_id: Option<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateProjectRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub visibility: Option<ProjectVisibility>,
    pub language: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateFileRequest {
    pub path: String,
    pub name: String,
    pub is_directory: bool,
    pub parent_id: Option<Uuid>,
    pub content: Option<String>,
    pub mime_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateFileRequest {
    pub path: Option<String>,
    pub name: Option<String>,
    pub content: Option<String>,
    pub mime_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateShareLinkRequest {
    pub password: Option<String>,
    pub expires_at: Option<DateTime<Utc>>,
    pub max_views: Option<i32>,
    pub permissions: Option<SharePermissions>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShareLinkResponse {
    pub token: String,
    pub url: String,
    pub expires_at: Option<DateTime<Utc>>,
    pub permissions: SharePermissions,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InviteCollaboratorRequest {
    pub email: String,
    pub role: CollaboratorRole,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateCollaboratorRequest {
    pub role: CollaboratorRole,
}