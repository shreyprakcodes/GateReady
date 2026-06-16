"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { TsaWaitData } from "@/app/api/tsa/route";

export type TsaLoadState = "loading" | "live" | "historical" | "error";

export interface UseTsaWaitTimeResult {
  data: TsaWaitData | null;
  loadState: TsaLoadState;
  fetching: boolean;
  error: string | null;
  secondsAgo: number;
  refresh: () => void;
}

export function useTsaWaitTime(airportCode: string | null): UseTsaWaitTimeResult {
  const [data, setData]             = useState<TsaWaitData | null>(null);
  const [loadState, setLoadState]   = useState<TsaLoadState>("loading");
  const [fetching, setFetching]     = useState(!!airportCode);
  const [error, setError]           = useState<string | null>(null);
  const [secondsAgo, setSecondsAgo] = useState(0);

  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    if (!airportCode) { setFetching(false); return; }
    setFetching(true);
    setError(null);
    try {
      const res = await fetch(`/api/tsa?airport=${encodeURIComponent(airportCode)}`);
      const json: TsaWaitData = await res.json();
      if ((json as { error?: string }).error) {
        throw new Error((json as { error?: string }).error!);
      }
      setData(json);
      setLoadState(json.source as TsaLoadState);
      setSecondsAgo(0);
      // Restart the per-second ticker
      if (tickerRef.current) clearInterval(tickerRef.current);
      tickerRef.current = setInterval(() => setSecondsAgo((s) => s + 1), 1_000);
    } catch (e) {
      setError((e as Error).message);
      setLoadState("error");
    } finally {
      setFetching(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [airportCode]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60_000);
    return () => {
      clearInterval(interval);
      if (tickerRef.current) clearInterval(tickerRef.current);
    };
  }, [fetchData]);

  return { data, loadState, fetching, error, secondsAgo, refresh: fetchData };
}
