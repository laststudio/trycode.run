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
      const language = node?.data?.meta || 'text';
      return <SyntaxHighlighter language={language} {...props} />;
    },
    math: (props: any) => <MathRenderer {...props} />,
    mermaid: mermaidEnabled ? (props: any) => <Mermaid {...props} /> : undefined,
  }), [mermaidEnabled]);

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
        ]}
      >
        {content}
      </ReactMarkdown>

      {/* KaTeX 样式 */}
      {mathEngine === 'katex' && (
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/katex@0.16.0/dist/katex.min.css"
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

  if (engine === 'katex') {
    return <KaTeX displayMode={displayMode}>{children}</KaTeX>;
  }

  return <MathJax displayMode={displayMode}>{children}</MathJax>;
}
