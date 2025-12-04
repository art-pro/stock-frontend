'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { authAPI, portfolioAPI } from '@/lib/api';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import ColumnSettings, { ColumnConfig, DEFAULT_COLUMNS } from '@/components/ColumnSettings';

export default function SettingsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'username' | 'password' | 'portfolio' | 'columns'>('username');
  const [currentUser, setCurrentUser] = useState<{ username: string } | null>(null);
  
  // Username form
  const [usernamePassword, setUsernamePassword] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [usernameSuccess, setUsernameSuccess] = useState('');

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  // Portfolio settings
  const [portfolioSettings, setPortfolioSettings] = useState({
    update_frequency: 'daily',
    alerts_enabled: true,
    alert_threshold_ev: 10.0,
  });
  const [settingsError, setSettingsError] = useState('');
  const [settingsSuccess, setSettingsSuccess] = useState('');

  // Column settings
  const [columnSettings, setColumnSettings] = useState<ColumnConfig[]>(DEFAULT_COLUMNS);
  const [columnError, setColumnError] = useState('');
  const [columnSuccess, setColumnSuccess] = useState('');

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }
    fetchCurrentUser();
    fetchPortfolioSettings();
    loadColumnSettings();
  }, [router]);

  const fetchCurrentUser = async () => {
    try {
      const response = await authAPI.getCurrentUser();
      setCurrentUser({ username: response.data.username });
      setNewUsername(response.data.username); // Set current username as default
    } catch (err) {
      console.error('Failed to fetch current user:', err);
    }
  };

  const fetchPortfolioSettings = async () => {
    try {
      const response = await portfolioAPI.getSettings();
      setPortfolioSettings({
        update_frequency: response.data.update_frequency || 'daily',
        alerts_enabled: response.data.alerts_enabled !== false,
        alert_threshold_ev: response.data.alert_threshold_ev || 10.0,
      });
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    }
  };

  const loadColumnSettings = () => {
    try {
      const saved = localStorage.getItem('stock-table-columns');
      if (saved) {
        const parsedColumns = JSON.parse(saved);
        // Merge with defaults to handle any new columns added
        const mergedColumns = DEFAULT_COLUMNS.map(defaultCol => {
          const savedCol = parsedColumns.find((col: ColumnConfig) => col.id === defaultCol.id);
          return savedCol ? { ...defaultCol, ...savedCol } : defaultCol;
        });
        setColumnSettings(mergedColumns);
      }
    } catch (err) {
      console.error('Failed to load column settings:', err);
      setColumnSettings(DEFAULT_COLUMNS);
    }
  };

  const saveColumnSettings = (columns: ColumnConfig[]) => {
    try {
      localStorage.setItem('stock-table-columns', JSON.stringify(columns));
      setColumnSuccess('Column settings saved successfully!');
      setColumnError('');
      // Clear success message after 3 seconds
      setTimeout(() => setColumnSuccess(''), 3000);
    } catch (err) {
      console.error('Failed to save column settings:', err);
      setColumnError('Failed to save column settings');
    }
  };

  const handleColumnSettingsChange = (columns: ColumnConfig[]) => {
    setColumnSettings(columns);
    saveColumnSettings(columns);
  };

  const handleUsernameSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setUsernameError('');
    setUsernameSuccess('');

    if (!newUsername.trim()) {
      setUsernameError('Username cannot be empty');
      return;
    }

    if (newUsername.length < 3) {
      setUsernameError('Username must be at least 3 characters');
      return;
    }

    if (newUsername === currentUser?.username) {
      setUsernameError('New username must be different from current username');
      return;
    }

    try {
      await authAPI.changeUsername(usernamePassword, newUsername);
      setUsernameSuccess('Username changed successfully!');
      setUsernamePassword('');
      // Update current user info
      setCurrentUser({ username: newUsername });
    } catch (err: any) {
      setUsernameError(err.response?.data?.error || 'Failed to change username');
    }
  };

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }

    try {
      await authAPI.changePassword(currentPassword, newPassword);
      setPasswordSuccess('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordError(err.response?.data?.error || 'Failed to change password');
    }
  };

  const handleSettingsSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSettingsError('');
    setSettingsSuccess('');

    try {
      await portfolioAPI.updateSettings(portfolioSettings);
      setSettingsSuccess('Settings updated successfully!');
    } catch (err: any) {
      setSettingsError(err.response?.data?.error || 'Failed to update settings');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center text-primary-400 hover:text-primary-300 mb-2"
          >
            <ArrowLeftIcon className="h-5 w-5 mr-2" />
            Back to Dashboard
          </button>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="flex space-x-4 mb-6 border-b border-gray-700">
          <button
            onClick={() => setActiveTab('username')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'username'
                ? 'text-primary-400 border-b-2 border-primary-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Change Username
          </button>
          <button
            onClick={() => setActiveTab('password')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'password'
                ? 'text-primary-400 border-b-2 border-primary-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Change Password
          </button>
          <button
            onClick={() => setActiveTab('portfolio')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'portfolio'
                ? 'text-primary-400 border-b-2 border-primary-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Portfolio Settings
          </button>
          <button
            onClick={() => setActiveTab('columns')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'columns'
                ? 'text-primary-400 border-b-2 border-primary-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Column Settings
          </button>
        </div>

        {/* Username Tab */}
        {activeTab === 'username' && (
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-xl font-bold text-white mb-4">Change Username</h2>
            
            {/* Current Username Display */}
            <div className="mb-6 p-4 bg-gray-700 rounded-lg">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Current Username
              </label>
              <p className="text-white font-semibold text-lg">
                {currentUser?.username || 'Loading...'}
              </p>
            </div>

            <form onSubmit={handleUsernameSubmit} className="space-y-4">
              {usernameError && (
                <div className="bg-red-900 bg-opacity-50 border border-red-700 text-red-200 px-4 py-3 rounded-lg">
                  {usernameError}
                </div>
              )}
              {usernameSuccess && (
                <div className="bg-green-900 bg-opacity-50 border border-green-700 text-green-200 px-4 py-3 rounded-lg">
                  {usernameSuccess}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  New Username
                </label>
                <input
                  type="text"
                  required
                  minLength={3}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value.trim())}
                  placeholder="Enter new username"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Minimum 3 characters, no spaces
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Current Password
                </label>
                <input
                  type="password"
                  required
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  value={usernamePassword}
                  onChange={(e) => setUsernamePassword(e.target.value)}
                  placeholder="Enter your current password to confirm"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Verification required to change username
                </p>
              </div>

              <div className="bg-amber-900 bg-opacity-30 border border-amber-700 rounded-lg p-4">
                <p className="text-sm text-amber-200">
                  <strong>⚠️ Important:</strong> Changing your username will affect your login credentials. 
                  Make sure to remember your new username for future logins.
                </p>
              </div>

              <button
                type="submit"
                className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Change Username
              </button>
            </form>
          </div>
        )}

        {/* Password Tab */}
        {activeTab === 'password' && (
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-xl font-bold text-white mb-4">Change Password</h2>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              {passwordError && (
                <div className="bg-red-900 bg-opacity-50 border border-red-700 text-red-200 px-4 py-3 rounded-lg">
                  {passwordError}
                </div>
              )}
              {passwordSuccess && (
                <div className="bg-green-900 bg-opacity-50 border border-green-700 text-green-200 px-4 py-3 rounded-lg">
                  {passwordSuccess}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Current Password
                </label>
                <input
                  type="password"
                  required
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <p className="text-xs text-gray-400 mt-1">
                  Minimum 8 characters
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              <button
                type="submit"
                className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Change Password
              </button>
            </form>
          </div>
        )}

        {/* Portfolio Settings Tab */}
        {activeTab === 'portfolio' && (
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-xl font-bold text-white mb-4">Portfolio Settings</h2>
            <form onSubmit={handleSettingsSubmit} className="space-y-4">
              {settingsError && (
                <div className="bg-red-900 bg-opacity-50 border border-red-700 text-red-200 px-4 py-3 rounded-lg">
                  {settingsError}
                </div>
              )}
              {settingsSuccess && (
                <div className="bg-green-900 bg-opacity-50 border border-green-700 text-green-200 px-4 py-3 rounded-lg">
                  {settingsSuccess}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Default Update Frequency
                </label>
                <select
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  value={portfolioSettings.update_frequency}
                  onChange={(e) =>
                    setPortfolioSettings({
                      ...portfolioSettings,
                      update_frequency: e.target.value,
                    })
                  }
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="manually">Manually</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  How often stocks should be updated (Manually = only when you trigger updates)
                </p>
              </div>

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-primary-600 bg-gray-700 border-gray-600 rounded focus:ring-primary-500"
                    checked={portfolioSettings.alerts_enabled}
                    onChange={(e) =>
                      setPortfolioSettings({
                        ...portfolioSettings,
                        alerts_enabled: e.target.checked,
                      })
                    }
                  />
                  <span className="ml-2 text-sm text-gray-300">
                    Enable Email Alerts
                  </span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Alert Threshold (EV Change %)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  value={portfolioSettings.alert_threshold_ev}
                  onChange={(e) =>
                    setPortfolioSettings({
                      ...portfolioSettings,
                      alert_threshold_ev: parseFloat(e.target.value) || 10.0,
                    })
                  }
                />
                <p className="text-xs text-gray-400 mt-1">
                  Send alert when Expected Value changes by this percentage
                </p>
              </div>

              <button
                type="submit"
                className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Save Settings
              </button>
            </form>
          </div>
        )}

        {/* Column Settings Tab */}
        {activeTab === 'columns' && (
          <div>
            {columnError && (
              <div className="bg-red-900 bg-opacity-50 border border-red-700 text-red-200 px-4 py-3 rounded-lg mb-4">
                {columnError}
              </div>
            )}
            {columnSuccess && (
              <div className="bg-green-900 bg-opacity-50 border border-green-700 text-green-200 px-4 py-3 rounded-lg mb-4">
                {columnSuccess}
              </div>
            )}

            <ColumnSettings
              onSettingsChange={handleColumnSettingsChange}
              initialColumns={columnSettings}
            />
          </div>
        )}
      </main>
    </div>
  );
}

