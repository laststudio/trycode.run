import { useState, useEffect } from 'react';
import { 
  UsersIcon, 
  ChartBarIcon, 
  CpuChipIcon, 
  ServerIcon,
  BugAntIcon,
  DocumentTextIcon,
  ArrowPathIcon,
  PlayIcon,
  StopIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ChevronDownIcon,
} from '../../utils/icons.ts';
import { useAuth } from '../../hooks/useAuth';
import { AdminState, get_system_config, get_system_status, get_admin_stats, list_audit_logs, list_executions_admin, list_users_admin, test_smtp, test_captcha, test_oauth, test_database, initialize_super_admin, trigger_config_reload } from '../../api/admin';
import clsx from 'clsx';

interface AdminPageProps {}

export function AdminPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'executions' | 'config' | 'audit' | 'tests'>('overview');
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [executions, setExecutions] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [configs, setConfigs] = useState<any[]>([]);
  const [testResults, setTestResults] = useState<any>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, execRes, usersRes, auditRes, configRes] = await Promise.all([
        fetch('/api/admin/stats').then(r => r.json()),
        fetch('/api/admin/executions?limit=50').then(r => r.json()),
        fetch('/api/admin/users?limit=50').then(r => r.json()),
        fetch('/api/admin/audit-logs?limit=50').then(r => r.json()),
        fetch('/api/admin/config').then(r => r.json()),
      ]);
      setStats(statsRes);
      setExecutions(execRes);
      setUsers(usersRes);
      setAuditLogs(auditRes);
      setConfigs(configRes);
    } catch (error) {
      console.error('Failed to load admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const runTest = async (testType: string) => {
    setTestResults(prev => ({ ...prev, [testType]: { status: 'running' } }));
    try {
      const response = await fetch(`/api/admin/test/${testType}`, { method: 'POST' });
      const result = await response.json();
      setTestResults(prev => ({ ...prev, [testType]: { status: result.success ? 'success' : 'error', message: result.message } }));
    } catch (error) {
      setTestResults(prev => ({ ...prev, [testType]: { status: 'error', message: 'Test failed' } }));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: ChartBarIcon },
    { id: 'users', label: 'Users', icon: UsersIcon },
    { id: 'executions', label: 'Executions', icon: PlayIcon },
    { id: 'config', label: 'Config', icon: CpuChipIcon },
    { id: 'ssr', label: 'SSR Config', icon: ServerIcon },
    { id: 'audit', label: 'Audit Logs', icon: DocumentTextIcon },
    { id: 'tests', label: 'System Tests', icon: BugAntIcon },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 px-4 border-b border-border flex items-center justify-between bg-background/95 backdrop-blur">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">Admin Panel</h1>
          <span className="px-2 py-0.5 text-xs bg-red-500/20 text-red-400 rounded">SUPER ADMIN</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadData} className="p-2 hover:bg-accent rounded-lg" title="Refresh">
            <ArrowPathIcon className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="flex">
        <aside className="w-56 bg-card border-r border-border min-h-[calc(100vh-3.5rem)]">
          <nav className="p-3 space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={clsx(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm font-medium transition-colors',
                  activeTab === tab.id
                    ? 'bg-primary/10 text-primary border-l-4 border-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex-1 p-6 overflow-auto">
          {activeTab === 'overview' && stats && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Total Users" value={stats.total_users} icon={UsersIcon} />
                <StatCard label="Active (24h)" value={stats.active_users_24h} icon={UsersIcon} />
                <StatCard label="Total Projects" value={stats.total_projects} icon={ChartBarIcon} />
                <StatCard label="Executions (24h)" value={stats.executions_24h} icon={PlayIcon} />
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-card border border-border rounded-lg p-6">
                  <h3 className="text-lg font-medium mb-4">Language Usage (24h)</h3>
                  <div className="space-y-3">
                    {stats.languages_usage?.map((l: any) => (
                      <div key={l.language} className="flex items-center justify-between">
                        <span className="font-mono text-sm">{l.language}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded" style={{ width: `${(l.count / Math.max(...stats.languages_usage.map((x: any) => x.count))) * 100}%` }} />
                          </div>
                          <span className="text-sm text-muted-foreground w-16 text-right">{l.count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="bg-card border border-border rounded-lg p-6">
                  <h3 className="text-lg font-medium mb-4">Executions by Status</h3>
                  <div className="flex flex-wrap gap-4">
                    {stats.executions_by_status?.map((s: any) => (
                      <div key={s.status} className="flex items-center gap-2 px-3 py-1 bg-muted rounded">
                        <span className="capitalize">{s.status}</span>
                        <span className="font-mono font-medium">{s.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">User Management</h2>
                <input
                  type="text"
                  placeholder="Search users..."
                  className="px-4 py-2 border border-border rounded-lg w-64"
                />
              </div>
              <div className="bg-card border border-border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">User</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Role</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Status</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Executions (24h)</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Last Login</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u: any) => (
                      <tr key={u.id} className="border-t border-border hover:bg-muted/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                              {u.name?.charAt(0)?.toUpperCase() || 'U'}
                            </div>
                            <div>
                              <p className="font-medium">{u.name}</p>
                              <p className="text-sm text-muted-foreground">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={clsx(
                            'px-2 py-0.5 text-xs rounded font-medium',
                            u.role === 'super_admin' && 'bg-red-500/20 text-red-400',
                            u.role === 'admin' && 'bg-purple-500/20 text-purple-400',
                            u.role === 'user' && 'bg-gray-500/20 text-gray-400',
                          )}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={clsx(
                            'px-2 py-0.5 text-xs rounded font-medium',
                            u.status === 'active' && 'bg-green-500/20 text-green-400',
                            u.status === 'suspended' && 'bg-yellow-500/20 text-yellow-400',
                            u.status === 'banned' && 'bg-red-500/20 text-red-400',
                            u.status === 'pending' && 'bg-gray-500/20 text-gray-400',
                          )}>
                            {u.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-sm">{u.executions_24h}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : 'Never'}
                        </td>
                        <td className="px-4 py-3">
                          <button className="text-sm text-primary hover:underline">Edit</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'executions' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Execution Logs</h2>
                <div className="flex gap-2">
                  <input type="text" placeholder="Filter..." className="px-4 py-2 border border-border rounded-lg w-64" />
                  <select className="px-4 py-2 border border-border rounded-lg">
                    <option>All Languages</option>
                    <option>Python</option>
                    <option>JavaScript</option>
                    <option>TypeScript</option>
                    <option>Rust</option>
                    <option>Go</option>
                  </select>
                </div>
              </div>
              <div className="bg-card border border-border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">ID</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">User</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Language</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Status</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Time</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Memory</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">WASM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {executions.map((e: any) => (
                      <tr key={e.id} className="border-t border-border hover:bg-muted/50">
                        <td className="px-4 py-3 font-mono text-xs">{e.id.slice(0, 8)}...</td>
                        <td className="px-4 py-3 text-sm">{e.user_email}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 text-xs bg-muted rounded">{e.language}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={clsx(
                            'px-2 py-0.5 text-xs rounded font-medium',
                            e.status === 'completed' && 'bg-green-500/20 text-green-400',
                            e.status === 'failed' && 'bg-red-500/20 text-red-400',
                            e.status === 'timeout' && 'bg-yellow-500/20 text-yellow-400',
                            e.status === 'running' && 'bg-blue-500/20 text-blue-400',
                          )}>
                            {e.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {e.wall_time_ms ? `${e.wall_time_ms}ms` : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {e.memory_peak_mb ? `${e.memory_peak_mb}MB` : '-'}
                        </td>
                        <td className="px-4 py-3">
                          {e.wasm_attempted && (
                            <span className={clsx(
                              'px-2 py-0.5 text-xs rounded',
                              e.wasm_fallback_reason ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'
                            )}>
                              {e.wasm_fallback_reason ? 'Fallback' : 'OK'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'config' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">System Configuration</h2>
                <button onClick={() => { /* reload config */ }} className="px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-accent">
                  <ArrowPathIcon className="w-4 h-4 mr-1" /> Reload
                </button>
              </div>
              <div className="bg-card border border-border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Key</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Category</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Value</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Secret</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {configs.map((c: any) => (
                      <tr key={c.key} className="border-t border-border hover:bg-muted/50">
                        <td className="px-4 py-3 font-mono text-sm">{c.key}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 text-xs bg-muted rounded">{c.category}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={c.is_secret ? 'text-muted-foreground italic' : 'font-mono text-sm'}>
                            {c.is_secret ? '***MASKED***' : JSON.stringify(c.value).slice(0, 100)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {c.is_secret && <span className="px-2 py-0.5 text-xs bg-red-500/20 text-red-400 rounded">Secret</span>}
                        </td>
                        <td className="px-4 py-3">
                          <button className="text-sm text-primary hover:underline">Edit</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold">Audit Logs</h2>
              <div className="bg-card border border-border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Time</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">User</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Action</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Resource</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log: any) => (
                      <tr key={log.id} className="border-t border-border hover:bg-muted/50">
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 font-medium">{log.user_email || 'System'}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 text-xs bg-muted rounded">{log.action}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {log.resource_type} {log.resource_id}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{log.ip_address}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'ssr' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold">SSR Configuration</h2>
                  <button onClick={() => triggerConfigReload()} className="px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-accent">
                    <ArrowPathIcon className="w-4 h-4 mr-1" /> Reload Config
                  </button>
                </div>
                
                <div className="bg-card border border-border rounded-lg p-6">
                  <h3 className="text-lg font-medium mb-4">SSR Settings</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Enable SSR</h4>
                        <p className="text-sm text-muted-foreground">Enable server-side rendering for public pages</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          defaultChecked={true}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                      </label>
                    </div>
                    
                    <div className="space-y-4">
                      <label className="flex items-center gap-3">
                        <input type="text" placeholder="Pre-render routes (comma separated)" className="flex-1 px-3 py-2 border border-border rounded-lg text-sm bg-background" />
                        <span className="text-sm text-muted-foreground">Routes to pre-render at build time</span>
                      </label>
                      <label className="flex items-center gap-3">
                        <input type="number" placeholder="Cache TTL (seconds)" value={300} className="w-32 px-3 py-2 border border-border rounded-lg text-sm bg-background" />
                        <span className="text-sm text-muted-foreground">Cache TTL in seconds</span>
                      </label>
                    </div>
                    <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90">
                      Save SSR Config
                    </button>
                  </div>
                </div>

                <div className="bg-card border border-border rounded-lg p-6 mt-6">
                  <h3 className="text-lg font-medium mb-4">Pre-rendered Routes Status</h3>
                  <div className="bg-card border border-border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Route</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Status</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Last Rendered</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Size</th>
                        </tr>
                      </thead>
                      <tbody>
                        {['/', '/docs', '/docs/getting-started', '/docs/api', '/pricing', '/about'].map((route) => (
                          <tr key={route} className="border-t border-border hover:bg-muted/50">
                            <td className="px-4 py-3 font-mono text-sm">{route}</td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded">Rendered</span>
                            </td>
                            <td className="px-4 py-3 text-sm text-muted-foreground">2 hours ago</td>
                            <td className="px-4 py-3 text-sm text-muted-foreground">12.4 KB</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'tests' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold">System Tests</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { id: 'smtp', label: 'SMTP Connection', icon: ServerIcon },
                  { id: 'captcha', label: 'CAPTCHA Verification', icon: BugAntIcon },
                  { id: 'oauth', label: 'GitHub OAuth', icon: UsersIcon },
                  { id: 'database', label: 'Database Connection', icon: CpuChipIcon },
                ].map((test) => (
                  <div key={test.id} className="bg-card border border-border rounded-lg p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <test.icon className="w-6 h-6 text-primary" />
                      <h3 className="font-medium">{test.label}</h3>
                    </div>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => runTest(test.id)}
                        disabled={testResults[test.id]?.status === 'running'}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 flex-1"
                      >
                        {testResults[test.id]?.status === 'running' ? (
                          'Running...'
                        ) : 'Run Test'}
                      </button>
                      {testResults[test.id] && (
                        <span className={clsx(
                          'px-3 py-1 text-sm rounded font-medium',
                          testResults[test.id].status === 'success' && 'bg-green-500/20 text-green-400',
                          testResults[test.id].status === 'error' && 'bg-red-500/20 text-red-400',
                          testResults[test.id].status === 'running' && 'bg-blue-500/20 text-blue-400',
                        )}>
                          {testResults[test.id].status === 'running' ? 'Running...' : 
                           testResults[test.id].status === 'success' ? '✓ Passed' : '✗ Failed'}
                        </span>
                      )}
                    </div>
                    {testResults[test.id]?.message && (
                      <p className="mt-2 text-sm text-muted-foreground">{testResults[test.id].message}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: number; icon: any }) {
  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-3xl font-bold mt-1">{value.toLocaleString()}</p>
        </div>
        <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
          <Icon className="w-6 h-6 text-primary" />
        </div>
      </div>
    </div>
  );
}