import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true,
    });

    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => config,
      (error) => Promise.reject(error)
    );

    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          try {
            await axios.post(`${API_BASE}/auth/refresh`, {}, { withCredentials: true });
            return this.client.request(error.config);
          } catch {
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    );
  }

  get<T>(url: string, config?: any) {
    return this.client.get<T>(url, config);
  }

  post<T>(url: string, data?: any, config?: any) {
    return this.client.post<T>(url, data, config);
  }

  put<T>(url: string, data?: any, config?: any) {
    return this.client.put<T>(url, data, config);
  }

  patch<T>(url: string, data?: any, config?: any) {
    return this.client.patch<T>(url, data, config);
  }

  delete<T>(url: string, config?: any) {
    return this.client.delete<T>(url, config);
  }
}

export const api = new ApiClient();

export interface ExecuteCodeRequest {
  code: string;
  language: string;
  stdin?: string;
  files?: Array<{ path: string; content: string; is_main: boolean }>;
  project_id?: string;
  timeout_secs?: number;
}

/** 执行代码 */
export async function executeCode(request: ExecuteCodeRequest): Promise<{ data: any }> {
  return api.post('/execution/execute', request);
}

export interface AiExecuteRequest {
  type: 'explain' | 'review' | 'generate-tests' | 'chat';
  code?: string;
  language?: string;
  prompt?: string;
  context?: string;
}

/** 调用 AI 助手 */
export async function executeAi(request: AiExecuteRequest): Promise<{ data: any }> {
  return api.post('/ai/execute', request);
}