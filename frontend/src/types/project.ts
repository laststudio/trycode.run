export interface Project {
  id: string;
  owner_id: string;
  name: string;
  description?: string;
  visibility: 'private' | 'public' | 'unlisted';
  language?: string;
  is_template: boolean;
  forked_from?: string;
  stars_count: number;
  forks_count: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectFile {
  id: string;
  project_id: string;
  path: string;
  name: string;
  is_directory: boolean;
  parent_id?: string;
  content?: string;
  size: number;
  mime_type?: string;
  encoding: string;
  created_at: string;
  updated_at: string;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  visibility: 'private' | 'public' | 'unlisted';
  language?: string;
  is_template?: boolean;
  template_id?: string;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  visibility?: 'private' | 'public' | 'unlisted';
  language?: string;
}

export interface CreateFileRequest {
  path: string;
  name: string;
  is_directory: boolean;
  parent_id?: string;
  content?: string;
  mime_type?: string;
}

export interface UpdateFileRequest {
  path?: string;
  name?: string;
  content?: string;
  mime_type?: string;
}

export interface ShareLink {
  id: string;
  project_id: string;
  created_by: string;
  token: string;
  password_hash?: string;
  expires_at?: string;
  max_views?: number;
  view_count: number;
  permissions: SharePermissions;
  created_at: string;
}

export interface SharePermissions {
  run: boolean;
  view: boolean;
  fork: boolean;
}

export interface CreateShareLinkRequest {
  password?: string;
  expires_at?: string;
  max_views?: number;
  permissions?: SharePermissions;
}

export interface ShareLinkResponse {
  token: string;
  url: string;
  expires_at?: string;
  permissions: SharePermissions;
}

export interface Collaborator {
  id: string;
  project_id: string;
  user_id: string;
  role: 'viewer' | 'editor' | 'admin';
  invited_by?: string;
  invited_at: string;
  accepted_at?: string;
  user?: {
    id: string;
    name: string;
    email: string;
    avatar_url?: string;
  };
}

export interface InviteCollaboratorRequest {
  email: string;
  role: 'viewer' | 'editor' | 'admin';
}

export interface UpdateCollaboratorRequest {
  role: 'viewer' | 'editor' | 'admin';
}