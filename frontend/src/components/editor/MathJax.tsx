import { useEffect, useRef } from 'react';

interface MathJaxProps {
  children?: React.ReactNode;
  displayMode?: boolean;
}

declare global {
  interface Window {
    MathJax?: {
      typesetPromise?: (elements?: HTMLElement[]) => Promise<void>;
    };
  }
}

/**
 * MathJax 数学公式渲染组件
 * 依赖页面中已加载的 MathJax（window.MathJax）
 */
export function MathJax({ children, displayMode = false }: MathJaxProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const latex = typeof children === 'string' ? children : String(children ?? '');

  useEffect(() => {
    if (window.MathJax?.typesetPromise && ref.current) {
      window.MathJax.typesetPromise([ref.current]).catch(console.error);
    }
  }, [latex]);

  return (
    <span ref={ref} className={displayMode ? 'math-display' : 'math-inline'}>
      {displayMode ? `$$${latex}$$` : `$${latex}$`}
    </span>
  );
}

export default MathJax;
