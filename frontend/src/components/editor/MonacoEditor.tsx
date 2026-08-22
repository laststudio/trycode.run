import { useEffect, useRef, useCallback, useState } from 'react';
import Editor from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { useEditorStore } from '../../stores';
import { LANGUAGES } from '../../utils/languages';
import { useCollab } from '../../hooks/useCollab';

interface MonacoEditorProps {
  fileId: string;
  language: string;
  readOnly?: boolean;
  onContentChange?: (content: string) => void;
  height?: string;
  width?: string;
}

export function MonacoEditor({ 
  fileId, 
  language, 
  readOnly = false, 
  onContentChange,
  height = '100%',
  width = '100%',
}: MonacoEditorProps) {
  const editorRef = useRef<Editor>(null);
  const [mounted, setMounted] = useState(false);
  const { 
    fileContents, 
    setFileContent, 
    markSaved,
    unsavedFiles,
    collabUsers,
    setCollabUsers 
  } = useEditorStore();
  const { connect, disconnect, awareness } = useCollab();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Get initial content
  const initialContent = fileContents[fileId] || '';

  // Language mapping for Monaco
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

  // Handle editor mount
  const handleEditorMount = useCallback((editor: any, monacoInstance: typeof monaco) => {
    editorRef.current = editor;
    
    // Set up collaboration if enabled
    if (awareness) {
      // Yjs awareness integration would go here
    }

    // Set up content change listener
    editor.onDidChangeModelContent(() => {
      const content = editor.getValue();
      setFileContent(fileId, content);
      onContentChange?.(content);
    });

    // Set up save shortcut
    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS, () => {
      markSaved(fileId);
    });

    // Configure editor options
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
    });

    // Add collaborator cursors
    if (collabUsers.length > 0) {
      // Decorate other users' cursors
      const decorations = collabUsers
        .filter(u => u.id !== 'current-user')
        .map(u => ({
          range: new monacoInstance.Range(u.cursor?.line || 1, u.cursor?.column || 1, u.cursor?.line || 1, u.cursor?.column || 1),
          options: {
            className: `collab-cursor-${u.color.replace('#', '')}`,
            beforeContentClassName: `collab-cursor-label-${u.color.replace('#', '')}`,
            before: u.name,
          }
        }));
      
      editor.deltaDecorations([], decorations);
    }
  }, [fileId, language, readOnly, collabUsers, awareness, setFileContent, markSaved, onContentChange]);

  // Handle content changes from collaboration
  useEffect(() => {
    if (editorRef.current && awareness) {
      // Apply remote changes
    }
  }, [awareness]);

  if (!mounted) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const monacoLanguage = getMonacoLanguage(language);

  return (
    <div className="h-full w-full relative" style={{ height, width }}>
      <Editor
        height="100%"
        width="100%"
        language={monacoLanguage}
        theme="vs-dark"
        value={initialContent}
        onMount={handleEditorMount}
        onChange={onContentChange}
        options={{
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
          fontSize: 14,
          lineHeight: 22,
          letterSpacing: 0.5,
        }}
      />
      
      {/* Unsaved indicator */}
      {unsavedFiles.has(fileId) && (
        <div className="absolute top-2 right-2 z-10">
          <span className="bg-yellow-500/20 text-yellow-400 text-xs px-2 py-1 rounded flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse"></span>
            Unsaved
          </span>
        </div>
      )}
      
      {/* Collaborator avatars */}
      {collabUsers.length > 1 && (
        <div className="absolute top-2 left-2 z-10 flex -space-x-2">
          {collabUsers.slice(0, 5).map((user) => (
            <div
              key={user.id}
              className="w-8 h-8 rounded-full border-2 border-background flex items-center justify-center text-xs font-medium"
              style={{ backgroundColor: user.color }}
              title={user.name}
            >
              {user.name.charAt(0).toUpperCase()}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}