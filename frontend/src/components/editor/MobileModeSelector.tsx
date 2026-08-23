import { useState, useRef, useEffect } from 'react';
import {
  CpuChipIcon,
  ServerIcon,
  CpuChipIcon as HybridIcon,
  CheckIcon,
  ChevronDownIcon,
} from '../../utils/icons.ts';
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
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default MobileModeSelector;
