export interface ExecuteRequest {
  code: string;
  language: string;
  stdin?: string;
  files?: ExecuteFile[];
  project_id?: string;
  timeout_secs?: number;
}

export interface ExecuteFile {
  path: string;
  content: string;
  is_main: boolean;
}

export interface ExecutionResponse {
  execution_id: string;
  status: ExecutionStatus;
  stdout?: string;
  stderr?: string;
  exit_code?: number;
  cpu_time_ms?: number;
  wall_time_ms?: number;
  memory_peak_mb?: number;
  wasm_fallback: boolean;
  fallback_reason?: string;
}

export interface Execution {
  id: string;
  user_id: string;
  project_id?: string;
  language: string;
  status: ExecutionStatus;
  source_code: string;
  stdin?: string;
  stdout?: string;
  stderr?: string;
  exit_code?: number;
  cpu_time_ms?: number;
  wall_time_ms?: number;
  memory_peak_bytes?: number;
  disk_usage_bytes?: number;
  executor_worker_id?: number;
  wasm_attempted: boolean;
  wasm_fallback_reason?: string;
  error_message?: string;
  queued_at: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

export type ExecutionStatus = 
  | 'queued' 
  | 'running' 
  | 'completed' 
  | 'failed' 
  | 'timeout' 
  | 'cancelled';

export interface Language {
  id: string;
  name: string;
  display_name: string;
  version: string;
  enabled: boolean;
  file_extensions: string[];
  mime_types: string[];
  compile_command?: string;
  run_command: string;
  wasm_runtime?: string;
  wasm_preload: boolean;
  resource_overrides: Record<string, any>;
}

export interface ExecutionMetrics {
  language: string;
  status: string;
  duration_ms: number;
  memory_peak_mb: number;
  cpu_time_ms: number;
  wasm_fallback: boolean;
}