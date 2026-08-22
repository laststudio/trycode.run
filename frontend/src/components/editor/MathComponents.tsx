import { useMemo, useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkMermaid from 'remark-mermaid';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import rehypeSlug from 'rehype-slug';
import rehypeRaw from 'rehype-raw';
import { Mermaid } from './MathComponents';
import { KaTeX } from './MathComponents';
import { MathJax } from './MathComponents';
import { SyntaxHighlighter } from './SyntaxHighlighter';
import { useEditorSettings } from '../../stores';
import { useEditorStore } from '../../stores';
import clsx from 'clsx';

interface MarkdownPreviewPanelProps {
  content: string;
  language?: string;
  mathRenderer?: 'katex' | 'mathjax' | 'auto';
  mermaidEnabled?: boolean;
  className?: string;
  onScroll?: (scrollTop: number, scrollHeight: number, clientHeight: number) => void;
  syncScroll?: boolean;
}

export function MarkdownPreviewPanel({ 
  content, 
  language = 'markdown',
  mathRenderer = 'katex',
  mermaidEnabled = true,
  className = '',
  onScroll,
  syncScroll = true,
}: MarkdownPreviewPanelProps) {
  const { settings } = useEditorSettings();
  const { fileContents, selectedFileId } = useEditorStore();
  const [mathEngine, setMathEngine] = useState<'katex' | 'mathjax'>('katex');
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const [scrollPosition, setScrollPosition] = useState({ top: 0, height: 0, clientHeight: 0 });

  // 确定使用哪个数学引擎
  useEffect(() => {
    if (mathRenderer === 'auto') {
      // 自动选择逻辑：简单公式用 KaTeX，复杂公式用 MathJax
      const hasComplexMath = content.includes('\\begin{') || content.includes('\\displaystyle') || 
        content.includes('\\int') || content.includes('\\sum') || content.includes('\\prod') ||
        content.includes('\\frac') || content.includes('\\sqrt') || content.includes('\\sum') ||
        content.includes('\\prod') || content.includes('\\int') || content.includes('\\oint');
      setMathEngine(hasComplexMath ? 'mathjax' : 'katex');
    } else {
      setMathEngine(mathRenderer);
    }
  }, [mathRenderer, content]);

  // 同步滚动
  useEffect(() => {
    if (!syncScroll || !editorRef.current || !containerRef.current) return;

    const handleEditorScroll = () => {
      if (!editorRef.current || !containerRef.current) return;
      
      const editor = editorRef.current;
      const preview = containerRef.current;
      
      const editorScrollTop = editor.scrollTop;
      const editorScrollHeight = editor.scrollHeight - editor.clientHeight;
      const previewScrollHeight = preview.scrollHeight - preview.clientHeight;
      
      if (editorScrollHeight > 0 && previewScrollHeight > 0) {
        const ratio = editorScrollTop / editorScrollHeight;
        preview.scrollTop = ratio * previewScrollHeight;
      }
    };

    const editorElement = document.querySelector('.monaco-editor .view-lines') as HTMLElement;
    if (editorElement) {
      editorElement.addEventListener('scroll', handleEditorScroll);
      return () => editorElement.removeEventListener('scroll', handleEditorScroll);
    }
  }, [syncScroll]);

  // 处理预览区域滚动
  const handlePreviewScroll = useCallback(() => {
    if (!containerRef.current) return;
    
    const scrollTop = containerRef.current.scrollTop;
    const scrollHeight = containerRef.current.scrollHeight;
    const clientHeight = containerRef.current.clientHeight;
    
    setScrollPosition({ top: scrollTop, height: scrollHeight, clientHeight });
    onScroll?.(scrollTop, scrollHeight, clientHeight);
  }, [onScroll]);

  // 确定使用哪个数学引擎
  const [mathEngine, setMathEngine] = useState<'katex' | 'mathjax'>('katex');

  useEffect(() => {
    if (mathRenderer === 'auto') {
      const hasComplexMath = content.includes('\\begin{') || content.includes('\\displaystyle') || 
        content.includes('\\int') || content.includes('\\sum') || content.includes('\\prod') ||
        content.includes('\\frac') || content.includes('\\sqrt') || content.includes('\\sum') ||
        content.includes('\\prod') || content.includes('\\int') || content.includes('\\oint');
      setMathEngine(hasComplexMath ? 'mathjax' : 'katex');
    } else {
      setMathEngine(mathRenderer);
    }
  }, [mathRenderer, content]);

  // 代码语法高亮组件
  const components = useMemo(() => ({
    code: ({ node, ...props }: any) => {
      const language = node.data?.meta || 'text';
      return <SyntaxHighlighter language={language} {...props} />;
    },
    math: (props: any) => <MathRenderer {...props} />,
    mermaid: mermaidEnabled ? (props: any) => <Mermaid {...props} /> : undefined,
  }, [mermaidEnabled, mathRenderer]);

  return (
    <div 
      ref={containerRef}
      className={clsx(
        'markdown-preview prose prose-sm dark:prose-invert max-w-none',
        className
      )}
      onScroll={handlePreviewScroll}
      style={{ height: '100%', overflow: 'auto' }}
    >
      <ReactMarkdown
        components={{
          code: ({ node, ...props }: any) => {
            const language = node.data?.meta || 'text';
            return <SyntaxHighlighter language={language} {...props} />;
          },
          math: (props: any) => <MathRenderer {...props} />,
          mermaid: mermaidEnabled ? (props: any) => <Mermaid {...props} /> : undefined,
        }}
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
 * KaTeX 渲染器组件
 */
export function KaTeX({ 
  children, 
  displayMode = false,
  errorColor = '#ef4444',
}: { 
  children: React.ReactNode; 
  displayMode?: boolean;
  errorColor?: string;
}) {
  const latex = typeof children === 'string' ? children : String(children);
  const [html, setHtml] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const elementRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const renderKaTeX = async () => {
      try {
        // 动态导入 KaTeX
        const katex = await import('katex');
        const html = katex.renderToString(latex, {
          displayMode,
          throwOnError: false,
          strict: false,
          trust: true,
          output: 'html',
        });
        setHtml(html);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'KaTeX render error');
      }
    };

    renderKaTeX();
  }, [latex, displayMode]);

  if (error) {
    return (
      <code className="text-red-400 font-mono text-sm" style={{ color: errorColor }}>
        {error}: {String(latex).slice(0, 100)}
      </code>
    );
  }

  return (
    <span 
      className={clsx('katex-render', displayMode && 'katex-display')}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/**
 * MathJax 渲染器组件
 */
export function MathJax({ 
  children, 
  displayMode = false,
}: { 
  children: React.ReactNode; 
  displayMode?: boolean;
}) {
  const latex = typeof children === 'string' ? children : String(children);
  const ref = useRef<HTMLSpanElement>(null);

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
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let mounted = true;
    
    const renderMermaid = async () => {
      try {
        // 动态导入 mermaid
        const mermaid = await import('mermaid');
        
        mermaid.initialize({ 
          theme: 'dark',
          securityLevel: 'loose',
          fontFamily: 'JetBrains Mono',
          startOnLoad: false,
          logLevel: 'error',
        });
        
        const { svg } = await mermaid.render(id, code);
        
        if (mounted && containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Mermaid render error');
      }
    };

    renderMermaid();

    return () => {
      mounted = false;
    };
  }, [code]);

  if (error) {
    return (
      <pre className="text-red-400 p-2 bg-red-500/10 rounded text-sm overflow-auto">
        {error}
      </pre>
    );
  }

  return <div ref={containerRef} id={id} className="mermaid-container" />;
}

/**
 * KaTeX 组件
 */
export function KaTeX({ 
  children, 
  displayMode = false,
  errorColor = '#ef4444',
}: { 
  children: React.ReactNode; 
  displayMode?: boolean;
  errorColor?: string;
}) {
  const latex = typeof children === 'string' ? children : String(children);
  const [html, setHtml] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const renderKaTeX = async () => {
      try {
        // 动态导入 KaTeX
        const katex = await import('katex');
        const html = katex.renderToString(latex, {
          displayMode,
          throwOnError: false,
          strict: false,
          trust: true,
          output: 'html',
        });
        setHtml(html);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'KaTeX render error');
      }
    };

    renderKaTeX();
  }, [latex, displayMode]);

  if (error) {
    return (
      <code className="text-red-400 font-mono text-sm" style={{ color: errorColor }}>
        {error}: {String(latex).slice(0, 100)}
      </code>
    );
  }

  return (
    <span 
      ref={containerRef}
      className={clsx('katex-render', displayMode && 'katex-display')}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/**
 * MathJax 渲染器组件
 */
export function MathJax({ 
  children, 
  displayMode = false,
}: { 
  children: React.ReactNode; 
  displayMode?: boolean;
}) {
  const latex = typeof children === 'string' ? children : String(children);
  const ref = useRef<HTMLSpanElement>(null);

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
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let mounted = true;
    
    const renderMermaid = async () => {
      try {
        // 动态导入 mermaid
        const mermaid = await import('mermaid');
        
        mermaid.initialize({ 
          theme: 'dark',
          securityLevel: 'loose',
          fontFamily: 'JetBrains Mono',
          startOnLoad: false,
          logLevel: 'error',
        });
        
        const { svg } = await mermaid.render(id, code);
        
        if (mounted && containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Mermaid render error');
      }
    };

    renderMermaid();

    return () => {
      mounted = false;
    };
  }, [code]);

  if (error) {
    return (
      <pre className="text-red-400 p-2 bg-red-500/10 rounded text-sm overflow-auto">
        {error}
      </pre>
    );
  }

  return <div ref={containerRef} id={id} className="mermaid-container" />;
}

/**
 * KaTeX 组件
 */
export function KaTeX({ 
  children, 
  displayMode = false,
  errorColor = '#ef4444',
}: { 
  children: React.ReactNode; 
  displayMode?: boolean;
  errorColor?: string;
}) {
  const latex = typeof children === 'string' ? children : String(children);
  const [html, setHtml] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const renderKaTeX = async () => {
      try {
        // 动态导入 KaTeX
        const katex = await import('katex');
        const html = katex.renderToString(latex, {
          displayMode,
          throwOnError: false,
          strict: false,
          trust: true,
          output: 'html',
        });
        setHtml(html);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'KaTeX render error');
      }
    };

    renderKaTeX();
  }, [latex, displayMode]);

  if (error) {
    return (
      <code className="text-red-400 font-mono text-sm" style={{ color: errorColor }}>
        {error}: {String(latex).slice(0, 100)}
      </code>
    );
  }

  return (
    <span 
      ref={containerRef}
      className={clsx('katex-render', displayMode && 'katex-display')}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/**
 * MathJax 渲染器组件
 */
export function MathJax({ 
  children, 
  displayMode = false,
}: { 
  children: React.ReactNode; 
  displayMode?: boolean;
}) {
  const latex = typeof children === 'string' ? children : String(children);
  const ref = useRef<HTMLSpanElement>(null);

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
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let mounted = true;
    
    const renderMermaid = async () => {
      try {
        // 动态导入 mermaid
        const mermaid = await import('mermaid');
        
        mermaid.initialize({ 
          theme: 'dark',
          securityLevel: 'loose',
          fontFamily: 'JetBrains Mono',
          startOnLoad: false,
          logLevel: 'error',
        });
        
        const { svg } = await mermaid.render(id, code);
        
        if (mounted && containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Mermaid render error');
      }
    };

    renderMermaid();

    return () => {
      mounted = false;
    };
  }, [code]);

  if (error) {
    return (
      <pre className="text-red-400 p-2 bg-red-500/10 rounded text-sm overflow-auto">
        {error}
      </pre>
    );
  }

  return <div ref={containerRef} id={id} className="mermaid-container" />;
}

/**
 * KaTeX 组件
 */
export function KaTeX({ 
  children, 
  displayMode = false,
  errorColor = '#ef4444',
}: { 
  children: React.ReactNode; 
  displayMode?: boolean;
  errorColor?: string;
}) {
  const latex = typeof children === 'string' ? children : String(children);
  const [html, setHtml] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const renderKaTeX = async () => {
      try {
        // 动态导入 KaTeX
        const katex = await import('katex');
        const html = katex.renderToString(latex, {
          displayMode,
          throwOnError: false,
          strict: false,
          trust: true,
          output: 'html',
        });
        setHtml(html);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'KaTeX render error');
      }
    };

    renderKaTeX();
  }, [latex, displayMode]);

  if (error) {
    return (
      <code className="text-red-400 font-mono text-sm" style={{ color: errorColor }}>
        {error}: {String(latex).slice(0, 100)}
      </code>
    );
  }

  return (
    <span 
      ref={containerRef}
      className={clsx('katex-render', displayMode && 'katex-display')}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/**
 * MathJax 渲染器组件
 */
export function MathJax({ 
  children, 
  displayMode = false,
}: { 
  children: React.ReactNode; 
  displayMode?: boolean;
}) {
  const latex = typeof children === 'string' ? children : String(children);
  const ref = useRef<HTMLSpanElement>(null);

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
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let mounted = true;
    
    const renderMermaid = async () => {
      try {
        // 动态导入 mermaid
        const mermaid = await import('mermaid');
        
        mermaid.initialize({ 
          theme: 'dark',
          securityLevel: 'loose',
          fontFamily: 'JetBrains Mono',
          startOnLoad: false,
          logLevel: 'error',
        });
        
        const { svg } = await mermaid.render(id, code);
        
        if (mounted && containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Mermaid render error');
      }
    };

    renderMermaid();

    return () => {
      mounted = false;
    };
  }, [code]);

  if (error) {
    return (
      <pre className="text-red-400 p-2 bg-red-500/10 rounded text-sm overflow-auto">
        {error}
      </pre>
    );
  }

  return <div ref={containerRef} id={id} className="mermaid-container" />;
}