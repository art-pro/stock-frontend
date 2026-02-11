import { act, renderHook, waitFor } from '@testing-library/react';
import { DEFAULT_COLUMNS } from '@/components/ColumnSettings';
import { useColumnSettings } from './useColumnSettings';

jest.mock('@/lib/api', () => ({
  settingsAPI: {
    getColumnSettings: jest.fn(),
    saveColumnSettings: jest.fn(),
  },
}));

jest.mock('@/lib/auth', () => ({
  isAuthenticated: jest.fn(),
}));

import { settingsAPI } from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';

const mockedSettingsAPI = settingsAPI as jest.Mocked<typeof settingsAPI>;
const mockedIsAuthenticated = isAuthenticated as jest.MockedFunction<typeof isAuthenticated>;

describe('column settings subsystem', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    jest.useRealTimers();
  });

  it('loads settings from localStorage when user is not authenticated', async () => {
    mockedIsAuthenticated.mockReturnValue(false);

    const stored = DEFAULT_COLUMNS.map((col) =>
      col.id === 'sector' ? { ...col, visible: false } : col
    );
    localStorage.setItem('stock-table-columns', JSON.stringify(stored));

    const { result } = renderHook(() => useColumnSettings());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const sector = result.current.columnSettings.find((c) => c.id === 'sector');
    expect(sector?.visible).toBe(false);
    expect(mockedSettingsAPI.getColumnSettings).not.toHaveBeenCalled();
  });

  it('loads settings from API when user is authenticated', async () => {
    mockedIsAuthenticated.mockReturnValue(true);

    const apiColumns = DEFAULT_COLUMNS.map((col) =>
      col.id === 'beta' ? { ...col, visible: false } : col
    );

    mockedSettingsAPI.getColumnSettings.mockResolvedValue({
      data: { settings: JSON.stringify(apiColumns) },
    } as any);

    const { result } = renderHook(() => useColumnSettings());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockedSettingsAPI.getColumnSettings).toHaveBeenCalledTimes(1);
    const beta = result.current.columnSettings.find((c) => c.id === 'beta');
    expect(beta?.visible).toBe(false);
  });

  it('persists updates with debounce when authenticated', async () => {
    jest.useFakeTimers();
    mockedIsAuthenticated.mockReturnValue(true);
    mockedSettingsAPI.getColumnSettings.mockResolvedValue({
      data: { settings: '' },
    } as any);
    mockedSettingsAPI.saveColumnSettings.mockResolvedValue({ data: {} } as any);

    const { result } = renderHook(() => useColumnSettings());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const updatedColumns = result.current.columnSettings.map((col) =>
      col.id === 'expected_value' ? { ...col, visible: false } : col
    );

    await act(async () => {
      result.current.saveSettings(updatedColumns);
    });

    expect(localStorage.getItem('stock-table-columns')).toContain('"expected_value"');

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => expect(mockedSettingsAPI.saveColumnSettings).toHaveBeenCalledTimes(1));
  });
});
