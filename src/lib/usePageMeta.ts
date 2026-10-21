import { useEffect } from 'react';
import { SITE } from '../config';

/**
 * Canonical alan adı: config'teki siteUrl; yoksa derlemede statik sayfaya yazılan canonical'ın alan adı
 * (önizleme adreslerinden girilse bile asıl alan adı kullanılır); o da yoksa tarayıcıdaki alan adı.
 */
function canonicalOrigin(existing: HTMLLinkElement | null): string {
  const configured: string = SITE.siteUrl;
  if (configured) return configured.replace(/\/+$/, '');
  try {
    if (existing?.href) return new URL(existing.href).origin;
  } catch {
    /* geçersiz adres */
  }
  return window.location.origin;
}

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

/**
 * Sayfa içinde gezinirken başlık, açıklama, canonical ve paylaşım etiketlerini günceller.
 * (Doğrudan açılan sayfalarda bu etiketler derlemede üretilen statik HTML'de zaten bulunur.)
 */
export function usePageMeta(title: string, description?: string) {
  useEffect(() => {
    const url = canonicalOrigin(document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')) + window.location.pathname;
    document.title = title;
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:url', url);
    if (description) {
      setMeta('name', 'description', description);
      setMeta('property', 'og:description', description);
    }
    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = url;
  }, [title, description]);
}
