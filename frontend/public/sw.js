// TryCode Service Worker
// Version: 1.0.0

const CACHE_NAME = 'trycode-v1.0.0';
const STATIC_CACHE = 'trycode-static-v1';
const DYNAMIC_CACHE = 'trycode-dynamic-v1';
const API_CACHE = 'trycode-api-v1';

// 需要缓存的静态资源
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  // 编辑器相关资源会在运行时缓存
];

// 缓存策略配置
const CACHE_STRATEGIES = {
  // 静态资源：Cache First
  static: 'cache-first',
  // API 请求：Network First，回退到缓存
  api: 'network-first',
  // 编辑器资源：Stale While Revalidate
  editor: 'stale-while-revalidate',
  // 字体和图片：Cache First
  fonts: 'cache-first',
  images: 'cache-first',
};

// 缓存过期时间（毫秒）
const CACHE_EXPIRY = {
  static: 30 * 24 * 60 * 60 * 1000,  // 30 天
  dynamic: 7 * 24 * 60 * 60 * 1000,  // 7 天
  api: 5 * 60 * 1000,                // 5 分钟
  editor: 24 * 60 * 60 * 1000,       // 1 天
};

// 需要离线可用的页面
const OFFLINE_PAGES = [
  '/',
  '/editor',
  '/projects',
  '/docs',
];

// 当前缓存版本
let currentCacheVersion = 'v1.0.0';

// 安装事件
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await cache.addAll(STATIC_ASSETS);
      console.log('[SW] Static assets cached');
      
      // 跳过等待，立即激活
      await self.skipWaiting();
    })()
  );
});

// 激活事件
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // 清理旧缓存
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter(name => 
            name !== STATIC_CACHE && 
            name !== DYNAMIC_CACHE && 
            name !== API_CACHE &&
            name.startsWith('trycode-')
          )
          .map(name => caches.delete(name))
      );
      
      console.log('[SW] Old caches cleaned');
      
      // 立即控制所有客户端
      await self.clients.claim();
    })()
  );
});

// 拦截请求
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // 只处理同源请求
  if (url.origin !== location.origin) {
    return;
  }
  
  // 判断请求类型并应用相应策略
  const strategy = getCacheStrategy(request);
  
  event.respondWith(handleRequest(request, strategy));
});

// 确定缓存策略
function getCacheStrategy(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  // API 请求
  if (pathname.startsWith('/api/')) {
    return 'api';
  }
  
  // 静态资源
  if (
    pathname.startsWith('/assets/') ||
    pathname.startsWith('/static/') ||
    pathname.match(/\.(js|css|woff2?|ttf|eot|ico|png|jpg|jpeg|gif|webp|svg|woff2)$/)
  ) {
    return 'static';
  }
  
  // 编辑器相关页面
  if (pathname.startsWith('/editor') || pathname.startsWith('/projects')) {
    return 'editor';
  }
  
  // API 请求
  if (pathname.startsWith('/api/')) {
    return 'api';
  }
  
  // 字体文件
  if (pathname.match(/\.(woff2?|ttf|eot)$/)) {
    return 'fonts';
  }
  
  // 图片文件
  if (pathname.match(/\.(png|jpg|jpeg|gif|webp|svg)$/)) {
    return 'images';
  }
  
  // 默认策略
  return 'editor';
}

// 处理请求的主函数
async function handleRequest(request, strategy) {
  switch (strategy) {
    case 'cache-first':
      return cacheFirst(request);
    case 'network-first':
      return networkFirst(request);
    case 'stale-while-revalidate':
      return staleWhileRevalidate(request);
    case 'network-only':
      return networkOnly(request);
    case 'cache-only':
      return cacheOnly(request);
    default:
      return networkFirst(request);
  }
}

// Cache First 策略
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    // 后台更新缓存
    fetchAndCache(request).catch(() => {});
    return cached;
  }
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

// Network First 策略
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    // 返回离线页面
    if (request.mode === 'navigate') {
      return caches.match('/offline.html') || new Response('Offline', { status: 503 });
    }
    return new Response('Offline', { status: 503 });
  }
}

// Stale While Revalidate 策略
async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) {
      const cache = caches.open(DYNAMIC_CACHE);
      cache.then(c => c.put(request, response.clone()));
    }
    return response;
  }).catch(() => null);
  
  // 立即返回缓存（如果有），否则等待网络
  return cached || fetchPromise;
}

// Network Only 策略
async function networkOnly(request) {
  return fetch(request);
}

// Cache Only 策略
async function cacheOnly(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  return new Response('Not cached', { status: 504 });
}

// 获取并缓存响应
async function fetchAndCache(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      await cache.put(request, response.clone());
    }
  } catch (error) {
    // 静默失败
  }
}

// 消息处理
self.addEventListener('message', (event) => {
  const { type, payload } = event.data;
  
  switch (event.data.type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'CLEAR_CACHE':
      clearAllCaches().then(() => {
        event.ports[0]?.postMessage({ success: true });
      });
      break;
      
    case 'GET_CACHE_SIZE':
      getCacheSize().then(size => {
        event.ports[0]?.postMessage({ size });
      });
      break;
      
    case 'PREFETCH_URLS':
      prefetchUrls(payload.urls);
      break;
      
    case 'CLEAR_EXPIRED':
      clearExpiredCaches().then(() => {
        event.ports[0]?.postMessage({ success: true });
      });
      break;
      
    default:
      console.log('[SW] Unknown message:', event.data.type);
  }
});

// 清理所有缓存
async function clearAllCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map(name => caches.delete(name)));
}

// 获取缓存大小
async function getCacheSize() {
  let totalSize = 0;
  const cacheNames = await caches.keys();
  
  for (const name of cacheNames) {
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
}

// 预获取 URL
async function prefetchUrls(urls) {
  const cache = await caches.open(DYNAMIC_CACHE);
  await Promise.allSettled(
    urls.map(url => 
      fetch(url).then(response => {
        if (response.ok) {
          return cache.put(url, response.clone());
        }
      })
  );
}

// 清理过期缓存
async function clearExpiredCaches() {
  const cacheNames = await caches.keys();
  
  for (const name of cacheNames) {
    if (!name.startsWith('trycode-')) continue;
    
    const cache = await caches.open(name);
    const keys = await cache.keys();
    
    for (const request of keys) {
      const response = await cache.match(request);
      if (response) {
        const dateHeader = response.headers.get('date');
        if (dateHeader) {
          const age = Date.now() - new Date(dateHeader).getTime();
          const maxAge = CACHE_EXPIRY.dynamic;
          if (age > maxAge) {
            await cache.delete(request);
          }
        }
      }
    }
  }
}

// 推送通知处理
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  const data = event.data.json();
  const options = {
    body: data.body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: data.data || {},
    actions: data.actions || [],
    requireInteraction: data.requireInteraction || false,
    silent: data.silent || false,
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// 通知点击处理
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const action = event.action;
  const data = event.notification.data;
  
  let url = '/';
  
  if (action === 'open') {
    url = data.url || '/';
  } else if (action === 'dismiss') {
    return;
  } else {
    url = data.url || '/';
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clients => {
        // 尝试找到已打开的窗口
        for (const client of clients) {
          if (client.url === url && 'focus' in client) {
            return client.focus();
          }
        }
        // 如果没有找到，打开新窗口
        return clients.openWindow(url);
      })
  );
}

// 后台同步
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-executions') {
    event.waitUntil(syncExecutions());
  } else if (event.tag === 'sync-projects') {
    event.waitUntil(syncProjects());
  }
});

// 后台同步执行记录
async function syncExecutions() {
  // 实现执行记录同步逻辑
  console.log('[SW] Syncing executions...');
}

// 同步项目
async function syncProjects() {
  // 实现项目同步逻辑
  console.log('[SW] Syncing projects...');
}

// 定期清理过期缓存
setInterval(() => {
  clearExpiredCaches().catch(console.error);
}, 60 * 60 * 1000); // 每小时运行一次

// 导出给测试使用
if (typeof module !== 'undefined') {
  module.exports = {
    getCacheStrategy,
    cacheFirst,
    networkFirst,
    staleWhileRevalidate,
    clearExpiredCaches,
  };
}