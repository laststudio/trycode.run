use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CollabDocument {
    pub id: Uuid,
    pub project_id: Uuid,
    pub file_path: String,
    pub ydoc_state: Option<Vec<u8>>,
    pub version: i64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CollabSession {
    pub id: Uuid,
    pub document_id: Uuid,
    pub user_id: Uuid,
    pub awareness_state: Option<serde_json::Value>,
    pub joined_at: DateTime<Utc>,
    pub last_activity_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AwarenessState {
    pub user_id: Uuid,
    pub user_name: String,
    pub user_color: String,
    pub cursor: Option<CursorPosition>,
    pub selection: Option<SelectionRange>,
    pub last_seen: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CursorPosition {
    pub line: u32,
    pub column: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SelectionRange {
    pub start_line: u32,
    pub start_column: u32,
    pub end_line: u32,
    pub end_column: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CollabMessage {
    pub message_type: CollabMessageType,
    pub document_id: Uuid,
    pub user_id: Uuid,
    pub payload: serde_json::Value,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CollabMessageType {
    Sync,
    Awareness,
    AwarenessUpdate,
    DocUpdate,
    UserJoin,
    UserLeave,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncMessage {
    pub doc_state: Option<Vec<u8>>, // Yjs encoded state
    pub version: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AwarenessMessage {
    pub states: Vec<AwarenessState>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocUpdateMessage {
    pub update: Vec<u8>, // Yjs encoded update
    pub version: i64,
}