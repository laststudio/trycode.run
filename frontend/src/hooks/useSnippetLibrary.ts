import { useState, useCallback, useMemo, useEffect } from 'react';
import { 
  SearchIcon, 
  PlusIcon, 
  Trash2Icon, 
  Edit2Icon, 
  CopyIcon,
  ChevronDownIcon,
  FolderIcon,
  FileCodeIcon,
  TagIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

interface CodeSnippet {
  id: string;
  title: string;
  description: string;
  language: string;
  code: string;
  tags: string[];
  folderId?: string;
  createdAt: number;
  updatedAt: number;
  usageCount: number;
}

interface SnippetFolder {
  id: string;
  name: string;
  parentId?: string;
  children?: SnippetFolder[];
  snippetIds: string[];
  expanded: boolean;
  createdAt: number;
}

interface SnippetLibraryState {
  snippets: Map<string, CodeSnippet>;
  folders: Map<string, SnippetFolder>;
  rootFolderIds: string[];
  searchQuery: string;
  selectedFolderId?: string;
  editingSnippetId?: string;
  editingFolderId?: string;
}

const DEFAULT_FOLDERS = [
  { id: 'general', name: '通用', children: [], snippetIds: [], expanded: true, createdAt: Date.now() },
  { id: 'algorithms', name: '算法', children: [], snippetIds: [], expanded: true, createdAt: Date.now() },
  { id: 'patterns', name: '设计模式', children: [], snippetIds: [], expanded: true, createdAt: Date.now() },
  { id: 'utils', name: '实用工具', children: [], snippetIds: [], expanded: true, createdAt: Date.now() },
];

const BUILTIN_SNIPPETS = [
  {
    id: 'py-main',
    title: 'Python 主函数模板',
    description: '标准的 Python 主函数入口',
    language: 'python',
    code: 'def main():\n    pass\n\nif __name__ == "__main__":\n    main()',
    tags: ['template', 'main', 'entry'],
    folderId: 'general',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    usageCount: 0,
  },
  {
    id: 'py-class',
    title: 'Python 类模板',
    description: '带有类型注解的类模板',
    language: 'python',
    code: 'from dataclasses import dataclass\nfrom typing import Optional\n\n@dataclass\nclass ${1:ClassName}:\n    ${2:field}: ${3:type} = ${4:default}\n\n    def ${5:method}(self${6:, ${7:param}: ${8:type}}) -> ${9:return_type}:\n        ${10:pass}',
    tags: ['template', 'class', 'dataclass'],
    folderId: 'patterns',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    usageCount: 0,
  },
  {
    id: 'js-fetch',
    title: 'Fetch 请求封装',
    description: '带错误处理的 fetch 封装',
    language: 'javascript',
    code: 'async function fetchWithErrorHandling(url, options = {}) {\n  try {\n    const response = await fetch(url, {\n      headers: {\n        \'Content-Type\': \'application/json\',\n        ...options.headers\n      },\n      ...options\n    });\n    \n    if (!response.ok) {\n      throw new Error(`HTTP error! status: ${response.status}`);\n    }\n    \n    return await response.json();\n  } catch (error) {\n    console.error(\'Fetch error:\', error);\n    throw error;\n  }\n}',
    tags: ['fetch', 'async', 'error-handling'],
    folderId: 'utils',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    usageCount: 0,
  },
  {
    id: 'react-hook',
    title: '自定义 Hook 模板',
    description: '通用的自定义 Hook 模板',
    language: 'typescript',
    code: 'import { useState, useEffect, useCallback } from \'react\';\n\ninterface ${1:HookName}Options {\n  ${2:option}: ${3:type};\n}\n\ninterface ${1:HookName}Return {\n  ${4:value}: ${5:type};\n  ${6:loading}: boolean;\n  ${7:error}: Error | null;\n}\n\nexport function use${1:HookName}(options: ${1:HookName}Options = {}): ${1:HookName}Return {\n  const [${4:value}, set${4:Value}] = useState<${5:type}>(${7:initialValue});\n  const [${6:loading}, set${6:Loading}] = useState(false);\n  const [${7:error}, set${7:Error}] = useState<Error | null>(null);\n\n  const ${8:refresh} = useCallback(async () => {\n    set${6:Loading}(true);\n    set${7:Error}(null);\n    try {\n      ${9:// 业务逻辑}\n    } catch (err) {\n      set${7:Error}(err as Error);\n    } finally {\n      set${6:Loading}(false);\n    }\n  }, [${10:dependencies}]);\n\n  useEffect(() => {\n    ${8:refresh}();\n  }, [${8:refresh}]);\n\n  return {\n    ${4:value},\n    ${6:loading},\n    ${7:error},\n    ${8:refresh},\n  };\n}',
    tags: ['hook', 'react', 'template'],
    folderId: 'patterns',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    usageCount: 0,
  },
  {
    id: 'rust-main',
    title: 'Rust 主函数模板',
    description: '标准的 Rust 程序入口',
    language: 'rust',
    code: 'fn main() {\n    println!("Hello, world!");\n}',
    tags: ['template', 'main', 'entry'],
    folderId: 'general',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    usageCount: 0,
  },
  {
    id: 'go-main',
    title: 'Go 主函数模板',
    description: '标准的 Go 程序入口',
    language: 'go',
    code: 'package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, World!")\n}',
    tags: ['template', 'main', 'entry'],
    folderId: 'general',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    usageCount: 0,
  },
];

export interface CodeSnippet {
  id: string;
  title: string;
  description: string;
  language: string;
  code: string;
  tags: string[];
  folderId?: string;
  createdAt: number;
  updatedAt: number;
  usageCount: number;
}

export interface SnippetFolder {
  id: string;
  name: string;
  parentId?: string;
  children?: SnippetFolder[];
  snippetIds: string[];
  expanded: boolean;
  createdAt: number;
}

interface SnippetLibraryState {
  snippets: Map<string, any>;
  folders: Map<string, any>;
  rootFolderIds: string[];
  searchQuery: string;
  selectedFolderId?: string;
  editingSnippetId?: string;
  editingFolderId?: string;
}

const BUILTIN_SNIPPETS = [
  // ... 这里简化，实际包含上面定义的片段
];

export function useSnippetLibrary() {
  const [state, setState] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('snippet-library');
        if (saved) {
          const parsed = JSON.parse(saved);
          return {
            snippets: new Map(Object.entries(parsed.snippets || {})),
            folders: new Map(Object.entries(parsed.folders || {})),
            rootFolderIds: parsed.rootFolderIds || ['general', 'algorithms', 'patterns', 'utils'],
            searchQuery: '',
            selectedFolderId: undefined,
            editingSnippetId: undefined,
            editingFolderId: undefined,
          };
        }
      } catch (e) {
        console.warn('Failed to load snippet library:', e);
      }
    }
    return {
      snippets: new Map(),
      folders: new Map(),
      rootFolderIds: ['general', 'algorithms', 'patterns', 'utils'],
      searchQuery: '',
      selectedFolderId: undefined,
      editingSnippetId: undefined,
      editingFolderId: undefined,
    };
  });

  const persistState = useCallback((newState: any) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('snippet-library', JSON.stringify({
          snippets: Object.fromEntries(newState.snippets),
          folders: Object.fromEntries(newState.folders),
          rootFolderIds: newState.rootFolderIds,
        }));
      } catch (e) {
        console.warn('Failed to persist snippet library:', e);
      }
    }
  }, []);

  useEffect(() => {
    const existingSnippets = Array.from(state.snippets.keys());
    if (existingSnippets.length === 0) {
      // 初始化内置片段
      // 实际实现中会有完整的 BUILTIN_SNIPPETS
    }
  }, []);

  useEffect(() => {
    persistState(state);
  }, [state]);

  const persistState = useCallback((newState: any) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('snippet-library', JSON.stringify({
          snippets: Object.fromEntries(newState.snippets),
          folders: Object.fromEntries(newState.folders),
          rootFolderIds: newState.rootFolderIds,
        }));
      } catch (e) {
        console.warn('Failed to persist snippet library:', e);
      }
    }
  }, []);

  const filteredSnippets = useMemo(() => {
    let snippets = Array.from(state.snippets.values());
    
    if (state.searchQuery) {
      const query = state.searchQuery.toLowerCase();
      snippets = snippets.filter(s => 
        s.title.toLowerCase().includes(query) ||
        s.description.toLowerCase().includes(query) ||
        s.code.toLowerCase().includes(query) ||
        s.tags.some(t => t.toLowerCase().includes(query)) ||
        s.language.toLowerCase().includes(query)
      );
    }
    
    if (state.selectedFolderId) {
      const folder = state.folders.get(state.selectedFolderId);
      if (folder) {
        snippets = snippets.filter(s => folder.snippetIds.includes(s.id));
      }
    }
    
    return snippets.sort((a, b) => b.usageCount - a.usageCount || b.updatedAt - a.updatedAt);
  }, [state.snippets, state.folders, state.searchQuery, state.selectedFolderId]);

  const folderTree = useMemo(() => {
    const buildTree = (folderId: string) => {
      const folder = state.folders.get(folderId);
      if (!folder) return null;
      return {
        ...folder,
        children: folder.children?.map(c => buildTree(c.id)) || [],
      };
    };
    return state.rootFolderIds.map(id => buildTree(id)).filter(Boolean);
  }, [state.folders]);

  const createSnippet = useCallback((snippet: any) => {
    const newSnippet = {
      ...snippet,
      id: `snippet-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      usageCount: 0,
    };
    setState(prev => {
      const newSnippets = new Map(prev.snippets);
      newSnippets.set(newSnippet.id, newSnippet);
      
      if (snippet.folderId) {
        const folder = new Map(prev.folders);
        const folderData = folder.get(snippet.folderId!);
        if (folderData) {
          folder.set(snippet.folderId!, {
            ...folderData,
            snippetIds: [...folderData.snippetIds, newSnippet.id],
          });
          return { ...prev, snippets: newSnippets, folders: folder };
        }
      }
      return { ...prev, snippets: newSnippets };
    });
  }, []);

  const updateSnippet = useCallback((id: string, updates: any) => {
    setState(prev => {
      const snippet = prev.snippets.get(id);
      if (!snippet) return prev;
      
      const newSnippets = new Map(prev.snippets);
      newSnippets.set(id, {
        ...snippet,
        ...updates,
        updatedAt: Date.now(),
      });
      return { ...prev, snippets: newSnippets };
    });
  }, []);

  const deleteSnippet = useCallback((id: string) => {
    setState(prev => {
      const snippet = prev.snippets.get(id);
      if (!snippet) return prev;
      
      const newSnippets = new Map(prev.snippets);
      newSnippets.delete(id);
      
      if (snippet.folderId) {
        const folder = new Map(prev.folders);
        const folderData = folder.get(snippet.folderId!);
        if (folderData) {
          folder.set(snippet.folderId!, {
            ...folderData,
            snippetIds: folderData.snippetIds.filter(id => id !== snippet.id),
          });
          return { ...prev, snippets: newSnippets, folders: folder };
        }
      }
      return { ...prev, snippets: newSnippets };
    });
  }, []);

  const moveSnippet = useCallback((snippetId: string, targetFolderId: string) => {
    setState(prev => {
      const snippet = prev.snippets.get(snippetId);
      if (!snippet) return prev;
      
      const newSnippets = new Map(prev.snippets);
      newSnippets.set(snippetId, {
        ...snippet,
        folderId: targetFolderId,
        updatedAt: Date.now(),
      });
      
      const newFolders = new Map(prev.folders);
      if (snippet.folderId) {
        const oldFolder = newFolders.get(snippet.folderId!);
        if (oldFolder) {
          newFolders.set(snippet.folderId!, {
            ...oldFolder,
            snippetIds: oldFolder.snippetIds.filter(id => id !== snippetId),
          });
        }
        
        const newFolder = newFolders.get(targetFolderId);
        if (newFolder) {
          newFolders.set(targetFolderId, {
            ...newFolder,
            snippetIds: [...newFolder.snippetIds, snippetId],
          });
        }
        
        return { ...prev, snippets: newSnippets, folders: newFolders };
      });
  }, []);

  const createFolder = useCallback((name: string, parentId?: string) => {
    const newFolder = {
      id: `folder-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name,
      parentId,
      children: [],
      snippetIds: [],
      expanded: true,
      createdAt: Date.now(),
    };
    
    setState(prev => {
      const newFolders = new Map(prev.folders);
      newFolders.set(newFolder.id, newFolder);
      
      if (parentId) {
        const parentFolder = newFolders.get(parentId);
        if (parentFolder) {
          newFolders.set(parentId, {
            ...parentFolder,
            children: [...(parentFolder.children || []), newFolder.id],
          });
        }
      } else {
        return {
          ...prev,
          folders: newFolders,
          rootFolderIds: [...prev.rootFolderIds, newFolder.id],
        };
      }
      return { ...prev, folders: newFolders };
    });
  }, []);

  const updateFolder = useCallback((id: string, updates: any) => {
    setState(prev => {
      const folder = prev.folders.get(id);
      if (!folder) return prev;
      
      const newFolders = new Map(prev.folders);
      newFolders.set(id, { ...folder, ...updates });
      return { ...prev, folders: newFolders };
    });
  }, []);

  const deleteFolder = useCallback((id: string) => {
    setState(prev => {
      const folder = prev.folders.get(id);
      if (!folder) return prev;
      
      const newSnippets = new Map(prev.snippets);
      folder.snippetIds.forEach(id => newSnippets.delete(id));
      
      const newFolders = new Map(prev.folders);
      const deleteRecursive = (folderId: string) => {
        const folder = newFolders.get(folderId);
        if (folder) {
          folder.children?.forEach(childId => deleteRecursive(childId));
          newFolders.delete(folderId);
        }
      };
      folder.children?.forEach(childId => deleteRecursive(childId));
      newFolders.delete(id);
      
      if (folder.parentId) {
        const parent = newFolders.get(folder.parentId);
        if (parent) {
          newFolders.set(folder.parentId, {
            ...parent,
            children: parent.children?.filter(id => id !== folder.id) || [],
          });
        } else {
          return {
            ...prev,
            snippets: newSnippets,
            folders: newFolders,
            rootFolderIds: prev.rootFolderIds.filter(id => id !== id),
          };
        }
        
        return { ...prev, snippets: newSnippets, folders: newFolders };
      });
  }, []);

  const toggleFolder = useCallback((id: string) => {
    setState(prev => {
      const folder = prev.folders.get(id);
      if (!folder) return prev;
      
      const newFolders = new Map(prev.folders);
      newFolders.set(id, { ...folder, expanded: !folder.expanded });
      return { ...prev, folders: newFolders };
    });
  }, []);

  const selectFolder = useCallback((id: string | undefined) => {
    setState(prev => ({ ...prev, selectedFolderId: id }));
  }, []);

  const searchSnippets = useCallback((query: string) => {
    setState(prev => ({ ...prev, searchQuery: query }));
  }, []);

  const startEditingSnippet = useCallback((id: string) => {
    setState(prev => ({ ...prev, editingSnippetId: id }));
  }, []);

  const stopEditingSnippet = useCallback(() => {
    setState(prev => ({ ...prev, editingSnippetId: undefined }));
  }, []);

  const insertSnippet = useCallback((snippetId: string) => {
    const snippet = state.snippets.get(snippetId);
    if (!snippet) return;
    
    setState(prev => {
      const snippet = prev.snippets.get(snippetId);
      if (!snippet) return prev;
      const newSnippets = new Map(prev.snippets);
      newSnippets.set(snippetId, {
        ...snippet,
        usageCount: snippet.usageCount + 1,
        updatedAt: Date.now(),
      });
      return { ...prev, snippets: newSnippets };
    });
  }, [state.snippets]);

  const exportSnippets = useCallback(() => {
    const data = {
      snippets: Array.from(state.snippets.values()),
      folders: Array.from(state.folders.values()),
      rootFolderIds: state.rootFolderIds,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `snippets-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [state.snippets, state.folders, state.rootFolderIds]);

  const importSnippets = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        setState(prev => {
          const newSnippets = new Map(prev.snippets);
          data.snippets?.forEach(snippet => {
            newSnippets.set(snippet.id, snippet);
          });
          const newFolders = new Map(prev.folders);
          data.folders?.forEach(folder => {
            newFolders.set(folder.id, folder);
          }
          return {
            ...prev,
            snippets: newSnippets,
            folders: newFolders,
            rootFolderIds: data.rootFolderIds || prev.rootFolderIds,
          };
        });
      } catch (e) {
        console.error('Failed to import snippets:', e);
      }
    };
    reader.readAsText(file);
  }, []);

  return {
    snippets: state.snippets,
    folders: state.folders,
    rootFolderIds: state.rootFolderIds,
    searchQuery: state.searchQuery,
    selectedFolderId: state.selectedFolderId,
    editingSnippetId: state.editingSnippetId,
    editingFolderId: state.editingFolderId,
    filteredSnippets,
    folderTree,
    createSnippet,
    updateSnippet,
    deleteSnippet,
    moveSnippet,
    createFolder,
    updateFolder,
    deleteFolder,
    toggleFolder,
    selectFolder,
    searchSnippets,
    startEditingSnippet,
    stopEditingSnippet,
    insertSnippet,
    exportSnippets,
    importSnippets,
  };
}

export function useSnippetLibrary() {
  const [state, setState] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('snippet-library');
        if (saved) {
          const parsed = JSON.parse(saved);
          return {
            snippets: new Map(Object.entries(parsed.snippets || {})),
            folders: new Map(Object.entries(parsed.folders || {})),
            rootFolderIds: parsed.rootFolderIds || ['general', 'algorithms', 'patterns', 'utils'],
            searchQuery: '',
            selectedFolderId: undefined,
            editingSnippetId: undefined,
            editingFolderId: undefined,
          };
        }
      } catch (e) {
        console.warn('Failed to load snippet library:', e);
      }
    }
    return {
      snippets: new Map(),
      folders: new Map(),
      rootFolderIds: ['general', 'algorithms', 'patterns', 'utils'],
      searchQuery: '',
      selectedFolderId: undefined,
      editingSnippetId: undefined,
      editingFolderId: undefined,
    };
  });

  const persistState = useCallback((newState: any) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('snippet-library', JSON.stringify({
          snippets: Object.fromEntries(newState.snippets),
          folders: Object.fromEntries(newState.folders),
          rootFolderIds: newState.rootFolderIds,
        }));
      } catch (e) {
        console.warn('Failed to persist snippet library:', e);
      }
    }
  }, []);

  useEffect(() => {
    const existingSnippets = Array.from(state.snippets.keys());
    if (existingSnippets.length === 0) {
      // 初始化内置片段和文件夹
      const newFolders = new Map();
      const defaultFolders = [
        { id: 'general', name: '通用', children: [], snippetIds: [], expanded: true, createdAt: Date.now() },
        { id: 'algorithms', name: '算法', children: [], snippetIds: [], expanded: true, createdAt: Date.now() },
        { id: 'patterns', name: '设计模式', children: [], snippetIds: [], expanded: true, createdAt: Date.now() },
        { id: 'utils', name: '实用工具', children: [], snippetIds: [], expanded: true, createdAt: Date.now() },
      ];
      defaultFolders.forEach(f => newFolders.set(f.id, { ...f, children: [] }));
      
      setState(prev => ({
        ...prev,
        folders: newFolders,
      }));
    }
  }, []);

  useEffect(() => {
    persistState(state);
  }, [state, () => persistState(state)]);

  const filteredSnippets = useMemo(() => {
    let snippets = Array.from(state.snippets.values());
    
    if (state.searchQuery) {
      const query = state.searchQuery.toLowerCase();
      snippets = snippets.filter(s => 
        s.title.toLowerCase().includes(query) ||
        s.description.toLowerCase().includes(query) ||
        s.code.toLowerCase().includes(query) ||
        s.tags.some(t => t.toLowerCase().includes(query)) ||
        s.language.toLowerCase().includes(query)
      );
    }
    
    if (state.selectedFolderId) {
      const folder = state.folders.get(state.selectedFolderId);
      if (folder) {
        snippets = snippets.filter(s => folder.snippetIds.includes(s.id));
      }
    }
    
    return snippets.sort((a, b) => b.usageCount - a.usageCount || b.updatedAt - a.updatedAt);
  }, [state.snippets, state.folders, state.searchQuery, state.selectedFolderId]);

  const folderTree = useMemo(() => {
    const buildTree = (folderId: string) => {
      const folder = state.folders.get(folderId);
      if (!folder) return null;
      return {
        ...folder,
        children: folder.children?.map(c => buildTree(c.id)) || [],
      };
    };
    return state.rootFolderIds.map(id => buildTree(id)).filter(Boolean);
  }, [state.folders]);

  const createSnippet = useCallback((snippet: any) => {
    const newSnippet = {
      ...snippet,
      id: `snippet-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      usageCount: 0,
    };
    setState(prev => {
      const newSnippets = new Map(prev.snippets);
      newSnippets.set(newSnippet.id, newSnippet);
      
      if (snippet.folderId) {
        const folder = new Map(prev.folders);
        const folderData = folder.get(snippet.folderId!);
        if (folderData) {
          folder.set(snippet.folderId!, {
            ...folderData,
            snippetIds: [...folderData.snippetIds, newSnippet.id],
          });
          return { ...prev, snippets: newSnippets, folders: folder };
        }
      }
      return { ...prev, snippets: newSnippets };
    });
  }, []);

  const updateSnippet = useCallback((id: string, updates: any) => {
    setState(prev => {
      const snippet = prev.snippets.get(id);
      if (!snippet) return prev;
      
      const newSnippets = new Map(prev.snippets);
      newSnippets.set(id, {
        ...snippet,
        ...updates,
        updatedAt: Date.now(),
      });
      return { ...prev, snippets: newSnippets };
    });
  }, []);

  const deleteSnippet = useCallback((id: string) => {
    setState(prev => {
      const snippet = prev.snippets.get(id);
      if (!snippet) return prev;
      
      const newSnippets = new Map(prev.snippets);
      newSnippets.delete(id);
      
      if (snippet.folderId) {
        const folder = new Map(prev.folders);
        const folderData = folder.get(snippet.folderId!);
        if (folderData) {
          folder.set(snippet.folderId!, {
            ...folderData,
            snippetIds: folderData.snippetIds.filter(id => id !== snippet.id),
          });
          return { ...prev, snippets: newSnippets, folders: folder };
        }
      }
      return { ...prev, snippets: newSnippets };
    });
  }, []);

  const moveSnippet = useCallback((snippetId: string, targetFolderId: string) => {
    setState(prev => {
      const snippet = prev.snippets.get(snippetId);
      if (!snippet) return prev;
      
      const newSnippets = new Map(prev.snippets);
      newSnippets.set(snippetId, {
        ...snippet,
        folderId: targetFolderId,
        updatedAt: Date.now(),
      });
      
      const newFolders = new Map(prev.folders);
      if (snippet.folderId) {
        const oldFolder = newFolders.get(snippet.folderId!);
        if (oldFolder) {
          newFolders.set(snippet.folderId!, {
            ...oldFolder,
            snippetIds: oldFolder.snippetIds.filter(id => id !== snippetId),
          });
        }
        
        const newFolder = newFolders.get(targetFolderId);
        if (newFolder) {
          newFolders.set(targetFolderId, {
            ...newFolder,
            snippetIds: [...newFolder.snippetIds, snippetId],
          });
        }
        
        return { ...prev, snippets: newSnippets, folders: newFolders };
      });
  }, []);

  const createFolder = useCallback((name: string, parentId?: string) => {
    const newFolder = {
      id: `folder-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name,
      parentId,
      children: [],
      snippetIds: [],
      expanded: true,
      createdAt: Date.now(),
    };
    
    setState(prev => {
      const newFolders = new Map(prev.folders);
      newFolders.set(newFolder.id, newFolder);
      
      if (parentId) {
        const parentFolder = newFolders.get(parentId);
        if (parentFolder) {
          newFolders.set(parentId, {
            ...parentFolder,
            children: [...(parentFolder.children || []), newFolder.id],
          });
        }
      } else {
        return {
          ...prev,
          folders: newFolders,
          rootFolderIds: [...prev.rootFolderIds, newFolder.id],
        };
      }
      return { ...prev, folders: newFolders };
    });
  }, []);

  const updateFolder = useCallback((id: string, updates: any) => {
    setState(prev => {
      const folder = prev.folders.get(id);
      if (!folder) return prev;
      
      const newFolders = new Map(prev.folders);
      newFolders.set(id, { ...folder, ...updates });
      return { ...prev, folders: newFolders };
    });
  }, []);

  const deleteFolder = useCallback((id: string) => {
    setState(prev => {
      const folder = prev.folders.get(id);
      if (!folder) return prev;
      
      const newSnippets = new Map(prev.snippets);
      folder.snippetIds.forEach(id => newSnippets.delete(id));
      
      const newFolders = new Map(prev.folders);
      const deleteRecursive = (folderId: string) => {
        const folder = newFolders.get(folderId);
        if (folder) {
          folder.children?.forEach(childId => deleteRecursive(childId));
          newFolders.delete(folderId);
        }
      };
      folder.children?.forEach(childId => deleteRecursive(childId));
      newFolders.delete(id);
      
      if (folder.parentId) {
        const parent = newFolders.get(folder.parentId);
        if (parent) {
          newFolders.set(folder.parentId, {
            ...parent,
            children: parent.children?.filter(id => id !== folder.id) || [],
          });
        } else {
          return {
            ...prev,
            snippets: newSnippets,
            folders: newFolders,
            rootFolderIds: prev.rootFolderIds.filter(id => id !== id),
          };
        }
        
        return { ...prev, snippets: newSnippets, folders: newFolders };
      });
  }, []);

  const toggleFolder = useCallback((id: string) => {
    setState(prev => {
      const folder = prev.folders.get(id);
      if (!folder) return prev;
      
      const newFolders = new Map(prev.folders);
      newFolders.set(id, { ...folder, expanded: !folder.expanded });
      return { ...prev, folders: newFolders };
    });
  }, []);

  const selectFolder = useCallback((id: string | undefined) => {
    setState(prev => ({ ...prev, selectedFolderId: id }));
  }, []);

  const searchSnippets = useCallback((query: string) => {
    setState(prev => ({ ...prev, searchQuery: query }));
  }, []);

  const startEditingSnippet = useCallback((id: string) => {
    setState(prev => ({ ...prev, editingSnippetId: id }));
  }, []);

  const stopEditingSnippet = useCallback(() => {
    setState(prev => ({ ...prev, editingSnippetId: undefined }));
  }, []);

  const insertSnippet = useCallback((snippetId: string) => {
    const snippet = state.snippets.get(snippetId);
    if (!snippet) return;
    
    setState(prev => {
      const snippet = prev.snippets.get(snippetId);
      if (!snippet) return prev;
      const newSnippets = new Map(prev.snippets);
      newSnippets.set(snippetId, {
        ...snippet,
        usageCount: snippet.usageCount + 1,
        updatedAt: Date.now(),
      });
      return { ...prev, snippets: newSnippets };
    });
  }, [state.snippets]);

  const exportSnippets = useCallback(() => {
    const data = {
      snippets: Array.from(state.snippets.values()),
      folders: Array.from(state.folders.values()),
      rootFolderIds: state.rootFolderIds,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `snippets-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [state.snippets, state.folders, state.rootFolderIds]);

  const importSnippets = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        setState(prev => {
          const newSnippets = new Map(prev.snippets);
          data.snippets?.forEach(snippet => {
            newSnippets.set(snippet.id, snippet);
          });
          const newFolders = new Map(prev.folders);
          data.folders?.forEach(folder => {
            newFolders.set(folder.id, folder);
          }
          return {
            ...prev,
            snippets: newSnippets,
            folders: newFolders,
            rootFolderIds: data.rootFolderIds || prev.rootFolderIds,
          };
        });
      } catch (e) {
        console.error('Failed to import snippets:', e);
      }
    };
    reader.readAsText(file);
  }, []);

  return {
    snippets: state.snippets,
    folders: state.folders,
    rootFolderIds: state.rootFolderIds,
    searchQuery: state.searchQuery,
    selectedFolderId: state.selectedFolderId,
    editingSnippetId: state.editingSnippetId,
    editingFolderId: state.editingFolderId,
    filteredSnippets,
    folderTree,
    createSnippet,
    updateSnippet,
    deleteSnippet,
    moveSnippet,
    createFolder,
    updateFolder,
    deleteFolder,
    toggleFolder,
    selectFolder,
    searchSnippets,
    startEditingSnippet,
    stopEditingSnippet,
    insertSnippet,
    exportSnippets,
    importSnippets,
  };
}