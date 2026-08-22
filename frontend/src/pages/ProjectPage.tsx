import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeftIcon, 
  PlusIcon, 
  FolderPlusIcon, 
  ShareIcon,
  Cog6ToothIcon,
  ChevronDownIcon,
  TrashIcon,
  PencilIcon,
  DownloadIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../hooks/useAuth';
import { useEditorStore } from '../../stores';
import { FileTree } from '../../components/filetree/FileTree';
import { MonacoEditor } from '../../components/editor/MonacoEditor';
import { TerminalComponent } from '../../components/terminal/Terminal';
import { CollabBar } from '../../components/collab/CollabBar';
import { executeCode } from '../../utils/api';
import { LANGUAGES, getLanguageById } from '../../utils/languages';
import clsx from 'clsx';

export function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useUIStore();
  
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
    fileContents,
    setFileContent,
    markSaved,
    sidebarWidth,
    setSidebarWidth,
    terminalHeight,
    setTerminalHeight,
    showTerminal,
    setShowTerminal,
    showOutput,
    setShowOutput,
    collabUsers,
  } = useEditorStore();
  
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [executionOutput, setExecutionOutput] = useState('');
  const [executionError, setExecutionError] = useState('');
  const [wasmFallback, setWasmFallback] = useState(false);
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);

  useEffect(() => {
    loadProject();
  }, [projectId]);

  const loadProject = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/projects/${projectId}`);
      if (response.ok) {
        const project = await response.json();
        setCurrentProject(project);
        // Load files would be done via the store
      } else {
        addToast({ type: 'error', title: 'Project not found' });
        navigate('/');
      }
    } catch (error) {
      addToast({ type: 'error', title: 'Failed to load project' });
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handleRun = async () => {
    const file = files.find(f => f.id === selectedFileId);
    if (!file || file.is_directory) return;

    const content = fileContents[file.id] || file.content || '';
    const language = getLanguageById(currentLanguage);

    setExecuting(true);
    setExecutionOutput('');
    setExecutionError('');
    setWasmFallback(false);
    setFallbackReason(null);

    try {
      const response = await executeCode({
        code: content,
        language: language.id,
        project_id: projectId,
      });

      if (response.data.stdout) setExecutionOutput(response.data.stdout);
      if (response.data.stderr) setExecutionError(response.data.stderr);
      if (response.data.wasm_fallback) {
        setWasmFallback(true);
        setFallbackReason(response.data.fallback_reason);
      }
    } catch (error: any) {
      setExecutionError(error.response?.data?.message || 'Execution failed');
    } finally {
      setExecuting(false);
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
    // Implementation
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!currentProject) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Project not found</h1>
          <button onClick={() => navigate('/')} className="mt-4 text-primary hover:underline">
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="h-12 px-4 border-b border-border flex items-center justify-between bg-background/95 backdrop-blur">
        <div className="flex items-center gap-3">
          <Link to="/" className="p-1.5 hover:bg-accent rounded-lg">
            <ArrowLeftIcon className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            <span className="font-medium truncate max-w-[300px]">{currentProject.name}</span>
            <span className="px-2 py-0.5 text-xs bg-primary/10 text-primary rounded">{currentProject.language || 'txt'}</span>
            <span className={clsx(
              'px-2 py-0.5 text-xs rounded',
              currentProject.visibility === 'public' && 'bg-green-500/20 text-green-400',
              currentProject.visibility === 'private' && 'bg-gray-500/20 text-gray-400',
              currentProject.visibility === 'unlisted' && 'bg-yellow-500/20 text-yellow-400',
            )}>
              {currentProject.visibility}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to={`/projects/${projectId}/settings`} className="p-1.5 hover:bg-accent rounded-lg" title="Settings">
            <Cog6ToothIcon className="w-5 h-5" />
          </Link>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
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
            projectId={projectId}
            onFileSelect={handleFileSelect}
            onFileCreate={() => {}}
            onFolderCreate={() => {}}
            onFileDelete={() => {}}
            onFileRename={() => {}}
            onFileMove={() => {}}
          />
        </aside>

        <div className="w-1 cursor-col-resize hover:bg-primary/20 transition-colors" onMouseDown={() => {}} />

        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="h-9 border-b border-border flex items-center px-2 bg-card overflow-x-auto">
            <div className="flex gap-1 min-w-max">
              {openTabs.map((tabId) => {
                const file = files.find(f => f.id === tabId);
                if (!file) return null;
                const isActive = activeTabId === tabId;
                return (
                  <button
                    key={tabId}
                    onClick={() => { setActiveTabId(tabId); setSelectedFileId(tabId); }}
                    className={clsx(
                      'flex items-center gap-1.5 px-2 py-1.5 rounded-t-lg text-sm font-mono transition-colors whitespace-nowrap',
                      isActive ? 'bg-background border-b-2 border-primary' : 'hover:bg-accent'
                    )}
                  >
                    <span className="truncate max-w-[150px]">{file.name}</span>
                    <button onClick={(e) => { e.stopPropagation(); handleTabClose(tabId); }} className="ml-1 p-0.5 hover:bg-destructive/10 text-destructive rounded opacity-0 group-hover:opacity-100">
                      <XMarkIcon className="w-3 h-3" />
                    </button>
                  </button>
                );
              })}
              <button className="p-2 hover:bg-accent rounded-l-lg" title="New File">
                <PlusIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden relative">
            {selectedFileId ? (
              <MonacoEditor
                fileId={selectedFileId}
                language={currentLanguage}
                onContentChange={(content) => {}}
                height="100%"
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                <p>Select a file to start editing</p>
              </div>
            )}
          </main>

          <aside className="w-80 border-l border-border bg-card flex flex-col">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-medium">Terminal</h3>
              <button className="p-1 hover:bg-accent rounded" title="Toggle Output">
                <ChevronDownIcon className="w-4 h-4" />
              </button>
            </div>
            <TerminalComponent height={200} />
          </aside>
        </div>
      </div>
    </div>
  );
}