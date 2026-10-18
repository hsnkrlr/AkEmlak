import { useEffect, useState } from 'react';
import { sanitizeListing } from '../lib/schema';
import { verifySignedDocument } from '../security/signing';
import type { Listing, PublishedPayload } from '../types';

export type PublishedState =
  | { status: 'loading' }
  | { status: 'ok'; data: PublishedPayload }
  | { status: 'invalid' }
  | { status: 'error' };

let cache: Promise<PublishedState> | null = null;

async function fetchPublished(): Promise<PublishedState> {
  let doc: unknown;
  try {
    const res = await fetch('/data/listings.json', { cache: 'no-cache', credentials: 'omit' });
    if (!res.ok) return { status: 'error' };
    doc = await res.json();
  } catch {
    return { status: 'error' };
  }
  const payload = await verifySignedDocument(doc);
  if (!payload) return { status: 'invalid' };
  try {
    const parsed = JSON.parse(payload) as Partial<PublishedPayload>;
    const listings = (Array.isArray(parsed.listings) ? parsed.listings : [])
      .map(sanitizeListing)
      .filter((l): l is Listing => l !== null);
    return { status: 'ok', data: { version: 1, publishedAt: String(parsed.publishedAt ?? ''), listings } };
  } catch {
    return { status: 'invalid' };
  }
}

/** Yayındaki, imzası doğrulanmış ilan verisi. */
export function loadPublished(force = false): Promise<PublishedState> {
  if (force || !cache) cache = fetchPublished();
  return cache;
}

/** Müşterilere gösterilecek ilanlar (taslaklar hariç). */
export function publicListings(state: PublishedState): Listing[] {
  if (state.status !== 'ok') return [];
  return state.data.listings.filter((l) => l.status !== 'taslak');
}

export function usePublished(): PublishedState {
  const [state, setState] = useState<PublishedState>({ status: 'loading' });
  useEffect(() => {
    let alive = true;
    loadPublished().then((s) => alive && setState(s));
    return () => {
      alive = false;
    };
  }, []);
  return state;
}
