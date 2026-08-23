/**
 * SEO 工具模块
 * 提供动态 meta 标签生成、Open Graph、Twitter Cards、JSON-LD 结构化数据等
 */

export interface SEOData {
  title: string;
  description: string;
  canonical: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: 'website' | 'article';
  ogUrl?: string;
  twitterCard?: 'summary' | 'summary_large_image';
  twitterSite?: string;
  twitterCreator?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
  jsonLd?: Record<string, any>;
  noindex?: boolean;
  nofollow?: boolean;
  robots?: string;
  alternateLinks?: Array<{ hreflang: string; href: string }>;
}

export interface SEOConfig {
  siteName: string;
  siteUrl: string;
  defaultTitle: string;
  defaultDescription: string;
  defaultImage: string;
  twitterSite: string;
  twitterCreator: string;
  locale: string;
  themeColor: string;
}

// 默认 SEO 配置
export const defaultSEOConfig: SEOConfig = {
  siteName: 'TryCode',
  siteUrl: 'https://trycode.run',
  defaultTitle: 'TryCode - 在线运行 30+ 编程语言 | 免费在线代码运行器',
  defaultDescription: '免费在线代码运行器，支持 Python、JavaScript、TypeScript、Rust、Go、Java、C++ 等 30+ 语言。无需安装，即写即运，支持实时协作、AI 助手、包管理。',
  defaultImage: 'https://trycode.run/og-image.png',
  twitterSite: '@trycode',
  twitterCreator: '@trycode',
  locale: 'zh_CN',
  themeColor: '#00D4AA',
};

// 路由 SEO 配置表
export const routeSEOConfig: Record<string, SEOData> = {
  '/': {
    title: 'TryCode - 在线运行 30+ 编程语言 | 免费在线代码运行器',
    description: '免费在线代码运行器，支持 Python、JavaScript、TypeScript、Rust、Go、Java、C++ 等 30+ 语言。无需安装，即写即运，支持实时协作、AI 助手、包管理。',
    canonical: 'https://trycode.run/',
    ogTitle: 'TryCode - 在线代码运行器',
    ogDescription: '支持 30+ 编程语言的免费在线 IDE，即写即运，无需配置环境。',
    ogImage: 'https://trycode.run/og-image.png',
    ogType: 'website',
    ogUrl: 'https://trycode.run/',
    twitterCard: 'summary_large_image',
    twitterSite: '@trycode',
    twitterCreator: '@trycode',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'TryCode',
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Web',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      description: '在线运行 30+ 编程语言',
      featureList: [
        '30+ 编程语言支持',
        '实时协作编辑',
        'AI 代码助手',
        '包管理器集成',
        'WASM + 后端双模式执行'
      ],
      screenshot: 'https://trycode.run/screenshot.png',
      releaseNotes: 'https://trycode.run/changelog',
      datePublished: '2024-01-01',
      dateModified: '2024-12-01',
    },
  },
  '/editor': {
    title: '在线代码编辑器 - TryCode',
    description: '在浏览器中直接编写、运行代码。支持 30+ 编程语言，实时语法高亮、智能补全、错误检查。',
    canonical: 'https://trycode.run/editor',
    ogTitle: '在线代码编辑器 - TryCode',
    ogDescription: '在浏览器中直接编写、运行代码，支持 30+ 编程语言。',
    ogImage: 'https://trycode.run/og-editor.png',
    ogType: 'website',
    twitterCard: 'summary_large_image',
  },
  '/projects': {
    title: '我的项目 - TryCode',
    description: '管理你的代码项目，创建、编辑、分享、协作。支持文件夹、文件管理、版本控制。',
    canonical: 'https://trycode.run/projects',
    ogTitle: '我的项目 - TryCode',
    ogDescription: '管理你的代码项目，创建、编辑、分享、协作。',
    ogType: 'website',
  },
  '/login': {
    title: '登录 - TryCode',
    description: '登录 TryCode 访问你的项目、设置和协作功能。',
    canonical: 'https://trycode.run/login',
    noindex: true,
    nofollow: true,
  },
  '/register': {
    title: '注册 - TryCode',
    description: '创建 TryCode 账号，开始你的编程之旅。免费注册，即刻开始编码。',
    canonical: 'https://trycode.run/register',
    noindex: true,
    nofollow: true,
  },
  '/settings': {
    title: '设置 - TryCode',
    description: '管理你的账号设置、偏好、通知、API 密钥等。',
    canonical: 'https://trycode.run/settings',
    noindex: true,
    nofollow: true,
  },
  '/admin': {
    title: '管理后台 - TryCode',
    description: 'TryCode 管理后台，系统配置、用户管理、执行监控、审计日志。',
    canonical: 'https://trycode.run/admin',
    noindex: true,
    nofollow: true,
  },
  '/docs': {
    title: '文档 - TryCode',
    description: 'TryCode 官方文档，快速开始、API 参考、最佳实践、常见问题。',
    canonical: 'https://trycode.run/docs',
    ogTitle: '文档 - TryCode',
    ogDescription: 'TryCode 官方文档，快速开始、API 参考、最佳实践。',
  },
  '/share': {
    title: '分享代码 - TryCode',
    description: '分享你的代码片段，生成链接、设置密码、过期时间、权限控制。',
    canonical: 'https://trycode.run/share',
    ogTitle: '分享代码 - TryCode',
    ogDescription: '分享代码片段，生成链接、设置密码、过期时间。',
  },
};

// 动态路由 SEO 配置生成器
export function generateDynamicSEO(
  route: string,
  params: Record<string, string> = {}
): SEOData {
  const baseConfig = routeSEOConfig[route];

  // 替换参数
  const replaceParams = (str: string) => {
    return str.replace(/\{(\w+)\}/g, (_, key) => params[key] || `{${key}}`);
  };

  if (!baseConfig) {
    return {
      title: defaultSEOConfig.defaultTitle,
      description: defaultSEOConfig.defaultDescription,
      canonical: `${defaultSEOConfig.siteUrl}${route}`,
    };
  }

  return {
    ...baseConfig,
    title: replaceParams(baseConfig.title),
    description: replaceParams(baseConfig.description),
    canonical: replaceParams(baseConfig.canonical),
    ogTitle: baseConfig.ogTitle ? replaceParams(baseConfig.ogTitle) : undefined,
    ogDescription: baseConfig.ogDescription ? replaceParams(baseConfig.ogDescription) : undefined,
    ogImage: baseConfig.ogImage ? replaceParams(baseConfig.ogImage) : undefined,
    ogUrl: baseConfig.ogUrl ? replaceParams(baseConfig.ogUrl) : undefined,
    twitterTitle: baseConfig.twitterTitle ? replaceParams(baseConfig.twitterTitle) : undefined,
    twitterDescription: baseConfig.twitterDescription ? replaceParams(baseConfig.twitterDescription) : undefined,
    twitterImage: baseConfig.twitterImage ? replaceParams(baseConfig.twitterImage) : undefined,
    jsonLd: baseConfig.jsonLd ? replaceJSONLDParams(baseConfig.jsonLd, params) : undefined,
  };
}

function replaceJSONLDParams(obj: any, params: Record<string, string>): any {
  if (typeof obj === 'string') {
    return obj.replace(/\{(\w+)\}/g, (_, key) => params[key] || `{${key}}`);
  }
  if (Array.isArray(obj)) {
    return obj.map(item => replaceJSONLDParams(item, params));
  }
  if (obj !== null && typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = replaceJSONLDParams(value, params);
    }
    return result;
  }
  return obj;
}

// 生成 meta 标签字符串
export function generateMetaTags(seo: SEOData, config: SEOConfig = defaultSEOConfig): string {
  const tags: string[] = [];

  // 基础 meta
  tags.push(`<title>${escapeHtml(seo.title)}</title>`);
  tags.push(`<meta name="description" content="${escapeHtml(seo.description)}" />`);
  tags.push(`<link rel="canonical" href="${seo.canonical}" />`);

  // Robots
  if (seo.noindex || seo.nofollow) {
    const robots = [
      seo.noindex ? 'noindex' : 'index',
      seo.nofollow ? 'nofollow' : 'follow',
    ].join(', ');
    tags.push(`<meta name="robots" content="${robots}" />`);
  }
  if (seo.robots) {
    tags.push(`<meta name="robots" content="${seo.robots}" />`);
  }

  // Open Graph
  tags.push(`<meta property="og:type" content="${seo.ogType || 'website'}" />`);
  tags.push(`<meta property="og:url" content="${seo.ogUrl || seo.canonical}" />`);
  tags.push(`<meta property="og:title" content="${escapeHtml(seo.ogTitle || seo.title)}" />`);
  tags.push(`<meta property="og:description" content="${escapeHtml(seo.ogDescription || seo.description)}" />`);
  if (seo.ogImage) {
    tags.push(`<meta property="og:image" content="${seo.ogImage}" />`);
    tags.push(`<meta property="og:image:width" content="1200" />`);
    tags.push(`<meta property="og:image:height" content="630" />`);
  }
  tags.push(`<meta property="og:site_name" content="${config.siteName}" />`);
  tags.push(`<meta property="og:locale" content="${config.locale}" />`);

  // Twitter Card
  tags.push(`<meta name="twitter:card" content="${seo.twitterCard || 'summary_large_image'}" />`);
  if (seo.twitterSite) tags.push(`<meta name="twitter:site" content="${seo.twitterSite}" />`);
  if (seo.twitterCreator) tags.push(`<meta name="twitter:creator" content="${seo.twitterCreator}" />`);
  tags.push(`<meta name="twitter:title" content="${escapeHtml(seo.twitterTitle || seo.ogTitle || seo.title)}" />`);
  tags.push(`<meta name="twitter:description" content="${escapeHtml(seo.twitterDescription || seo.ogDescription || seo.description)}" />`);
  if (seo.twitterImage || seo.ogImage) {
    tags.push(`<meta name="twitter:image" content="${seo.twitterImage || seo.ogImage}" />`);
  }

  // 备用链接
  if (seo.alternateLinks) {
    for (const link of seo.alternateLinks) {
      tags.push(`<link rel="alternate" hreflang="${link.hreflang}" href="${link.href}" />`);
    }
  }

  // JSON-LD 结构化数据
  if (seo.jsonLd) {
    tags.push(`<script type="application/ld+json">${JSON.stringify(seo.jsonLd, null, 2)}</script>`);
  }

  // Favicon & Theme
  tags.push(`<link rel="icon" type="image/svg+xml" href="/favicon.svg" />`);
  tags.push(`<meta name="theme-color" content="${config.themeColor}" />`);
  tags.push(`<link rel="preconnect" href="https://fonts.googleapis.com" />`);
  tags.push(`<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />`);

  return tags.join('\n    ');
}

// HTML 转义
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#039;');
}

// React Hook：在组件中使用 SEO
import { useEffect } from 'react';

export function useSEO(seo: SEOData, _config: SEOConfig = defaultSEOConfig) {
  useEffect(() => {
    // 更新 document.title
    document.title = seo.title;

    // 更新或创建 meta 标签
    const updateMeta = (name: string, content: string, isProperty = false) => {
      const selector = isProperty ? `meta[property="${name}"]` : `meta[name="${name}"]`;
      let meta = document.querySelector(selector) as HTMLMetaElement;
      if (!meta) {
        meta = document.createElement('meta');
        if (isProperty) {
          meta.setAttribute('property', name);
        } else {
          meta.setAttribute('name', name);
        }
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', content);
    };

    const updateLink = (rel: string, href: string, attrs: Record<string, string> = {}) => {
      let link = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.setAttribute('rel', rel);
        document.head.appendChild(link);
      }
      link.setAttribute('href', href);
      Object.entries(attrs).forEach(([key, value]) => link.setAttribute(key, value));
    };

    // 更新 title
    document.title = seo.title;

    // 基础 meta
    updateMeta('description', seo.description);
    updateLink('canonical', seo.canonical);

    // Robots
    if (seo.noindex || seo.nofollow) {
      const robots = [
        seo.noindex ? 'noindex' : 'index',
        seo.nofollow ? 'nofollow' : 'follow',
      ].join(', ');
      updateMeta('robots', robots);
    }

    // Open Graph
    const ogData = {
      'og:type': seo.ogType || 'website',
      'og:url': seo.ogUrl || seo.canonical,
      'og:title': seo.ogTitle || seo.title,
      'og:description': seo.ogDescription || seo.description,
      'og:image': seo.ogImage || '',
      'og:site_name': 'TryCode',
      'og:locale': 'zh_CN',
    };
    Object.entries(ogData).forEach(([key, value]) => {
      if (value) updateMeta(key, value, true);
    });

    // Twitter Card
    const twitterData = {
      'twitter:card': 'summary_large_image',
      'twitter:title': seo.title,
      'twitter:description': seo.description,
      'twitter:image': seo.ogImage || '',
      'twitter:site': '@trycode',
    };
    Object.entries(twitterData).forEach(([key, value]) => {
      if (value) updateMeta(key, value, true);
    });

    // JSON-LD
    const existingScript = document.querySelector('script[type="application/ld+json"]');
    if (existingScript) existingScript.remove();
    if (seo.jsonLd) {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(seo.jsonLd, null, 2);
      document.head.appendChild(script);
    }

    // Cleanup
    return () => {
      // Cleanup 可选
    };
  }, [seo]);
}
