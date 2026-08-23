import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Project, ProjectFile, Execution, ExecutionResponse } from '../types';

interface EditorState {
  // Project state
  currentProject: Project | null;
  setCurrentProject: (project: Project | null) => void;

  // Language service mode
  mode: 'monaco' | 'lsp' | 'hybrid';
  setMode: (mode: 'monaco' | 'lsp' | 'hybrid') => void;
  
  // File tree state
  files: ProjectFile[];
  setFiles: (files: ProjectFile[]) => void;
  addFile: (file: ProjectFile) => void;
  updateFile: (fileId: string, updates: Partial<ProjectFile>) => void;
  deleteFile: (fileId: string) => void;
  selectedFileId: string | null;
  setSelectedFileId: (id: string | null) => void;
  expandedFolders: Set<string>;
  toggleFolder: (folderId: string) => void;
  
  // Editor state
  activeTabId: string | null;
  setActiveTabId: (id: string | null) => void;
  openTabs: string[];
  addTab: (fileId: string) => void;
  closeTab: (fileId: string) => void;
  moveTab: (fromIndex: number, toIndex: number) => void;
  
  // Editor content (for unsaved changes)
  fileContents: Record<string, string>;
  setFileContent: (fileId: string, content: string) => void;
  getFileContent: (fileId: string) => string | undefined;
  markSaved: (fileId: string) => void;
  unsavedFiles: Set<string>;
  
  // Language
  currentLanguage: string;
  setCurrentLanguage: (language: string) => void;
  
  // Layout
  sidebarWidth: number;
  setSidebarWidth: (width: number) => void;
  terminalHeight: number;
  setTerminalHeight: (height: number) => void;
  showTerminal: boolean;
  setShowTerminal: (show: boolean) => void;
  showOutput: boolean;
  setShowOutput: (show: boolean) => void;
  
  // Collaboration
  collabUsers: CollabUser[];
  setCollabUsers: (users: CollabUser[]) => void;
  addCollabUser: (user: CollabUser) => void;
  removeCollabUser: (userId: string) => void;
  updateCollabUser: (userId: string, updates: Partial<CollabUser>) => void;
}

interface CollabUser {
  id: string;
  name: string;
  color: string;
  cursor?: { line: number; column: number };
  selection?: { startLine: number; startColumn: number; endLine: number; endColumn: number };
}

interface ExecutionState {
  currentExecution: ExecutionResponse | null;
  setCurrentExecution: (execution: ExecutionResponse | null) => void;
  executionHistory: Execution[];
  addToHistory: (execution: Execution) => void;
  isExecuting: boolean;
  setIsExecuting: (executing: boolean) => void;
  executionOutput: string;
  setExecutionOutput: (output: string) => void;
  appendExecutionOutput: (output: string) => void;
  executionError: string | null;
  setExecutionError: (error: string | null) => void;
  wasmFallback: boolean;
  setWasmFallback: (fallback: boolean) => void;
  fallbackReason: string | null;
  setFallbackReason: (reason: string | null) => void;
}

interface UIState {
  // Modals
  openModals: Set<string>;
  openModal: (modalId: string) => void;
  closeModal: (modalId: string) => void;
  closeAllModals: () => void;
  
  // Toasts
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  
  // Sidebar
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  
  // Command palette
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
}

interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}

export const useEditorStore = create<EditorState>()(
  persist(
    (set, get) => ({
      currentProject: null,
      setCurrentProject: (project) => set({ currentProject: project }),

      mode: 'hybrid',
      setMode: (mode) => set({ mode }),

      files: [],
      setFiles: (files) => set({ files }),
      addFile: (file) => set((state) => ({ files: [...state.files, file] })),
      updateFile: (fileId, updates) => set((state) => ({
        files: state.files.map(f => f.id === fileId ? { ...f, ...updates } : f)
      })),
      deleteFile: (fileId) => set((state) => ({
        files: state.files.filter(f => f.id !== fileId),
        openTabs: state.openTabs.filter(id => id !== fileId),
      })),
      selectedFileId: null,
      setSelectedFileId: (id) => set({ selectedFileId: id }),
      expandedFolders: new Set(),
      toggleFolder: (folderId) => set((state) => {
        const newExpanded = new Set(state.expandedFolders);
        if (newExpanded.has(folderId)) newExpanded.delete(folderId);
        else newExpanded.add(folderId);
        return { expandedFolders: newExpanded };
      }),
      
      activeTabId: null,
      setActiveTabId: (id) => set({ activeTabId: id }),
      openTabs: [],
      addTab: (fileId) => set((state) => {
        if (!state.openTabs.includes(fileId)) {
          return { openTabs: [...state.openTabs, fileId], activeTabId: fileId };
        }
        return { activeTabId: fileId };
      }),
      closeTab: (fileId) => set((state) => {
        const tabs = state.openTabs.filter(id => id !== fileId);
        let active = state.activeTabId;
        if (active === fileId) {
          const idx = state.openTabs.indexOf(fileId);
          active = tabs[idx] || tabs[idx - 1] || null;
        }
        return { openTabs: tabs, activeTabId: active };
      }),
      moveTab: (fromIndex, toIndex) => set((state) => {
        const tabs = [...state.openTabs];
        const [removed] = tabs.splice(fromIndex, 1);
        tabs.splice(toIndex, 0, removed);
        return { openTabs: tabs };
      }),
      
      fileContents: {},
      setFileContent: (fileId, content) => set((state) => ({
        fileContents: { ...state.fileContents, [fileId]: content },
        unsavedFiles: new Set([...state.unsavedFiles, fileId]),
      })),
      getFileContent: (fileId) => get().fileContents[fileId],
      markSaved: (fileId) => set((state) => {
        const unsaved = new Set(state.unsavedFiles);
        unsaved.delete(fileId);
        return { unsavedFiles: unsaved };
      }),
      unsavedFiles: new Set(),
      
      currentLanguage: 'python',
      setCurrentLanguage: (language) => set({ currentLanguage: language }),
      
      sidebarWidth: 280,
      setSidebarWidth: (width) => set({ sidebarWidth: Math.max(200, Math.min(500, width)) }),
      terminalHeight: 200,
      setTerminalHeight: (height) => set({ terminalHeight: Math.max(100, Math.min(500, height)) }),
      showTerminal: true,
      setShowTerminal: (show) => set({ showTerminal: show }),
      showOutput: true,
      setShowOutput: (show) => set({ showOutput: show }),
      
      collabUsers: [],
      setCollabUsers: (users) => set({ collabUsers: users }),
      addCollabUser: (user) => set((state) => ({
        collabUsers: [...state.collabUsers.filter(u => u.id !== user.id), user]
      })),
      removeCollabUser: (userId) => set((state) => ({
        collabUsers: state.collabUsers.filter(u => u.id !== userId)
      })),
      updateCollabUser: (userId, updates) => set((state) => ({
        collabUsers: state.collabUsers.map(u => u.id === userId ? { ...u, ...updates } : u)
      })),
    }),
    {
      name: 'editor-store',
      partialize: (state) => ({
        sidebarWidth: state.sidebarWidth,
        terminalHeight: state.terminalHeight,
        showTerminal: state.showTerminal,
        showOutput: state.showOutput,
        currentLanguage: state.currentLanguage,
        expandedFolders: Array.from(state.expandedFolders),
        openTabs: state.openTabs,
        activeTabId: state.activeTabId,
      }),
    }
  )
);

interface EditorSettings {
  mathRenderer: 'katex' | 'mathjax' | 'auto';
  mermaidEnabled: boolean;
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  minimap: boolean;
  lineNumbers: boolean;
  autoSave: boolean;
  theme: string;
}

interface EditorSettingsState {
  settings: EditorSettings;
  updateSettings: (updates: Partial<EditorSettings>) => void;
  resetSettings: () => void;
}

export const useEditorSettings = create<EditorSettingsState>()(
  persist(
    (set) => ({
      settings: {
        mathRenderer: 'katex' as 'katex' | 'mathjax' | 'auto',
        mermaidEnabled: true,
        fontSize: 14,
        tabSize: 4,
        wordWrap: true,
        minimap: false,
        lineNumbers: true,
        autoSave: true,
        theme: 'dark' as string,
      },
      updateSettings: (updates) =>
        set((state) => ({ settings: { ...state.settings, ...updates } })),
      resetSettings: () =>
        set({
          settings: {
            mathRenderer: 'katex',
            mermaidEnabled: true,
            fontSize: 14,
            tabSize: 4,
            wordWrap: true,
            minimap: false,
            lineNumbers: true,
            autoSave: true,
            theme: 'dark',
          },
        }),
    }),
    {
      name: 'editor-settings',
    }
  )
);

export const useExecutionStore = create<ExecutionState>((set) => ({
  currentExecution: null,
  setCurrentExecution: (execution) => set({ currentExecution: execution }),
  executionHistory: [],
  addToHistory: (execution) => set((state) => ({
    executionHistory: [execution, ...state.executionHistory.slice(0, 49)]
  })),
  isExecuting: false,
  setIsExecuting: (executing) => set({ isExecuting: executing }),
  executionOutput: '',
  setExecutionOutput: (output) => set({ executionOutput: output }),
  appendExecutionOutput: (output) => set((state) => ({
    executionOutput: state.executionOutput + output
  })),
  executionError: null,
  setExecutionError: (error) => set({ executionError: error }),
  wasmFallback: false,
  setWasmFallback: (fallback) => set({ wasmFallback: fallback }),
  fallbackReason: null,
  setFallbackReason: (reason) => set({ fallbackReason: reason }),
}));

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      openModals: new Set(),
      openModal: (modalId) => set((state) => ({
        openModals: new Set([...state.openModals, modalId])
      })),
      closeModal: (modalId) => set((state) => {
        const modals = new Set(state.openModals);
        modals.delete(modalId);
        return { openModals: modals };
      }),
      closeAllModals: () => set({ openModals: new Set() }),
      
      toasts: [],
      addToast: (toast) => set((state) => ({
        toasts: [...state.toasts, { ...toast, id: crypto.randomUUID() }]
      })),
      removeToast: (id) => set((state) => ({
        toasts: state.toasts.filter(t => t.id !== id)
      })),
      
      sidebarOpen: true,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      
      commandPaletteOpen: false,
      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
    }),
    {
      name: 'ui-store',
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
      }),
    }
  )
);