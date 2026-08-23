import * as monaco from 'monaco-editor';

// 语言配置导入
import { pythonProviders, pythonLanguageConfig } from './languageConfigs/python';
import { typescriptProviders, typescriptLanguageConfig, javascriptLanguageConfig } from './languageConfigs/typescript';
import { rustProviders, rustLanguageConfig } from './languageConfigs/rust';
import { goProviders, goLanguageConfig } from './languageConfigs/go';
import { MonacoProviders, registerMonacoProviders } from './providers/monaco';

// 语言配置注册表
export const languageConfigs: Record<string, any> = {
  python: { config: pythonLanguageConfig, providers: pythonProviders },
  typescript: { config: typescriptLanguageConfig, providers: typescriptProviders },
  javascript: { config: javascriptLanguageConfig, providers: javascriptProviders },
  rust: { config: rustLanguageConfig, providers: rustProviders },
  go: { config: goLanguageConfig, providers: goProviders },
};

// 语言服务模式
export type LanguageServiceMode = 'monaco' | 'lsp' | 'hybrid';

export interface LanguageServiceState {
  mode: LanguageServiceMode;
  lspClient: any | null;
  isLSPConnected: boolean;
  isLSPConnecting: boolean;
  lspError: string | null;
  monacoProvidersRegistered: boolean;
}

// 语言服务管理器类
export class LanguageServiceManager {
  private monaco: typeof monaco | null = null;
  private registeredProviders: Map<string, monaco.languages.CompletionItemProvider> = new Map();
  private lspClients: Map<string, any> = new Map();
  private state: LanguageServiceState = {
    mode: 'hybrid',
    lspClient: null,
    isLSPConnected: false,
    isLSPConnecting: false,
    lspError: null,
    monacoProvidersRegistered: false,
  };
  private listeners: Set<(state: LanguageServiceState) => void> = new Set();
  private lspClient: any = null;

  // 初始化
  initialize(monacoInstance: typeof monaco) {
    this.monaco = monacoInstance;
    this.registerMonacoProviders();
    this.state.monacoProvidersRegistered = true;
    this.notifyListeners();
  }

  // 注册所有 Monaco 提供者
  private registerMonacoProviders() {
    if (!this.monaco) return;

    // 使用统一的注册函数
    registerMonacoProviders(this.monaco!);
    
    // 为每种语言注册 Monaco Provider（保持向后兼容）
    Object.entries(languageConfigs).forEach(([langId, config]) => {
      if (config.providers?.completion) {
        const provider = config.providers.completion(this.monaco!);
        const disposable = this.monaco!.languages.registerCompletionItemProvider(
          config.config.monacoLanguageId,
          provider
        );
        this.registeredProviders.set(`${langId}-completion`, disposable);
      }

      // 可以在这里注册其他类型的 provider (hover, definition 等)
      // if (config.providers?.hover) { ... }
      // if (config.providers?.definition) { ... }
      // if (config.providers?.signatureHelp) { ... }
    });

    console.log('Monaco providers registered for all languages');
  }

  // 设置语言服务模式
  setMode(mode: 'monaco' | 'lsp' | 'hybrid') {
    this.state.mode = mode;
    this.notifyListeners();
  }

  getMode(): 'monaco' | 'lsp' | 'hybrid' {
    return this.state.mode;
  }

  // 连接 LSP 客户端
  async connectLSP(languageId: string): Promise<boolean> {
    if (!this.supportsLSP(languageId)) {
      return false;
    }

    this.state.isLSPConnecting = true;
    this.state.lspError = null;
    this.notifyListeners();

    try {
      // 这里应该连接到后端的 LSP Multiplexer
      // 实际实现中会使用 WebSocket 连接到后端的 LSP Multiplexer
      // 这里只是模拟连接过程
      
      // 实际实现中：
      // 1. 建立 WebSocket 连接到 ws://host:3001/api/lsp/ws?language_id=xxx
      // 2. 发送 initialize 请求
      // 3. 处理 LSP 消息
      
      this.state.lspClient = {
        languageId: languageId,
        connected: true,
        sendRequest: async (method: string, params: any) => {
          // 发送 LSP 请求
          return this.sendLSPRequest(languageId, method, params);
        },
        sendNotification: async (method: string, params: any) => {
          // 发送 LSP 通知
        },
      };
      
      this.state.isLSPConnecting = false;
      this.state.isLSPConnected = true;
      this.notifyListeners();
      
      return true;
    } catch (error) {
      this.state.isLSPConnecting = false;
      this.state.lspError = error instanceof Error ? error.message : 'Connection failed';
      this.notifyListeners();
      return false;
    }
  }

  // 断开 LSP 连接
  async disconnectLSP(languageId: string): Promise<void> {
    if (this.state.lspClient && this.state.lspClient.languageId === languageId) {
      this.state.lspClient = null;
      this.state.isLSPConnected = false;
      this.notifyListeners();
    }
  }

  // 检查语言是否支持 LSP
  supportsLSP(languageId: string): boolean {
    const lspLanguages = ['python', 'typescript', 'javascript', 'rust', 'go', 'cpp', 'c', 'java', 'csharp', 'php', 'ruby'];
    return lspLanguages.includes(languageId);
  }

  // 发送 LSP 请求
  private async sendLSPRequest(languageId: string, method: string, params: any): Promise<any> {
    // 实际实现：通过 WebSocket 发送 LSP 请求到后端
    // 这里只是模拟
    console.log(`Sending LSP request: ${method} for ${languageId}`, params);
    return null;
  }

  // 获取当前状态
  getState(): LanguageServiceState {
    return { ...this.state };
  }

  // 订阅状态变化
  subscribe(listener: (state: LanguageServiceState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // 通知监听器
  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.getState()));
  }

  // 获取语言配置
  getLanguageConfig(languageId: string) {
    return languageConfigs[languageId]?.config || null;
  }

  // 获取可用的语言列表
  getAvailableLanguages() {
    return Object.keys(languageConfigs);
  }

  // 检查语言是否支持 Monaco
  supportsMonaco(languageId: string): boolean {
    return languageId in languageConfigs;
  }

  // 获取语言的 Monaco 语言 ID
  getMonacoLanguageId(languageId: string): string {
    return languageConfigs[languageId]?.config?.monacoLanguageId || languageId;
  }

  // 销毁管理器
  dispose() {
    // 清理 Monaco 提供者
    this.registeredProviders.forEach(disposable => disposable.dispose());
    this.registeredProviders.clear();
    this.listeners.clear();
    this.state.monacoProvidersRegistered = false;
  }
}

// 单例实例
let languageServiceManagerInstance: LanguageServiceManager | null = null;

export function getLanguageServiceManager(): LanguageServiceManager {
  if (!languageServiceManagerInstance) {
    languageServiceManagerInstance = new LanguageServiceManager();
  }
  return languageServiceManagerInstance;
}

// React Hook
import { useState, useEffect, useCallback } from 'react';

export function useLanguageServiceManager() {
  const [manager] = useState(() => getLanguageServiceManager());
  const [state, setState] = useState(manager.getState());

  useEffect(() => {
    const unsubscribe = manager.subscribe(setState);
    return unsubscribe;
  }, []);

  const connectLSP = useCallback(async (languageId: string) => {
    return manager.connectLSP(languageId);
  }, []);

  const disconnectLSP = useCallback(async (languageId: string) => {
    await manager.disconnectLSP(languageId);
  }, []);

  const setMode = useCallback((mode: 'monaco' | 'lsp' | 'hybrid') => {
    manager.setMode(mode);
  }, []);

  return {
    state,
    connectLSP,
    disconnectLSP,
    setMode,
    getLanguageConfig: (languageId: string) => manager.getLanguageConfig(languageId),
    getAvailableLanguages: () => manager.getAvailableLanguages(),
    supportsLSP: (languageId: string) => manager.supportsLSP(languageId),
    supportsMonaco: (languageId: string) => manager.supportsMonaco(languageId),
    getMonacoLanguageId: (languageId: string) => manager.getMonacoLanguageId(languageId),
  };
}

// 导出类型
export type { LanguageServiceState };
export { languageConfigs, LanguageServiceManager };