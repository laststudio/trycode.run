use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
};
use sqlx::PgPool;
use std::sync::Arc;
use uuid::Uuid;

use crate::{
    fs::FileSystem,
    models::{
        CollaboratorRole, CreateProjectRequest, CreateShareLinkRequest, InviteCollaboratorRequest,
        Project, ProjectFile, ProjectVisibility, ShareLink, ShareLinkResponse, UpdateProjectRequest,
    },
};
use trycode_auth::{AuthExtractor, OptionalAuthExtractor};
use trycode_core::{CoreError, Result};

#[derive(serde::Deserialize)]
pub struct ListProjectsQuery {
    pub visibility: Option<ProjectVisibility>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

pub async fn create_project(
    State(state): State<Arc<ProjectsState>>,
    auth: AuthExtractor,
    Json(payload): Json<CreateProjectRequest>,
) -> Result<(StatusCode, Json<Project>)> {
    let project_id = Uuid::new_v4();
    let now = chrono::Utc::now();

    let project = sqlx::query_as!(Project,
        r#"
        INSERT INTO projects (id, owner_id, name, description, visibility, language, is_template, forked_from, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
        RETURNING *
        "#,
        project_id,
        auth.user.id,
        payload.name,
        payload.description,
        payload.visibility as _,
        payload.language,
        payload.is_template.unwrap_or(false),
        payload.template_id,
        now
    )
    .fetch_one(&state.db)
    .await?;

    // Create default main file
    let ext = get_file_extension(payload.language.as_deref().unwrap_or("txt"));
    state.fs.create_file(project_id, crate::models::CreateFileRequest {
        path: format!("main{}", ext),
        name: format!("main{}", ext),
        is_directory: false,
        parent_id: None,
        content: Some(get_default_template(payload.language.as_deref().unwrap_or("txt"))),
        mime_type: Some(get_mime_type(payload.language.as_deref().unwrap_or("txt"))),
    }, auth.user.id).await?;

    Ok((StatusCode::CREATED, Json(project)))
}

pub async fn get_project(
    State(state): State<Arc<ProjectsState>>,
    auth: OptionalAuthExtractor,
    Path(project_id): Path<Uuid>,
) -> Result<Json<Project>> {
    let project = sqlx::query_as!(Project, "SELECT * FROM projects WHERE id = $1", project_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(CoreError::NotFound("Project not found".to_string()))?;

    // Check access
    if !check_project_access(&state.db, project_id, auth.user.as_ref()).await {
        return Err(CoreError::Forbidden("Access denied".to_string()));
    }

    Ok(Json(project))
}

pub async fn update_project(
    State(state): State<Arc<ProjectsState>>,
    auth: AuthExtractor,
    Path(project_id): Path<Uuid>,
    Json(payload): Json<UpdateProjectRequest>,
) -> Result<Json<Project>> {
    // Check write access
    if !check_project_write_access(&state.db, project_id, &auth.user).await {
        return Err(CoreError::Forbidden("Write access denied".to_string()));
    }

    let project = sqlx::query_as!(Project,
        r#"
        UPDATE projects SET
            name = COALESCE($1, name),
            description = COALESCE($2, description),
            visibility = COALESCE($3, visibility),
            language = COALESCE($4, language),
            updated_at = NOW()
        WHERE id = $5
        RETURNING *
        "#,
        payload.name,
        payload.description,
        payload.visibility as _,
        payload.language,
        project_id
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(CoreError::NotFound("Project not found".to_string()))?;

    Ok(Json(project))
}

pub async fn delete_project(
    State(state): State<Arc<ProjectsState>>,
    auth: AuthExtractor,
    Path(project_id): Path<Uuid>,
) -> Result<StatusCode> {
    // Check ownership
    let project = sqlx::query_as!(Project, "SELECT * FROM projects WHERE id = $1", project_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(CoreError::NotFound("Project not found".to_string()))?;

    if project.owner_id != auth.user.id && auth.user.role != trycode_auth::models::UserRole::Admin {
        return Err(CoreError::Forbidden("Only owner can delete project".to_string()));
    }

    sqlx::query!("DELETE FROM projects WHERE id = $1", project_id)
        .execute(&state.db)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn list_projects(
    State(state): State<Arc<ProjectsState>>,
    auth: OptionalAuthExtractor,
    Query(query): Query<ListProjectsQuery>,
) -> Result<Json<Vec<Project>>> {
    let limit = query.limit.unwrap_or(20).min(100);
    let offset = query.offset.unwrap_or(0);

    let projects = if let Some(user) = auth.user {
        if let Some(visibility) = query.visibility {
            sqlx::query_as!(Project,
                "SELECT * FROM projects WHERE (owner_id = $1 OR visibility = 'public') AND visibility = $2 ORDER BY updated_at DESC LIMIT $3 OFFSET $4",
                user.id, visibility as _, limit as i64, offset as i64
            )
            .fetch_all(&state.db)
            .await?
        } else {
            sqlx::query_as!(Project,
                "SELECT * FROM projects WHERE owner_id = $1 OR visibility = 'public' ORDER BY updated_at DESC LIMIT $2 OFFSET $3",
                user.id, limit as i64, offset as i64
            )
            .fetch_all(&state.db)
            .await?
        }
    } else {
        let visibility = query.visibility.unwrap_or(ProjectVisibility::Public);
        sqlx::query_as!(Project,
            "SELECT * FROM projects WHERE visibility = $1 ORDER BY updated_at DESC LIMIT $2 OFFSET $3",
            visibility as _, limit as i64, offset as i64
        )
        .fetch_all(&state.db)
        .await?
    };

    Ok(Json(projects))
}

pub async fn fork_project(
    State(state): State<Arc<ProjectsState>>,
    auth: AuthExtractor,
    Path(project_id): Path<Uuid>,
) -> Result<(StatusCode, Json<Project>)> {
    let original = sqlx::query_as!(Project, "SELECT * FROM projects WHERE id = $1", project_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(CoreError::NotFound("Project not found".to_string()))?;

    // Check if user can view
    if !check_project_access(&state.db, project_id, Some(&auth.user)).await {
        return Err(CoreError::Forbidden("Cannot fork private project".to_string()));
    }

    let new_project_id = Uuid::new_v4();
    let now = chrono::Utc::now();

    let project = sqlx::query_as!(Project,
        r#"
        INSERT INTO projects (id, owner_id, name, description, visibility, language, is_template, forked_from, created_at, updated_at)
        VALUES ($1, $2, $3, $4, 'private', $5, false, $6, $7, $7)
        RETURNING *
        "#,
        new_project_id,
        auth.user.id,
        format!("{} (fork)", original.name),
        original.description,
        original.language,
        project_id,
        now
    )
    .fetch_one(&state.db)
    .await?;

    // Copy all files
    let files = state.fs.list_all_files(project_id).await?;
    for file in files {
        if !file.is_directory {
            state.fs.create_file(new_project_id, crate::models::CreateFileRequest {
                path: file.path,
                name: file.name,
                is_directory: false,
                parent_id: None, // Would need to handle parent mapping
                content: file.content.map(|c| String::from_utf8_lossy(&c).to_string()),
                mime_type: file.mime_type,
            }, auth.user.id).await?;
        }
    }

    Ok((StatusCode::CREATED, Json(project)))
}

pub async fn list_files(
    State(state): State<Arc<ProjectsState>>,
    auth: OptionalAuthExtractor,
    Path(project_id): Path<Uuid>,
    Query(query): Query<ListFilesQuery>,
) -> Result<Json<Vec<ProjectFile>>> {
    if !check_project_access(&state.db, project_id, auth.user.as_ref()).await {
        return Err(CoreError::Forbidden("Access denied".to_string()));
    }

    let files = if let Some(parent_id) = query.parent_id {
        state.fs.list_files(project_id, Some(parent_id)).await?
    } else {
        state.fs.list_files(project_id, None).await?
    };

    Ok(Json(files))
}

pub async fn get_file(
    State(state): State<Arc<ProjectsState>>,
    auth: OptionalAuthExtractor,
    Path((project_id, file_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<ProjectFile>> {
    if !check_project_access(&state.db, project_id, auth.user.as_ref()).await {
        return Err(CoreError::Forbidden("Access denied".to_string()));
    }

    let file = state.fs.get_file(project_id, file_id).await?;
    Ok(Json(file))
}

pub async fn create_file(
    State(state): State<Arc<ProjectsState>>,
    auth: AuthExtractor,
    Path(project_id): Path<Uuid>,
    Json(payload): Json<crate::models::CreateFileRequest>,
) -> Result<(StatusCode, Json<ProjectFile>)> {
    if !check_project_write_access(&state.db, project_id, &auth.user).await {
        return Err(CoreError::Forbidden("Write access denied".to_string()));
    }

    let file = state.fs.create_file(project_id, payload, auth.user.id).await?;
    Ok((StatusCode::CREATED, Json(file)))
}

pub async fn update_file(
    State(state): State<Arc<ProjectsState>>,
    auth: AuthExtractor,
    Path((project_id, file_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<crate::models::UpdateFileRequest>,
) -> Result<Json<ProjectFile>> {
    if !check_project_write_access(&state.db, project_id, &auth.user).await {
        return Err(CoreError::Forbidden("Write access denied".to_string()));
    }

    let file = state.fs.update_file(project_id, file_id, payload, auth.user.id).await?;
    Ok(Json(file))
}

pub async fn delete_file(
    State(state): State<Arc<ProjectsState>>,
    auth: AuthExtractor,
    Path((project_id, file_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode> {
    if !check_project_write_access(&state.db, project_id, &auth.user).await {
        return Err(CoreError::Forbidden("Write access denied".to_string()));
    }

    state.fs.delete_file(project_id, file_id, auth.user.id).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn move_file(
    State(state): State<Arc<ProjectsState>>,
    auth: AuthExtractor,
    Path((project_id, file_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<MoveFileRequest>,
) -> Result<Json<ProjectFile>> {
    if !check_project_write_access(&state.db, project_id, &auth.user).await {
        return Err(CoreError::Forbidden("Write access denied".to_string()));
    }

    let file = state.fs.move_file(project_id, file_id, payload.new_parent_id, payload.new_name, auth.user.id).await?;
    Ok(Json(file))
}

#[derive(serde::Deserialize)]
pub struct MoveFileRequest {
    pub new_parent_id: Option<Uuid>,
    pub new_name: Option<String>,
}

#[derive(serde::Deserialize)]
pub struct ListFilesQuery {
    pub parent_id: Option<Uuid>,
}

pub async fn create_share_link(
    State(state): State<Arc<ProjectsState>>,
    auth: AuthExtractor,
    Path(project_id): Path<Uuid>,
    Json(payload): Json<CreateShareLinkRequest>,
) -> Result<Json<ShareLinkResponse>> {
    if !check_project_write_access(&state.db, project_id, &auth.user).await {
        return Err(CoreError::Forbidden("Write access denied".to_string()));
    }

    let token = generate_share_token();
    let password_hash = if let Some(password) = payload.password {
        Some(hash_password(&password)?)
    } else {
        None
    };

    let permissions = payload.permissions.unwrap_or_default();

    let share = sqlx::query_as!(ShareLink,
        r#"
        INSERT INTO share_links (project_id, created_by, token, password_hash, expires_at, max_views, permissions)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
        "#,
        project_id,
        auth.user.id,
        token,
        password_hash,
        payload.expires_at,
        payload.max_views,
        serde_json::to_value(permissions)?
    )
    .fetch_one(&state.db)
    .await?;

    Ok(Json(ShareLinkResponse {
        token: share.token,
        url: format!("https://trycode.run/share/{}", share.token),
        expires_at: share.expires_at,
        permissions,
    }))
}

pub async fn get_share_link(
    State(state): State<Arc<ProjectsState>>,
    Path(token): Path<String>,
) -> Result<Json<ShareLink>> {
    let share = sqlx::query_as!(ShareLink,
        "SELECT * FROM share_links WHERE token = $1 AND (expires_at IS NULL OR expires_at > NOW())",
        token
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(CoreError::NotFound("Share link not found or expired".to_string()))?;

    // Increment view count
    sqlx::query!("UPDATE share_links SET view_count = view_count + 1 WHERE id = $1", share.id)
        .execute(&state.db)
        .await?;

    // Check max views
    if let Some(max_views) = share.max_views {
        if share.view_count >= max_views {
            return Err(CoreError::Forbidden("Share link view limit exceeded".to_string()));
        }
    }

    Ok(Json(share))
}

pub async fn verify_share_password(
    State(state): State<Arc<ProjectsState>>,
    Path(token): Path<String>,
    Json(payload): Json<VerifySharePasswordRequest>,
) -> Result<Json<ShareLink>> {
    let share = sqlx::query_as!(ShareLink,
        "SELECT * FROM share_links WHERE token = $1 AND (expires_at IS NULL OR expires_at > NOW())",
        token
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(CoreError::NotFound("Share link not found or expired".to_string()))?;

    if let Some(password_hash) = share.password_hash {
        if !verify_password(&payload.password, &password_hash)? {
            return Err(CoreError::Unauthorized("Invalid password".to_string()));
        }
    }

    // Increment view count
    sqlx::query!("UPDATE share_links SET view_count = view_count + 1 WHERE id = $1", share.id)
        .execute(&state.db)
        .await?;

    Ok(Json(share))
}

#[derive(serde::Deserialize)]
pub struct VerifySharePasswordRequest {
    pub password: String,
}

pub async fn invite_collaborator(
    State(state): State<Arc<ProjectsState>>,
    auth: AuthExtractor,
    Path(project_id): Path<Uuid>,
    Json(payload): Json<InviteCollaboratorRequest>,
) -> Result<StatusCode> {
    if !check_project_write_access(&state.db, project_id, &auth.user).await {
        return Err(CoreError::Forbidden("Write access denied".to_string()));
    }

    // Find user by email
    let invited_user = sqlx::query_as!(trycode_auth::models::User,
        "SELECT * FROM users WHERE email = $1", payload.email
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(CoreError::NotFound("User not found".to_string()))?;

    if invited_user.id == auth.user.id {
        return Err(CoreError::Validation("Cannot invite yourself".to_string()));
    }

    sqlx::query!(
        r#"
        INSERT INTO project_collaborators (project_id, user_id, role, invited_by, invited_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (project_id, user_id) DO UPDATE SET
            role = EXCLUDED.role,
            invited_by = EXCLUDED.invited_by,
            invited_at = EXCLUDED.invited_at,
            accepted_at = NULL
        "#,
        project_id,
        invited_user.id,
        payload.role as _,
        auth.user.id
    )
    .execute(&state.db)
    .await?;

    // TODO: Send invitation email

    Ok(StatusCode::CREATED)
}

pub async fn list_collaborators(
    State(state): State<Arc<ProjectsState>>,
    auth: AuthExtractor,
    Path(project_id): Path<Uuid>,
) -> Result<Json<Vec<crate::models::ProjectCollaborator>>> {
    if !check_project_write_access(&state.db, project_id, &auth.user).await {
        return Err(CoreError::Forbidden("Access denied".to_string()));
    }

    let collaborators = sqlx::query_as!(crate::models::ProjectCollaborator,
        "SELECT * FROM project_collaborators WHERE project_id = $1 ORDER BY invited_at DESC",
        project_id
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(collaborators))
}

pub async fn update_collaborator(
    State(state): State<Arc<ProjectsState>>,
    auth: AuthExtractor,
    Path((project_id, user_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<crate::models::UpdateCollaboratorRequest>,
) -> Result<StatusCode> {
    if !check_project_write_access(&state.db, project_id, &auth.user).await {
        return Err(CoreError::Forbidden("Write access denied".to_string()));
    }

    sqlx::query!(
        "UPDATE project_collaborators SET role = $1 WHERE project_id = $2 AND user_id = $3",
        payload.role as _, project_id, user_id
    )
    .execute(&state.db)
    .await?;

    Ok(StatusCode::OK)
}

pub async fn remove_collaborator(
    State(state): State<Arc<ProjectsState>>,
    auth: AuthExtractor,
    Path((project_id, user_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode> {
    if !check_project_write_access(&state.db, project_id, &auth.user).await {
        return Err(CoreError::Forbidden("Write access denied".to_string()));
    }

    sqlx::query!("DELETE FROM project_collaborators WHERE project_id = $1 AND user_id = $2", project_id, user_id)
        .execute(&state.db)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

async fn check_project_access(db: &PgPool, project_id: Uuid, user: Option<&trycode_auth::models::User>) -> bool {
    let project = sqlx::query!("SELECT owner_id, visibility FROM projects WHERE id = $1", project_id)
        .fetch_optional(db)
        .await
        .ok()
        .flatten();

    if let Some(project) = project {
        if let Some(user) = user {
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

fn generate_share_token() -> String {
    use rand::Rng;
    const CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let mut rng = rand::thread_rng();
    (0..32).map(|_| CHARSET[rng.gen_range(0..CHARSET.len())] as char).collect()
}

fn get_file_extension(language: &str) -> &'static str {
    match language {
        "python" => ".py",
        "javascript" => ".js",
        "typescript" => ".ts",
        "rust" => ".rs",
        "go" => ".go",
        "java" => ".java",
        "cpp" => ".cpp",
        "c" => ".c",
        "csharp" => ".cs",
        "php" => ".php",
        "ruby" => ".rb",
        "swift" => ".swift",
        "kotlin" => ".kt",
        "scala" => ".scala",
        "r" => ".r",
        "lua" => ".lua",
        "perl" => ".pl",
        "dart" => ".dart",
        "zig" => ".zig",
        "julia" => ".jl",
        "haskell" => ".hs",
        "fortran" => ".f90",
        "objectivec" => ".m",
        "vbnet" => ".vb",
        "fsharp" => ".fs",
        "groovy" => ".groovy",
        "html" => ".html",
        "sql" => ".sql",
        "bash" => ".sh",
        "powershell" => ".ps1",
        _ => ".txt",
    }
}

fn get_mime_type(language: &str) -> &'static str {
    match language {
        "python" => "text/x-python",
        "javascript" => "application/javascript",
        "typescript" => "application/typescript",
        "rust" => "text/rust",
        "go" => "text/x-go",
        "java" => "text/x-java",
        "cpp" => "text/x-c++",
        "c" => "text/x-c",
        "csharp" => "text/x-csharp",
        "php" => "text/x-php",
        "ruby" => "text/x-ruby",
        "swift" => "text/x-swift",
        "kotlin" => "text/x-kotlin",
        "scala" => "text/x-scala",
        "r" => "text/x-r",
        "lua" => "text/x-lua",
        "perl" => "text/x-perl",
        "dart" => "application/dart",
        "zig" => "text/x-zig",
        "julia" => "text/x-julia",
        "haskell" => "text/x-haskell",
        "fortran" => "text/x-fortran",
        "objectivec" => "text/x-objective-c",
        "vbnet" => "text/x-vb",
        "fsharp" => "text/x-fsharp",
        "groovy" => "text/x-groovy",
        "html" => "text/html",
        "sql" => "text/x-sql",
        "bash" => "application/x-shellscript",
        "powershell" => "text/x-powershell",
        _ => "text/plain",
    }
}

fn get_default_template(language: &str) -> String {
    match language {
        "python" => "# Python Template\nprint(\"Hello, World!\")\n",
        "javascript" => "// JavaScript Template\nconsole.log(\"Hello, World!\");\n",
        "typescript" => "// TypeScript Template\nconsole.log(\"Hello, World!\");\n",
        "rust" => "// Rust Template\nfn main() {\n    println!(\"Hello, World!\");\n}\n",
        "go" => "// Go Template\npackage main\n\nimport \"fmt\"\n\nfunc main() {\n    fmt.Println(\"Hello, World!\")\n}\n",
        "java" => "// Java Template\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println(\"Hello, World!\");\n    }\n}\n",
        "cpp" => "// C++ Template\n#include <iostream>\n\nint main() {\n    std::cout << \"Hello, World!\" << std::endl;\n    return 0;\n}\n",
        "c" => "// C Template\n#include <stdio.h>\n\nint main() {\n    printf(\"Hello, World!\\n\");\n    return 0;\n}\n",
        "csharp" => "// C# Template\nusing System;\n\nclass Program {\n    static void Main() {\n        Console.WriteLine(\"Hello, World!\");\n    }\n}\n",
        "php" => "<?php\n// PHP Template\necho \"Hello, World!\\n\";\n",
        "ruby" => "# Ruby Template\nputs \"Hello, World!\"\n",
        "swift" => "// Swift Template\nprint(\"Hello, World!\")\n",
        "kotlin" => "// Kotlin Template\nfun main() {\n    println(\"Hello, World!\")\n}\n",
        "scala" => "// Scala Template\nobject Main {\n    def main(args: Array[String]): Unit = {\n        println(\"Hello, World!\")\n    }\n}\n",
        "r" => "# R Template\ncat(\"Hello, World!\\n\")\n",
        "lua" => "-- Lua Template\nprint(\"Hello, World!\")\n",
        "perl" => "# Perl Template\nprint \"Hello, World!\\n\";\n",
        "dart" => "// Dart Template\nvoid main() {\n  print('Hello, World!');\n}\n",
        "zig" => "// Zig Template\nconst std = @import(\"std\");\n\npub fn main() !void {\n    std.debug.print(\"Hello, World!\\n\", .{});\n}\n",
        "julia" => "# Julia Template\nprintln(\"Hello, World!\")\n",
        "haskell" => "-- Haskell Template\nmain :: IO ()\nmain = putStrLn \"Hello, World!\"\n",
        "fortran" => "! Fortran Template\nprogram main\n    print *, \"Hello, World!\"\nend program main\n",
        "objectivec" => "// Objective-C Template\n#import <Foundation/Foundation.h>\n\nint main(int argc, const char * argv[]) {\n    @autoreleasepool {\n        NSLog(@\"Hello, World!\");\n    }\n    return 0;\n}\n",
        "vbnet" => "' VB.NET Template\nModule Program\n    Sub Main()\n        Console.WriteLine(\"Hello, World!\")\n    End Sub\nEnd Module\n",
        "fsharp" => "// F# Template\nprintfn \"Hello, World!\"\n",
        "groovy" => "// Groovy Template\nprintln \"Hello, World!\"\n",
        "html" => "<!DOCTYPE html>\n<html>\n<head>\n    <title>Hello</title>\n</head>\n<body>\n    <h1>Hello, World!</h1>\n</body>\n</html>",
        "sql" => "-- SQL Template\nSELECT 'Hello, World!' as message;\n",
        "bash" => "#!/bin/bash\n# Bash Template\necho \"Hello, World!\"\n",
        "powershell" => "# PowerShell Template\nWrite-Host \"Hello, World!\"\n",
        _ => "// Template\n// Hello, World!\n",
    }
}

use trycode_auth::models::User;