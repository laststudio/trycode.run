import { useState, useCallback, useMemo } from 'react';
import {
  ChevronRightIcon,
  ChevronDownIcon,
  FileIcon,
  FolderIcon,
  DocumentTextIcon,
} from '../../utils/icons';
import { useEditorStore } from '../../stores';
import { getFileIcon } from '../../utils/fileIcons';
import clsx from 'clsx';

interface FileTreeProps {
  projectId: string;
  onFileSelect: (file: any) => void;
  onFileCreate: (parentId?: string) => void;
  onFolderCreate: (parentId?: string) => void;
  onFileDelete: (fileId: string) => void;
  onFileRename: (fileId: string, newName: string) => void;
  onFileMove: (fileId: string, newParentId?: string) => void;
}

export function FileTree({
  onFileSelect,
  onFileCreate,
  onFolderCreate,
  onFileDelete,
  onFileRename,
}: FileTreeProps) {
  const { files, expandedFolders, toggleFolder, selectedFileId, setSelectedFileId } = useEditorStore();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Build tree structure
  const fileMap = useMemo(() => {
    const map = new Map<string, any[]>();
    files.forEach(file => {
      const parentKey = file.parent_id || 'root';
      if (!map.has(parentKey)) map.set(parentKey, []);
      map.get(parentKey)!.push(file);
    });
    return map;
  }, [files]);

  const rootFiles = fileMap.get('root') || [];

  const renderFileNode = useCallback((file: any, depth: number = 0) => {
    const isExpanded = expandedFolders.has(file.id);
    const hasChildren = file.is_directory && (fileMap.get(file.id)?.length || 0) > 0;
    const isSelected = selectedFileId === file.id;
    const isRenaming = renamingId === file.id;

    const Icon = getFileIcon(file.name, file.mime_type);
    const FolderToggle = isExpanded ? ChevronDownIcon : ChevronRightIcon;

    const handleRenameConfirm = () => {
      if (renameValue.trim() && renameValue !== file.name) {
        onFileRename(file.id, renameValue.trim());
      }
      setRenamingId(null);
    };

    const handleRenameCancel = () => {
      setRenamingId(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleRenameConfirm();
      if (e.key === 'Escape') handleRenameCancel();
    };

    return (
      <div className={clsx('select-none', depth > 0 && 'ml-6')}>
        <div
          className={clsx(
            'flex items-center gap-1 px-2 py-1 rounded hover:bg-accent transition-colors',
            isSelected && 'bg-accent text-accent-foreground'
          )}
          onClick={(e) => {
            e.stopPropagation();
            if (!isRenaming) {
              setSelectedFileId(file.id);
              if (!file.is_directory) {
                onFileSelect(file);
              }
            }
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            if (file.is_directory) {
              toggleFolder(file.id);
            } else {
              onFileSelect(file);
            }
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setSelectedFileId(file.id);
            showContextMenu(e.clientX, e.clientY, file);
          }}
        >
          {hasChildren && (
            <FolderToggle
              className={clsx('w-4 h-4 text-muted-foreground flex-shrink-0', isExpanded && 'rotate-90')}
              onClick={(e) => {
                e.stopPropagation();
                toggleFolder(file.id);
              }}
            />
          )}
          {!hasChildren && !file.is_directory && <span className="w-4 h-4 flex-shrink-0" />}
          
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
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="truncate text-sm font-mono">{file.name}</span>
            </>
          )}
        </div>
        
        {file.is_directory && isExpanded && (
          <div className="mt-1">
            {fileMap.get(file.id)?.map(child => renderFileNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  }, [expandedFolders, selectedFileId, renamingId, renameValue, fileMap, onFileSelect, toggleFolder, onFileRename]);

  const showContextMenu = (x: number, y: number, file: any) => {
    // Remove existing context menu
    const existing = document.getElementById('file-context-menu');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.id = 'file-context-menu';
    menu.className = 'fixed z-50 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[160px]';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    const items = [
      { label: 'New File', action: () => onFileCreate(file.is_directory ? file.id : file.parent_id), icon: FileIcon },
      { label: 'New Folder', action: () => onFolderCreate(file.is_directory ? file.id : file.parent_id), icon: FolderIcon },
      { label: 'Rename', action: () => { setRenamingId(file.id); setRenameValue(file.name); }, icon: DocumentTextIcon },
      { label: 'Delete', action: () => onFileDelete(file.id), icon: null, danger: true },
    ];

    items.forEach(item => {
      const btn = document.createElement('button');
      btn.className = clsx(
        'w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-accent transition-colors',
        item.danger && 'text-destructive'
      );
      if (item.icon) {
        const icon = document.createElement('span');
        icon.innerHTML = item.icon({ className: 'w-4 h-4' }).toString();
        btn.appendChild(icon);
      }
      btn.appendChild(document.createTextNode(item.label));
      btn.onclick = () => {
        item.action();
        document.body.removeChild(menu);
      };
      menu.appendChild(btn);
    });

    document.body.appendChild(menu);

    const closeMenu = () => {
      document.body.removeChild(menu);
      document.removeEventListener('click', closeMenu);
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
  };

  return (
    <div className="h-full overflow-y-auto p-2 bg-background">
      <div className="mb-2 px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
        FILES
      </div>
      <div className="space-y-1">
        {rootFiles.map(file => renderFileNode(file))}
      </div>

      {rootFiles.length === 0 && (
        <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
          <FolderIcon className="w-12 h-12 mb-2 opacity-50" />
          <p className="text-sm">No files yet</p>
          <button
            onClick={() => onFileCreate()}
            className="mt-2 text-primary hover:underline text-sm"
          >
            Create your first file
          </button>
        </div>
      )}
    </div>
  );
}