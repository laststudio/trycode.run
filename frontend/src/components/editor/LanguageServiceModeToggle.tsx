import { useState, useRef, useEffect } from 'react';
import { 
  CpuChipIcon, 
  ServerIcon, 
  CpuChipIcon as HybridIcon,
  CheckIcon,
  InformationCircleIcon,
} from '../../utils/icons.ts';
import clsx from 'clsx';

interface LanguageServiceModeToggleProps {
  value: 'monaco' | 'lsp' | 'hybrid';
  onChange: (mode: 'monaco' | 'lsp' | 'hybrid') => void;
  lspStatus?: {
    isConnected: boolean;
    isConnecting: boolean;
    error: string | null;
  };
  availableLanguages?: string[];
}

export function LanguageServiceModeToggle({ 
  value, 
  onChange, 
  lspStatus,
  availableLanguages = [],
}: LanguageServiceModeToggleProps) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          triggerRef.current && !triggerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const modes = [
    { 
      id: 'monaco' as const, 
      label: 'Monaco Only', 
      description: '纯浏览器运行，启动快，无需网络',
      icon: CpuChipIcon,
      badge: 'WASM',
      color: 'text-green-400',
      bgColor: 'bg-green-500/10',
    },
    { 
      id: 'hybrid' as const, 
      label: 'Hybrid (推荐)', 
      description: 'WASM 优先，5秒回退到后端，最佳体验',
      icon: HybridIcon,
      badge: 'WASM + LSP',
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
    },
    { 
      id: 'lsp' as const, 
      label: 'LSP Only', 
      description: '完整语言服务器，完整 IDE 体验，需网络',
      icon: ServerIcon,
      badge: 'LSP',
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
    },
  ];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 bg-card border border-border rounded-lg text-sm hover:bg-accent transition-colors"
        aria-haspopup="listbox"
        aria-expanded={open}
        type="button"
      >
        <span className="flex items-center gap-2">
          <span className={clsx('w-2 h-2 rounded-full', 
            value === 'monaco' && 'bg-green-400',
            value === 'hybrid' && 'bg-blue-400',
            value === 'lsp' && 'bg-purple-400'
          )} />
          <span className="font-mono text-sm capitalize">{value}</span>
        </span>
        <svg className={clsx('w-4 h-4 text-muted-foreground', open && 'rotate-180')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg py-1 z-20 min-w-[280px]">
          <div className="p-3 border-b border-border">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-sm">语言服务模式</h3>
              <div className="flex items-center gap-1">
                <span className={clsx(
                  'px-2 py-0.5 text-xs rounded font-medium',
                  value === 'monaco' && 'bg-green-500/20 text-green-400',
                  value === 'hybrid' && 'bg-blue-500/20 text-blue-400',
                  value === 'lsp' && 'bg-purple-500/20 text-purple-400',
                )}>
                  {value}
                </span>
              </div>
            </div>
            {availableLanguages.length > 0 && (
              <p className="text-xs text-muted-foreground mb-3">
                支持 LSP 的语言: {availableLanguages.join(', ')}
              </p>
            )}
          </div>
          
          <div className="py-1">
            {modes.map(mode => (
              <button
                key={mode.id}
                onClick={() => onChange(mode.id)}
                className={clsx(
                  'w-full flex items-start gap-3 px-3 py-2.5 text-left text-sm rounded-lg transition-colors border-l-4',
                  value === mode.id
                    ? `${mode.bgColor} border-${mode.color.replace('text', 'bg').replace('400', '500')}`
                    : 'hover:bg-accent'
                )}
              >
                <div className="flex-shrink-0">
                  <mode.icon className={clsx('w-5 h-5', mode.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{mode.label}</span>
                    <span className={clsx('px-1.5 py-0.5 text-xs rounded font-medium', mode.bgColor, mode.color)}>
                      {mode.badge}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{mode.description}</p>
                </div>
                <div className="flex-shrink-0">
                  {value === mode.id && (
                    <CheckIcon className="w-4 h-4" style={{ color: mode.color }} />
                  )}
                </div>
              </button>
            ))}
            
            <div className="border-t border-border pt-3">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 text-xs">
                <InformationCircleIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="font-medium">当前模式: <span className="font-mono capitalize">{value}</span></p>
                  <p className="text-muted-foreground">
                    {value === 'monaco' && '纯浏览器运行，启动最快，适合简单代码'}
                    {value === 'hybrid' && 'WASM 优先，5秒超时自动回退到后端 LSP，平衡体验与功能'}
                    {value === 'lsp' && '完整语言服务器功能，补全、跳转、重构、诊断全支持'}
                  </p>
                </div>
              </div>
              
              { /* LSP 连接状态 */ }
              <div className="px-3 py-2 border-t border-border">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">LSP 状态</span>
                  <span className="flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full ${true ? 'bg-green-400' : 'bg-gray-400'}`} />
                    <span className="text-muted-foreground">已连接</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}