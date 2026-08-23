import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { useExecutionStore } from '../../stores';
import { useEditorStore } from '../../stores';

interface TerminalProps {
  height?: number;
  onInput?: (data: string) => void;
}

export function TerminalComponent({ height = 200, onInput }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon>(new FitAddon());
  const [initialized, setInitialized] = useState(false);
  const { executionOutput, isExecuting } = useExecutionStore();
  const { currentProject } = useEditorStore();

  useEffect(() => {
    if (initialized || !terminalRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#ffffff',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#e5e5e5',
      },
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 13,
      lineHeight: 1.5,
      scrollback: 10000,
      allowTransparency: true,
      convertEol: true,
    });

    term.loadAddon(fitAddonRef.current);
    term.loadAddon(new WebLinksAddon());

    term.open(terminalRef.current!);
    fitAddonRef.current.fit();

    termRef.current = term;
    setInitialized(true);

    // Write initial output
    if (executionOutput) {
      term.write(executionOutput);
    }

    // Handle input
    term.onData((data) => {
      onInput?.(data);
    });

    // Handle resize
    const handleResize = () => {
      fitAddonRef.current.fit();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      term.dispose();
      window.removeEventListener('resize', handleResize);
    };
  }, [initialized, executionOutput, onInput]);

  // Append new output
  useEffect(() => {
    if (termRef.current && executionOutput) {
      // Only write new content (simplified)
      termRef.current.write('\r\n' + executionOutput.split('\n').slice(-1)[0]);
    }
  }, [executionOutput]);

  // Auto-scroll to bottom when executing
  useEffect(() => {
    if (isExecuting && termRef.current) {
      termRef.current.scrollToBottom();
    }
  }, [isExecuting]);

  const clear = useCallback(() => {
    termRef.current?.clear();
  }, []);

  const reset = useCallback(() => {
    termRef.current?.reset();
  }, []);

  return (
    <div
      ref={terminalRef}
      className="bg-terminal-bg rounded-lg border border-border overflow-hidden"
      style={{ height: `${height}px`, minHeight: '150px' }}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/50">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500"></span>
          <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
          <span className="w-3 h-3 rounded-full bg-green-500"></span>
        </div>
        <span className="text-xs text-muted-foreground font-mono">
          {currentProject ? `~/projects/${currentProject.name}` : '~'}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={clear}
            className="p-1 hover:bg-accent rounded transition-colors"
            title="Clear"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <button
            onClick={reset}
            className="p-1 hover:bg-accent rounded transition-colors"
            title="Reset"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>
      <div ref={terminalRef} className="h-full" />
    </div>
  );
}