import { useState, useCallback, useEffect } from 'react';
import {
  ChevronRightIcon,
  FileIcon,
  FolderIcon,
  PlusIcon,
  XMarkIcon,
} from '../../utils/icons';
import clsx from 'clsx';

interface MobileFileTreeProps {
  projectId: string;
  onFileSelect: (file: any) => void;
  onFileCreate: (parentId?: string) => void;
  onFolderCreate: (parentId?: string) => void;
  onFileDelete: (fileId: string) => void;
  onFileRename: (fileId: string, newName: string) => void;
  onFileMove: (fileId: string, newParentId?: string) => void;
}

export interface FileTreeItem {
  id: string;
  name: string;
  isDirectory: boolean;
  path: string;
  parentId?: string;
  children?: FileTreeItem[];
  mimeType?: string;
  size?: number;
}

export function MobileFileTree({
  projectId,
  onFileSelect,
  onFileCreate,
  onFolderCreate,
  onFileDelete,
  onFileRename,
}: MobileFileTreeProps) {
  const [files, setFiles] = useState<any[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [showContextMenu, setShowContextMenu] = useState<{ x: number; y: number; file: any } | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

  // 模拟文件树数据 - 实际应该从 API 获取
  useEffect(() => {
    // 这里应该调用 API 获取项目文件
    // 模拟数据
    const mockFiles = [
      { id: '1', name: 'src', isDirectory: true, path: 'src', parentId: undefined, children: [
        { id: '2', name: 'main.py', isDirectory: false, path: 'src/main.py', parentId: '1', mimeType: 'text/x-python' },
        { id: '3', name: 'utils.py', isDirectory: false, path: 'src/utils.py', parentId: '1', mimeType: 'text/x-python' },
        { id: '4', name: 'components', isDirectory: true, path: 'src/components', parentId: '1', children: [
          { id: '5', name: 'Button.tsx', isDirectory: false, path: 'src/components/Button.tsx', parentId: '4', mimeType: 'text/typescript' },
        ]},
      ]},
      { id: '6', name: 'tests', isDirectory: true, path: 'tests', parentId: undefined, children: [
        { id: '7', name: 'test_main.py', isDirectory: false, path: 'tests/test_main.py', parentId: '6', mimeType: 'text/x-python' },
      ]},
      { id: '8', name: 'README.md', isDirectory: false, path: 'README.md', parentId: undefined, mimeType: 'text/markdown' },
      { id: '9', name: 'package.json', isDirectory: false, path: 'package.json', parentId: undefined, mimeType: 'application/json' },
      { id: '10', name: 'requirements.txt', isDirectory: false, path: 'requirements.txt', parentId: undefined, mimeType: 'text/plain' },
    ];
    setFiles(mockFiles);
  }, [projectId]);

  const toggleFolder = useCallback((folderId: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  }, []);

  const handleFileSelect = useCallback((file: any) => {
    if (!file.isDirectory) {
      setSelectedFileId(file.id);
      onFileSelect(file);
    }
  }, [onFileSelect]);

  const handleRenameStart = useCallback((file: any) => {
    setRenamingId(file.id);
    setRenameValue(file.name);
  }, []);

  const handleRenameConfirm = useCallback(() => {
    if (renamingId && renameValue.trim() && renameValue !== files.find(f => f.id === renamingId)?.name) {
      onFileRename(renamingId, renameValue.trim());
    }
    setRenamingId(null);
  }, [renamingId, renameValue, onFileRename]);

  const handleRenameCancel = useCallback(() => {
    setRenamingId(null);
  }, []);

  const handleDelete = useCallback((fileId: string) => {
    if (window.confirm('确定要删除这个文件/文件夹吗？')) {
      onFileDelete(fileId);
    }
  }, [onFileDelete]);

  const handleCreateFile = useCallback((parentId?: string) => {
    onFileCreate(parentId);
  }, [onFileCreate]);

  const handleCreateFolder = useCallback((parentId?: string) => {
    onFolderCreate(parentId);
  }, [onFolderCreate]);

  const renderFileNode = useCallback((file: any, depth = 0) => {
    const isExpanded = expandedFolders.has(file.id);
    const hasChildren = file.isDirectory && file.children && file.children.length > 0;
    const isSelected = selectedFileId === file.id;
    const isRenaming = renamingId === file.id;

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleRenameConfirm();
      } else if (e.key === 'Escape') {
        handleRenameCancel();
      }
    };

    return (
      <div className={clsx('select-none', depth > 0 && 'ml-6')}>
        <div
          className={clsx(
            'flex items-center gap-1 px-2 py-1.5 rounded hover:bg-accent transition-colors',
            isSelected && 'bg-accent text-accent-foreground'
          )}
          onClick={(e) => {
            e.stopPropagation();
            if (!file.isDirectory) {
              handleFileSelect(file);
            } else {
              toggleFolder(file.id);
            }
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            if (!file.isDirectory) {
              handleFileSelect(file);
            }
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowContextMenu({ x: e.clientX, y: e.clientY, file });
          }}
        >
          {hasChildren && (
            <ChevronRightIcon
              className={clsx('w-4 h-4 text-muted-foreground flex-shrink-0', isExpanded && 'rotate-90')}
              onClick={(e) => {
                e.stopPropagation();
                toggleFolder(file.id);
              }}
            />
          )}
          {!hasChildren && !file.isDirectory && <span className="w-4 h-4 flex-shrink-0" />}
          
          {isRenaming ? (
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={handleRenameConfirm}
              onKeyDown={handleKeyDown}
              autoFocus
              className="flex-1 px-1 py-0.5 text-sm border border-primary rounded bg-background outline-none"
            />
          ) : (
            <>
              {file.isDirectory ? (
                <FolderIcon className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
              ) : (
                <FileIcon className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
              )}
              {isRenaming ? (
                <input
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={handleRenameConfirm}
                  onKeyDown={handleKeyDown}
                  autoFocus
                  className="flex-1 px-1 py-0.5 text-sm border border-primary rounded bg-background outline-none"
                />
              ) : (
                <span className="truncate text-sm font-mono">{file.name}</span>
              )}
            </>
          )}

          </div>

          {file.isDirectory && isExpanded && (
            <div className="mt-1">
              {file.children?.map((child: any) => renderFileNode(child, depth + 1))}
            </div>
          )}
        </div>
      )
    }, [expandedFolders, selectedFileId, renamingId, renameValue, onFileSelect, toggleFolder, onFileRename, onFileDelete]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showContextMenu && !(event.target as HTMLElement).closest('[data-context-menu]')) {
        setShowContextMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showContextMenu]);

  if (!files.length) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 text-muted-foreground">
        <FolderIcon className="w-12 h-12 mb-2 opacity-50" />
        <p className="text-sm">No files yet</p>
        <button 
          onClick={() => onFileCreate()}
          className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <PlusIcon className="w-4 h-4 mr-2" />
          Create your first file
        </button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-2 bg-background" data-project-id={projectId}>
      <div className="mb-2 px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
        FILES
      </div>
      <div className="space-y-1">
        {files.map(file => renderFileNode(file))}
      </div>

      {showContextMenu && (
        <div
          data-context-menu
          className="fixed z-50 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[160px]"
          style={{ left: showContextMenu.x, top: showContextMenu.y }}
        >
          <button
            className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-accent transition-colors"
            onClick={() => {
              const f = showContextMenu.file;
              handleCreateFile(f.isDirectory ? f.id : f.parentId);
              setShowContextMenu(null);
            }}
          >
            <PlusIcon className="w-4 h-4" />
            New File
          </button>
          <button
            className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-accent transition-colors"
            onClick={() => {
              const f = showContextMenu.file;
              handleCreateFolder(f.isDirectory ? f.id : f.parentId);
              setShowContextMenu(null);
            }}
          >
            <FolderIcon className="w-4 h-4" />
            New Folder
          </button>
          <button
            className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-accent transition-colors"
            onClick={() => {
              handleRenameStart(showContextMenu.file);
              setShowContextMenu(null);
            }}
          >
            <FileIcon className="w-4 h-4" />
            Rename
          </button>
          <button
            className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-red-500/10 text-destructive transition-colors"
            onClick={() => {
              handleDelete(showContextMenu.file.id);
              setShowContextMenu(null);
            }}
          >
            <XMarkIcon className="w-4 h-4" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}