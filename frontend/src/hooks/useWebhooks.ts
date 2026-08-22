import { useState, useCallback, useEffect } from 'react';
import { useEditorStore } from '../../stores';

export interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  events: WebhookEvent[];
  secret?: string;
  enabled: boolean;
  headers?: Record<string, string>;
  retryPolicy: RetryPolicy;
  createdAt: number;
  updatedAt: number;
}

export type WebhookEvent = 
  | 'execution.completed'
  | 'execution.failed'
  | 'execution.timeout'
  | 'execution.started'
  | 'project.created'
  | 'project.updated'
  | 'project.deleted'
  | 'user.registered'
  | 'user.login'
  | 'collab.invited'
  | 'share.created';

export interface RetryPolicy {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: number;
  data: any;
  signature?: string;
}

interface WebhookState {
  webhooks: Map<string, WebhookConfig>;
  deliveryLogs: WebhookDeliveryLog[];
  isLoading: boolean;
}

interface WebhookDeliveryLog {
  id: string;
  webhookId: string;
  event: WebhookEvent;
  payload: WebhookPayload;
  status: 'pending' | 'delivered' | 'failed' | 'retrying';
  statusCode?: number;
  responseBody?: string;
  error?: string;
  attempts: number;
  createdAt: number;
  completedAt?: number;
  nextRetryAt?: number;
}

const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

export function useWebhooks() {
  const [state, setState] = useState<WebhookState>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('webhook-config');
        if (saved) {
          const parsed = JSON.parse(saved);
          return {
            webhooks: new Map(Object.entries(parsed.webhooks || {})),
            deliveryLogs: parsed.deliveryLogs || [],
            isLoading: false,
          };
        }
      } catch (e) {
        console.warn('Failed to load webhooks:', e);
      }
    }
    return {
      webhooks: new Map(),
      deliveryLogs: [],
      isLoading: false,
    };
  });

  const persistState = useCallback((newState: any) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('webhook-config', JSON.stringify({
          webhooks: Object.fromEntries(newState.webhooks),
          deliveryLogs: newState.deliveryLogs.slice(-1000), // 只保留最近1000条
        }));
      } catch (e) {
        console.warn('Failed to persist webhooks:', e);
      }
    }
  }, []);

  useEffect(() => {
    persistState(state);
  }, [state, persistState]);

  const createWebhook = useCallback((config: Omit<WebhookConfig, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newWebhook: WebhookConfig = {
      ...config,
      id: `webhook-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      retryPolicy: config.retryPolicy || DEFAULT_RETRY_POLICY,
    };
    setState(prev => {
      const newWebhooks = new Map(prev.webhooks);
      newWebhooks.set(newWebhook.id, newWebhook);
      return { ...prev, webhooks: newWebhooks };
    });
    return newWebhook;
  }, []);

  const updateWebhook = useCallback((id: string, updates: Partial<WebhookConfig>) => {
    setState(prev => {
      const webhook = prev.webhooks.get(id);
      if (!webhook) return prev;
      const newWebhooks = new Map(prev.webhooks);
      newWebhooks.set(id, { ...webhook, ...updates, updatedAt: Date.now() });
      return { ...prev, webhooks: newWebhooks };
    });
  }, []);

  const deleteWebhook = useCallback((id: string) => {
    setState(prev => {
      const newWebhooks = new Map(prev.webhooks);
      newWebhooks.delete(id);
      return { ...prev, webhooks: newWebhooks };
    });
  }, []);

  const toggleWebhook = useCallback((id: string, enabled: boolean) => {
    setState(prev => {
      const webhook = prev.webhooks.get(id);
      if (!webhook) return prev;
      const newWebhooks = new Map(prev.webhooks);
      newWebhooks.set(id, { ...webhook, enabled, updatedAt: Date.now() });
      return { ...prev, webhooks: newWebhooks };
    });
  }, []);

  const getWebhook = useCallback((id: string) => {
    return state.webhooks.get(id);
  }, [state.webhooks]);

  const getAllWebhooks = useCallback(() => {
    return Array.from(state.webhooks.values());
  }, [state.webhooks]);

  const getWebhooksByEvent = useCallback((event: WebhookEvent) => {
    return Array.from(state.webhooks.values()).filter(w => w.enabled && w.events.includes(event));
  }, [state.webhooks]);

  // 发送 Webhook
  const sendWebhook = useCallback(async (event: WebhookEvent, data: any) => {
    const webhooks = getWebhooksByEvent(event);
    if (webhooks.length === 0) return;

    const payload: WebhookPayload = {
      event,
      timestamp: Date.now(),
      data,
    };

    // 并行发送到所有匹配的 webhook
    const promises = webhooks.map(webhook => deliverWebhook(webhook, payload));
    await Promise.allSettled(promises);
  }, [state.webhooks]);

  const deliverWebhook = useCallback(async (webhook: WebhookConfig, payload: WebhookPayload) => {
    const logEntry: WebhookDeliveryLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      webhookId: webhook.id,
      event: payload.event,
      payload,
      status: 'pending',
      attempts: 0,
      createdAt: Date.now(),
    };

    setState(prev => ({
      ...prev,
      deliveryLogs: [logEntry, ...prev.deliveryLogs].slice(0, 1000),
    }));

    return attemptDelivery(webhook, payload, logEntry);
  }, []);

  const attemptDelivery = useCallback(async (
    webhook: WebhookConfig, 
    payload: WebhookPayload, 
    logEntry: WebhookDeliveryLog
  ) => {
    const maxRetries = webhook.retryPolicy?.maxRetries ?? DEFAULT_RETRY_POLICY.maxRetries;
    let attempt = 0;
    let delay = webhook.retryPolicy?.initialDelayMs ?? DEFAULT_RETRY_POLICY.initialDelayMs;
    const maxDelay = webhook.retryPolicy?.maxDelayMs ?? DEFAULT_RETRY_POLICY.maxDelayMs;
    const multiplier = webhook.retryPolicy?.backoffMultiplier ?? DEFAULT_RETRY_POLICY.backoffMultiplier;

    while (attempt <= maxRetries) {
      attempt++;
      
      // 更新日志状态
      updateLogStatus(logEntry.id, 'pending', { attempts: attempt });

      try {
        // 生成签名
        let body = JSON.stringify(payload);
        let headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'User-Agent': 'TryCode-Webhook/1.0',
          'X-TryCode-Event': payload.event,
          'X-TryCode-Timestamp': payload.timestamp.toString(),
          'X-TryCode-Delivery': logEntry.id,
        };

        if (webhook.secret) {
          const crypto = await import('crypto');
          const signature = crypto.createHmac('sha256', webhook.secret)
            .update(body)
            .digest('hex');
          headers['X-TryCode-Signature'] = `sha256=${signature}`;
        }

        // 添加自定义头
        if (webhook.headers) {
          Object.assign(headers, webhook.headers);
        }

        const response = await fetch(webhook.url, {
          method: 'POST',
          headers,
          body,
          signal: AbortSignal.timeout(30000),
        });

        const responseBody = await response.text();
        
        if (response.ok) {
          updateLogStatus(logEntry.id, 'delivered', { 
            statusCode: response.status,
            responseBody: responseBody.slice(0, 10000),
            completedAt: Date.now(),
          });
          return { success: true, statusCode: response.status };
        } else {
          throw new Error(`HTTP ${response.status}: ${responseBody.slice(0, 500)}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        if (attempt <= (webhook.retryPolicy?.maxRetries ?? DEFAULT_RETRY_POLICY.maxRetries)) {
          // 更新日志为重试状态
          updateLogStatus(logEntry.id, 'retrying', { 
            error: errorMessage,
            attempts: attempt,
            nextRetryAt: Date.now() + delay,
          });
          
          // 等待后重试
          await new Promise(resolve => setTimeout(resolve, delay));
          delay = Math.min(delay * (webhook.retryPolicy?.backoffMultiplier ?? DEFAULT_RETRY_POLICY.backoffMultiplier), 
            webhook.retryPolicy?.maxDelayMs ?? DEFAULT_RETRY_POLICY.maxDelayMs);
        } else {
          // 所有重试都失败了
          updateLogStatus(logEntry.id, 'failed', { 
            error: errorMessage,
            statusCode: 0,
            completedAt: Date.now(),
          });
          return { success: false, error: errorMessage };
        }
      }
    }, []);

  const updateLogStatus = useCallback((logId: string, status: WebhookDeliveryLog['status'], updates: Partial<WebhookDeliveryLog>) => {
    setState(prev => {
      const newLogs = prev.deliveryLogs.map(log => 
        log.id === logId ? { ...log, ...updates, status } : log
      );
      return { ...prev, deliveryLogs: newLogs };
    });
  }, []);

  // 测试 webhook
  const testWebhook = useCallback(async (webhookId: string) => {
    const webhook = state.webhooks.get(webhookId);
    if (!webhook) throw new Error('Webhook not found');

    const testPayload: WebhookPayload = {
      event: 'test',
      timestamp: Date.now(),
      data: { message: 'This is a test webhook from TryCode' },
    };

    const result = await deliverWebhook(state.webhooks.get(webhookId)!, {
      event: 'test',
      timestamp: Date.now(),
      data: { message: 'This is a test webhook from TryCode' },
    }, {
      id: `test-${Date.now()}`,
      webhookId,
      event: 'test',
      payload: {
        event: 'test',
        timestamp: Date.now(),
        data: { message: 'This is a test webhook from TryCode' },
      },
      status: 'pending',
      attempts: 0,
      createdAt: Date.now(),
    });

    return result;
  }, [state.webhooks]);

  const getDeliveryLogs = useCallback((webhookId?: string, limit = 100) => {
    let logs = state.deliveryLogs;
    if (webhookId) {
      logs = logs.filter(l => l.webhookId === webhookId);
    }
    return logs.slice(0, limit);
  }, [state.deliveryLogs]);

  const clearLogs = useCallback((webhookId?: string) => {
    setState(prev => ({
      ...prev,
      deliveryLogs: webhookId 
        ? prev.deliveryLogs.filter(l => l.webhookId !== webhookId)
        : [],
    });
  }, []);

  const retryFailed = useCallback(async (logId: string) => {
    const log = state.deliveryLogs.find(l => l.id === logId);
    if (!log || log.status !== 'failed') return;
    
    const webhook = state.webhooks.get(log.webhookId);
    if (!webhook) return;

    const newLog: WebhookDeliveryLog = {
      ...log,
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      status: 'pending',
      attempts: 0,
      createdAt: Date.now(),
      completedAt: undefined,
      nextRetryAt: undefined,
    };

    setState(prev => ({
      ...prev,
      deliveryLogs: [newLog, ...prev.deliveryLogs].slice(0, 1000),
    }));

    await attemptDelivery(state.webhooks.get(log.webhookId)!, log.payload, newLog);
  }, [state.webhooks, state.deliveryLogs]);

  return {
    // 状态
    webhooks: state.webhooks,
    deliveryLogs: state.deliveryLogs,
    
    // 操作方法
    createWebhook,
    updateWebhook,
    deleteWebhook,
    toggleWebhook,
    getWebhook,
    getAllWebhooks,
    getWebhooksByEvent,
    sendWebhook,
    testWebhook,
    getDeliveryLogs,
    clearLogs,
    retryFailed,
  };
}

export function useWebhooks() {
  const [state, setState] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('webhook-config');
        if (saved) {
          const parsed = JSON.parse(saved);
          return {
            webhooks: new Map(Object.entries(parsed.webhooks || {})),
            deliveryLogs: parsed.deliveryLogs || [],
            isLoading: false,
          };
        }
      } catch (e) {
        console.warn('Failed to load webhooks:', e);
      }
    }
    return {
      webhooks: new Map(),
      deliveryLogs: [],
      isLoading: false,
    };
  });

  const persistState = useCallback((newState: any) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('webhook-config', JSON.stringify({
          webhooks: Object.fromEntries(newState.webhooks),
          deliveryLogs: newState.deliveryLogs.slice(-1000),
        }));
      } catch (e) {
        console.warn('Failed to persist webhooks:', e);
      }
    }
  }, []);

  useEffect(() => {
    persistState(state);
  }, [state, persistState]);

  // ... 复用上面的实现，这里简化
  const createWebhook = useCallback((config: any) => {
    const newWebhook = {
      ...config,
      id: `webhook-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setState(prev => {
      const newWebhooks = new Map(prev.webhooks);
      newWebhooks.set(newWebhook.id, newWebhook);
      return { ...prev, webhooks: newWebhooks };
    });
    return newWebhook;
  }, []);

  const updateWebhook = useCallback((id: string, updates: any) => {
    setState(prev => {
      const webhook = prev.webhooks.get(id);
      if (!webhook) return prev;
      const newWebhooks = new Map(prev.webhooks);
      newWebhooks.set(id, { ...webhook, ...updates, updatedAt: Date.now() });
      return { ...prev, webhooks: newWebhooks };
    });
  }, []);

  const deleteWebhook = useCallback((id: string) => {
    setState(prev => {
      const newWebhooks = new Map(prev.webhooks);
      newWebhooks.delete(id);
      return { ...prev, webhooks: newWebhooks };
    });
  }, []);

  const toggleWebhook = useCallback((id: string, enabled: boolean) => {
    setState(prev => {
      const webhook = prev.webhooks.get(id);
      if (!webhook) return prev;
      const newWebhooks = new Map(prev.webhooks);
      newWebhooks.set(id, { ...webhook, enabled, updatedAt: Date.now() });
      return { ...prev, webhooks: newWebhooks };
    });
  }, []);

  const getAllWebhooks = () => Array.from(state.webhooks.values());
  const getWebhooksByEvent = (event: string) => 
    Array.from(state.webhooks.values()).filter(w => w.enabled && w.events.includes(event));

  return {
    webhooks: state.webhooks,
    deliveryLogs: state.deliveryLogs,
    createWebhook,
    updateWebhook,
    deleteWebhook,
    toggleWebhook,
    getAllWebhooks,
    getWebhooksByEvent,
    sendWebhook: async (event: string, data: any) => {
      const webhooks = getWebhooksByEvent(event);
      // 实际发送逻辑省略
    },
    testWebhook: async (id: string) => {
      // 测试逻辑
    },
    getDeliveryLogs: (webhookId?: string, limit = 100) => {
      let logs = state.deliveryLogs;
      if (webhookId) logs = logs.filter(l => l.webhookId === webhookId);
      return logs.slice(0, limit);
    },
    clearLogs: (webhookId?: string) => {
      setState(prev => ({
        ...prev,
        deliveryLogs: webhookId 
          ? prev.deliveryLogs.filter(l => l.webhookId !== webhookId)
          : [],
      });
    },
    retryFailed: async (logId: string) => {
      // 重试逻辑
    },
  };
}