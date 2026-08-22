/**
 * 生成 sitemap.xml
 * 在构建时运行: node scripts/generate-sitemap.js
 */

import { writeFileSync } from 'fs';
import { join } from 'path';

// 站点配置
const siteUrl = 'https://trycode.run';
const lastmod = new Date().toISOString().split('T')[0];

// 静态路由
const staticRoutes = [
  { url: '/', changefreq: 'weekly', priority: 1.0 },
  { url: '/editor', changefreq: 'weekly', priority: 0.9 },
  { url: '/projects', changefreq: 'daily', priority: 0.8 },
  { url: '/docs', changefreq: 'weekly', priority: 0.7 },
  { url: '/pricing', changefreq: 'monthly', priority: 0.6 },
  { url: '/about', changefreq: 'monthly', priority: 0.5 },
  { url: '/login', changefreq: 'yearly', priority: 0.3 },
  { url: '/register', changefreq: 'yearly', priority: 0.3 },
  { url: '/settings', changefreq: 'monthly', priority: 0.4 },
  { url: '/docs/getting-started', changefreq: 'weekly', priority: 0.8 },
  { url: '/docs/guide', changefreq: 'weekly', priority: 0.7 },
  { url: '/docs/api', changefreq: 'weekly', priority: 0.7 },
  { url: '/docs/languages', changefreq: 'weekly', priority: 0.7 },
  { url: '/docs/features', changefreq: 'weekly', priority: 0.7 },
  { url: '/docs/faq', changefreq: 'monthly', priority: 0.5 },
  { url: '/changelog', changefreq: 'weekly', priority: 0.6 },
  { url: '/changelog/v1.0.0', changefreq: 'yearly', priority: 0.5 },
  { url: '/privacy', changefreq: 'yearly', priority: 0.3 },
  { url: '/terms', changefreq: 'yearly', priority: 0.3 },
  { url: '/contact', changefreq: 'monthly', priority: 0.4 },
  { url: '/status', changefreq: 'daily', priority: 0.5 },
];

// 动态路由（需要从数据库获取，这里提供模板）
const dynamicRoutes = [
  // 项目页面: /projects/:id
  // 分享页面: /share/:token
  // 文档页面: /docs/:slug
];

function generateSitemap() {
  const urls = staticRoutes.map(route => ({
    url: `${siteUrl}${route.url}`,
    lastmod,
    changefreq: route.changefreq,
    priority: route.priority,
  }));

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ';
  xml += 'xmlns:xhtml="http://www.w3.org/1999/xhtml">\n';

  for (const route of urls) {
    xml += '  <url>\n';
    xml += `    <loc>${escapeXml(route.url)}</loc>\n`;
    xml += `    <lastmod>${route.lastmod}</lastmod>\n`;
    xml += `    <changefreq>${route.changefreq}</changefreq>\n`;
    xml += `    <priority>${route.priority.toFixed(1)}</priority>\n`;
    xml += '  </url>\n';
  }

  xml += '</urlset>';

  // 写入文件
  const outputPath = join(process.cwd(), 'frontend', 'dist', 'sitemap.xml');
  writeFileSync(outputPath, xml);
  console.log(`Sitemap generated at ${outputPath}`);
  console.log(`Total URLs: ${urls.length}`);
}

function escapeXml(str: string): string {
  return String(str)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&apos;');
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  generateSitemap();
}

export { generateSitemap };