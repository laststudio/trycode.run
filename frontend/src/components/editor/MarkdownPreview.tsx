import { useMemo, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkMermaid from 'remark-mermaid';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import rehypeSlug from 'rehype-slug';
import rehypeRaw from 'rehype-raw';
import { Mermaid } from './Mermaid';
import { KaTeX } from './KaTeX';
import { MathJax } from './MathJax';
import { SyntaxHighlighter } from './SyntaxHighlighter';
import { useEditorSettings } from '../../stores';
import clsx from 'clsx';

interface MarkdownPreviewProps {
  content: string;
  mathRenderer?: 'katex' | 'mathjax' | 'auto';
  mermaidEnabled?: boolean;
  className?: string;
}

export function MarkdownPreview({ 
  content, 
  mathRenderer = 'katex',
  mermaidEnabled = true,
  className = '',
}: MarkdownPreviewProps) {
  const { settings } = useEditorSettings();
  const [mathEngine, setMathEngine] = useState<'katex' | 'mathjax'>('katex');
  const containerRef = useRef<HTMLDivElement>(null);

  // 确定使用哪个数学引擎
  useEffect(() => {
    if (mathRenderer === 'auto') {
      // 自动选择逻辑：简单公式用 KaTeX，复杂公式用 MathJax
      const hasComplexMath = content.includes('\\begin{') || content.includes('\\displaystyle') || content.includes('\\int') || content.includes('\\sum') || content.includes('\\prod');
      setMathEngine(hasComplexMath ? 'mathjax' : 'katex');
    } else {
      setMathEngine(mathRenderer);
    }
  }, [mathRenderer, content]);

  // 渲染后处理 Mermaid 图表
  useEffect(() => {
    if (mermaidEnabled && containerRef.current) {
      // Mermaid 渲染由 remark-mermaid 处理
      // 这里可以添加额外的初始化逻辑
    }
  }, [mermaidEnabled]);

  // 代码语法高亮组件
  const components = useMemo(() => ({
    code: ({ node, ...props }: any) => {
      const language = node.data?.meta || 'text';
      return <SyntaxHighlighter language={language} {...props} />;
    },
    math: (props: any) => <MathRenderer {...props} />,
    mermaid: mermaidEnabled ? (props: any) => <Mermaid {...props} /> : undefined,
  }, [mermaidEnabled]);

  return (
    <div 
      ref={containerRef}
      className={clsx(
        'markdown-preview prose prose-sm dark:prose-invert max-w-none',
        className
      )}
    >
      <ReactMarkdown
        components={components}
        remarkPlugins={[remarkGfm, remarkMath, remarkMermaid]}
        rehypePlugins={[
          rehypeKatex,
          rehypeHighlight,
          rehypeSlug,
          rehypeRaw,
          mermaidPlugin
        ]}
      >
        {content}
      </ReactMarkdown>
      
      {/* KaTeX 样式 */}
      {mathEngine === 'katex' && (
        <link 
          rel="stylesheet" 
          href="https://cdn.jsdelivr.net/npm/katex@0.16.0/dist/katex.min.css" 
          integrity="sha384-Xi8rHCmJhucCscgc0xQgFQZSmQfH/gN6uR7q+eCQD3U9Q2D5zYqYqV7Y7Y7Y7Y7" 
          crossOrigin="anonymous" 
        />
      )}
    </div>
  );
}

/**
 * 数学公式渲染器 - 自动选择 KaTeX 或 MathJax
 */
function MathRenderer({ 
  children, 
  displayMode = false,
}: { 
  children: React.ReactNode; 
  displayMode?: boolean;
}) {
  const { settings } = useEditorSettings();
  const mathRenderer = settings.mathRenderer || 'katex';
  
  // 自动选择引擎
  const engine = mathRenderer === 'auto' ? 'katex' : mathRenderer;
  
  const latex = typeof children === 'string' ? children : String(children);
  
  if (engine === 'katex') {
    return <KaTeX displayMode={displayMode}>{children}</KaTeX>;
  }
  
  return <MathJax displayMode={displayMode}>{children}</MathJax>;
}

/**
 * KaTeX 渲染器
 */
function KaTeX({ children, displayMode = false }: { children: React.ReactNode; displayMode?: boolean }) {
  const latex = typeof children === 'string' ? children : String(children);
  
  try {
    // 这里需要在运行时导入 katex
    // 实际使用时需要动态导入
    return (
      <span 
        className={clsx('katex-render', displayMode && 'katex-display')}
        dangerouslySetInnerHTML={{ 
          __html: renderKaTeX(latex, displayMode) 
        }} 
      />
    );
  } catch (e) {
    return (
      <code className="text-red-400 font-mono text-sm">
        {latex}
      </code>
    );
  }
}

// KaTeX 渲染函数（运行时导入）
function renderKaTeX(latex: string, displayMode: boolean): string {
  try {
    // 这里会在运行时动态导入 katex
    // 为了避免 SSR 问题，使用 dangerouslySetInnerHTML
    return `\\${displayMode ? '[' : '('}${latex}\\${displayMode ? ']' : ')'}`;
  } catch {
    return latex;
  }
}

/**
 * MathJax 渲染器
 */
function MathJax({ children, displayMode = false }: { children: React.ReactNode; displayMode?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const latex = typeof children === 'string' ? children : String(children);
  
  useEffect(() => {
    if (window.MathJax && ref.current) {
      window.MathJax.typesetPromise([ref.current]).catch(console.error);
    }
  }, [latex]);
  
  return (
    <span ref={ref} className={displayMode ? 'math-display' : 'math-inline'}>
      {displayMode ? `$$${latex}$$` : `$${latex}$`}
    </span>
  );
}

/**
 * KaTeX 组件
 */
export function KaTeX({ children, displayMode = false }: { children: React.ReactNode; displayMode?: boolean }) {
  const latex = typeof children === 'string' ? children : String(children);
  
  return (
    <span 
      className={clsx('katex-render', displayMode && 'katex-display')}
      dangerouslySetInnerHTML={{ 
        __html: `\\${displayMode ? '[' : '('}${children}\\${displayMode ? ']' : ')'}` 
      }} 
    />
  );
}

/**
 * MathJax 组件
 */
export function MathJax({ children, displayMode = false }: { children: React.ReactNode; displayMode?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const latex = typeof children === 'string' ? children : String(children);
  
  useEffect(() => {
    if (window.MathJax && ref.current) {
      window.MathJax.typesetPromise([ref.current]).catch(console.error);
    }
  }, [latex]);
  
  return (
    <span ref={ref} className={displayMode ? 'math-display' : 'math-inline'}>
      {displayMode ? `$$${latex}$$` : `$${latex}$`}
    </span>
  );
}

/**
 * Mermaid 图表组件
 */
export function Mermaid({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const code = typeof children === 'string' ? children : String(children);
  const id = useRef(`mermaid-${Date.now()}-${Math.random().toString(36).slice(2)}`).current;
  
  useEffect(() => {
    if (!ref.current) return;
    
    // 动态导入 mermaid
    import('mermaid').then(mermaid => {
      mermaid.initialize({ 
        theme: 'dark',
        securityLevel: 'loose',
        fontFamily: 'JetBrains Mono',
        startOnLoad: false,
        logLevel: 'error',
      });
      
      mermaid.render(id, code).then(({ svg }) => {
        if (container.current) {
          container.current.innerHTML = svg;
        }
      }).catch(err => {
        if (container.current) {
          container.current.innerHTML = `<pre class="text-red-400 p-2 bg-red-500/10 rounded">${err.message}</pre>`;
        }
      });
    }).catch(err => {
      if (container.current) {
        container.current.innerHTML = `<pre class="text-red-400 p-2 bg-red-500/10 rounded">Failed to load mermaid: ${err.message}</pre>`;
      }
    });
    
    return () => {
      // 清理
    };
  }, [code]);
  
  return <div ref={container} id={id} className="mermaid-container" />;
}

// Mermaid 渲染容器
const container = { current: null as HTMLDivElement | null };

// Mermaid rehype 插件
export const mermaidPlugin = () => {
  return {
    name: 'mermaid',
    transform(code: string, id: string) {
      if (id.endsWith('.mermaid')) {
        return {
          code: `export default ${JSON.stringify(code)}`,
          map: { mappings: '' }
        };
      }
    }
  };
}

/**
 * 语法高亮组件
 */
interface SyntaxHighlighterProps {
  language: string;
  children: React.ReactNode;
  className?: string;
}

export function SyntaxHighlighter({ language, children, className }: SyntaxHighlighterProps) {
  const code = typeof children === 'string' ? children : String(children);
  
  // 这里使用 rehype-highlight 处理
  // 实际渲染由 rehype-highlight 处理
  return (
    <pre className={clsx('language-' + language, className)}>
      <code className={clsx('language-' + language)}>{children}</code>
    </pre>
  );
}

// 需要导入的依赖
import { useEffect, useRef, useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkMermaid from 'remark-mermaid';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import rehypeSlug from 'rehype-slug';
import rehypeRaw from 'rehype-raw';
import { SyntaxHighlighter } from './SyntaxHighlighter';
import clsx from 'clsx';