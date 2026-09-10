import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { fetchScans, type Origin } from './api';
import type { Scan } from './types';

interface Store {
  readonly scans: readonly Scan[];
  readonly loading: boolean;
  /** Where the repository came from. Surfaced on screen, never assumed. */
  readonly origin: Origin;
  readonly addScan: (scan: Scan) => void;
  readonly getScan: (id: string) => Scan | undefined;
}

const Ctx = createContext<Store | null>(null);

export function ScansProvider({ children }: { children: ReactNode }) {
  const [scans, setScans] = useState<readonly Scan[]>([]);
  const [loading, setLoading] = useState(true);
  const [origin, setOrigin] = useState<Origin>('sample');

  useEffect(() => {
    let alive = true;
    void fetchScans().then((r) => {
      if (!alive) return;
      setScans(r.data);
      setOrigin(r.origin);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  const addScan = useCallback((scan: Scan) => {
    setScans((xs) => [scan, ...xs.filter((x) => x.id !== scan.id)]);
  }, []);

  const getScan = useCallback((id: string) => scans.find((s) => s.id === id), [scans]);

  const value = useMemo<Store>(
    () => ({ scans, loading, origin, addScan, getScan }),
    [scans, loading, origin, addScan, getScan],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useScans(): Store {
  const v = useContext(Ctx);
  if (!v) throw new Error('useScans must be used inside <ScansProvider>');
  return v;
}
