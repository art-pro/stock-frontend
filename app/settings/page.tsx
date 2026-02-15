'use client';

import { useState, useEffect, FormEvent, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { authAPI, portfolioAPI } from '@/lib/api';
import { ArrowLeftIcon, PlusIcon, TrashIcon, ArrowDownTrayIcon, ArrowUpTrayIcon, DocumentDuplicateIcon } from '@heroicons/react/24/outline';
import ColumnSettings, { ColumnConfig, DEFAULT_COLUMNS } from '@/components/ColumnSettings';
import { useColumnSettings } from '@/hooks/useColumnSettings';
import { useSectorTargetsContext } from '@/contexts/SectorTargetsContext';
import { SECTOR_TARGET_TABLE, CASH_TARGET_ROW, type SectorTargetTableRow } from '@/lib/sectorTargets';

const SECTOR_TARGETS_EXPORT_FILENAME = 'sector-targets.json';

function sectorTargetsToJson(rows: SectorTargetTableRow[]): string {
  return JSON.stringify({ rows }, null, 2);
}

function parseSectorTargetsJson(json: string): SectorTargetTableRow[] | null {
  try {
    const data = JSON.parse(json);
    const rows = Array.isArray(data) ? data : data?.rows;
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return rows.map((r: Record<string, unknown>) => ({
      sector: String(r.sector ?? '').trim(),
      min: Number(r.min),
      max: Number(r.max),
      rationale: String(r.rationale ?? '').trim(),
    }));
  } catch {
    return null;
  }
}

function validateRow(row: SectorTargetTableRow): string | null {
  if (!row.sector || !String(row.sector).trim()) return 'Sector name is required';
  const min = Number(row.min);
  const max = Number(row.max);
  if (Number.isNaN(min) || Number.isNaN(max)) return 'Min and max must be numbers';
  if (min < 0 || min > 100 || max < 0 || max > 100) return 'Min and max must be between 0 and 100';
  if (min > max) return 'Min must be ≤ max';
  return null;
}

function SectorTargetsTabContent({ canEditSectorTargets }: { canEditSectorTargets: boolean }) {
  const {
    tableRows,
    save,
    isLoading,
    saveStatus,
    saveError,
  } = useSectorTargetsContext();

  const [draftRows, setDraftRows] = useState<SectorTargetTableRow[]>(() =>
    tableRows.length > 0 ? tableRows.map((r) => ({ ...r })) : []
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [exportCopied, setExportCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isLoading && tableRows.length > 0) {
      setDraftRows(tableRows.map((r) => ({ ...r })));
    }
  }, [isLoading, tableRows]);

  const handleResetToDefaults = () => {
    const defaultRows = [...SECTOR_TARGET_TABLE, CASH_TARGET_ROW];
    setDraftRows(defaultRows.map((r) => ({ ...r })));
    setValidationError(null);
    save(defaultRows);
  };

  const handleAddSector = () => {
    setDraftRows((prev) => [...prev, { sector: '', min: 5, max: 10, rationale: '' }]);
    setValidationError(null);
  };

  const handleDeleteRow = (index: number) => {
    if (draftRows.length <= 1) return;
    setDraftRows((prev) => prev.filter((_, i) => i !== index));
    setValidationError(null);
  };

  const handleDraftChange = (index: number, field: keyof SectorTargetTableRow, value: string | number) => {
    setDraftRows((prev) => {
      const next = prev.map((r, i) => (i === index ? { ...r, [field]: value } : r));
      return next;
    });
    setValidationError(null);
  };

  const handleSave = () => {
    const errors: string[] = [];
    draftRows.forEach((row, i) => {
      const err = validateRow(row);
      if (err) errors.push(`Row ${i + 1} (${row.sector || 'new'}): ${err}`);
    });
    if (errors.length) {
      setValidationError(errors.join('. '));
      return;
    }
    const normalized = draftRows.map((r) => ({
      sector: String(r.sector).trim(),
      min: Number(r.min),
      max: Number(r.max),
      rationale: String(r.rationale ?? '').trim(),
    }));
    setValidationError(null);
    save(normalized);
  };

  const rowsForExport = canEditSectorTargets ? draftRows : tableRows;
  const handleCopyJson = async () => {
    const json = sectorTargetsToJson(rowsForExport);
    try {
      await navigator.clipboard.writeText(json);
      setExportCopied(true);
      setTimeout(() => setExportCopied(false), 2000);
    } catch {
      setImportError('Failed to copy to clipboard');
    }
  };
  const handleDownloadJson = () => {
    const json = sectorTargetsToJson(rowsForExport);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = SECTOR_TARGETS_EXPORT_FILENAME;
    a.click();
    URL.revokeObjectURL(url);
  };

  const applyImportedRows = (rows: SectorTargetTableRow[]): boolean => {
    const errors: string[] = [];
    rows.forEach((row, i) => {
      const err = validateRow(row);
      if (err) errors.push(`Row ${i + 1} (${row.sector || '?'}): ${err}`);
    });
    if (errors.length) {
      setImportError(errors.join('. '));
      return false;
    }
    setDraftRows(rows);
    setImportError(null);
    setImportText('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    return true;
  };
  const handleImportFromText = () => {
    setImportError(null);
    const rows = parseSectorTargetsJson(importText);
    if (!rows) {
      setImportError('Invalid JSON: expected { "rows": [ ... ] } or an array of { sector, min, max, rationale }');
      return;
    }
    applyImportedRows(rows);
  };
  const handleImportFromFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const rows = parseSectorTargetsJson(text);
      if (!rows) {
        setImportError('Invalid JSON in file: expected { "rows": [ ... ] } or an array of objects with sector, min, max, rationale');
        return;
      }
      applyImportedRows(rows);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  if (isLoading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <div className="animate-pulse text-gray-400">Loading sector targets...</div>
      </div>
    );
  }

  const rowsToShow = canEditSectorTargets ? draftRows : tableRows;

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <h2 className="text-xl font-bold text-white mb-4">Sector Allocation Targets</h2>
      <p className="text-sm text-gray-400 mb-4">
        Ratios applied to rebalance hints and sector headers on the Dashboard. Stored per user. Equity sectors and Cash (separate).
      </p>
      <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
        <span className="text-xs text-gray-500">
          {canEditSectorTargets ? 'You can add, edit, and delete rows (admin).' : 'View only. Only admins can change targets.'}
        </span>
        {canEditSectorTargets && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleAddSector}
              disabled={saveStatus === 'saving'}
              className="text-sm px-3 py-1.5 bg-gray-600 text-white rounded hover:bg-gray-500 disabled:opacity-50 flex items-center gap-1"
            >
              <PlusIcon className="w-4 h-4" /> Add sector
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saveStatus === 'saving'}
              className="text-sm px-3 py-1.5 bg-primary-600 text-white rounded hover:bg-primary-500 disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={handleResetToDefaults}
              disabled={saveStatus === 'saving'}
              className="text-sm px-3 py-1.5 bg-gray-600 text-white rounded hover:bg-gray-500 disabled:opacity-50"
            >
              Reset to defaults
            </button>
          </div>
        )}
      </div>
      {saveStatus === 'success' && (
        <div className="mb-4 bg-green-900/50 border border-green-700 text-green-200 px-4 py-2 rounded text-sm">
          Saved. Dashboard tables and info boxes use these targets.
        </div>
      )}
      {saveStatus === 'error' && saveError && (
        <div className="mb-4 bg-red-900/50 border border-red-700 text-red-200 px-4 py-2 rounded text-sm">
          {saveError}
        </div>
      )}
      {validationError && (
        <div className="mb-4 bg-amber-900/50 border border-amber-700 text-amber-200 px-4 py-2 rounded text-sm">
          {validationError}
        </div>
      )}

      {/* Import / Export */}
      <div className="mb-4 p-4 rounded-lg border border-gray-600 bg-gray-800/80">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Import / Export sector ratios</h3>
        <div className="flex flex-wrap gap-4 items-start">
          <div className="flex flex-col gap-2">
            <span className="text-xs text-gray-500">Export (current table)</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCopyJson}
                className="text-sm px-3 py-1.5 bg-gray-600 text-white rounded hover:bg-gray-500 flex items-center gap-1"
              >
                <DocumentDuplicateIcon className="w-4 h-4" />
                {exportCopied ? 'Copied' : 'Copy JSON'}
              </button>
              <button
                type="button"
                onClick={handleDownloadJson}
                className="text-sm px-3 py-1.5 bg-gray-600 text-white rounded hover:bg-gray-500 flex items-center gap-1"
              >
                <ArrowDownTrayIcon className="w-4 h-4" />
                Download file
              </button>
            </div>
          </div>
          {canEditSectorTargets && (
            <div className="flex flex-col gap-2 flex-1 min-w-0">
              <span className="text-xs text-gray-500">Import (load into table; then Save to persist)</span>
              <div className="flex flex-wrap gap-2 items-end">
                <div className="flex-1 min-w-[200px]">
                  <textarea
                    value={importText}
                    onChange={(e) => { setImportText(e.target.value); setImportError(null); }}
                    placeholder='Paste JSON: { "rows": [ { "sector": "...", "min": 10, "max": 15, "rationale": "..." } ] }'
                    rows={2}
                    className="w-full bg-gray-700 text-white border border-gray-600 rounded px-2 py-1.5 text-sm font-mono placeholder:text-gray-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleImportFromText}
                  disabled={!importText.trim()}
                  className="text-sm px-3 py-1.5 bg-gray-600 text-white rounded hover:bg-gray-500 disabled:opacity-50 flex items-center gap-1"
                >
                  <ArrowUpTrayIcon className="w-4 h-4" />
                  Load from text
                </button>
                <label className="text-sm px-3 py-1.5 bg-gray-600 text-white rounded hover:bg-gray-500 cursor-pointer flex items-center gap-1">
                  <ArrowUpTrayIcon className="w-4 h-4" />
                  Load from file
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={handleImportFromFile}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          )}
        </div>
        {importError && (
          <p className="mt-2 text-sm text-amber-200">{importError}</p>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-600">
              <th className="py-3 px-4 text-gray-300 font-medium">Sector</th>
              <th className="py-3 px-4 text-gray-300 font-medium">Target Range (min–max %)</th>
              <th className="py-3 px-4 text-gray-300 font-medium">Key Rationale</th>
              {canEditSectorTargets && <th className="py-3 px-4 text-gray-300 font-medium w-20">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rowsToShow.map((row, index) => (
              <tr key={canEditSectorTargets ? index : row.sector} className="border-b border-gray-700 hover:bg-gray-700/50">
                <td className="py-2 px-4">
                  {canEditSectorTargets ? (
                    <input
                      type="text"
                      value={row.sector}
                      onChange={(e) => handleDraftChange(index, 'sector', e.target.value)}
                      placeholder="e.g. Healthcare"
                      className="w-full bg-gray-700 text-white border border-gray-600 rounded px-2 py-1.5 text-sm"
                    />
                  ) : (
                    <span className="font-medium text-white">{row.sector}</span>
                  )}
                </td>
                <td className="py-2 px-4">
                  {canEditSectorTargets ? (
                    <span className="flex items-center gap-1 flex-wrap">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={row.min}
                        onChange={(e) => handleDraftChange(index, 'min', e.target.value === '' ? 0 : Number(e.target.value))}
                        className="w-16 bg-gray-700 text-white border border-gray-600 rounded px-2 py-1.5 text-sm"
                      />
                      <span className="text-gray-400">–</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={row.max}
                        onChange={(e) => handleDraftChange(index, 'max', e.target.value === '' ? 0 : Number(e.target.value))}
                        className="w-16 bg-gray-700 text-white border border-gray-600 rounded px-2 py-1.5 text-sm"
                      />
                      <span className="text-gray-400 text-xs">%</span>
                    </span>
                  ) : (
                    <span className="text-gray-300">
                      {row.min === row.max ? `${row.min}%` : `${row.min}–${row.max}%`}
                    </span>
                  )}
                </td>
                <td className="py-2 px-4">
                  {canEditSectorTargets ? (
                    <input
                      type="text"
                      value={row.rationale ?? ''}
                      onChange={(e) => handleDraftChange(index, 'rationale', e.target.value)}
                      placeholder="Rationale"
                      className="w-full bg-gray-700 text-white border border-gray-600 rounded px-2 py-1.5 text-sm"
                    />
                  ) : (
                    <span className="text-gray-400 text-sm">{row.rationale}</span>
                  )}
                </td>
                {canEditSectorTargets && (
                  <td className="py-2 px-4">
                    <button
                      type="button"
                      onClick={() => handleDeleteRow(index)}
                      disabled={draftRows.length <= 1}
                      title={draftRows.length <= 1 ? 'Keep at least one row' : 'Delete row'}
                      className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'username' | 'password' | 'portfolio' | 'columns' | 'sector-targets'>('username');
  const [currentUser, setCurrentUser] = useState<{ username: string } | null>(null);

  // Elementary RBAC: only admin can edit sector targets (view allowed for all authenticated users)
  const adminUsername = typeof process.env.NEXT_PUBLIC_ADMIN_USERNAME === 'string' ? process.env.NEXT_PUBLIC_ADMIN_USERNAME : 'admin';
  const canEditSectorTargets = currentUser?.username === adminUsername;
  
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
  const { 
    columnSettings: hookColumnSettings, 
    saveSettings: hookSaveSettings,
    isLoading: columnsLoading,
    saveStatus,
    saveError
  } = useColumnSettings();
  
  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }
    fetchCurrentUser();
    fetchPortfolioSettings();
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

  const handleColumnSettingsChange = useCallback((columns: ColumnConfig[]) => {
    hookSaveSettings(columns);
  }, [hookSaveSettings]);

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
          <button
            onClick={() => setActiveTab('sector-targets')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'sector-targets'
                ? 'text-primary-400 border-b-2 border-primary-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Sector Targets
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

        {/* Sector Targets Tab */}
        {activeTab === 'sector-targets' && (
          <SectorTargetsTabContent canEditSectorTargets={canEditSectorTargets} />
        )}

        {/* Column Settings Tab */}
        {activeTab === 'columns' && (
          <div>
            {saveStatus === 'error' && saveError && (
              <div className="bg-red-900 bg-opacity-50 border border-red-700 text-red-200 px-4 py-3 rounded-lg mb-4">
                {saveError}
              </div>
            )}
            {saveStatus === 'success' && (
              <div className="bg-green-900 bg-opacity-50 border border-green-700 text-green-200 px-4 py-3 rounded-lg mb-4">
                Column settings saved successfully!
              </div>
            )}
            {saveStatus === 'saving' && (
              <div className="bg-blue-900 bg-opacity-30 border border-blue-700 text-blue-200 px-4 py-3 rounded-lg mb-4 flex items-center">
                 <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-200 mr-3"></div>
                 Saving changes...
              </div>
            )}

            {columnsLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto mb-4"></div>
                <p className="text-gray-400">Loading settings...</p>
              </div>
            ) : (
              <ColumnSettings
                onSettingsChange={handleColumnSettingsChange}
                initialColumns={hookColumnSettings}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}

