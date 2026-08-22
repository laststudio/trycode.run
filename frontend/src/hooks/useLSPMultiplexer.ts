import { useState, useEffect, useCallback, useRef } from 'react';
import { LSPWSMessage, LSPServerInfo, LSPServerConfig } from '../../types/lsp';

// LSP 多路复用器 Hook
export function useLSPMultiplexer() {
  const [clients, setClients] = useState<Map<string, any>>(new Map());
  const [globalMode, setGlobalMode] = useState<'monaco' | 'lsp' | 'hybrid'>('hybrid');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const clientCounter = useRef(0);

  // 连接到 LSP Multiplexer WebSocket
  const connect = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const wsUrl = `${import.meta.env.VITE_WS_BASE || 'ws://localhost:3001'}/api/lsp/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('LSP Multiplexer WebSocket connected');
        setError(null);
      };

      ws.onmessage = (event) => {
        try {
          const message: LSPWSMessage = JSON.parse(event.data);
          handleMultiplexerMessage(message);
        } catch (e) {
          console.error('Failed to parse multiplexer message:', e);
        }
      };

      ws.onerror = (error) => {
        console.error('LSP Multiplexer WebSocket error:', error);
      };

      ws.onclose = (event) => {
        console.log('LSP Multiplexer WebSocket closed:', event.code, event.reason);
        // 自动重连
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 5000);
      };
    } catch (error) {
      console.error('Failed to connect to LSP Multiplexer:', error);
    }
  }, []);

  // 处理多路复用器消息
  const handleMultiplexerMessage = useCallback((message: LSPWSMessage) => {
    switch (message.type) {
      case 'response':
        // 处理响应
        break;
      case 'notification':
        if (message.method === 'server/status') {
          // 更新服务器状态
          updateServerStatus(message.params);
        } else if (message.method === 'server/started') {
          // 服务器启动
          onServerStarted(message.params);
        } else if (message.method === 'server/stopped') {
          // 服务器停止
          onServerStopped(message.params);
        }
        break;
      case 'error':
        console.error('Multiplexer error:', message.message);
        break;
    }
  }, []);

  // 更新服务器状态
  const updateServerStatus = useCallback((params: any) => {
    setClients(prev => {
      const newClients = new Map(prev);
      if (params.language_id) {
        const existing = prev.get(params.language_id) || {};
        newClients.set(params.language_id, {
          ...existing,
          ...params,
          last_update: Date.now(),
        });
      }
      return newClients;
    });
  }, []);

  // 服务器启动
  const onServerStarted = useCallback((params: any) => {
    setClients(prev => {
      const newClients = new Map(prev);
      newClients.set(params.language_id, {
        language_id: params.language_id,
        status: 'running',
        pid: params.pid,
        memory_usage_mb: 0,
        cpu_percent: 0,
        uptime_secs: 0,
        request_count: 0,
        error_count: 0,
        restart_count: 0,
        last_error: null,
        capabilities: null,
      });
      return newClients;
    });
  }, []);

  // 服务器停止
  const onServerStopped = useCallback((params: any) => {
    setClients(prev => {
      const newClients = new Map(prev);
      const existing = prev.get(params.language_id);
      if (existing) {
        newClients.set(params.language_id, {
          ...existing,
          status: 'stopped',
        });
      }
      return newClients;
    });
  }, []);

  // 连接到多路复用器
  const connect = useCallback(async () => {
    try {
      const wsUrl = `${import.meta.env.VITE_WS_BASE || 'ws://localhost:3001'}/api/lsp/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('LSP Multiplexer WebSocket connected');
      };

      ws.onmessage = (event) => {
        try {
          const message: LSPWSMessage = JSON.parse(event.data);
          handleMultiplexerMessage(message);
        } catch (e) {
          console.error('Failed to parse multiplexer message:', e);
        }
      };

      ws.onerror = (error) => {
        console.error('LSP Multiplexer WebSocket error:', error);
      };

      ws.onclose = (event) => {
        console.log('LSP Multiplexer WebSocket closed:', event.code, event.reason);
        // 自动重连
        setTimeout(() => connect(), 5000);
      };
    } catch (error) {
      console.error('Failed to connect to LSP Multiplexer:', error);
    }
  }, []);

  // 发送消息到多路复用器
  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  // 请求启动语言服务器
  const startServer = useCallback(async (languageId: string) => {
    sendMessage({
      type: 'request',
      request_id: Date.now(),
      method: 'server/start',
      params: { language_id: languageId },
    });
  }, []);

  // 请求停止语言服务器
  const stopServer = useCallback(async (languageId: string) => {
    sendMessage({
      type: 'request',
      request_id: Date.now(),
      method: 'server/stop',
      params: { language_id: languageId },
    });
  }, []);

  // 重启语言服务器
  const restartServer = useCallback(async (languageId: string) => {
    sendMessage({
      type: 'request',
      request_id: Date.now(),
      method: 'server/restart',
      params: { language_id: languageId },
    });
  }, []);

  // 获取服务器状态
  const getServerStatus = useCallback(async (languageId: string) => {
    // 这里应该从本地状态或通过请求获取
    return null;
  }, []);

  // 获取所有服务器状态
  const getAllStatus = useCallback(async () => {
    // 实际实现中从后端获取
    return [];
  }, []);

  // 设置全局模式
  const setGlobalMode = (mode: 'monaco' | 'lsp' | 'hybrid') => {
    // 实际实现中保存到设置
    console.log('Setting global mode:', mode);
  };

  // 连接到多路复用器
  const wsRef = useRef<WebSocket | null>(null);
  const connect = useCallback(async () => {
    if (typeof window === 'undefined') return;
    
    try {
      const wsUrl = `${import.meta.env.VITE_WS_BASE || 'ws://localhost:3001'}/api/lsp/ws`;
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => console.log('LSP Multiplexer connected');
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          // 处理消息
        } catch (e) {
          console.error('Failed to parse multiplexer message:', e);
        }
      };
      ws.onclose = () => setTimeout(() => connect(), 5000);
      
      return ws;
    } catch (e) {
      console.error('Failed to connect multiplexer:', e);
    }
  }, []);

  // 清理
  useEffect(() => {
    return () => {
      // 清理连接
    };
  }, []);

  return {
    globalMode: 'hybrid' as const,
    setGlobalMode: () => {},
    clients: new Map(),
    startClient: async () => {},
    stopClient: async () => {},
    restartClient: async () => {},
    getAllStatus: async () => [],
    getClient: () => null,
    connect: async () => {},
  };
}