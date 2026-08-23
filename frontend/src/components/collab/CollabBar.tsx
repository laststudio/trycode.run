import { LinkIcon } from '../../utils/icons';

interface CollabUser {
  id: string;
  name: string;
  color: string;
  cursor?: { line: number; column: number };
}

interface CollabBarProps {
  users: CollabUser[];
}

export function CollabBar({ users }: CollabBarProps) {
  if (users.length <= 1) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 animate-slide-in-from-bottom">
      <div className="bg-card border border-border rounded-lg shadow-xl p-2 flex items-center gap-2 min-w-[200px]">
        <span className="text-xs text-muted-foreground">Collaborating:</span>
        <div className="flex -space-x-2">
          {users.slice(0, 5).map((user) => (
            <div
              key={user.id}
              className="w-8 h-8 rounded-full border-2 border-background flex items-center justify-center text-xs font-medium flex-shrink-0"
              style={{ backgroundColor: user.color }}
              title={user.name + (user.cursor ? ` (Line ${user.cursor.line})` : '')}
            >
              {user.name.charAt(0).toUpperCase()}
            </div>
          ))}
          {users.length > 5 && (
            <div className="w-8 h-8 rounded-full border-2 border-background flex items-center justify-center text-xs font-medium flex-shrink-0 bg-muted text-muted-foreground">
              +{users.length - 5}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 ml-2">
          <button className="p-1.5 hover:bg-accent rounded" title="Invite collaborator">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </button>
          <button className="p-1.5 hover:bg-accent rounded" title="Copy share link">
            <LinkIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}