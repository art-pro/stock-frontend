import { act, renderHook, waitFor } from '@testing-library/react';
import { useSectorTargets } from './useSectorTargets';
import { SECTOR_TARGET_TABLE, CASH_TARGET_ROW } from '@/lib/sectorTargets';

jest.mock('@/lib/api', () => ({
  settingsAPI: {
    getSectorTargets: jest.fn(),
    saveSectorTargets: jest.fn(),
  },
}));

jest.mock('@/lib/auth', () => ({
  isAuthenticated: jest.fn(),
}));

import { settingsAPI } from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';

const mockedSettingsAPI = settingsAPI as jest.Mocked<typeof settingsAPI>;
const mockedIsAuthenticated = isAuthenticated as jest.MockedFunction<typeof isAuthenticated>;

const defaultRows = [...SECTOR_TARGET_TABLE, CASH_TARGET_ROW];

describe('useSectorTargets', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedIsAuthenticated.mockReturnValue(true);
  });

  it('starts with default table rows when API returns null', async () => {
    mockedSettingsAPI.getSectorTargets.mockResolvedValue({
      data: { rows: null },
    } as any);

    const { result } = renderHook(() => useSectorTargets());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.tableRows.length).toBe(defaultRows.length);
    expect(result.current.targetPctBySector['Healthcare']).toEqual({ min: 25, max: 30 });
    expect(result.current.cashTarget).toEqual({ min: 8, max: 12 });
  });

  it('uses persisted rows when API returns data', async () => {
    const persisted = [
      { sector: 'Healthcare', min: 20, max: 28, rationale: 'Custom.' },
      { sector: 'Cash', min: 10, max: 14, rationale: 'More cash.' },
    ];
    mockedSettingsAPI.getSectorTargets.mockResolvedValue({
      data: { rows: persisted },
    } as any);

    const { result } = renderHook(() => useSectorTargets());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.tableRows).toHaveLength(2);
    expect(result.current.tableRows[0].sector).toBe('Healthcare');
    expect(result.current.tableRows[0].min).toBe(20);
    expect(result.current.targetPctBySector['Healthcare']).toEqual({ min: 20, max: 28 });
    expect(result.current.cashTarget).toEqual({ min: 10, max: 14 });
  });

  it('save() calls API and reloads', async () => {
    mockedSettingsAPI.getSectorTargets.mockResolvedValue({
      data: { rows: null },
    } as any);
    mockedSettingsAPI.saveSectorTargets.mockResolvedValue({ data: { status: 'saved' } } as any);

    const { result } = renderHook(() => useSectorTargets());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const customRows = [
      { sector: 'Technology', min: 12, max: 18, rationale: 'Test' },
      { sector: 'Cash', min: 8, max: 12, rationale: 'Dry powder' },
    ];

    await act(async () => {
      result.current.save(customRows);
    });

    expect(mockedSettingsAPI.saveSectorTargets).toHaveBeenCalledWith({
      rows: customRows.map((r) => ({ sector: r.sector, min: r.min, max: r.max, rationale: r.rationale })),
    });
    await waitFor(() => expect(result.current.saveStatus).toBe('success'));
  });

  it('when not authenticated uses defaults and does not call API', async () => {
    mockedIsAuthenticated.mockReturnValue(false);

    const { result } = renderHook(() => useSectorTargets());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockedSettingsAPI.getSectorTargets).not.toHaveBeenCalled();
    expect(result.current.tableRows.length).toBe(defaultRows.length);
  });
});
