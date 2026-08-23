import clsx from 'clsx';

interface SyntaxHighlighterProps {
  language: string;
  children?: React.ReactNode;
  className?: string;
}

/**
 * 语法高亮组件
 * 实际的高亮渲染由 rehype-highlight 在 markdown 管线中处理，
 * 该组件负责提供标准的 <pre><code> 结构与语言标记。
 */
export function SyntaxHighlighter({ language, children, className }: SyntaxHighlighterProps) {
  const lang = language || 'text';
  return (
    <pre className={clsx('language-' + lang, className)}>
      <code className={clsx('language-' + lang)}>{children}</code>
    </pre>
  );
}

export default SyntaxHighlighter;
