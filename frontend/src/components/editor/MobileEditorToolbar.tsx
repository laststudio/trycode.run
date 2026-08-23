import {
  PlayIcon,
  StopIcon,
  BugAntIcon,
  SparklesIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  ArrowPathIcon,
  FolderIcon,
  LayoutIcon,
  CodeIcon,
  TerminalIcon,
  SmartphoneIcon,
} from '../../utils/icons';
import clsx from 'clsx';

interface MobileEditorToolbarProps {
  layout: 'editor' | 'terminal' | 'split' | 'files';
  onLayoutChange: (layout: 'editor' | 'terminal' | 'split' | 'files') => void;
  onModeChange: (mode: 'monaco' | 'lsp' | 'hybrid') => void;
  mode: 'monaco' | 'lsp' | 'hybrid';
  isOnline: boolean;
  isInstallable?: boolean;
  isInstalled?: boolean;
  install?: () => Promise<boolean>;
  updateAvailable?: boolean;
  applyUpdate?: () => void;
}

export function MobileEditorToolbar({
  layout,
  onLayoutChange,
  onModeChange,
  mode,
  isOnline,
  isInstallable = false,
  isInstalled = false,
  install,
  updateAvailable = false,
  applyUpdate,
}: MobileEditorToolbarProps) {

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pb-safe pb-4">
      {/* 主工具栏 */}
      <div className="flex items-center justify-between px-3 py-2">
        {/* 左侧：布局切换 */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onLayoutChange('editor')}
            className={clsx(
              'p-2 rounded-lg transition-colors flex items-center gap-1',
              layout === 'editor' 
                ? 'bg-primary/10 text-primary' 
                : 'text-muted-foreground hover:bg-accent'
            )}
            aria-label="Editor"
          >
            <CodeIcon className="w-5 h-5" />
          </button>
          <button
            onClick={() => onLayoutChange('split')}
            className={clsx(
              'p-2 rounded-lg transition-colors',
              layout === 'split' 
                ? 'bg-primary/10 text-primary' 
                : 'text-muted-foreground hover:bg-accent'
            )}
            aria-label="Split view"
          >
            <LayoutIcon className="w-5 h-5" />
          </button>
          <button
            onClick={() => onLayoutChange('terminal')}
            className={clsx(
              'p-2 rounded-lg transition-colors',
              layout === 'terminal' 
                ? 'bg-primary/10 text-primary' 
                : 'text-muted-foreground hover:bg-accent'
            )}
            aria-label="Terminal"
          >
            <TerminalIcon className="w-5 h-5" />
          </button>
          <button
            onClick={() => onLayoutChange('files')}
            className={clsx(
              'p-2 rounded-lg transition-colors',
              layout === 'files' 
                ? 'bg-primary/10 text-primary' 
                : 'text-muted-foreground hover:bg-accent'
            )}
            aria-label="Files"
          >
            <FolderIcon className="w-5 h-5" />
          </button>
        </div>
        
        {/* 中间：模式选择器 */}
        <div className="flex-1 flex items-center justify-center px-4">
          <select
            value={mode}
            onChange={(e) => onModeChange(e.target.value as any)}
            className="px-2 py-1 bg-card border border-border rounded-lg text-sm font-mono text-xs focus:border-primary focus:outline-none"
          >
            <option value="monaco">Monaco</option>
            <option value="hybrid">Hybrid</option>
            <option value="lsp">LSP</option>
          </select>
        </div>
        
        {/* 右侧：状态和更新 */}
        <div className="flex items-center gap-2">
          {/* 网络状态 */}
          <div className="flex items-center gap-1 px-2 py-1 bg-muted/50 rounded-lg">
            <span className={clsx(
              'w-2 h-2 rounded-full',
              isOnline ? 'bg-green-400' : 'bg-red-400'
            )} />
            <span className="text-xs text-muted-foreground">
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
          
          {/* 更新提示 */}
          {updateAvailable && (
            <button
              onClick={applyUpdate}
              className="px-2 py-1 bg-green-500/10 border border-green-500/20 text-green-500 rounded-lg text-xs font-medium hover:bg-green-500/20 transition-colors flex items-center gap-1"
            >
              <ArrowPathIcon className="w-3 h-3 animate-spin" />
              <span>Update</span>
            </button>
          )}
          
          {/* 安装提示 */}
          {isInstallable && !isInstalled && (
            <button
              onClick={install}
              className="px-2 py-1 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors flex items-center gap-1"
            >
              <SmartphoneIcon className="w-3 h-3" />
              <span>Install</span>
            </button>
          )}
        </div>
      </div>
      
      {/* 底部快捷操作栏 */}
      <div className="flex items-center justify-around px-3 py-2 border-t border-border bg-background/50">
        <button className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded-lg transition-colors" aria-label="Run code">
          <PlayIcon className="w-5 h-5" />
          <span className="text-xs">Run</span>
        </button>
        <button className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded-lg transition-colors" aria-label="Stop">
          <StopIcon className="w-5 h-5" />
          <span className="text-xs">Stop</span>
        </button>
        <button className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded-lg transition-colors" aria-label="Debug">
          <BugAntIcon className="w-5 h-5" />
          <span className="text-xs">Debug</span>
        </button>
        <button className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded-lg transition-colors" aria-label="AI Assistant">
          <SparklesIcon className="w-5 h-5" />
          <span className="text-xs">AI</span>
        </button>
        <button className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded-lg transition-colors" aria-label="Download">
          <ArrowDownTrayIcon className="w-5 h-5" />
          <span className="text-xs">Download</span>
        </button>
        <button className="flex flex-col items-center gap-1 p-2 hover:bg-accent rounded-lg transition-colors" aria-label="Share">
          <ArrowUpTrayIcon className="w-5 h-5" />
          <span className="text-xs">Share</span>
        </button>
      </div>
    </div>
  );
}