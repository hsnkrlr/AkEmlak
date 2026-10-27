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

/** Google girişi hata kodu → kullanıcıya gösterilecek metin. Kullanıcının kendi kapattığı pencere için null. */
export function girisHataMetni(code: string): string | null {
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return null;
  if (code === 'auth/unauthorized-domain') return 'Bu adres Google girişi için yetkilendirilmemiş.';
  if (code === 'auth/operation-not-allowed') return 'Google ile giriş henüz açılmamış (Firebase konsolu → Authentication).';
  if (code === 'auth/network-request-failed') return 'Bağlantı kurulamadı. İnternetinizi kontrol edin.';
  return 'Giriş yapılamadı. Lütfen tekrar deneyin.';
}
