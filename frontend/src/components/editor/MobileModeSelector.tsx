import { useState, useRef, useEffect } from 'react';
import { 
  CpuChipIcon, 
  ServerIcon, 
  CpuChipIcon as HybridIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

interface MobileModeSelectorProps {
  value: 'monaco' | 'lsp' | 'hybrid';
  onChange: (mode: 'monaco' | 'lsp' | 'hybrid') => void;
  lspStatus?: {
    isConnected: boolean;
    isConnecting: boolean;
    error: string | null;
  };
  availableLanguages?: string[];
  className?: string;
}

export function MobileModeSelector({ 
  value, 
  onChange, 
  lspStatus,
  availableLanguages = [],
  className = '',
}: MobileModeSelectorProps) {
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
    <div className={clsx('relative', className)} ref={dropdownRef}>
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 bg-card border border-border rounded-lg text-sm hover:bg-accent transition-colors"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="font-mono text-sm">{selectedLang.name}</span>
        <ChevronDownIcon className={clsx('w-4 h-4 text-muted-foreground', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg py-1 z-20 min-w-[280px]">
          <div className="p-3 border-b border-border">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium">语言服务模式</h3>
              <span className={clsx(
                'px-2 py-0.5 text-xs rounded font-medium',
                value === 'monaco' && 'bg-green-500/20 text-green-400',
                value === 'hybrid' && 'bg-blue-500/20 text-blue-400',
                value === 'lsp' && 'bg-purple-500/20 text-purple-400',
              )}>
                {value}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${true ? 'bg-green-400' : 'bg-gray-400'}`} />
                <span>LSP 连接中</span>
              </span>
            </div>
          </div>
          
          <div className="py-1">
            {modes.map(mode => (
              <button
                key={mode.id}
                onClick={() => {
                  onChange(mode.id);
                  setOpen(false);
                }}
                className={clsx(
                  'w-full flex items-start gap-3 px-3 py-2.5 text-left text-sm font-medium border-b-2 transition-colors rounded-lg',
                  value === mode.id
                    ? `border-${mode.color.replace('text', 'bg').replace('400', '500')} ${mode.bgColor}`
                    : 'border-transparent hover:bg-accent hover:border-transparent'
                )}
              >
                <mode.icon className={clsx('w-5 h-5 flex-shrink-0', mode.color)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{mode.label}</span>
                    <span className={clsx(
                      'px-1.5 py-0.5 text-xs rounded font-medium',
                      mode.bgColor,
                      mode.color
                    )}>
                      {mode.badge}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{mode.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MobileModeSelector({ 
  value, 
  onChange, 
  lspStatus,
  availableLanguages = [],
  className = '',
}: MobileModeSelectorProps) {
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

  const selectedMode = modes.find(m => m.id === value) || modes[0];

  return (
    <div className={clsx('relative', className)} ref={dropdownRef}>
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2 py-1.5 bg-card border border-border rounded-lg text-sm hover:bg-accent transition-colors"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="font-mono text-sm">{selectedMode.label}</span>
        <ChevronDownIcon className={clsx('w-4 h-4 text-muted-foreground', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg py-1 z-20 min-w-[200px]">
          <div className="flex items-center justify-between p-2 border-b border-border">
            <h3 className="font-medium">语言服务模式</h3>
            <span className={clsx(
              'px-2 py-0.5 text-xs rounded font-medium',
              value === 'monaco' && 'bg-green-500/20 text-green-400',
              value === 'hybrid' && 'bg-blue-500/20 text-blue-400',
              value === 'lsp' && 'bg-purple-500/20 text-purple-400',
            )}>
              {value}
            </span>
          </div>
          <div className="flex items-center gap-2 mb-2 px-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-400"></span>
              <span>LSP 就绪</span>
            </span>
          </div>
          <div className="py-1">
            {modes.map(({ id, label, icon: Icon, badge, color, bgColor }) => (
              <button
                key={id}
                onClick={() => {
                  onChange(id);
                  setOpen(false);
                }}
                className={clsx(
                  'w-full flex items-center gap-3 px-3 py-2 text-left text-sm font-medium border-b-2 transition-colors',
                  value === id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-accent'
                )}
              >
                <Icon className="w-5 h-5" style={{ color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">{label}</span>
                    <span className={clsx(
                      'px-1.5 py-0.5 text-xs rounded font-medium',
                      bgColor,
                      color,
                    )}>
                      {badge}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                    {modes.find(m => m.id === id)?.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useRef, useEffect } from 'react';
import { 
  CpuChipIcon, 
  ServerIcon, 
  CpuChipIcon as HybridIcon,
  CheckIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

interface MobileModeSelectorProps {
  value: 'monaco' | 'lsp' | 'hybrid';
  onChange: (mode: 'monaco' | 'lsp' | 'hybrid') => void;
  lspStatus?: {
    isConnected: boolean;
    isConnecting: boolean;
    error: string | null;
  };
  availableLanguages?: string[];
  className?: string;
}

export function MobileModeSelector({ 
  value, 
  onChange, 
  lspStatus,
  availableLanguages = [],
  className = '',
}: MobileModeSelectorProps) {
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

  const selectedMode = modes.find(m => m.id === value) || modes[0];

  return (
    <div className={clsx('relative', className)} ref={dropdownRef}>
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 bg-card border border-border rounded-lg text-sm hover:bg-accent transition-colors"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="font-mono text-sm">{selectedMode.label}</span>
        <ChevronDownIcon className={clsx('w-4 h-4 text-muted-foreground', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg py-1 z-20 min-w-[200px]">
          <div className="p-2 border-b border-border">
            <input
              type="text"
              placeholder="Search modes..."
              className="w-full px-3 py-1.5 text-sm bg-background border border-border rounded-lg outline-none focus:border-primary"
              autoFocus
            />
          </div>
          <div className="py-1">
            {modes.map(({ id, label, icon: Icon, badge, color, bgColor }) => (
              <button
                key={id}
                onClick={() => {
                  onChange(id);
                  setOpen(false);
                }}
                className={clsx(
                  'w-full px-3 py-2 text-left text-sm rounded-lg transition-colors flex items-center gap-2',
                  value === id ? 'bg-primary/10 text-primary' : 'hover:bg-accent'
                )}
              >
                <Icon className={clsx('w-4 h-4', color)} />
                <span className="font-medium">{label}</span>
                <span className={clsx('px-2 py-0.5 text-xs rounded font-medium', bgColor, color)}>
                  {badge}
                </span>
                {value === id && <CheckIcon className="w-4 h-4 text-primary ml-auto" />}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useRef, useEffect } from 'react';
import { 
  CpuChipIcon, 
  ServerIcon, 
  CpuChipIcon as HybridIcon,
  CheckIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

export default MobileModeSelector;