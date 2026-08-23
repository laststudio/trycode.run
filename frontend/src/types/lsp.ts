/**
 * LSP (Language Server Protocol) related type definitions
 */

/** LSP WebSocket error object */
export interface LSPWSError {
  code: number;
  message: string;
  data?: unknown;
}

/** Message types transmitted over the LSP WebSocket */
export interface LSPWSMessage {
  type: 'request' | 'response' | 'notification' | 'error' | 'ping' | 'pong';
  request_id?: number;
  language_id?: string;
  method?: string;
  params?: any;
  result?: any;
  error?: LSPWSError;
  message?: string;
}

/** LSP server configuration information */
export interface LSPServerConfig {
  languageId: string;
  command?: string;
  args?: string[];
  rootUri?: string;
  initializationOptions?: any;
}

/** LSP server running status */
export interface LSPServerInfo {
  languageId: string;
  status: 'starting' | 'running' | 'stopped' | 'error';
  pid?: number;
  capabilities?: any;
  error?: string;
}

/** LSP client abstraction */
export interface LSPClient {
  languageId: string;
  connected: boolean;
  sendRequest: (method: string, params?: any) => Promise<any>;
  sendNotification: (method: string, params?: any) => Promise<void>;
  disconnect: () => void;
}
