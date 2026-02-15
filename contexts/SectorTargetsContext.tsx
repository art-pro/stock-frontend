'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useSectorTargets } from '@/hooks/useSectorTargets';
import type { SectorTargetTableRow } from '@/lib/sectorTargets';
import type { SectorTargetPct } from '@/hooks/useSectorTargets';

export type SectorTargetsContextValue = {
  tableRows: SectorTargetTableRow[];
  equityRows: SectorTargetTableRow[];
  cashTarget: { min: number; max: number };
  targetPctBySector: SectorTargetPct;
  load: () => Promise<void>;
  save: (rows: SectorTargetTableRow[]) => Promise<void>;
  isLoading: boolean;
  saveStatus: 'idle' | 'saving' | 'success' | 'error';
  saveError: string | null;
};

const SectorTargetsContext = createContext<SectorTargetsContextValue | null>(null);

export function SectorTargetsProvider({ children }: { children: ReactNode }) {
  const value = useSectorTargets();
  return (
    <SectorTargetsContext.Provider value={value}>
      {children}
    </SectorTargetsContext.Provider>
  );
}

export function useSectorTargetsContext(): SectorTargetsContextValue {
  const ctx = useContext(SectorTargetsContext);
  if (!ctx) {
    throw new Error('useSectorTargetsContext must be used within SectorTargetsProvider');
  }
  return ctx;
}
