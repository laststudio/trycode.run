import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';

export interface ExecuteRequest {
  code: string;
  language: string;
  stdin?: string;
  files?: Array<{ path: string; content: string; is_main: boolean }>;
  project_id?: string;
  timeout_secs?: number;
}

export interface ExecuteResponse {
  execution_id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'timeout' | 'cancelled';
  stdout?: string;
  stderr?: string;
  exit_code?: number;
  cpu_time_ms?: number;
  wall_time_ms?: number;
  memory_peak_mb?: number;
  wasm_fallback: boolean;
  fallback_reason?: string;
}

export function useExecutor() {
  const { user } = useAuth();

  const [stdout, setStdout] = useState('');
  const [stderr, setStderr] = useState('');
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wasmFallback, setWasmFallback] = useState(false);
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'running' | 'completed' | 'error'>('idle');
  const [connected, setConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const executionIdRef = useRef<string | null>(null);
  const statusRef = useRef<'idle' | 'connecting' | 'running' | 'completed' | 'error'>('idle');

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const handleStreamEvent = useCallback((event: any) => {
    switch (event.type) {
      case 'stdout':
        setStdout(prev => prev + event.data);
        break;
      case 'stderr':
        setStderr(prev => prev + event.data);
        break;
      case 'status':
        if (event.data === 'running') setStatus('running');
        else if (event.data === 'completed') setStatus('completed');
        else if (event.data === 'failed') setStatus('error');
        else if (event.data === 'timeout') setStatus('error');
        break;
      case 'progress':
        // 可选：处理进度更新
        break;
      case 'complete':
        setStatus('completed');
        setExitCode(event.data.exit_code);
        setWasmFallback(event.data.wasm_fallback || false);
        setFallbackReason(event.data.fallback_reason || null);
        break;
      case 'error':
        setError(event.data.message);
        setStatus('error');
        break;
    }
  }, []);

  const connect = useCallback(async (executionId: string) => {
    const wsUrl = `${import.meta.env.VITE_WS_BASE || 'ws://localhost:3001'}/api/execute/ws/${executionId}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[Executor] WebSocket connected');
      setConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const event_data = JSON.parse(event.data);
        handleStreamEvent(event_data);
      } catch (e) {
        console.error('Failed to parse executor message:', e);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setStatus('error');
    };

    ws.onclose = (event) => {
      console.log('[Executor] WebSocket closed:', event.code, event.reason);
      setConnected(false);
      if (statusRef.current === 'running') {
        setStatus('error');
      }
    };

    wsRef.current = ws;
  }, [handleStreamEvent]);

  const execute = useCallback(async (request: ExecuteRequest) => {
    if (!user) throw new Error('Not authenticated');

    // 1. 创建执行记录
    const response = await fetch('/api/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        code: request.code,
        language: request.language,
        stdin: request.stdin,
        files: request.files,
        project_id: request.project_id,
        timeout_secs: request.timeout_secs,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || 'Failed to create execution');
    }

    const data = await response.json();
    const executionId = data.execution_id;
    executionIdRef.current = executionId;
    setStdout('');
    setStderr('');
    setError(null);
    setExitCode(null);
    setWasmFallback(false);
    setFallbackReason(null);
    setStatus('connecting');

    // 连接 WebSocket
    await connect(executionId);

    // 等待完成或超时
    return new Promise<{
      execution_id: string;
      status: string;
      stdout: string;
      stderr: string;
      exit_code: number | null;
      wasm_fallback: boolean;
      fallback_reason: string | null;
    }>((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.close();
        }
        setStatus('error');
        reject(new Error('Execution timeout'));
      }, 60000);

      const checkComplete = () => {
        if (statusRef.current === 'completed') {
          clearTimeout(timeout);
          resolve({
            execution_id: executionIdRef.current!,
            status: 'completed',
            stdout: stdout,
            stderr: stderr,
            exit_code: exitCode,
            wasm_fallback: wasmFallback,
            fallback_reason: fallbackReason,
          });
        } else if (statusRef.current === 'error') {
          clearTimeout(timeout);
          reject(new Error(error || 'Execution failed'));
        }
      };

      const checkInterval = setInterval(checkComplete, 100);
      void checkInterval;
    });
  }, [user, connect, stdout, stderr, exitCode, error, wasmFallback, fallbackReason]);

  const stop = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus('idle');
  }, []);

  // 清理
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return {
    execute,
    stop,
    status,
    stdout,
    stderr,
    exitCode,
    error,
    wasmFallback,
    fallbackReason,
    connected,
    executing: status === 'running' || status === 'connecting',
  };
}
