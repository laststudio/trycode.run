import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import Editor from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { useLanguageServiceManager } from '../../hooks/useLanguageServiceManager';
import { useEditorStore } from '../../stores';
import { LANGUAGES, getLanguageById } from '../../utils/languages';
import { clsx } from 'clsx';
import { 
  MenuIcon, 
  XMarkIcon, 
  ChevronLeftIcon, 
  ChevronRightIcon,
  LayoutIcon,
  CodeIcon,
  TerminalIcon,
  SmartphoneIcon,
  TabletIcon,
  DesktopIcon,
} from '@heroicons/react/24/outline';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { usePWA } from '../../hooks/usePWA';
import { MobileEditorToolbar } from './MobileEditorToolbar';
import { MobileFileTree } from './MobileFileTree';
import { MobileTerminal } from './MobileTerminal';
import { MobileLanguageSelector } from './MobileLanguageSelector';
import { MobileModeSelector } from './MobileModeSelector';
import { CollabBar } from '../collab/CollabBar';
import { usePWA } from '../../hooks/usePWA';

interface EditorContentProps {
  fileId: string;
  language: string;
  readOnly?: boolean;
  onContentChange?: (content: string) => void;
  height?: string;
  width?: string;
}

export function EditorContent({ 
  fileId, 
  language, 
  readOnly = false, 
  onContentChange,
  height = '100%',
  width = '100%',
}: EditorContentProps) {
  const editorRef = useRef<any>(null);
  const [mounted, setMounted] = useState(false);
  const [layout, setLayout] = useState<'editor' | 'terminal' | 'split' | 'files'>('editor');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState(200);
  const [showMobileToolbar, setShowMobileToolbar] = useState(true);
  
  const { 
    fileContents, 
    setFileContent, 
    markSaved,
    unsavedFiles,
    collabUsers,
    mode,
    setMode,
    currentLanguage,
    setCurrentLanguage,
    sidebarWidth,
    setSidebarWidth,
    showTerminal,
    setShowTerminal,
    showOutput,
    setShowOutput,
    fileContents,
    selectedFileId,
    setSelectedFileId,
    activeTabId,
    setActiveTabId,
    openTabs,
    addTab,
    closeTab,
    collabUsers,
  } = useEditorStore();
  
  const { connectLSP, disconnectLSP, state: lspState } = useLanguageServiceManager();
  const [lspConnected, setLspConnected] = useState(false);
  
  const { isOnline, isInstalled, install } = usePWA();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isTablet = useMediaQuery('(max-width: 1024px)');
  const isDesktop = useMediaQuery('(min-width: 1025px)');
  
  const isMobileLayout = isMobile || isTablet;

  useEffect(() => {
    setMounted(true);
  }, []);

  // 初始内容
  const initialContent = fileContents[fileId] || '';

  // 语言映射
  const getMonacoLanguage = (lang: string): string => {
    const langMap: Record<string, string> = {
      python: 'python',
      javascript: 'javascript',
      typescript: 'typescript',
      rust: 'rust',
      go: 'go',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      csharp: 'csharp',
      php: 'php',
      ruby: 'ruby',
      swift: 'swift',
      kotlin: 'kotlin',
      scala: 'scala',
      r: 'r',
      lua: 'lua',
      perl: 'perl',
      dart: 'dart',
      zig: 'zig',
      julia: 'julia',
      haskell: 'haskell',
      fortran: 'fortran',
      objectivec: 'objective-c',
      vbnet: 'vb',
      fsharp: 'fsharp',
      groovy: 'groovy',
      html: 'html',
      css: 'css',
      sql: 'sql',
      bash: 'shell',
      powershell: 'powershell',
    };
    return langMap[lang] || 'plaintext';
  };

  // 处理编辑器挂载
  const handleEditorMount = useCallback((editor: any, monacoInstance: typeof monaco) => {
    editorRef.current = editor;
    
    // 设置内容变化监听
    editor.onDidChangeModelContent(() => {
      const content = editor.getValue();
      setFileContent(fileId, content);
      onContentChange?.(content);
    });

    // 保存快捷键
    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS, () => {
      markSaved(fileId);
    });

    // 配置编辑器选项
    editor.updateOptions({
      readOnly,
      tabSize: language === 'python' ? 4 : 2,
      insertSpaces: true,
      detectIndentation: true,
      renderWhitespace: 'selection',
      renderControlCharacters: true,
      folding: true,
      lineNumbers: 'on',
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      automaticLayout: true,
      wordWrap: 'on',
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: 'on',
      smoothScrolling: true,
      fontSize: isMobileLayout ? 13 : 14,
      lineHeight: 20,
      letterSpacing: 0.5,
    });

    // 如果是 LSP 模式，连接 LSP
    if (lspState.mode === 'lsp' || lspState.mode === 'hybrid') {
      console.log('LSP mode enabled for language:', language);
    }
  }, [fileId, language, readOnly, setFileContent, markSaved, onContentChange]);

  // 语言变更时重新连接 LSP
  useEffect(() => {
    if (lspState.mode === 'lsp' || lspState.mode === 'hybrid') {
      // 实际实现中重新连接 LSP
    }
  }, [language]);

  // 处理模式切换
  const handleModeChange = useCallback((newMode: 'monaco' | 'lsp' | 'hybrid') => {
    setMode(newMode);
    if (newMode === 'monaco') {
      // 断开 LSP
    } else if (newMode === 'lsp' || newMode === 'hybrid') {
      // 连接 LSP
    }
  }, [setMode]);

  // 处理布局切换
  const handleLayoutChange = useCallback((newLayout: 'editor' | 'terminal' | 'split' | 'files') => {
    setLayout(newLayout);
  }, []);

  // 处理终端高度调整
  const handleTerminalResize = useCallback((e: React.MouseEvent) => {
    const startY = e.clientY;
    const startHeight = terminalHeight;
    
    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = startY - e.clientY;
      setTerminalHeight(Math.max(100, Math.min(500, startHeight + deltaY)));
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);

  // 处理侧边栏宽度调整
  const handleSidebarResize = useCallback((e: React.MouseEvent) => {
    const startX = e.clientX;
    const startWidth = sidebarWidth;
    
    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX;
      setSidebarWidth(Math.max(200, Math.min(500, startWidth + deltaX)));
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);

  // 响应式断点变化处理
  useEffect(() => {
    if (isMobileLayout) {
      // 移动端默认隐藏侧边栏，只显示编辑器
      setSidebarOpen(false);
      setLayout('editor');
    } else if (isTablet) {
      // 平板默认分栏布局
      setLayout('split');
    } else {
      // 桌面端默认完整布局
      setLayout('editor');
      setSidebarOpen(true);
    }
  }, [isMobile, isTablet, isDesktop]);

  // 处理文件选择
  const handleFileSelect = useCallback((file: any) => {
    if (!file.is_directory) {
      addTab(file.id);
      setSelectedFileId(file.id);
      setActiveTabId(file.id);
      // 移动端选择文件后自动关闭文件树
      if (isMobileLayout) {
        setSidebarOpen(false);
      }
    }
  }, [addTab, setSelectedFileId, setActiveTabId]);

  // 处理标签页关闭
  const handleTabClose = useCallback((fileId: string) => {
    closeTab(fileId);
  }, [closeTab]);

  // 处理语言切换
  const handleLanguageChange = useCallback((langId: string) => {
    setCurrentLanguage(langId);
  }, [setCurrentLanguage]);

  // 处理模式切换
  const handleModeChange = useCallback((newMode: 'monaco' | 'lsp' | 'hybrid') => {
    setMode(newMode);
    if (newMode === 'monaco') {
      // 断开 LSP
    } else if (newMode === 'lsp' || newMode === 'hybrid') {
      // 连接 LSP
    }
  }, [setMode]);

  if (!mounted) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const monacoLanguage = getMonacoLanguage(language);

  // 获取 Monaco 编辑器配置
  const editorOptions = useMemo(() => ({
    readOnly,
    tabSize: language === 'python' ? 4 : 2,
    insertSpaces: true,
    detectIndentation: true,
    renderWhitespace: 'selection',
    renderControlCharacters: true,
    folding: true,
    lineNumbers: 'on',
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    automaticLayout: true,
    wordWrap: 'on',
    cursorBlinking: 'smooth',
    cursorSmoothCaretAnimation: 'on',
    smoothScrolling: true,
    fontSize: isMobileLayout ? 13 : 14,
    lineHeight: 20,
    letterSpacing: 0.5,
  }), [language, readOnly, isMobileLayout]);

  // 获取 Monaco 语言 ID
  const monacoLanguage = getMonacoLanguage(language);

  // 当前文件内容
  const currentFileContent = fileContents[selectedFileId] || initialContent;

  return (
    <div className="h-full w-full relative flex flex-col bg-background" style={{ height, width }}>
      {/* 顶部工具栏 */}
      <header className={clsx(
        'h-12 px-3 border-b border-border flex items-center justify-between bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60',
        isMobileLayout && 'h-10 px-2'
      )}>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* 移动端菜单按钮 */}
          {isMobileLayout && (
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-accent rounded-lg transition-colors lg:hidden"
              aria-label="Toggle sidebar"
            >
              <MenuIcon className="w-5 h-5" />
            </button>
          )}
          
          <Link to="/" className="flex items-center gap-2 font-bold text-lg lg:hidden">
            <CodeIcon className="w-5 h-5 text-primary" />
            <span className="font-bold">TryCode</span>
          </Link>
          
          {/* 桌面端导航 */}
          {!isMobileLayout && (
            <nav className="flex items-center gap-1 ml-4">
              <Link to="/" className={clsx(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                layout === 'editor' 
                  ? 'bg-primary/10 text-primary border-b-2 border-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}>
                <CodeIcon className="w-4 h-4" />
                <span>Editor</span>
              </Link>
              <Link to="/projects" className={clsx(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                layout === 'files'
                  ? 'bg-primary/10 text-primary border-b-2 border-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}>
                <FolderIcon className="w-4 h-4" />
                <span>Projects</span>
              </Link>
            </nav>
          )}
          
          <div className="flex items-center gap-2 flex-1 justify-end">
            {/* 语言选择器 */}
            <MobileLanguageSelector
              value={currentLanguage}
              onChange={handleLanguageChange}
              languages={LANGUAGES}
              className="hidden md:block"
            />
            
            {/* 布局切换器 - 仅桌面端 */}
            {!isMobileLayout && (
              <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
                {[
                  { id: 'editor', icon: CodeIcon, label: '编辑器' },
                  { id: 'split', icon: LayoutIcon, label: '分栏' },
                  { id: 'terminal', icon: TerminalIcon, label: '终端' },
                  { id: 'files', icon: FileCodeIcon, label: '文件' },
                ].map(({ id, icon: Icon, label }) => (
                  <button
                    key={id}
                    onClick={() => handleLayoutChange(id as any)}
                    className={clsx(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                      layout === id
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    )}
                    title={label}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                ))}
              </div>
            )}
            
            {/* 模式选择器 */}
            <MobileModeSelector
              value={lspState.mode}
              onChange={handleModeChange}
              className="hidden md:block"
            />
            
            {/* 移动端工具栏 */}
            {isMobileLayout && (
              <MobileEditorToolbar
                layout={layout}
                onLayoutChange={handleLayoutChange}
                onModeChange={handleModeChange}
                mode={lspState.mode}
                isOnline={true}
                isOnlineCheck={true}
              />
            )}
            
            {/* LSP 状态指示器 */}
            <div className="flex items-center gap-2">
              {lspState.isLSPConnecting && (
                <div className="flex items-center gap-1 px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-400">
                  <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                  <span>Connecting LSP...</span>
                </div>
              )}
              {lspState.isLSPConnected && !lspState.isLSPConnecting && (
                <div className="flex items-center gap-1 px-2 py-1 bg-green-500/10 border border-green-500/20 rounded-lg text-xs text-green-400">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                  <span>LSP Connected</span>
                </div>
              )}
              {lspState.lspError && (
                <div className="flex items-center gap-1 px-2 py-1 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
                  <span>LSP Error:</span>
                  <span>{lspState.lspError}</span>
                </div>
              )}
            </div>
            
            {/* PWA 安装按钮 */}
            {!isOnline && (
              <div className="flex items-center gap-2 px-2 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-xs text-yellow-400">
                <span className="flex items-center gap-1">
                  <WifiOffIcon className="w-3 h-3" />
                  <span>Offline</span>
                </span>
              </div>
            )}
            
            {isInstallable && !isInstalled && (
              <button
                onClick={install}
                className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <SmartphoneIcon className="w-4 h-4 mr-1" />
                安装应用
              </button>
            )}
            
            {isInstalled && updateAvailable && (
              <button
                onClick={applyUpdate}
                className="px-3 py-1.5 bg-green-500/10 border border-green-500/20 text-green-500 rounded-lg text-sm font-medium hover:bg-green-500/20 transition-colors"
              >
                <ArrowPathIcon className="w-4 h-4 mr-1 animate-spin" />
                更新可用
              </button>
            )}
          </div>
        </header>

        {/* 主内容区 */}
        <div className={clsx('flex-1 flex overflow-hidden', isMobileLayout && 'flex-col')}>
          {/* 移动端侧边栏 */}
          {isMobileLayout && sidebarOpen && (
            <aside className="fixed inset-y-0 left-0 z-50 w-72 bg-card border-r border-border shadow-xl transform transition-transform duration-300 ease-in-out lg:hidden"
              style={{ transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)' }}
            >
              <div className="h-full flex flex-col">
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <h3 className="font-medium">文件</h3>
                  <button onClick={() => setSidebarOpen(false)} className="p-1 hover:bg-accent rounded">
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
                <MobileFileTree
                  projectId={currentProject?.id || ''}
                  onFileSelect={handleFileSelect}
                  onFileCreate={() => {}}
                  onFolderCreate={() => {}}
                  onFileDelete={() => {}}
                  onFileRename={() => {}}
                  onFileMove={() => {}}
                />
              </div>
            )}
            
            {/* 桌面端侧边栏 */}
            {!isMobileLayout && sidebarOpen && (
              <aside className={clsx('bg-card border-r border-border flex flex-col', 'w-[280px]')}>
                <div className="p-2 border-b border-border flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">FILES</span>
                  <div className="flex items-center gap-1">
                    <button className="p-1 hover:bg-accent rounded" title="New File">
                      <PlusIcon className="w-4 h-4" />
                    </button>
                    <button className="p-1 hover:bg-accent rounded" title="New Folder">
                      <FolderPlusIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <FileTree
                  projectId={currentProject?.id || ''}
                  onFileSelect={handleFileSelect}
                  onFileCreate={() => {}}
                  onFolderCreate={() => {}}
                  onFileDelete={() => {}}
                  onFileRename={() => {}}
                  onFileMove={() => {}}
                />
              </aside>
            )}
            
            {/* 侧边栏分割器 */}
            {!isMobileLayout && sidebarOpen && (
              <div
                className="w-1 cursor-col-resize hover:bg-primary/20 transition-colors"
                onMouseDown={handleSidebarResize}
              />
            )}

            {/* 主编辑区域 */}
            <main className={clsx('flex-1 flex flex-col overflow-hidden', isMobileLayout && 'flex-col')}>
              {/* 标签栏 */}
              <div className={clsx('h-9 border-b border-border flex items-center px-2 bg-card overflow-x-auto', isMobileLayout && 'h-8')}>
                <div className="flex gap-1 min-w-max">
                  {openTabs.map((tabId) => {
                    const file = files.find(f => f.id === tabId);
                    if (!file) return null;
                    const isActive = activeTabId === tabId;
                    const isUnsaved = unsavedFiles.has(tabId);
                    
                    return (
                      <button
                        key={tabId}
                        onClick={() => {
                          setActiveTabId(tabId);
                          setSelectedFileId(tabId);
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          // 显示标签页上下文菜单
                        }}
                        className={clsx(
                          'flex items-center gap-1.5 px-2 py-1.5 rounded-t-lg text-sm font-mono transition-colors whitespace-nowrap',
                          isActive
                            ? 'bg-background border-b-2 border-primary'
                            : 'hover:bg-accent'
                        )}
                      >
                        {getFileIcon(file.name, file.mime_type, 'w-4 h-4')}
                        <span className="truncate max-w-[150px]">{file.name}</span>
                        {isUnsaved && <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full" />}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTabClose(tabId);
                          }}
                          className="ml-1 p-0.5 hover:bg-destructive/10 text-destructive rounded opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <XMarkIcon className="w-3 h-3" />
                        </button>
                      </button>
                    );
                  })}
                  <button
                    onClick={handleNewFile}
                    className="p-2 hover:bg-accent rounded-l-lg transition-colors"
                    title="New File"
                  >
                    <PlusIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* 编辑器内容区域 */}
              <div className="flex-1 flex flex-col overflow-hidden relative">
                {selectedFileId ? (
                  <div className="h-full flex flex-col">
                    <MonacoEditor
                      fileId={selectedFileId}
                      language={currentLanguage}
                      onContentChange={(content) => setFileContent(selectedFileId!, content)}
                      height="100%"
                    />
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <svg className="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 00-2 2v3a2 2 0 01-2 2H7a2 2 0 01-2-2v-3a2 2 0 01-2-2H2a1 1 0 01-1-1V5a2 2 0 012-2h1a1 1 0 011-1z" />
                      </svg>
                      <h3 className="text-lg font-medium mb-1">No file selected</h3>
                      <p className="text-sm text-muted-foreground">Select a file from the file tree or create a new one</p>
                    </div>
                  </div>
                )}
                
                {/* 终端/输出面板 */}
                {showTerminal && (
                  <aside className={clsx('border-t border-border bg-card flex flex-col', showOutput ? 'h-[200px]' : 'h-10')}>
                    <div className="flex items-center justify-between px-3 py-1.5 border-b border-border">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">TERMINAL</span>
                      <div className="flex items-center gap-2">
                        <button className="p-1 hover:bg-accent rounded" title="Clear">
                          <XMarkIcon className="w-4 h-4" />
                        </button>
                        <button onClick={() => setShowOutput(!showOutput)} className="p-1 hover:bg-accent rounded" title="Toggle Output">
                          <ChevronDownIcon className={clsx('w-4 h-4', showOutput && 'rotate-90')} />
                        </button>
                      </div>
                    </div>
                    {showOutput && (
                      <TerminalComponent height={terminalHeight - 36} />
                    )}
                  </aside>
                )}
              </div>
            </main>

            {/* 协作栏 */}
            {collabUsers.length > 0 && (
              <CollabBar users={collabUsers} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function getMonacoLanguage(language: string): string {
  const langMap: Record<string, string> = {
    python: 'python',
    javascript: 'javascript',
    typescript: 'typescript',
    rust: 'rust',
    go: 'go',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    csharp: 'csharp',
    php: 'php',
    ruby: 'ruby',
    swift: 'swift',
    kotlin: 'kotlin',
    scala: 'scala',
    r: 'r',
    lua: 'lua',
    perl: 'perl',
    dart: 'dart',
    zig: 'zig',
    julia: 'julia',
    haskell: 'haskell',
    fortran: 'fortran',
    objectivec: 'objective-c',
    vbnet: 'vb',
    fsharp: 'fsharp',
    groovy: 'groovy',
    html: 'html',
    css: 'css',
    sql: 'sql',
    bash: 'shell',
    powershell: 'powershell',
  };
  return langMap[language] || 'plaintext';
}