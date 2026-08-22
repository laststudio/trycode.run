import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircleIcon, XCircleIcon, LockClosedIcon, EyeIcon, EyeSlashIcon, ArrowRightIcon, CodeBracketIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../hooks/useAuth';
import { useUIStore } from '../../stores';
import { MonacoEditor } from '../../components/editor/MonacoEditor';
import { TerminalComponent } from '../../components/terminal/Terminal';
import { executeCode } from '../../utils/api';
import { LANGUAGES, getLanguageById } from '../../utils/languages';
import clsx from 'clsx';

export function SharePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useUIStore();
  
  const [shareData, setShareData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState('python');
  const [fileContent, setFileContent] = useState('');
  const [executionOutput, setExecutionOutput] = useState('');
  const [executionError, setExecutionError] = useState('');
  const [wasmFallback, setWasmFallback] = useState(false);
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);

  useEffect(() => {
    loadShare();
  }, [token]);

  const loadShare = async () => {
    try {
      const response = await fetch(`/api/projects/share/${token}`);
      if (response.ok) {
        const data = await response.json();
        setShareData(data);
        // Load project files
        const filesResponse = await fetch(`/api/projects/${data.project_id}/files`);
        if (filesResponse.ok) {
          const files = await filesResponse.json();
          const mainFile = files.find((f: any) => !f.is_directory && f.path.endsWith(getFileExtension(data.language)));
          if (mainFile) {
            setFileContent(mainFile.content || '');
            setCurrentLanguage(data.language);
          }
        }
        setLoading(false);
      } else if (response.status === 401) {
        setNeedsPassword(true);
        setLoading(false);
      } else {
        addToast({ type: 'error', title: 'Share link not found or expired' });
        navigate('/');
      }
    } catch (error) {
      addToast({ type: 'error', title: 'Failed to load share' });
      navigate('/');
    }
  };

  const verifyPassword = async () => {
    try {
      const response = await fetch(`/api/projects/share/${token}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (response.ok) {
        setNeedsPassword(false);
        loadShare();
      } else {
        addToast({ type: 'error', title: 'Invalid password' });
      }
    } catch (error) {
      addToast({ type: 'error', title: 'Verification failed' });
    }
  };

  const handleRun = async () => {
    setExecuting(true);
    setExecutionOutput('');
    setExecutionError('');
    setWasmFallback(false);

    try {
      const response = await executeCode({
        code: fileContent,
        language: currentLanguage,
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

  const getFileExtension = (lang: string) => {
    const langData = LANGUAGES.find(l => l.id === lang);
    return langData?.extensions[0] || '.txt';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (needsPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md bg-card border border-border rounded-lg p-8">
          <div className="text-center mb-6">
            <LockClosedIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h1 className="text-2xl font-bold">Password Protected</h1>
            <p className="text-muted-foreground mt-2">This share link requires a password</p>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); verifyPassword(); }} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-background border border-border rounded-lg focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Enter password"
                required
              />
            </div>
            <button type="submit" className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90">
              Unlock
            </button>
          </form>
          <button onClick={() => navigate('/')} className="w-full mt-4 py-2 text-primary hover:underline">
            Go back
          </button>
        </div>
      </div>
    );
  }

  if (!shareData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <XCircleIcon className="w-16 h-16 mx-auto mb-4 text-red-500" />
          <h1 className="text-2xl font-bold">Share not found</h1>
          <p className="text-muted-foreground mt-2">This link may have expired or been removed</p>
          <button onClick={() => navigate('/')} className="mt-4 text-primary hover:underline">
            Go to homepage
          </button>
        </div>
      </div>
    );
  }

  const lang = getLanguageById(currentLanguage);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="h-12 px-4 border-b border-border flex items-center justify-between bg-background/95 backdrop-blur">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="p-1.5 hover:bg-accent rounded-lg">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <CodeBracketIcon className="w-5 h-5 text-primary" />
            <span className="font-medium truncate max-w-[300px]">{shareData.name}</span>
            <span className="px-2 py-0.5 text-xs bg-primary/10 text-primary rounded">{shareData.language}</span>
            {shareData.password_hash && (
              <span className="px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 rounded flex items-center gap-1">
                <LockClosedIcon className="w-3 h-3" />
                Protected
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Shared by {shareData.created_by_name || 'Unknown'}</span>
          <button onClick={() => navigate('/')} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
            Open in Editor
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Editor Area */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="h-9 border-b border-border flex items-center px-2 bg-card">
            <LanguageSelector
              value={currentLanguage}
              onChange={setCurrentLanguage}
              languages={LANGUAGES}
            />
          </div>
          <div className="flex-1 relative">
            <MonacoEditor
              fileId="shared-main"
              language={currentLanguage}
              readOnly={false}
              onContentChange={setFileContent}
              height="100%"
            />
          </div>
        </main>

        <aside className="w-80 border-l border-border bg-card flex flex-col">
          <div className="p-4 border-b border-border">
            <h3 className="font-medium">Output</h3>
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={handleRun}
                disabled={executing}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2',
                  executing ? 'bg-red-600 text-white' : 'bg-green-600 text-white hover:bg-green-700'
                )}
              >
                {executing ? 'Running...' : 'Run'}
              </button>
              {wasmFallback && (
                <span className="px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 rounded">
                  WASM Fallback
                </span>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4 font-mono text-sm">
            {executionOutput || executionError ? (
              <pre className="whitespace-pre-wrap">{executionOutput}{executionError}</pre>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                <p>No output yet. Click Run to execute.</p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}