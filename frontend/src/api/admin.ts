import { api } from '../utils/api';

export interface AdminStats {
  total_users: number;
  active_users_24h: number;
  new_users_24h: number;
  total_projects: number;
  total_executions: number;
  executions_24h: number;
  success_rate_24h: number;
  avg_execution_time_ms: number;
  languages_usage: LanguageUsage[];
  executions_by_status: StatusCount[];
}

export interface LanguageUsage {
  language: string;
  count: number;
  success_rate: number;
  avg_time_ms: number;
}

export interface StatusCount {
  status: string;
  count: number;
}

export interface UserAdminView {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  email_verified: boolean;
  created_at: string;
  last_login_at?: string;
  total_executions: number;
  executions_24h: number;
  is_locked: boolean;
}

export interface ExecutionDetail {
  id: string;
  user_id: string;
  user_email: string;
  project_id?: string;
  language: string;
  status: string;
  source_code: string;
  stdout?: string;
  stderr?: string;
  exit_code?: number;
  cpu_time_ms?: number;
  wall_time_ms?: number;
  memory_peak_mb?: number;
  executor_worker_id?: number;
  wasm_attempted: boolean;
  wasm_fallback_reason?: string;
  error_message?: string;
  queued_at: string;
  started_at?: string;
  completed_at?: string;
}

export interface AuditLogEntry {
  id: number;
  user_id?: string;
  user_email?: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  old_value?: any;
  new_value?: any;
  ip_address?: string;
  user_agent?: string;
  metadata?: any;
  created_at: string;
}

export interface SystemConfig {
  key: string;
  value: any;
  description?: string;
  category: string;
  is_secret: boolean;
  updated_by?: string;
  updated_at: string;
  created_at: string;
}

export async function get_admin_stats(): Promise<AdminStats> {
  const response = await api.get<AdminStats>('/api/admin/stats');
  return response.data;
}

export async function get_system_status(): Promise<any> {
  const response = await api.get('/api/admin/status');
  return response.data;
}

export async function list_users_admin(params?: { limit?: number; offset?: number }): Promise<UserAdminView[]> {
  const response = await api.get<UserAdminView[]>('/api/admin/users', { params });
  return response.data;
}

export async function update_user_admin(userId: string, data: any): Promise<UserAdminView> {
  const response = await api.put<UserAdminView>(`/api/admin/users/${userId}`, data);
  return response.data;
}

export async function list_executions_admin(params?: any): Promise<ExecutionDetail[]> {
  const response = await api.get<ExecutionDetail[]>('/api/admin/executions', { params });
  return response.data;
}

export async function get_execution_admin(executionId: string): Promise<ExecutionDetail> {
  const response = await api.get<ExecutionDetail>(`/api/admin/executions/${executionId}`);
  return response.data;
}

export async function list_audit_logs(params?: any): Promise<AuditLogEntry[]> {
  const response = await api.get<AuditLogEntry[]>('/api/admin/audit-logs', { params });
  return response.data;
}

export async function get_system_config(): Promise<any[]> {
  const response = await api.get('/api/admin/config');
  return response.data;
}

export async function update_system_config(key: string, value: any): Promise<any> {
  const response = await api.put(`/api/admin/config/${key}`, { value });
  return response.data;
}

export async function test_smtp(): Promise<{ success: boolean; message: string }> {
  const response = await api.post('/api/admin/test/smtp', {});
  return response.data;
}

export async function test_captcha(token: string): Promise<{ success: boolean; message: string }> {
  const response = await api.post('/api/admin/test/captcha', { token });
  return response.data;
}

export async function test_oauth(): Promise<{ success: boolean; message: string; auth_url?: string }> {
  const response = await api.post('/api/admin/test/oauth', {});
  return response.data;
}

export async function test_database(): Promise<{ success: boolean; message: string; latency_ms: number }> {
  const response = await api.post('/api/admin/test/database', {});
  return response.data;
}

export async function initialize_super_admin(data: {
  email: string;
  password: string;
  name: string;
  captcha_token: string;
}): Promise<any> {
  const response = await api.post('/api/admin/init-super-admin', data);
  return response.data;
}

export async function trigger_config_reload(): Promise<void> {
  await api.post('/api/admin/reload-config', {});
}