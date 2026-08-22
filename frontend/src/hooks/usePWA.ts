import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PWAState {
  isInstallable: boolean;
  isInstalled: boolean;
  isOnline: boolean;
  updateAvailable: boolean;
  deferredPrompt: BeforeInstallPromptEvent | null;
  swRegistration: ServiceWorkerRegistration | null;
}

export function usePWA() {
  const [state, setState] = useState<PWAState>({
    isInstallable: false,
    isInstalled: false,
    isOnline: navigator.onLine,
    updateAvailable: false,
    deferredPrompt: null,
    swRegistration: null,
  });

  // 检查是否已安装
  const checkInstalled = useCallback(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isInWebAppiOS = (window.navigator as any).standalone === true;
    return isStandalone || isInWebAppiOS;
  }, []);

  // 检查是否在线
  const checkOnline = useCallback(() => {
    setState(prev => ({ ...prev, isOnline: navigator.onLine }));
  }, []);

  useEffect(() => {
    // 检查安装状态
    const isInstalled = checkInstalled();
    setState(prev => ({ ...prev, isInstalled }));
    
    // 监听在线/离线状态
    window.addEventListener('online', checkOnline);
    window.addEventListener('offline', checkOnline);
    
    // 监听 beforeinstallprompt 事件
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setState(prev => ({ 
        ...prev, 
        isInstallable: true, 
        deferredPrompt: promptEvent 
      }));
    };
    
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    // 监听 appinstalled 事件
    const handleAppInstalled = () => {
      setState(prev => ({ 
        ...prev, 
        isInstalled: true, 
        isInstallable: false, 
        deferredPrompt: null 
      }));
    };
    
    window.addEventListener('appinstalled', handleAppInstalled);
    
    // 注册 Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log('[PWA] Service Worker registered:', registration.scope);
          
          // 检查更新
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // 有新版本可用
                  setState(prev => ({ ...prev, updateAvailable: true }));
                }
              });
            });
            
            setState(prev => ({ ...prev, swRegistration: registration }));
          })
          .catch(error => {
            console.error('[PWA] Service Worker registration failed:', error);
          });
    }
    
    // 检查是否已安装
    const isInstalled = checkInstalled();
    setState(prev => ({ ...prev, isInstalled }));
    
    // 监听在线/离线
    window.addEventListener('online', () => setState(prev => ({ ...prev, isOnline: true })));
    window.addEventListener('offline', () => setState(prev => ({ ...prev, isOnline: false })));
    
    // 监听 beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setState(prev => ({ 
        ...prev, 
        isInstallable: true, 
        deferredPrompt: e as BeforeInstallPromptEvent 
      }));
    };
    
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    // 监听 appinstalled 事件
    const handleAppInstalled = () => {
      setState(prev => ({ 
        ...prev, 
        isInstalled: true, 
        isInstallable: false, 
        deferredPrompt: null 
      }));
    };
    
    window.addEventListener('appinstalled', handleAppInstalled);
    
    // 监听 SW 更新
    const handleControllerChange = () => {
      if (navigator.serviceWorker.controller) {
        window.location.reload();
      }
    };
    
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    
    // 监听在线/离线
    window.addEventListener('online', () => setState(prev => ({ ...prev, isOnline: true })));
    window.addEventListener('offline', () => setState(prev => ({ ...prev, isOnline: false })));
    
    // 清理
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', checkOnline);
      window.removeEventListener('offline', checkOnline);
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  // 安装应用
  const install = useCallback(async () => {
    if (!state.deferredPrompt) return false;
    
    try {
      await state.deferredPrompt.prompt();
      const { outcome } = await state.deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setState(prev => ({ 
          ...prev, 
          isInstalled: true, 
          isInstallable: false, 
          deferredPrompt: null 
        }));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Install failed:', error);
      return false;
    }
  }, [state.deferredPrompt]);

  // 检查更新
  const checkForUpdate = useCallback(async () => {
    if (state.swRegistration) {
      await state.swRegistration.update();
    }
  }, [state.swRegistration]);

  // 应用更新
  const applyUpdate = useCallback(async () => {
    if (state.swRegistration?.waiting) {
      state.swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    }
  }, [state.swRegistration]);

  // 取消更新
  const dismissUpdate = useCallback(() => {
    setState(prev => ({ ...prev, updateAvailable: false }));
  }, []);

  // 清除缓存
  const clearCache = useCallback(async () => {
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(name => caches.delete(name))
      );
      console.log('[PWA] All caches cleared');
    }
  }, []);

  // 获取缓存大小
  const getCacheSize = useCallback(async () => {
    if (!('caches' in window)) return 0;
    
    let totalSize = 0;
    const cacheNames = await caches.keys();
    
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      const keys = await cache.keys();
      for (const request of keys) {
        const response = await cache.match(request);
        if (response) {
          const blob = await response.blob();
          totalSize += blob.size;
        }
      }
    }
    
    return totalSize;
  }, []);

  // 注册后台同步
  const registerSync = useCallback(async (tag: string) => {
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      const registration = await navigator.serviceWorker.ready;
      await (registration as any).sync.register(tag);
    }
  }, []);

  // 请求通知权限
  const requestNotificationPermission = useCallback(async () => {
    if (!('Notification' in window)) return false;
    
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }, []);

  // 发送本地通知
  const showNotification = useCallback(async (title: string, options?: NotificationOptions) => {
    if (!('Notification' in window)) return;
    
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;
    
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      return registration.showNotification(title, options);
    } else {
      return new Notification(title, options);
    }
  }, []);

  return {
    // 状态
    ...state,
    
    // 方法
    install,
    checkForUpdate,
    applyUpdate,
    dismissUpdate,
    clearCache,
    getCacheSize,
    registerSync,
    requestNotificationPermission,
    showNotification,
  };
}

// 检查是否已安装
function checkInstalled(): boolean {
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const isInWebAppiOS = (window.navigator as any).standalone === true;
  return isStandalone || isInWebAppiOS;
}

// Service Worker 消息通信
export function sendSWMessage(type: string, payload?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!navigator.serviceWorker.controller) {
      reject(new Error('No Service Worker controller'));
      return;
    }
    
    const messageChannel = new MessageChannel();
    messageChannel.port1.onmessage = (event) => {
      if (event.data.error) {
        reject(new Error(event.data.error));
      } else {
        resolve(event.data);
      }
    };
    
    navigator.serviceWorker.controller.postMessage(
      { type, payload },
      [messageChannel.port2]
    );
    
    // 超时处理
    setTimeout(() => reject(new Error('Message timeout')), 5000);
  };
}

// 注册周期性同步
export async function registerPeriodicSync(tag: string, minInterval: number = 24 * 60 * 60 * 1000) {
  if ('serviceWorker' in navigator && 'periodicSync' in window.ServiceWorkerRegistration.prototype) {
    const registration = await navigator.serviceWorker.ready;
    await (registration as any).periodicSync.register(tag, { minInterval });
  }
}

// 取消周期性同步
export async function unregisterPeriodicSync(tag: string) {
  if ('serviceWorker' in navigator && 'periodicSync' in window.ServiceWorkerRegistration.prototype) {
    const registration = await navigator.serviceWorker.ready;
    await (registration as any).periodicSync.unregister(tag);
  }
}

// 获取存储估算
export async function getStorageEstimate(): Promise<StorageEstimate | null> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    return await navigator.storage.estimate();
  }
  return null;
}

// 请求持久化存储
export async function requestPersistentStorage(): Promise<boolean> {
  if ('storage' in navigator && 'persist' in navigator.storage) {
    return await navigator.storage.persist();
  }
  return false;
}

// 检查存储是否持久化
export async function isStoragePersisted(): Promise<boolean> {
  if ('storage' in navigator && 'persisted' in navigator.storage) {
    return await navigator.storage.persisted();
  }
  return false;
}

// 离线检测 Hook
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  return isOnline;
}

// PWA 安装状态 Hook
export function usePWAInstallStatus() {
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  
  useEffect(() => {
    const checkInstalled = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isInWebAppiOS = (window.navigator as any).standalone === true;
      setIsInstalled(isStandalone || isInWebAppiOS);
    };
    
    checkInstalled();
    
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      // 可以存储 prompt 供后续使用
    };
    
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', () => setIsInstalled(true));
    
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', () => setIsInstalled(true));
    };
  }, []);
  
  return { isInstallable, isInstalled };
}