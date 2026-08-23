import { useState, useEffect, useCallback, useRef } from 'react';
import { LSPWSMessage } from '../types/lsp';

// LSP 客户端 Hook
export function useLSPClient(languageId?: string) {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingRequests = useRef<Map<number, (result: any) => void>>(new Map());
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectDelay = 2000;
  let lastLanguageId = languageId;

  // 连接到 LSP WebSocket
  const connect = useCallback(async (lang: string) => {
    if (!lang) return;
    
    setConnecting(true);
    setError(null);

    try {
      const wsUrl = `${import.meta.env.VITE_WS_BASE || 'ws://localhost:3001'}/api/lsp/ws?language_id=${lang}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log(`LSP WebSocket connected for ${lang}`);
        setConnected(true);
        setConnecting(false);
        reconnectAttempts.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message: LSPWSMessage = JSON.parse(event.data);
          handleMessage(message);
        } catch (e) {
          console.error('Failed to parse LSP message:', e);
        }
      };

      ws.onerror = (error) => {
        console.error('LSP WebSocket error:', error);
        setError('WebSocket connection error');
      };

      ws.onclose = (event) => {
        setConnected(false);
        console.log(`LSP WebSocket closed: ${event.code} ${event.reason}`);

        // 自动重连
        if (reconnectAttempts.current < maxReconnectAttempts) {
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            if (lastLanguageId) {
              connect(lastLanguageId);
            }
          }, reconnectDelay * Math.pow(2, reconnectAttempts.current));
        }
      };
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Connection failed');
      setConnecting(false);
    }
  }, []);

  // 处理接收到的消息
  const handleMessage = useCallback((message: LSPWSMessage) => {
    switch (message.type) {
      case 'response': {
        const rid = message.request_id;
        if (rid === undefined) break;
        const pending = pendingRequests.current.get(rid);
        if (pending) {
          pendingRequests.current.delete(rid);
          if (message.error) {
            console.error('LSP request error:', message.error.message || 'LSP error');
          } else {
            pending(message.result);
          }
        }
        break;
      }
      case 'notification':
        // 处理通知（诊断、日志等）
        console.log('LSP notification:', message.method, message.params);
        break;
      case 'error':
        console.error('LSP error:', message.message);
        break;
      case 'pong':
        // 心跳响应
        break;
    }
  }, []);

  // 发送请求
  const sendRequest = useCallback(async (method: string, params?: any): Promise<any> => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    const requestId = Date.now() + Math.random();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pendingRequests.current.delete(requestId);
        reject(new Error('Request timeout'));
      }, 30000);

      pendingRequests.current.set(requestId, (result: any) => {
        clearTimeout(timeout);
        resolve(result);
      });

      wsRef.current?.send(JSON.stringify({
        type: 'request',
        request_id: requestId,
        language_id: languageId || '',
        method,
        params,
      }));
    });
  }, [languageId]);

  // 发送通知
  const sendNotification = useCallback(async (method: string, params?: any) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    ws.send(JSON.stringify({
      type: 'notification',
      method,
      params,
    }));
  }, []);

  // 断开连接
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
  }, []);

  // 清理
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return {
    connected,
    connecting,
    error,
    connect: languageId ? () => connect(languageId) : connect,
    disconnect,
    sendRequest,
    sendNotification,
  };
};
