import { useMemo } from 'react';
import katex from 'katex';
import clsx from 'clsx';

interface KaTeXProps {
  children?: React.ReactNode;
  displayMode?: boolean;
}

/**
 * KaTeX 数学公式渲染组件
 */
export function KaTeX({ children, displayMode = false }: KaTeXProps) {
  const latex = typeof children === 'string' ? children : String(children ?? '');

  const html = useMemo(() => {
    try {
      return katex.renderToString(latex, {
        displayMode,
        throwOnError: false,
        strict: false,
      });
    } catch {
      return '';
    }
  }, [latex, displayMode]);

  if (!html) {
    return (
      <code className="text-red-400 font-mono text-sm">
        {latex}
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

export default KaTeX;
