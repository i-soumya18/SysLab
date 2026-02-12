/**
 * Admin Panel
 * Comprehensive admin interface for user management, system control, and monitoring
 */

import { useEffect, useState } from 'react';
import { useFirebaseAuthContext } from '../../hooks/useFirebaseAuth';

interface AdminUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  subscriptionTier: string;
  isAdmin: boolean;
  emailVerified: boolean;
  createdAt: string;
  lastLogin?: string;
  workspaceCount?: number;
}

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'down';
  database: {
    connected: boolean;
    responseTimeMs: number;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  uptime: number;
  timestamp: string;
}

interface ApiMetric {
  endpoint: string;
  method: string;
  totalRequests: number;
  avgResponseTime: number;
  errorRate: number;
  statusCodes: Record<string, number>;
}

interface SystemSettings {
  maintenanceMode: boolean;
  maintenanceMessage?: string;
  maxUsers?: number;
  features: Record<string, boolean>;
}

type Tab = 'users' | 'subscriptions' | 'health' | 'metrics' | 'settings';

export const AdminPanel: React.FC = () => {
  const { user } = useFirebaseAuthContext();
  const [activeTab, setActiveTab] = useState<Tab>('users');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [usersPage, setUsersPage] = useState(1);
  const [usersTotal, setUsersTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [metrics, setMetrics] = useState<ApiMetric[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    } else if (activeTab === 'health') {
      fetchHealth();
    } else if (activeTab === 'metrics') {
      fetchMetrics();
    } else if (activeTab === 'settings') {
      fetchSettings();
    }
  }, [activeTab, usersPage, searchQuery]);

  const fetchUsers = async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        page: usersPage.toString(),
        limit: '50'
      });
      if (searchQuery) {
        params.append('search', searchQuery);
      }

      const response = await fetch(`/api/v1/admin/users?${params}`, {
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': user?.email ?? '',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const result = await response.json();
      setUsers(result.data.users);
      setUsersTotal(result.data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const fetchHealth = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/v1/admin/health', {
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': user?.email ?? '',
        },
      });

      if (!response.ok) throw new Error('Failed to fetch health');
      const result = await response.json();
      setHealth(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch health');
    } finally {
      setLoading(false);
    }
  };

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/v1/admin/metrics?range=24h', {
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': user?.email ?? '',
        },
      });

      if (!response.ok) throw new Error('Failed to fetch metrics');
      const result = await response.json();
      setMetrics(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch metrics');
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/v1/admin/settings', {
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': user?.email ?? '',
        },
      });

      if (!response.ok) throw new Error('Failed to fetch settings');
      const result = await response.json();
      setSettings(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch settings');
    } finally {
      setLoading(false);
    }
  };

  const updateUserSubscription = async (userId: string, tier: 'free' | 'pro' | 'enterprise') => {
    try {
      const response = await fetch(`/api/v1/admin/users/${userId}/subscription`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': user?.email ?? '',
        },
        body: JSON.stringify({ tier })
      });

      if (!response.ok) throw new Error('Failed to update subscription');
      await fetchUsers();
      setSelectedUser(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update subscription');
    }
  };

  const toggleAdminStatus = async (userId: string, isAdmin: boolean) => {
    try {
      const response = await fetch(`/api/v1/admin/users/${userId}/admin`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': user?.email ?? '',
        },
        body: JSON.stringify({ isAdmin })
      });

      if (!response.ok) throw new Error('Failed to update admin status');
      await fetchUsers();
      setSelectedUser(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update admin status');
    }
  };

  const updateSettings = async (updates: Partial<SystemSettings>) => {
    try {
      const response = await fetch('/api/v1/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': user?.email ?? '',
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) throw new Error('Failed to update settings');
      await fetchSettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update settings');
    }
  };

  const formatBytes = (bytes: number): string => {
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-600">Please log in to access the admin panel</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
          <p className="mt-2 text-sm text-gray-600">System administration and monitoring</p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {(['users', 'subscriptions', 'health', 'metrics', 'settings'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-lg shadow">
          {activeTab === 'users' && (
            <div className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">User Management</h2>
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setUsersPage(1);
                  }}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
                />
              </div>

              {loading ? (
                <p className="text-gray-600">Loading users...</p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tier</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Admin</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Workspaces</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {users.map((u) => (
                          <tr key={u.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{u.email}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {u.firstName} {u.lastName}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                u.subscriptionTier === 'enterprise' ? 'bg-purple-100 text-purple-800' :
                                u.subscriptionTier === 'pro' ? 'bg-blue-100 text-blue-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {u.subscriptionTier}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {u.isAdmin ? (
                                <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">Admin</span>
                              ) : (
                                <span className="text-sm text-gray-500">-</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{u.workspaceCount || 0}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <button
                                onClick={() => setSelectedUser(u)}
                                className="text-blue-600 hover:text-blue-900"
                              >
                                Manage
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-sm text-gray-600">
                      Showing {users.length} of {usersTotal} users
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setUsersPage(p => Math.max(1, p - 1))}
                        disabled={usersPage === 1}
                        className="px-4 py-2 text-sm border rounded-lg disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setUsersPage(p => p + 1)}
                        disabled={users.length < 50}
                        className="px-4 py-2 text-sm border rounded-lg disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* User Management Modal */}
              {selectedUser && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-white rounded-lg p-6 max-w-md w-full">
                    <h3 className="text-lg font-semibold mb-4">Manage User: {selectedUser.email}</h3>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Subscription Tier</label>
                        <div className="flex gap-2">
                          {(['free', 'pro', 'enterprise'] as const).map((tier) => (
                            <button
                              key={tier}
                              onClick={() => updateUserSubscription(selectedUser.id, tier)}
                              className={`px-4 py-2 text-sm rounded-lg ${
                                selectedUser.subscriptionTier === tier
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              {tier}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Admin Status</label>
                        <button
                          onClick={() => toggleAdminStatus(selectedUser.id, !selectedUser.isAdmin)}
                          className={`px-4 py-2 text-sm rounded-lg ${
                            selectedUser.isAdmin
                              ? 'bg-red-600 text-white'
                              : 'bg-green-600 text-white'
                          }`}
                        >
                          {selectedUser.isAdmin ? 'Revoke Admin' : 'Grant Admin'}
                        </button>
                      </div>

                      <div className="flex gap-2 pt-4">
                        <button
                          onClick={() => setSelectedUser(null)}
                          className="flex-1 px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'health' && (
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">System Health</h2>
              {loading ? (
                <p className="text-gray-600">Loading health data...</p>
              ) : health ? (
                <div className="space-y-4">
                  <div className={`p-4 rounded-lg ${
                    health.status === 'healthy' ? 'bg-green-50 border border-green-200' :
                    health.status === 'degraded' ? 'bg-yellow-50 border border-yellow-200' :
                    'bg-red-50 border border-red-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Status: {health.status.toUpperCase()}</span>
                      <span className="text-sm text-gray-600">Uptime: {formatUptime(health.uptime)}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 border rounded-lg">
                      <h3 className="font-medium mb-2">Database</h3>
                      <p className={`text-sm ${health.database.connected ? 'text-green-600' : 'text-red-600'}`}>
                        {health.database.connected ? 'Connected' : 'Disconnected'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Response: {health.database.responseTimeMs}ms
                      </p>
                    </div>

                    <div className="p-4 border rounded-lg">
                      <h3 className="font-medium mb-2">Memory</h3>
                      <p className="text-sm text-gray-700">
                        {formatBytes(health.memory.used)} / {formatBytes(health.memory.total)}
                      </p>
                      <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            health.memory.percentage > 90 ? 'bg-red-500' :
                            health.memory.percentage > 70 ? 'bg-yellow-500' :
                            'bg-green-500'
                          }`}
                          style={{ width: `${health.memory.percentage}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {health.memory.percentage.toFixed(1)}% used
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-gray-600">No health data available</p>
              )}
            </div>
          )}

          {activeTab === 'metrics' && (
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">API Metrics (Last 24 Hours)</h2>
              {loading ? (
                <p className="text-gray-600">Loading metrics...</p>
              ) : metrics.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Endpoint</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requests</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Response</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Error Rate</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {metrics.map((metric, idx) => (
                        <tr key={idx}>
                          <td className="px-6 py-4 text-sm text-gray-900">{metric.endpoint}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">{metric.method}</td>
                          <td className="px-6 py-4 text-sm text-gray-700">{metric.totalRequests}</td>
                          <td className="px-6 py-4 text-sm text-gray-700">{metric.avgResponseTime}ms</td>
                          <td className="px-6 py-4 text-sm">
                            <span className={metric.errorRate > 5 ? 'text-red-600' : 'text-green-600'}>
                              {metric.errorRate.toFixed(2)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-600">No metrics data available</p>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">System Settings</h2>
              {loading ? (
                <p className="text-gray-600">Loading settings...</p>
              ) : settings ? (
                <div className="space-y-6">
                  <div>
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={settings.maintenanceMode}
                        onChange={(e) => updateSettings({ maintenanceMode: e.target.checked })}
                        className="w-5 h-5"
                      />
                      <span className="font-medium">Maintenance Mode</span>
                    </label>
                    <p className="text-sm text-gray-600 ml-8 mt-1">
                      When enabled, the system will display a maintenance message to all users
                    </p>
                    {settings.maintenanceMode && (
                      <input
                        type="text"
                        placeholder="Maintenance message..."
                        value={settings.maintenanceMessage || ''}
                        onChange={(e) => updateSettings({ maintenanceMessage: e.target.value })}
                        className="mt-2 ml-8 w-full rounded-lg border border-gray-300 px-4 py-2 text-sm"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Max Users</label>
                    <input
                      type="number"
                      value={settings.maxUsers || ''}
                      onChange={(e) => updateSettings({ maxUsers: parseInt(e.target.value) || undefined })}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm"
                      placeholder="Leave empty for unlimited"
                    />
                  </div>
                </div>
              ) : (
                <p className="text-gray-600">No settings available</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
