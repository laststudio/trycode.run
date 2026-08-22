import { Outlet, Link, useLocation } from 'react-router-dom';
import { 
  HomeIcon, 
  FolderIcon, 
  BookOpenIcon, 
  Cog6ToothIcon,
  UserCircleIcon,
  LogOutIcon,
  MenuIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../hooks/useAuth';
import { useUIStore } from '../stores';
import { useTheme } from '../hooks/useTheme';
import clsx from 'clsx';

export function Layout() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { sidebarOpen, toggleSidebar } = useUIStore();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { path: '/', label: 'Editor', icon: HomeIcon },
    { path: '/projects', label: 'Projects', icon: FolderIcon },
    { path: '/docs', label: 'Documentation', icon: BookOpenIcon },
  ];

  const userNavItems = [
    { path: '/settings', label: 'Settings', icon: Cog6ToothIcon },
    { path: '/profile', label: 'Profile', icon: UserCircleIcon },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Mobile header */}
      <header className="lg:hidden h-14 px-4 border-b border-border flex items-center justify-between bg-background/95 backdrop-blur">
        <button onClick={() => setMobileMenuOpen(true)} className="p-2 hover:bg-accent rounded-lg">
          <MenuIcon className="w-6 h-6" />
        </button>
        <Link to="/" className="font-bold text-xl">TryCode</Link>
        <div className="w-12" />
      </header>

      {/* Mobile sidebar */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col">
          <header className="h-14 px-4 border-b border-border flex items-center justify-between">
            <h2 className="font-bold">Menu</h2>
            <button onClick={() => setMobileMenuOpen(false)} className="p-2 hover:bg-accent rounded-lg">
              <XMarkIcon className="w-6 h-6" />
            </button>
          </header>
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {navItems.map(item => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={clsx(
                  'flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-colors',
                  location.pathname === item.path
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                <item.icon className="w-6 h-6" />
                {item.label}
              </Link>
            ))}
            {user && userNavItems.map(item => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={clsx(
                  'flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-colors',
                  location.pathname === item.path
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                <item.icon className="w-6 h-6" />
                {item.label}
              </Link>
            ))}
            {user && (
              <button onClick={logout} className="mx-4 mb-4 w-full py-2.5 border border-border rounded-lg font-medium hover:bg-accent transition-colors flex items-center justify-center gap-2">
                <LogOutIcon className="w-5 h-5" />
                Sign out
              </button>
            )}
          </nav>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className={clsx(
        'hidden lg:flex lg:flex-col bg-card border-r border-border min-h-[calc(100vh-3.5rem)]',
        'w-64'
      )}>
        <div className="p-4 border-b border-border">
          <Link to="/" className="font-bold text-xl">TryCode</Link>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                location.pathname === item.path
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          ))}
          {user && (
            <>
              <div className="border-t border-border my-3 pt-3" />
              {userNavItems.map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={clsx(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    location.pathname === item.path
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </Link>
              ))}
              {user && user.role === 'super_admin' && (
                <Link
                  to="/admin"
                  className={clsx(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    location.pathname.startsWith('/admin')
                      ? 'bg-red-500/10 text-red-500'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  )}
                >
                  <CpuChipIcon className="w-5 h-5" />
                  Admin Panel
                </Link>
              )}
              <button onClick={logout} className="mx-3 mt-4 w-full py-2 border border-border rounded-lg font-medium hover:bg-accent transition-colors flex items-center justify-center gap-2">
                <LogOutIcon className="w-5 h-5" />
                Sign out
              </button>
            </>
          )}
        </nav>
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-2 px-2 py-2">
            <button
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
              className="p-2 hover:bg-accent rounded-lg transition-colors"
              title="Toggle theme"
            >
              {resolvedTheme === 'dark' ? '☀️' : '🌙'}
            </button>
            <span className="text-sm text-muted-foreground capitalize">{theme}</span>
          </div>
        </div>
      </aside>

      <main className="flex-1 lg:ml-0">
        <Outlet />
      </main>
    </div>
  );
}