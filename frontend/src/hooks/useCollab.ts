import { useEffect, useRef, useCallback, useState } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { useAuth } from './useAuth';
import { useEditorStore } from '../stores';
import { v4 as uuidv4 } from 'uuid';

interface CollabUser {
  id: string;
  name: string;
  color: string;
  cursor?: { line: number; column: number };
  selection?: { startLine: number; startColumn: number; endLine: number; endColumn: number };
}

interface UseCollabReturn {
  connect: (projectId: string, filePath: string) => void;
  disconnect: () => void;
  ydoc: Y.Doc | null;
  awareness: any;
  connected: boolean;
  users: CollabUser[];
}

export function useCollab(): UseCollabReturn {
  const { user } = useAuth();
  const { setCollabUsers } = useEditorStore();
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const [connected, setConnected] = useState(false);
  const [users, setUsers] = useState<CollabUser[]>([]);

  const connect = useCallback((projectId: string, filePath: string) => {
    if (!user) return;

    // Create or reuse Yjs document
    if (!ydocRef.current) {
      ydocRef.current = new Y.Doc();
    }
    const ydoc = ydocRef.current;

    // Create WebSocket provider
    const wsUrl = `${import.meta.env.VITE_WS_BASE || 'ws://localhost:3000'}/api/collab/${projectId}?file=${encodeURIComponent(filePath)}&token=${localStorage.getItem('access_token')}`;
    
    providerRef.current = new WebsocketProvider(wsUrl, filePath, ydoc, {
      connect: true,
      maxBackoffTime: 10000,
    });

    const awareness = providerRef.current.awareness;
    
    // Set local user state
    awareness.setLocalState({
      user: {
        id: user.id,
        name: user.name,
        color: generateUserColor(user.id),
      },
      cursor: null,
      selection: null,
    });

    // Handle connection status
    providerRef.current.on('status', (event: { status: string }) => {
      setConnected(event.status === 'connected');
    });

    // Handle awareness changes
    awareness.on('change', () => {
      const states = Array.from(awareness.getStates().entries())
        .map(([clientID, state]: [number, any]) => ({
          id: state.user?.id || `user-${clientID}`,
          name: state.user?.name || `User ${clientID}`,
          color: state.user?.color || generateUserColor(clientID.toString()),
          cursor: state.cursor,
          selection: state.selection,
        }))
        .filter(u => u.id !== user.id); // Filter out self
      
      setUsers(users);
      setUsers(users); // This will trigger re-render with updated users
    });

    // Sync awareness with editor
    // This would be connected to Monaco editor cursors/selections
  }, [user]);

  const disconnect = useCallback(() => {
    if (providerRef.current) {
      providerRef.current.destroy();
      providerRef.current = null;
    }
    setConnected(false);
    setUsers([]);
  }, []);

  return {
    connect,
    disconnect,
    ydoc: ydocRef.current,
    awareness: providerRef.current?.awareness || null,
    connected,
    users,
  };
}

function generateUserColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 45%)`;
}