import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  SearchIcon,
  PlusIcon,
  Trash2Icon,
  Edit2Icon,
  CopyIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  FolderIcon,
  FileCodeIcon,
  TagIcon,
} from '../../utils/icons';
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
  children?: Array<string | SnippetFolder>;
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

export const DEFAULT_FOLDERS: SnippetFolder[] = [
  {
    id: 'general',
    name: '通用',
    children: [],
    snippetIds: [],
    expanded: true,
    createdAt: Date.now(),
  },
  {
    id: 'algorithms',
    name: '算法',
    children: [],
    snippetIds: [],
    expanded: true,
    createdAt: Date.now(),
  },
  {
    id: 'patterns',
    name: '设计模式',
    children: [],
    snippetIds: [],
    expanded: true,
    createdAt: Date.now(),
  },
  {
    id: 'utils',
    name: '实用工具',
    children: [],
    snippetIds: [],
    expanded: true,
    createdAt: Date.now(),
  },
];

const BUILTIN_SNIPPETS: CodeSnippet[] = [
  {
    id: 'py-main',
    title: 'Python 主函数模板',
    description: '标准的 Python 主函数入口',
    language: 'python',
    code: `def main():\n    pass\n\nif __name__ == "__main__":\n    main()`,
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
    code: `from dataclasses import dataclass\nfrom typing import Optional\n\n@dataclass\nclass \${1:ClassName}:\n    \${2:field}: \${3:type} = \${4:default}\n\n    def \${5:method}(self\${6:, \${7:param}: \${8:type}}) -> \${9:return_type}:\n        \${10:pass}`,
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
    code: `async function fetchWithErrorHandling(url, options = {}) {\n  try {\n    const response = await fetch(url, {\n      headers: {\n        'Content-Type': 'application/json',\n        ...options.headers\n      },\n      ...options\n    });\n    \n    if (!response.ok) {\n      throw new Error(\`HTTP error! status: \${response.status}\`);\n    }\n    \n    return await response.json();\n  } catch (error) {\n    console.error('Fetch error:', error);\n    throw error;\n  }\n}`,
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
    code: `import { useState, useEffect, useCallback } from 'react';\n\ninterface \${1:HookName}Options {\n  \${2:option}: \${3:type};\n}\n\ninterface \${1:HookName}Return {\n  \${4:value}: \${5:type};\n  \${6:loading}: boolean;\n  \${7:error}: Error | null;\n}\n\nexport function use\${1:HookName}(options: \${1:HookName}Options = {}): \${1:HookName}Return {\n  const [\${4:value}, set\${4:Value}] = useState<\${5:type}>(\${7:initialValue});\n  const [\${6:loading}, set\${6:Loading}] = useState(false);\n  const [\${7:error}, set\${7:Error}] = useState<Error | null>(null);\n\n  const \${8:refresh} = useCallback(async () => {\n    set\${6:Loading}(true);\n    set\${7:Error}(null);\n    try {\n      \${9:// 业务逻辑}\n    } catch (err) {\n      set\${7:Error}(err as Error);\n    } finally {\n      set\${6:Loading}(false);\n    }\n  }, [\${10:dependencies}]);\n\n  useEffect(() => {\n    \${8:refresh}();\n  }, [\${8:refresh}]);\n\n  return {\n    \${4:value},\n    \${6:loading},\n    \${7:error},\n    \${8:refresh},\n  };\n}`,
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
    code: `fn main() {\n    println!("Hello, world!");\n}`,
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
    code: `package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, World!")\n}`,
    tags: ['template', 'main', 'entry'],
    folderId: 'general',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    usageCount: 0,
  },
  {
    id: 'java-main',
    title: 'Java 主类模板',
    description: '标准的 Java 程序入口',
    language: 'java',
    code: `public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}`,
    tags: ['template', 'main', 'entry'],
    folderId: 'general',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    usageCount: 0,
  },
  {
    id: 'cpp-main',
    title: 'C++ 主函数模板',
    description: '标准的 C++ 程序入口',
    language: 'cpp',
    code: '#include <iostream>\n\nint main() {\n    std::cout << "Hello, World!" << std::endl;\n    return 0;\n}',
    tags: ['template', 'main', 'entry'],
    folderId: 'general',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    usageCount: 0,
  },
];

export function useSnippetLibrary() {
  const [state, setState] = useState<SnippetLibraryState>(() => {
    // 从 localStorage 恢复
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

  // 持久化到 localStorage
  const persistState = useCallback((newState: SnippetLibraryState) => {
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

  // 初始化内置片段
  useEffect(() => {
    const existingSnippets = Array.from(state.snippets.keys());
    if (existingSnippets.length === 0) {
      const newSnippets = new Map(state.snippets);
      BUILTIN_SNIPPETS.forEach(snippet => {
        if (!newSnippets.has(snippet.id)) {
          newSnippets.set(snippet.id, snippet);
        }
      });
      const newState = { ...state, snippets: newSnippets };
      setState(newState);
      persistState(newState);
    }
  }, []);

  // 持久化状态变化
  useEffect(() => {
    persistState(state);
  }, [state, persistState]);

  // 计算属性
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

  // 获取文件夹树
  const folderTree = useMemo(() => {
    const buildTree = (folderId: string): any => {
      const folder = state.folders.get(folderId);
      if (!folder) return null;
      return {
        ...folder,
        children: folder.children?.map(c => buildTree(c.id)) || [],
      };
    };
    return state.rootFolderIds.map(id => buildTree(id)).filter(Boolean);
  }, [state.folders]);

  // 操作方法
  const createSnippet = useCallback((snippet: Omit<CodeSnippet, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>) => {
    const newSnippet: CodeSnippet = {
      ...snippet,
      id: `snippet-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      usageCount: 0,
    };
    setState(prev => {
      const newSnippets = new Map(prev.snippets);
      newSnippets.set(newSnippet.id, newSnippet);
      
      // 添加到文件夹
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

  const updateSnippet = useCallback((id: string, updates: Partial<CodeSnippet>) => {
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
      
      // 从文件夹中移除
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
      
      // 从旧文件夹移除
      const newFolders = new Map(prev.folders);
      if (snippet.folderId) {
        const oldFolder = newFolders.get(snippet.folderId!);
        if (oldFolder) {
          newFolders.set(snippet.folderId!, {
            ...oldFolder,
            snippetIds: oldFolder.snippetIds.filter(id => id !== snippetId),
          });
        }
        
        // 添加到新文件夹
        const newFolder = newFolders.get(targetFolderId);
        if (newFolder) {
          newFolders.set(targetFolderId, {
            ...newFolder,
            snippetIds: [...newFolder.snippetIds, snippetId],
          });
        }

        return { ...prev, snippets: newSnippets, folders: newFolders };
      }

      return { ...prev, snippets: newSnippets };
    });
  }, []);

  const createFolder = useCallback((name: string, parentId?: string) => {
    const newFolder: SnippetFolder = {
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

  const updateFolder = useCallback((id: string, updates: Partial<SnippetFolder>) => {
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
      
      // 删除文件夹内的所有片段
      const newSnippets = new Map(prev.snippets);
      folder.snippetIds.forEach(id => newSnippets.delete(id));

      // 递归删除子文件夹
      const newFolders = new Map(prev.folders);
      const deleteRecursive = (child: string | SnippetFolder) => {
        const childId = typeof child === 'string' ? child : child.id;
        const childFolder = newFolders.get(childId);
        if (childFolder) {
          childFolder.children?.forEach(c => deleteRecursive(c as string | SnippetFolder));
          newFolders.delete(childId);
        }
      };
      folder.children?.forEach(c => deleteRecursive(c as string | SnippetFolder));
      newFolders.delete(id);

      // 从父文件夹移除
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
    
    // 增加使用计数
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
    
    // 这里应该触发编辑器插入代码的动作
    // 实际实现中会通过 EditorStore 插入代码
    console.log('Insert snippet:', snippet.code);
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
          });
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
    // 状态
    snippets: state.snippets,
    folders: state.folders,
    rootFolderIds: state.rootFolderIds,
    searchQuery: state.searchQuery,
    selectedFolderId: state.selectedFolderId,
    editingSnippetId: state.editingSnippetId,
    editingFolderId: state.editingFolderId,
    
    // 计算属性
    filteredSnippets,
    folderTree,
    
    // 操作方法
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

// 代码片段侧边栏组件

interface SnippetSidebarProps {
  onInsertSnippet?: (snippet: CodeSnippet) => void;
  className?: string;
}

export function SnippetSidebar({ 
  onInsertSnippet,
  className = '',
}: SnippetSidebarProps) {
  const {
    filteredSnippets,
    folderTree,
    searchQuery,
    selectedFolderId,
    editingSnippetId,
    folders,
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
  } = useSnippetLibrary();
  
  const [newSnippet, setNewSnippet] = useState({
    title: '',
    description: '',
    language: 'python',
    code: '',
    tags: '',
    folderId: '',
  });
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSnippet, setEditingSnippet] = useState<CodeSnippet | null>(null);
  
  const handleCreateSnippet = () => {
    createSnippet({
      ...newSnippet,
      tags: newSnippet.tags.split(',').map(t => t.trim()).filter(Boolean),
    });
    setNewSnippet({ title: '', description: '', language: 'python', code: '', tags: '', folderId: '' });
    setShowCreateModal(false);
  };
  
  const handleUpdateSnippet = () => {
    if (editingSnippet) {
      updateSnippet(editingSnippet.id, {
        title: editingSnippet.title,
        description: editingSnippet.description,
        language: editingSnippet.language,
        code: editingSnippet.code,
        tags: editingSnippet.tags,
        folderId: editingSnippet.folderId,
      });
      setEditingSnippet(null);
      stopEditingSnippet();
    }
  };

  const handleDeleteSnippet = (id: string) => {
    if (window.confirm('确定要删除这个代码片段吗？')) {
      deleteSnippet(id);
    }
  };

  const handleMoveSnippet = (snippetId: string, targetFolderId: string) => {
    moveSnippet(snippetId, targetFolderId);
  };

  const getFolderName = (folderId: string) => {
    const folder = folders.get(folderId);
    return folder?.name || folderId;
  };

  const renderFolderTree = (treeNodes: any[]) => (
    <div className="ml-4">
      {treeNodes.map(folder => {
        const ChevronToggle = folder.expanded ? ChevronDownIcon : ChevronRightIcon;
        return (
          <div key={folder.id} className="py-1">
            <div
              className={clsx(
                'flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer transition-colors',
                selectedFolderId === folder.id && 'bg-primary/10 text-primary'
              )}
              onClick={() => selectFolder(folder.id)}
            >
              <ChevronToggle
                className={clsx('w-4 h-4 text-muted-foreground transition-transform',
                  folder.expanded && 'rotate-0')}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFolder(folder.id);
                }}
              />
              <FolderIcon className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium truncate flex-1">{folder.name}</span>
              <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                {folders.get(folder.id)?.snippetIds.length || 0}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const newName = window.prompt('重命名文件夹', folder.name);
                  if (newName && newName.trim()) updateFolder(folder.id, { name: newName.trim() });
                }}
                className="p-1 hover:bg-accent rounded"
                title="重命名文件夹"
              >
                <Edit2Icon className="w-3 h-3" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm(`确定删除文件夹「${folder.name}」及其内部片段吗？`)) {
                    deleteFolder(folder.id);
                  }
                }}
                className="p-1 hover:bg-red-500/10 text-red-500 rounded"
                title="删除文件夹"
              >
                <Trash2Icon className="w-3 h-3" />
              </button>
            </div>
            {folder.expanded && (folder.children?.length ?? 0) > 0 && (
              <div>{renderFolderTree(folder.children || [])}</div>
            )}
          </div>
        );
      })}
    </div>
  );

  const renderSnippetItem = (snippet: any) => (
    <div
      key={snippet.id}
      className={clsx(
        'p-3 bg-card border border-border rounded-lg hover:border-primary/50 hover:bg-accent/50 transition-colors group',
        editingSnippetId === snippet.id && 'ring-2 ring-primary'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <FileCodeIcon className="w-4 h-4 text-primary flex-shrink-0" />
            <h4 className="font-medium text-sm truncate">{snippet.title}</h4>
            <span className="px-1.5 py-0.5 text-xs bg-muted rounded text-muted-foreground">
              {snippet.language}
            </span>
            {snippet.folderId && (
              <span className="px-1.5 py-0.5 text-xs bg-muted rounded text-muted-foreground truncate">
                {getFolderName(snippet.folderId)}
              </span>
            )}
          </div>
          {snippet.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{snippet.description}</p>
          )}
          {snippet.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              <TagIcon className="w-3 h-3 text-muted-foreground mt-0.5" />
              {snippet.tags.slice(0, 3).map((tag: string) => (
                <span key={tag} className="px-1.5 py-0.5 text-xs bg-muted rounded text-muted-foreground">
                  {tag}
                </span>
              ))}
              {snippet.tags.length > 3 && (
                <span className="text-xs text-muted-foreground">+{snippet.tags.length - 3}</span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 flex-wrap">
          <button
            onClick={() => {
              insertSnippet(snippet.id);
              onInsertSnippet?.(snippet);
            }}
            className="p-1.5 hover:bg-accent rounded transition-colors"
            title="插入代码"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4" />
            </svg>
          </button>
          <button
            onClick={() => navigator.clipboard.writeText(snippet.code || '')}
            className="p-1.5 hover:bg-accent rounded transition-colors"
            title="复制代码"
          >
            <CopyIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setEditingSnippet(snippet);
              startEditingSnippet(snippet.id);
            }}
            className="p-1.5 hover:bg-accent rounded transition-colors"
            title="编辑"
          >
            <Edit2Icon className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDeleteSnippet(snippet.id)}
            className="p-1.5 hover:bg-red-500/10 text-red-500 rounded transition-colors"
            title="删除"
          >
            <Trash2Icon className="w-4 h-4" />
          </button>
          <select
            value={snippet.folderId || ''}
            onChange={(e) => handleMoveSnippet(snippet.id, e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="text-xs bg-muted rounded px-1 py-0.5 text-muted-foreground"
            title="移动到文件夹"
          >
            <option value="">移动到…</option>
            {Array.from(folders.values()).map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>
      </div>

      {snippet.code && (
        <details className="mt-2 group">
          <summary className="text-xs text-muted-foreground cursor-pointer flex items-center gap-1">
            <ChevronRightIcon className="w-4 h-4 group-open:rotate-90 transition-transform" />
            <span>查看代码 ({snippet.code.split('\n').length} 行)</span>
          </summary>
          <pre className="mt-2 p-3 bg-muted/50 rounded text-xs overflow-x-auto font-mono text-sm">
            <code>{snippet.code}</code>
          </pre>
        </details>
      )}
    </div>
  );

  return (
    <aside className={clsx('w-80 border-r border-border bg-card flex flex-col', className)}>
      {/* 搜索与新建 */}
      <div className="p-2 border-b border-border flex items-center gap-2">
        <div className="flex-1 flex items-center gap-1.5 px-2 py-1 bg-muted/50 rounded-lg">
          <SearchIcon className="w-4 h-4 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={(e) => searchSnippets(e.target.value)}
            placeholder="搜索代码片段…"
            className="flex-1 min-w-0 bg-transparent outline-none text-sm"
          />
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="p-1.5 hover:bg-accent rounded"
          title="新建代码片段"
        >
          <PlusIcon className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            const name = window.prompt('新建文件夹名称');
            if (name && name.trim()) createFolder(name.trim());
          }}
          className="p-1.5 hover:bg-accent rounded"
          title="新建文件夹"
        >
          <FolderIcon className="w-4 h-4" />
        </button>
      </div>

      {/* 文件夹树 */}
      <div className="px-2 pt-2 pb-2 border-b border-border">
        <div
          className={clsx(
            'flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors',
            !selectedFolderId ? 'bg-primary/10 text-primary' : 'hover:bg-accent'
          )}
          onClick={() => selectFolder(undefined)}
        >
          <TagIcon className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">全部片段</span>
          <span className="text-xs text-muted-foreground ml-auto">{filteredSnippets.length}</span>
        </div>
        {renderFolderTree(folderTree)}
      </div>

      {/* 片段列表 */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {filteredSnippets.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-8">
            暂无代码片段，点击右上角 + 新建
          </div>
        ) : (
          filteredSnippets.map(snippet => renderSnippetItem(snippet))
        )}
      </div>

      {/* 新建片段弹窗 */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="bg-card border border-border rounded-xl w-[420px] max-h-[80vh] overflow-y-auto p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-medium">新建代码片段</h3>
            <input
              placeholder="标题"
              value={newSnippet.title}
              onChange={(e) => setNewSnippet({ ...newSnippet, title: e.target.value })}
              className="w-full px-2 py-1.5 text-sm border border-border rounded bg-background"
            />
            <input
              placeholder="描述"
              value={newSnippet.description}
              onChange={(e) => setNewSnippet({ ...newSnippet, description: e.target.value })}
              className="w-full px-2 py-1.5 text-sm border border-border rounded bg-background"
            />
            <input
              placeholder="语言（如 python、typescript）"
              value={newSnippet.language}
              onChange={(e) => setNewSnippet({ ...newSnippet, language: e.target.value })}
              className="w-full px-2 py-1.5 text-sm border border-border rounded bg-background"
            />
            <textarea
              placeholder="代码"
              value={newSnippet.code}
              onChange={(e) => setNewSnippet({ ...newSnippet, code: e.target.value })}
              rows={6}
              className="w-full px-2 py-1.5 text-sm border border-border rounded bg-background font-mono"
            />
            <input
              placeholder="标签（逗号分隔）"
              value={newSnippet.tags}
              onChange={(e) => setNewSnippet({ ...newSnippet, tags: e.target.value })}
              className="w-full px-2 py-1.5 text-sm border border-border rounded bg-background"
            />
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-accent"
              >
                取消
              </button>
              <button
                onClick={handleCreateSnippet}
                className="px-3 py-1.5 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑片段弹窗 */}
      {editingSnippet && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => {
            setEditingSnippet(null);
            stopEditingSnippet();
          }}
        >
          <div
            className="bg-card border border-border rounded-xl w-[420px] max-h-[80vh] overflow-y-auto p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-medium">编辑代码片段</h3>
            <input
              placeholder="标题"
              value={editingSnippet.title}
              onChange={(e) => setEditingSnippet({ ...editingSnippet, title: e.target.value })}
              className="w-full px-2 py-1.5 text-sm border border-border rounded bg-background"
            />
            <input
              placeholder="描述"
              value={editingSnippet.description}
              onChange={(e) => setEditingSnippet({ ...editingSnippet, description: e.target.value })}
              className="w-full px-2 py-1.5 text-sm border border-border rounded bg-background"
            />
            <input
              placeholder="语言"
              value={editingSnippet.language}
              onChange={(e) => setEditingSnippet({ ...editingSnippet, language: e.target.value })}
              className="w-full px-2 py-1.5 text-sm border border-border rounded bg-background"
            />
            <textarea
              placeholder="代码"
              value={editingSnippet.code}
              onChange={(e) => setEditingSnippet({ ...editingSnippet, code: e.target.value })}
              rows={6}
              className="w-full px-2 py-1.5 text-sm border border-border rounded bg-background font-mono"
            />
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => {
                  setEditingSnippet(null);
                  stopEditingSnippet();
                }}
                className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-accent"
              >
                取消
              </button>
              <button
                onClick={handleUpdateSnippet}
                className="px-3 py-1.5 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

export default SnippetSidebar;