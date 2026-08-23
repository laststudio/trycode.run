import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  PlayIcon,
  StopIcon,
  SparklesIcon,
  PlusIcon,
  FolderPlusIcon,
  Cog6ToothIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XMarkIcon,
} from '../utils/icons';
import { MonacoEditor } from '../components/editor/MonacoEditor';
import { TerminalComponent } from '../components/terminal/Terminal';
import { FileTree } from '../components/filetree/FileTree';
import { LanguageSelector } from './components/LanguageSelector';
import { CollabBar } from '../components/collab/CollabBar';
import { AiPanel } from '../components/ai/AiPanel';
import { useEditorStore, useExecutionStore, useUIStore } from '../stores';
import { useT } from '../i18n';
import { executeCode } from '../utils/api';
import { LANGUAGES, getLanguageById } from '../utils/languages';
import { clsx } from 'clsx';

export function EditorPage() {
  const navigate = useNavigate();
  const t = useT();
  const { projectId } = useParams<{ projectId?: string }>();

  const {
    currentProject,
    setCurrentProject,
    files,
    selectedFileId,
    setSelectedFileId,
    activeTabId,
    setActiveTabId,
    openTabs,
    addTab,
    closeTab,
    currentLanguage,
    setCurrentLanguage,
    sidebarWidth,
    setSidebarWidth,
    terminalHeight,
    setTerminalHeight,
    showTerminal,
    showOutput,
    setShowOutput,
    fileContents,
    setFileContent,
    markSaved,
    collabUsers,
  } = useEditorStore();

  const {
    isExecuting,
    setIsExecuting,
    executionOutput,
    setExecutionOutput,
    executionError,
    setExecutionError,
    wasmFallback,
    setWasmFallback,
    fallbackReason,
    setFallbackReason,
    currentExecution,
    setCurrentExecution,
  } = useExecutionStore();

  const {
    openModal,
    addToast,
    sidebarOpen,
    toggleSidebar
  } = useUIStore();

  const [resizing, setResizing] = useState<'sidebar' | 'terminal' | null>(null);
  const [showAi, setShowAi] = useState(false);

  // Load project if projectId provided
  useEffect(() => {
    if (projectId && (!currentProject || currentProject.id !== projectId)) {
      loadProject(projectId);
    }
  }, [projectId]);

  const loadProject = async (id: string) => {
    try {
      const response = await fetch(`/api/projects/${id}`);
      if (response.ok) {
        const project = await response.json();
        setCurrentProject(project);
        // Load files
        const filesResponse = await fetch(`/api/projects/${id}/files`);
        if (filesResponse.ok) {
          const files = await filesResponse.json();
          // Set files in store
        }
      }
    } catch (error) {
      console.error('Failed to load project:', error);
    }
  };

  const handleRun = useCallback(async () => {
    const file = files.find(f => f.id === selectedFileId);
    if (!file || file.is_directory) return;

    const content = fileContents[file.id] || file.content || '';
    const language = getLanguageById(currentLanguage);

    setIsExecuting(true);
    setExecutionOutput('');
    setExecutionError(null);
    setWasmFallback(false);
    setFallbackReason(null);

    try {
      const response = await executeCode({
        code: content,
        language: language.id,
        project_id: currentProject?.id,
      });

      setCurrentExecution(response.data);
      
      if (response.data.stdout) {
        setExecutionOutput(response.data.stdout);
      }
      if (response.data.stderr) {
        setExecutionError(response.data.stderr);
      }
      if (response.data.wasm_fallback) {
        setWasmFallback(true);
        setFallbackReason(response.data.fallback_reason);
      }
    } catch (error: any) {
      setExecutionError(error.response?.data?.message || t('editor.executionFailed'));
    } finally {
      setIsExecuting(false);
    }
  }, [selectedFileId, currentLanguage, currentProject, fileContents, files, t]);

  const handleStop = () => {
    // Implementation for stopping execution
  };

  const handleNewFile = () => {
    openModal('new-file');
  };

  const handleNewFolder = () => {
    openModal('new-folder');
  };

  const handleSave = () => {
    if (selectedFileId) {
      markSaved(selectedFileId);
      addToast({ type: 'success', title: t('editor.fileSaved') });
    }
  };

  const handleFileSelect = (file: any) => {
    if (!file.is_directory) {
      addTab(file.id);
      setSelectedFileId(file.id);
      setActiveTabId(file.id);
    }
  };

  const handleTabClose = (fileId: string) => {
    closeTab(fileId);
  };

  const handleLanguageChange = (langId: string) => {
    setCurrentLanguage(langId);
  };

  return (
    <div className="h-screen w-full flex flex-col bg-background">
      {/* Top Bar */}
      <header className="h-10 px-3 border-b border-border flex items-center justify-between bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSidebar}
            className="p-1.5 hover:bg-accent rounded-lg transition-colors"
            aria-label={sidebarOpen ? t('editor.collapseSidebar') : t('editor.expandSidebar')}
          >
            <ChevronLeftIcon className={clsx('w-5 h-5', sidebarOpen && 'rotate-180')} />
          </button>
          
          {currentProject && (
            <span className="font-medium text-sm truncate max-w-[200px]">{currentProject.name}</span>
          )}

          <LanguageSelector
            value={currentLanguage}
            onChange={handleLanguageChange}
            languages={LANGUAGES}
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Action Buttons */}
          <button
            onClick={handleNewFile}
            className="p-1.5 hover:bg-accent rounded-lg transition-colors"
            title={`${t('editor.newFile')} (Ctrl+N)`}
          >
            <PlusIcon className="w-5 h-5" />
          </button>
          
          <button
            onClick={handleNewFolder}
            className="p-1.5 hover:bg-accent rounded-lg transition-colors"
            title={t('editor.newFolder')}
          >
            <FolderPlusIcon className="w-5 h-5" />
          </button>

          <button
            onClick={handleSave}
            className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            title={`${t('common.save')} (Ctrl+S)`}
          >
            {t('common.save')}
          </button>

          <div className="w-px h-6 bg-border mx-1" />

          <button
            onClick={handleRun}
            disabled={isExecuting}
            className={clsx(
              'px-4 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors',
              isExecuting 
                ? 'bg-destructive text-destructive-foreground' 
                : 'bg-green-600 text-white hover:bg-green-700'
            )}
          >
            {isExecuting ? (
              <>
                <StopIcon className="w-5 h-5 animate-spin" />
                {t('editor.running')}
              </>
            ) : (
              <>
                <PlayIcon className="w-5 h-5" />
                {t('editor.run')}
              </>
            )}
          </button>

          {wasmFallback && (
            <span className="px-2 py-1 text-xs bg-yellow-500/20 text-yellow-400 rounded flex items-center gap-1">
              <SparklesIcon className="w-3 h-3" />
              {t('editor.wasmFallback', { reason: fallbackReason ?? '' })}
            </span>
          )}

          <button
            onClick={() => setShowAi(!showAi)}
            className={clsx('p-1.5 rounded-lg transition-colors', showAi && 'bg-accent')}
            title={t('editor.aiAssistant')}
          >
            <SparklesIcon className={clsx('w-5 h-5', showAi && 'text-primary')} />
          </button>

          <button
            onClick={() => navigate('/settings')}
            className="p-1.5 hover:bg-accent rounded-lg transition-colors"
            title={t('nav.settings')}
          >
            <Cog6ToothIcon className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside
          className={clsx(
            'bg-card border-r border-border flex flex-col transition-all duration-200',
            sidebarOpen ? 'w-[280px]' : 'w-12'
          )}
          style={{ width: sidebarOpen ? sidebarWidth : 48 }}
        >
          {sidebarOpen && (
            <div className="p-2 border-b border-border flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t('editor.explorer')}
              </span>
              <div className="flex items-center gap-1">
                <button onClick={handleNewFile} className="p-1 hover:bg-accent rounded" title={t('editor.newFile')}>
                  <PlusIcon className="w-4 h-4" />
                </button>
                <button onClick={handleNewFolder} className="p-1 hover:bg-accent rounded" title={t('editor.newFolder')}>
                  <FolderPlusIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
          
          <FileTree
            projectId={currentProject?.id || ''}
            onFileSelect={handleFileSelect}
            onFileCreate={handleNewFile}
            onFolderCreate={handleNewFolder}
            onFileDelete={() => {}}
            onFileRename={() => {}}
            onFileMove={() => {}}
          />
        </aside>

        {/* Sidebar Resizer */}
        {sidebarOpen && (
          <div
            className="w-1 cursor-col-resize hover:bg-primary/20 transition-colors"
            onMouseDown={() => setResizing('sidebar')}
          />
        )}

        {/* Editor Area */}
        <main className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Tabs Bar */}
          <div className="h-9 border-b border-border flex items-center px-2 bg-card overflow-x-auto">
            <div className="flex gap-1 min-w-max">
              {openTabs.map((tabId) => {
                const file = files.find(f => f.id === tabId);
                if (!file) return null;
                const isActive = activeTabId === tabId;
                const isUnsaved = fileContents[tabId] && fileContents[tabId] !== file.content;
                
                return (
                  <button
                    key={tabId}
                    onClick={() => {
                      setActiveTabId(tabId);
                      setSelectedFileId(tabId);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      // Show tab context menu
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
                title={t('editor.newFile')}
              >
                <PlusIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Editor Content */}
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
                  <h3 className="text-lg font-medium mb-1">{t('editor.noFileSelected')}</h3>
                  <p className="text-sm">{t('editor.noFileSelectedHint')}</p>
                </div>
              </div>
            )}
            
            {/* AI Panel */}
            {showAi && (
              <div className="absolute right-0 top-9 bottom-0 w-96 border-l border-border bg-card shadow-xl z-20 animate-slide-in-from-right">
                <AiPanel onClose={() => setShowAi(false)} />
              </div>
            )}
          </div>
        </main>

        {/* Terminal Resizer */}
        {showTerminal && (
          <div
            className="h-1 cursor-row-resize hover:bg-primary/20 transition-colors w-full"
            onMouseDown={() => setResizing('terminal')}
          />
        )}

        {/* Terminal/Output Panel */}
        {showTerminal && (
          <aside className={clsx('border-t border-border bg-card flex flex-col', showOutput ? 'h-[200px]' : 'h-10')} style={{ height: terminalHeight }}>
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('editor.terminal')}</span>
                {isExecuting && <span className="text-xs text-yellow-400">Running…</span>}
                {!isExecuting && currentExecution && (
                  <span className="text-xs text-muted-foreground">{currentExecution.status}</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button className="p-1 hover:bg-accent rounded" title={t('common.clear')}>
                  <XMarkIcon className="w-4 h-4" />
                </button>
                <button onClick={() => setShowOutput(!showOutput)} className="p-1 hover:bg-accent rounded" title={t('editor.toggleOutput')}>
                  <ChevronRightIcon className={clsx('w-4 h-4', showOutput && 'rotate-90')} />
                </button>
              </div>
            </div>
            {showOutput && (
              <>
                <TerminalComponent height={terminalHeight - 36} />
                {(executionOutput || executionError) && (
                  <pre className="max-h-24 overflow-auto px-3 py-1 text-xs font-mono whitespace-pre-wrap border-t border-border">
                    {executionError || executionOutput}
                  </pre>
                )}
                {wasmFallback && (
                  <div className="px-3 pb-1 text-xs text-yellow-400">WASM fallback: {fallbackReason}</div>
                )}
              </>
            )}
          </aside>
        )}

        {/* AI Panel Sidebar (alternative position) */}
        {/* {showAi && !showTerminal && (
          <aside className="w-96 border-l border-border bg-card shadow-xl">
            <AiPanel onClose={() => setShowAi(false)} />
          </aside>
        )} */}

        {/* Collab Bar */}
        {collabUsers.length > 0 && (
          <CollabBar users={collabUsers} />
        )}
      </div>

      {/* Resize Handlers */}
      {resizing && (
        <div
          className="fixed inset-0 z-50 cursor-col-resize"
          onMouseMove={(e) => {
            if (resizing === 'sidebar') {
              setSidebarWidth(Math.max(200, Math.min(500, e.clientX)));
            }
          }}
          onMouseUp={() => setResizing(null)}
          onMouseLeave={() => setResizing(null)}
        />
      )}

      {/* Terminal Resize Handler */}
      {resizing === 'terminal' && (
        <div
          className="fixed inset-0 z-50 cursor-row-resize"
          onMouseMove={(e) => {
            setTerminalHeight(Math.max(100, Math.min(500, window.innerHeight - e.clientY)));
          }}
          onMouseUp={() => setResizing(null)}
          onMouseLeave={() => setResizing(null)}
        />
      )}
    </div>
  );
}

function getFileIcon(_fileName: string, _mimeType?: string, className = 'w-4 h-4') {
  // Simplified - would use the actual utility
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.381C7.673 5.04 7.225 5.601 7 6.382V11a6 6 0 1012 0v3.158A2.002 2.002 0 0118 14.158l-1.405 1.405A2.032 2.032 0 0115 17z" />
    </svg>
  );
}