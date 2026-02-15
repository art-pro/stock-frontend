'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { settingsAPI, SectorTargetRow } from '@/lib/api';
import {
  SECTOR_TARGET_TABLE,
  CASH_TARGET_ROW,
  type SectorTargetTableRow,
} from '@/lib/sectorTargets';
import { isAuthenticated } from '@/lib/auth';

export type SectorTargetPct = Record<string, { min: number; max: number }>;

const defaultTableRows: SectorTargetTableRow[] = [
  ...SECTOR_TARGET_TABLE,
  CASH_TARGET_ROW,
];

function rowsToTargetPct(rows: SectorTargetTableRow[]): SectorTargetPct {
  const out: SectorTargetPct = {};
  for (const row of rows) {
    if (row.sector.toLowerCase() === 'cash') continue;
    out[row.sector] = { min: row.min, max: row.max };
  }
  return out;
}

export function useSectorTargets() {
  const [tableRows, setTableRows] = useState<SectorTargetTableRow[]>(defaultTableRows);
  const [isLoading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  const load = useCallback(async () => {
    if (!isAuthenticated()) {
      setTableRows(defaultTableRows);
      setLoading(false);
      return;
    }
    try {
      const res = await settingsAPI.getSectorTargets();
      const rows = res.data?.rows;
      if (Array.isArray(rows) && rows.length > 0) {
        const mapped: SectorTargetTableRow[] = rows.map((r: SectorTargetRow) => ({
          sector: r.sector,
          min: r.min,
          max: r.max,
          rationale: r.rationale ?? '',
        }));
        if (isMountedRef.current) setTableRows(mapped);
      }
      // else keep defaults
    } catch (err) {
      console.warn('Failed to load sector targets, using defaults', err);
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    load();
    return () => {
      isMountedRef.current = false;
    };
  }, [load]);

  const save = useCallback(async (rows: SectorTargetTableRow[]) => {
    setSaveStatus('saving');
    setSaveError(null);
    try {
      await settingsAPI.saveSectorTargets({
        rows: rows.map((r) => ({ sector: r.sector, min: r.min, max: r.max, rationale: r.rationale })),
      });
      if (isMountedRef.current) {
        setTableRows(rows);
        setSaveStatus('success');
      }
      await load();
    } catch (err: unknown) {
      const message = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
        : 'Failed to save';
      if (isMountedRef.current) {
        setSaveError(message || 'Failed to save sector targets');
        setSaveStatus('error');
      }
    }
  }, [load]);

  const targetPctBySector = rowsToTargetPct(tableRows);
  const cashTarget = tableRows.find((r) => r.sector.toLowerCase() === 'cash');
  const equityRows = tableRows.filter((r) => r.sector.toLowerCase() !== 'cash');

  return {
    tableRows,
    equityRows,
    cashTarget: cashTarget ? { min: cashTarget.min, max: cashTarget.max } : { min: 8, max: 12 },
    targetPctBySector,
    load,
    save,
    isLoading,
    saveStatus,
    saveError,
  };
}
