import { useState, useCallback } from 'react';
import { 
  SparklesIcon, 
  MagnifyingGlassIcon, 
  BugAntIcon, 
  BeakerIcon,
  ArrowRightIcon,
  XMarkIcon,
  ClipboardDocumentIcon,
} from '../../utils/icons.ts';
import { useEditorStore } from '../../stores';

import { executeAi } from '../../utils/api';
import clsx from 'clsx';

interface AiPanelProps {
  onClose: () => void;
}

export function AiPanel({ onClose }: AiPanelProps) {
  const { fileContents, selectedFileId, currentLanguage } = useEditorStore();
  const [activeTab, setActiveTab] = useState<'explain' | 'review' | 'tests' | 'chat'>('explain');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);

  const currentFileContent = selectedFileId ? fileContents[selectedFileId] : '';
  const lang = currentLanguage;

  const handleExplain = useCallback(async () => {
    if (!currentFileContent.trim()) return;
    setLoading(true);
    setOutput(null);
    try {
      const response = await executeAi({
        type: 'explain',
        code: currentFileContent,
        language: lang,
      });
      setOutput(response.data.explanation);
    } catch (error: any) {
      setOutput('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [currentFileContent, lang]);

  const handleReview = useCallback(async () => {
    if (!currentFileContent.trim()) return;
    setLoading(true);
    setOutput(null);
    try {
      const response = await executeAi({
        type: 'review',
        code: currentFileContent,
        language: lang,
      });
      setOutput(JSON.stringify(response.data, null, 2));
    } catch (error: any) {
      setOutput('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [currentFileContent, lang]);

  const handleGenerateTests = useCallback(async () => {
    if (!currentFileContent.trim()) return;
    setLoading(true);
    setOutput(null);
    try {
      const response = await executeAi({
        type: 'generate-tests',
        code: currentFileContent,
        language: lang,
      });
      setOutput(response.data.tests);
    } catch (error: any) {
      setOutput('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [currentFileContent, lang]);

  const handleChat = useCallback(async () => {
    if (!input.trim()) return;
    setStreaming(true);
    setOutput(prev => (prev || '') + '\n\nYou: ' + input);
    const userInput = input;
    setInput('');
    
    try {
      // This would connect to streaming endpoint
      const response = await executeAi({
        type: 'chat',
        prompt: userInput,
        context: currentFileContent,
        language: lang,
      });
      setOutput(prev => (prev || '') + '\n\nAI: ' + response.data.response);
    } catch (error: any) {
      setOutput(prev => (prev || '') + '\n\nError: ' + error.message);
    } finally {
      setStreaming(false);
    }
  }, [input, currentFileContent, lang]);

  const copyOutput = () => {
    if (output) {
      navigator.clipboard.writeText(output);
    }
  };

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <SparklesIcon className="w-5 h-5 text-primary" />
          <span className="font-medium">AI Assistant</span>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-accent rounded transition-colors">
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="flex -mb-px" aria-label="AI Assistant tabs">
          {[
            { id: 'explain', label: 'Explain', icon: MagnifyingGlassIcon },
            { id: 'review', label: 'Review', icon: BugAntIcon },
            { id: 'tests', label: 'Tests', icon: BeakerIcon },
            { id: 'chat', label: 'Chat', icon: SparklesIcon },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as any)}
              className={clsx(
                'flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                activeTab === id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-transparent'
              )}
            >
              <SparklesIcon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Input Area for Chat */}
        {activeTab === 'chat' && (
          <div className="p-4 border-b border-border">
            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleChat();
                  }
                }}
                placeholder="Ask AI about your code..."
                rows={2}
                className="flex-1 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:border-primary focus:outline-none resize-none"
                disabled={streaming}
              />
              <button
                onClick={handleChat}
                disabled={!input.trim() || streaming}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {streaming ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <>
                    <ArrowRightIcon className="w-4 h-4" />
                    Send
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Output Area */}
        <div className="flex-1 overflow-auto p-4">
          {output ? (
            <div className="prose prose-sm max-w-none">
              <pre className="whitespace-pre-wrap bg-background/50 p-4 rounded-lg text-sm overflow-auto max-h-[60vh]">
                {output}
              </pre>
              <div className="flex gap-2 mt-3">
                <button onClick={copyOutput} className="px-3 py-1.5 text-sm bg-muted hover:bg-muted/80 rounded-lg flex items-center gap-1.5">
                  <ClipboardDocumentIcon className="w-4 h-4" />
                  Copy
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
              <SparklesIcon className="w-16 h-16 mb-4 opacity-30" />
              <h3 className="text-lg font-medium mb-1">No output yet</h3>
              <p className="text-sm text-center max-w-xs">
                {activeTab === 'explain' && 'Select code and click Explain to get an explanation'}
                {activeTab === 'review' && 'Click Review to get code review feedback'}
                {activeTab === 'tests' && 'Click Generate Tests to create test cases'}
                {activeTab === 'chat' && 'Start a conversation with AI about your code'}
              </p>
            </div>
          )}
        </div>

        {/* Action Buttons for non-chat tabs */}
        {activeTab !== 'chat' && currentFileContent && (
          <div className="p-4 border-t border-border flex gap-2">
            {activeTab === 'explain' && (
              <button
                onClick={handleExplain}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <>
                    <MagnifyingGlassIcon className="w-4 h-4" />
                    Explain Code
                  </>
                )}
              </button>
            )}
            {activeTab === 'review' && (
              <button
                onClick={handleReview}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <>
                    <BugAntIcon className="w-4 h-4" />
                    Review Code
                  </>
                )}
              </button>
            )}
            {activeTab === 'tests' && (
              <button
                onClick={handleGenerateTests}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <>
                    <BeakerIcon className="w-4 h-4" />
                    Generate Tests
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}