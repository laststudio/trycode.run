import { useMemo } from 'react';
import { XMarkIcon, ArrowDownTrayIcon, ClipboardDocumentListIcon } from '@heroicons/react/24/outline';
import { useExecutionStore } from '../../stores';
import clsx from 'clsx';

interface OutputPanelProps {
  onClose?: () => void;
}

export function OutputPanel({ onClose }: OutputPanelProps) {
  const { 
    executionOutput, 
    executionError, 
    currentExecution,
    wasmFallback,
    fallbackReason 
  } = useExecutionStore();

  const outputLines = useMemo(() => {
    const stdout = executionOutput || '';
    const stderr = executionError || '';
    return [...stdout.split('\n'), ...stderr.split('\n')].filter(l => l);
  }, [executionOutput, executionError]);

  if (!currentExecution && outputLines.length === 0 && !wasmFallback) {
    return null;
  }

  return (
    <div className="bg-card border-t border-border rounded-t-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">OUTPUT</span>
        <div className="flex items-center gap-2">
          {wasmFallback && (
            <span className="px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 rounded flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse"></span>
              WASM Fallback: {fallbackReason}
            </span>
          )}
          {currentExecution && (
            <span className={clsx(
              'px-2 py-0.5 text-xs rounded font-medium',
              currentExecution.status === 'completed' && 'bg-green-500/20 text-green-400',
              currentExecution.status === 'failed' && 'bg-red-500/20 text-red-400',
              currentExecution.status === 'timeout' && 'bg-yellow-500/20 text-yellow-400',
              currentExecution.status === 'running' && 'bg-blue-500/20 text-blue-400 animate-pulse',
            )}>
              {currentExecution.status}
            </span>
          )}
          <div className="flex items-center gap-1">
            <button className="p-1 hover:bg-accent rounded" title="Copy Output">
              <ClipboardDocumentListIcon className="w-4 h-4" />
            </button>
            <button className="p-1 hover:bg-accent rounded" title="Download Output">
              <ArrowDownTrayIcon className="w-4 h-4" />
            </button>
            {onClose && (
              <button onClick={onClose} className="p-1 hover:bg-accent rounded" title="Close">
                <XMarkIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
      
      <div className="h-[calc(100%-40px)] overflow-auto font-mono text-sm p-3 bg-background/50">
        {outputLines.length === 0 && !wasmFallback ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
            <svg className="w-12 h-12 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm">No output yet</p>
            <p className="text-xs">Run your code to see output here</p>
          </div>
        ) : (
          <pre className="whitespace-pre-wrap break-all text-foreground">
            {outputLines.map((line, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-muted-foreground select-none w-8 text-right pr-2">{i + 1}</span>
                <span className="flex-1">{line}</span>
              </div>
            ))}
          </pre>
        )}
      </div>
    </div>
  );
}