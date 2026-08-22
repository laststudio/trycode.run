import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserIcon, BellIcon, ShieldIcon, PaletteIcon, KeyIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../hooks/useAuth';
import { useUIStore } from '../../stores';
import { useTheme } from '../../hooks/useTheme';
import clsx from 'clsx';

export function SettingsPage() {
  const navigate = useNavigate();
  const { user, updateProfile, changePassword } = useAuth();
  const { addToast, theme, setTheme } = useUIStore();
  const { resolvedTheme } = useTheme();
  
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'appearance' | 'notifications'>('profile');
  const [name, setName] = useState(user?.name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateProfile({ name });
      addToast({ type: 'success', title: 'Profile updated' });
    } catch (error: any) {
      // Handle error
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) return;
    if (newPassword.length < 8) return;
    setLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      addToast({ type: 'success', title: 'Password changed' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      // Handle error
    } finally {
      setLoading(false);
    }
  };

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    addToast({ type: 'success', title: 'Theme updated' });
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account settings</p>
      </div>

      <div className="flex gap-8">
        {/* Sidebar */}
        <aside className="w-48 flex-shrink-0">
          <nav className="space-y-1">
            {[
              { id: 'profile', label: 'Profile', icon: UserIcon },
              { id: 'security', label: 'Security', icon: ShieldIcon },
              { id: 'appearance', label: 'Appearance', icon: PaletteIcon },
              { id: 'notifications', label: 'Notifications', icon: BellIcon },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id as any)}
                className={clsx(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left text-sm font-medium transition-colors',
                  activeTab === id
                    ? 'bg-primary/10 text-primary border-l-4 border-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                <Icon className="w-5 h-5" />
                {label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1">
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div className="bg-card border border-border rounded-lg p-6">
                <h2 className="text-lg font-medium mb-4">Profile</h2>
                <form onSubmit={handleProfileUpdate} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-4 py-2.5 bg-background border border-border rounded-lg focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Email</label>
                    <input
                      type="email"
                      value={user?.email || ''}
                      disabled
                      className="w-full px-4 py-2.5 bg-muted border border-border rounded-lg text-muted-foreground"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={clsx(
                      'px-2 py-1 text-xs rounded-full font-medium',
                      user?.role === 'admin' && 'bg-purple-500/20 text-purple-400',
                      user?.role === 'super_admin' && 'bg-red-500/20 text-red-400',
                      user?.role === 'user' && 'bg-gray-500/20 text-gray-400',
                    )}>
                      {user?.role || 'user'}
                    </span>
                    {user?.email_verified && (
                      <span className="px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-400">
                        Verified
                      </span>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50"
                  >
                    {loading ? 'Saving...' : 'Save Changes'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6">
              <div className="bg-card border border-border rounded-lg p-6">
                <h2 className="text-lg font-medium mb-4">Change Password</h2>
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Current Password</label>
                    <div className="relative">
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full pl-4 pr-12 py-2.5 bg-background border border-border rounded-lg focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      >
                        {showCurrentPassword ? '🙈' : '👁'}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">New Password</label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full pl-4 pr-12 py-2.5 bg-background border border-border rounded-lg focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder="••••••••"
                        minLength={8}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      >
                        {showNewPassword ? '🙈' : '👁'}
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">At least 8 characters</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Confirm New Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-4 py-2.5 bg-background border border-border rounded-lg focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder="••••••••"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading || newPassword !== confirmPassword || newPassword.length < 8}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50"
                  >
                    Change Password
                  </button>
                </form>
              </div>

              <div className="bg-card border border-border rounded-lg p-6">
                <h2 className="text-lg font-medium mb-4">API Keys</h2>
                <p className="text-muted-foreground mb-4">Manage your API keys for programmatic access</p>
                <button className="px-4 py-2 border border-border rounded-lg font-medium hover:bg-accent">
                  Generate New API Key
                </button>
              </div>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="space-y-6">
              <div className="bg-card border border-border rounded-lg p-6">
                <h2 className="text-lg font-medium mb-4">Theme</h2>
                <div className="grid grid-cols-3 gap-4">
                  {['light', 'dark', 'system'].map((t) => (
                    <button
                      key={t}
                      onClick={() => handleThemeChange(t as any)}
                      className={clsx(
                        'p-4 rounded-lg border-2 transition-colors flex flex-col items-center gap-2',
                        resolvedTheme === t || theme === t
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      )}
                    >
                      <div className={clsx(
                        'w-16 h-10 rounded border',
                        t === 'light' && 'bg-white border-gray-300',
                        t === 'dark' && 'bg-gray-900 border-gray-700',
                        t === 'system' && 'bg-gradient-to-r from-white to-gray-900 border-gray-300',
                      )} />
                      <span className="capitalize text-sm font-medium">{t}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <div className="bg-card border border-border rounded-lg p-6">
                <h2 className="text-lg font-medium mb-4">Notification Preferences</h2>
                <div className="space-y-4">
                  {[
                    { id: 'email_executions', label: 'Email me when executions complete', default: true },
                    { id: 'email_errors', label: 'Email me on execution errors', default: true },
                    { id: 'email_collab', label: 'Email me when invited to collaborate', default: true },
                    { id: 'email_marketing', label: 'Send me product updates', default: false },
                  ].map((n) => (
                    <label key={n.id} className="flex items-center justify-between">
                      <span className="text-sm">{n.label}</span>
                      <input
                        type="checkbox"
                        defaultChecked={n.default}
                        className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
                      />
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}