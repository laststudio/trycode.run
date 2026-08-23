import { renderToPipeableStream } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { HelmetProvider } from 'react-helmet-async';
import { App } from './App';

interface SSRContext {
  url: string;
  manifest: any;
  helmetContext: {};
}

export async function renderApp(context: SSRContext) {
  const { url, manifest } = context;
  const helmetContext = {};
  
  return new Promise<{ html: string; helmet: any }>((resolve, reject) => {
    const stream = renderToPipeableStream(
      <HelmetProvider context={helmetContext}>
        <StaticRouter location={url}>
          <App />
        </StaticRouter>
      </HelmetProvider>,
      {
        onShellReady() {
          const helmet = (window as any).Helmet?.renderStatic ? (window as any).Helmet.renderStatic(helmetContext) : helmetContext;
          let html = '';
          stream.pipe({
            write(chunk: string) { html += chunk; },
            end() {
              // 注入 helmet 标签
              const helmetTags = `
                ${helmet.title?.toString() || ''}
                ${helmet.meta?.toString() || ''}
                ${helmet.link?.toString() || ''}
                ${helmet.script?.toString() || ''}
                ${helmet.noscript?.toString() || ''}
              `;
              
              const fullHtml = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content="#00D4AA" />
  ${helmetTags}
  <script type="module" src="/src/entry-client.tsx"></script>
</head>
<body>
  <div id="root">${html}</div>
</body>
</html>`;
              resolve({ html: fullHtml, helmet });
            }
          });
        },
        onError: reject
      }
    );
  });
}
