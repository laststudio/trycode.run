import { useEffect, useRef } from 'react';

interface MermaidProps {
  children?: React.ReactNode;
  chart?: string;
  className?: string;
}

/**
 * Mermaid 图表渲染组件
 */
export function Mermaid({ children, chart, className }: MermaidProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const code = (chart !== undefined ? chart : typeof children === 'string' ? children : String(children ?? ''))
    .replace(/^mermaid\s*/, '')
    .trim();

  useEffect(() => {
    let cancelled = false;
    if (!containerRef.current || !code) return;

    import('mermaid')
      .then((mod: any) => {
        const mermaid = mod.default ?? mod;
        mermaid.initialize({
          theme: 'dark',
          securityLevel: 'loose',
          fontFamily: 'JetBrains Mono',
          startOnLoad: false,
          logLevel: 'error',
        });

        const id = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        Promise.resolve(mermaid.render(id, code)).then((result: any) => {
          const svg = result?.svg ?? result;
          if (!cancelled && containerRef.current) {
            containerRef.current.innerHTML = svg;
          }
        }).catch((err: Error) => {
          if (!cancelled && containerRef.current) {
            containerRef.current.innerHTML =
              `<pre class="text-red-400 p-2 bg-red-500/10 rounded">${err.message}</pre>`;
          }
        });
      })
      .catch((err: Error) => {
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML =
            `<pre class="text-red-400 p-2 bg-red-500/10 rounded">Failed to load mermaid: ${err.message}</pre>`;
        }
      });

    return () => {
      cancelled = true;
    };
  }, [code]);

  return <div ref={containerRef} className={className || 'mermaid-container'} />;
}

export default Mermaid;
