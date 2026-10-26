/** Sunucunun Türkçe hata mesajını gösterilecek hâle getirir; bağlantı sorunlarını anlaşılır biçimde anlatır. */
export function hataMetni(e: unknown): string {
  const { code = '', message = '' } = (e ?? {}) as { code?: string; message?: string };
  // Firebase SDK mesajın sonuna HTTP durum kodunu ekler: "… [400]"
  const temiz = message.replace(/\s*\[\d{3}\]$/, '').trim();
  if (!temiz || temiz === 'internal' || code === 'functions/deadline-exceeded' || /fetch|network|deadline/i.test(temiz)) {
    return 'Bağlantı kurulamadı. İnternetinizi kontrol edip tekrar deneyin.';
  }
  return temiz;
}
