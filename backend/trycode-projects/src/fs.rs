use sqlx::PgPool;
use std::path::Path;
use uuid::Uuid;

use crate::models::{ProjectFile, CreateFileRequest, UpdateFileRequest};
use trycode_core::{CoreError, Result};

pub struct FileSystem {
    db: PgPool,
    max_file_size: usize,
    max_total_size: usize,
}

impl FileSystem {
    pub fn new(db: PgPool, max_file_size: usize, max_total_size: usize) -> Self {
        Self {
            db,
            max_file_size,
            max_total_size,
        }
    }

    pub async fn create_file(&self, project_id: Uuid, request: CreateFileRequest, user_id: Uuid) -> Result<ProjectFile> {
        // Validate path
        let normalized_path = normalize_path(&request.path);
        if normalized_path.is_empty() {
            return Err(CoreError::Validation("Invalid file path".to_string()));
        }

        // Check if parent exists
        if let Some(parent_id) = request.parent_id {
            let parent = self.get_file(project_id, parent_id).await?;
            if !parent.is_directory {
                return Err(CoreError::Validation("Parent is not a directory".to_string()));
            }
        }

        // Check if path already exists
        let existing = sqlx::query_as!(ProjectFile,
            "SELECT * FROM project_files WHERE project_id = $1 AND path = $2",
            project_id, normalized_path
        )
        .fetch_optional(&self.db)
        .await?;

        if existing.is_some() {
            return Err(CoreError::Conflict("File already exists".to_string()));
        }

        // Calculate size
        let content_bytes = request.content.as_deref().unwrap_or("").as_bytes();
        let size = content_bytes.len() as i64;

        if size > self.max_file_size as i64 {
            return Err(CoreError::Validation("File size exceeds limit".to_string()));
        }

        // Check total project size
        let total_size: Option<i64> = sqlx::query_scalar!(
            "SELECT COALESCE(SUM(size), 0) FROM project_files WHERE project_id = $1",
            project_id
        )
        .fetch_one(&self.db)
        .await?;

        if (total_size.unwrap_or(0) + size) > self.max_total_size as i64 {
            return Err(CoreError::Validation("Project size limit exceeded".to_string()));
        }

        let file_id = Uuid::new_v4();
        let now = chrono::Utc::now();

        let file = sqlx::query_as!(ProjectFile,
            r#"
            INSERT INTO project_files (id, project_id, path, name, is_directory, parent_id, content, size, mime_type, encoding, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'utf-8', $10, $10)
            RETURNING *
            "#,
            file_id,
            project_id,
            normalized_path,
            request.name,
            request.is_directory,
            request.parent_id,
            request.content.as_deref().map(|s| s.as_bytes().to_vec()),
            size,
            request.mime_type,
            now
        )
        .fetch_one(&self.db)
        .await?;

        Ok(file)
    }

    pub async fn get_file(&self, project_id: Uuid, file_id: Uuid) -> Result<ProjectFile> {
        let file = sqlx::query_as!(ProjectFile,
            "SELECT * FROM project_files WHERE project_id = $1 AND id = $2",
            project_id, file_id
        )
        .fetch_optional(&self.db)
        .await?
        .ok_or(CoreError::NotFound("File not found".to_string()))?;

        Ok(file)
    }

    pub async fn get_file_by_path(&self, project_id: Uuid, path: &str) -> Result<ProjectFile> {
        let normalized = normalize_path(path);
        let file = sqlx::query_as!(ProjectFile,
            "SELECT * FROM project_files WHERE project_id = $1 AND path = $2",
            project_id, normalized
        )
        .fetch_optional(&self.db)
        .await?
        .ok_or(CoreError::NotFound("File not found".to_string()))?;

        Ok(file)
    }

    pub async fn list_files(&self, project_id: Uuid, parent_id: Option<Uuid>) -> Result<Vec<ProjectFile>> {
        let files = if let Some(parent_id) = parent_id {
            sqlx::query_as!(ProjectFile,
                "SELECT * FROM project_files WHERE project_id = $1 AND parent_id = $2 ORDER BY is_directory DESC, name ASC",
                project_id, parent_id
            )
            .fetch_all(&self.db)
            .await?
        } else {
            sqlx::query_as!(ProjectFile,
                "SELECT * FROM project_files WHERE project_id = $1 AND parent_id IS NULL ORDER BY is_directory DESC, name ASC",
                project_id
            )
            .fetch_all(&self.db)
            .await?
        };

        Ok(files)
    }

    pub async fn list_all_files(&self, project_id: Uuid) -> Result<Vec<ProjectFile>> {
        let files = sqlx::query_as!(ProjectFile,
            "SELECT * FROM project_files WHERE project_id = $1 ORDER BY path ASC",
            project_id
        )
        .fetch_all(&self.db)
        .await?;

        Ok(files)
    }

    pub async fn update_file(&self, project_id: Uuid, file_id: Uuid, request: UpdateFileRequest, user_id: Uuid) -> Result<ProjectFile> {
        let mut file = self.get_file(project_id, file_id).await?;

        if file.is_directory {
            return Err(CoreError::Validation("Cannot update directory content".to_string()));
        }

        if let Some(new_path) = request.path {
            let normalized = normalize_path(&new_path);
            if normalized != file.path {
                // Check if new path exists
                let existing = sqlx::query_as!(ProjectFile,
                    "SELECT * FROM project_files WHERE project_id = $1 AND path = $2 AND id != $3",
                    project_id, normalized, file_id
                )
                .fetch_optional(&self.db)
                .await?;

                if existing.is_some() {
                    return Err(CoreError::Conflict("File already exists at path".to_string()));
                }
                file.path = normalized;
            }
        }

        if let Some(name) = request.name {
            file.name = name;
        }

        if let Some(content) = request.content {
            let content_bytes = content.as_bytes();
            let size = content_bytes.len() as i64;

            if size > self.max_file_size as i64 {
                return Err(CoreError::Validation("File size exceeds limit".to_string()));
            }

            // Check total project size
            let total_size: Option<i64> = sqlx::query_scalar!(
                "SELECT COALESCE(SUM(size), 0) FROM project_files WHERE project_id = $1 AND id != $2",
                project_id, file_id
            )
            .fetch_one(&self.db)
            .await?;

            if (total_size.unwrap_or(0) + size) > self.max_total_size as i64 {
                return Err(CoreError::Validation("Project size limit exceeded".to_string()));
            }

            file.content = Some(content_bytes.to_vec());
            file.size = size;
        }

        if let Some(mime_type) = request.mime_type {
            file.mime_type = Some(mime_type);
        }

        file.updated_at = chrono::Utc::now();

        sqlx::query!(
            r#"
            UPDATE project_files SET path = $1, name = $2, content = $3, size = $4, mime_type = $5, updated_at = $6
            WHERE id = $7
            "#,
            file.path,
            file.name,
            file.content,
            file.size,
            file.mime_type,
            file.updated_at,
            file_id
        )
        .execute(&self.db)
        .await?;

        Ok(file)
    }

    pub async fn delete_file(&self, project_id: Uuid, file_id: Uuid, user_id: Uuid) -> Result<()> {
        let file = self.get_file(project_id, file_id).await?;

        if file.is_directory {
            // Check if directory is empty
            let children = sqlx::query_as!(ProjectFile,
                "SELECT * FROM project_files WHERE project_id = $1 AND parent_id = $2",
                project_id, file_id
            )
            .fetch_all(&self.db)
            .await?;

            if !children.is_empty() {
                return Err(CoreError::Validation("Directory not empty".to_string()));
            }
        }

        sqlx::query!("DELETE FROM project_files WHERE id = $1", file_id)
            .execute(&self.db)
            .await?;

        Ok(())
    }

    pub async fn move_file(&self, project_id: Uuid, file_id: Uuid, new_parent_id: Option<Uuid>, new_name: Option<String>, user_id: Uuid) -> Result<ProjectFile> {
        let mut file = self.get_file(project_id, file_id).await?;

        // Check for cycles if moving directory
        if file.is_directory && new_parent_id.is_some() {
            let mut current = new_parent_id;
            while let Some(pid) = current {
                if pid == file_id {
                    return Err(CoreError::Validation("Cannot move directory into itself".to_string()));
                }
                let parent = self.get_file(project_id, pid).await?;
                current = parent.parent_id;
            }
        }

        if let Some(parent_id) = new_parent_id {
            let parent = self.get_file(project_id, parent_id).await?;
            if !parent.is_directory {
                return Err(CoreError::Validation("Target is not a directory".to_string()));
            }
            file.parent_id = Some(parent_id);
        } else {
            file.parent_id = None;
        }

        if let Some(name) = new_name {
            file.name = name;
        }

        // Update path
        file.path = build_path(&self.db, project_id, file.parent_id, &file.name).await?;
        
        // If directory, update all children paths
        if file.is_directory {
            update_children_paths(&self.db, project_id, file_id, &file.path).await?;
        }

        file.updated_at = chrono::Utc::now();

        sqlx::query!(
            r#"
            UPDATE project_files SET parent_id = $1, name = $2, path = $3, updated_at = $4
            WHERE id = $5
            "#,
            file.parent_id,
            file.name,
            file.path,
            file.updated_at,
            file_id
        )
        .execute(&self.db)
        .await?;

        Ok(file)
    }
}

fn normalize_path(path: &str) -> String {
    let path = path.trim().trim_start_matches('/');
    if path.is_empty() {
        return String::new();
    }
    // Remove any '..' or '.' components
    let components: Vec<&str> = path.split('/').filter(|c| !c.is_empty() && *c != "." && *c != "..").collect();
    components.join("/")
}

async fn build_path(db: &PgPool, project_id: Uuid, parent_id: Option<Uuid>, name: &str) -> Result<String> {
    if let Some(parent_id) = parent_id {
        let parent = sqlx::query_as!(ProjectFile,
            "SELECT path FROM project_files WHERE id = $1", parent_id
        )
        .fetch_one(db)
        .await?;
        Ok(format!("{}/{}", parent.path, name))
    } else {
        Ok(name.to_string())
    }
}

async fn update_children_paths(db: &PgPool, project_id: Uuid, parent_id: Uuid, new_parent_path: &str) -> Result<()> {
    let children = sqlx::query_as!(ProjectFile,
        "SELECT id, name, is_directory FROM project_files WHERE project_id = $1 AND parent_id = $2",
        project_id, parent_id
    )
    .fetch_all(db)
    .await?;

    for child in children {
        let new_path = format!("{}/{}", new_parent_path, child.name);
        
        sqlx::query!("UPDATE project_files SET path = $1 WHERE id = $2", new_path, child.id)
            .execute(db)
            .await?;

        if child.is_directory {
            update_children_paths(db, project_id, child.id, &new_path).await?;
        }
    }

    Ok(())
}