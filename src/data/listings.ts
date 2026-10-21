import { useEffect, useState } from 'react';
import { parseData } from '../lib/schema';
import type { Listing } from '../types';

export type ListingsState = { status: 'loading' } | { status: 'ok'; listings: Listing[] } | { status: 'error' };

let cache: Promise<ListingsState> | null = null;

async function fetchListings(): Promise<ListingsState> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data.json`, { cache: 'no-cache', credentials: 'omit' });
    if (!res.ok) return { status: 'error' };
    return { status: 'ok', listings: parseData(await res.json()) };
  } catch (e) {
    console.error('data.json okunamadı (yazım hatası olabilir):', e);
    return { status: 'error' };
  }
}

/** Müşterilere gösterilecek ilanlar (durumu "gizli" olanlar hariç). */
export function publicListings(state: ListingsState): Listing[] {
  return state.status === 'ok' ? state.listings.filter((l) => l.status !== 'taslak') : [];
}

export function useListings(): ListingsState {
  const [state, setState] = useState<ListingsState>({ status: 'loading' });
  useEffect(() => {
    let alive = true;
    (cache ??= fetchListings()).then((s) => alive && setState(s));
    return () => {
      alive = false;
    };
  }, []);
  return state;
}
