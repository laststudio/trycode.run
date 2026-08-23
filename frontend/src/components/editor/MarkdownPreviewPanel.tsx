import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
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
        content.includes('\\frac') || content.includes('\\sqrt') ||
        content.includes('\\oint');
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

  // 代码语法高亮组件
  const components = useMemo(() => ({
    code: ({ node, ...props }: any) => {
      const codeLanguage = node?.data?.meta || 'text';
      return <SyntaxHighlighter language={codeLanguage} {...props} />;
    },
    math: (props: any) => <MathRenderer {...props} />,
    mermaid: mermaidEnabled ? (props: any) => <Mermaid {...props} /> : undefined,
  }), [mermaidEnabled]);

  return (
    <div
      ref={containerRef}
      data-language={language}
      className={clsx(
        'markdown-preview prose prose-sm dark:prose-invert max-w-none',
        className
      )}
      onScroll={handlePreviewScroll}
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
