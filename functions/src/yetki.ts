/**
 * Yönetim yetkisi: Google ile giriş yapılmış, e-postası doğrulanmış ve Firestore'da
 * `yetkililer/{eposta}` kaydı olan kullanıcı. Firestore/Storage kurallarındaki koşulla aynıdır.
 */
export async function yetkiliMi(
  auth: { token: Record<string, unknown> } | undefined,
  varMi: (email: string) => Promise<boolean>,
): Promise<string | null> {
  const t = auth?.token;
  if (!t) return null;
  const firebase = t.firebase as { sign_in_provider?: unknown } | undefined;
  if (firebase?.sign_in_provider !== 'google.com' || t.email_verified !== true) return null;
  const email = typeof t.email === 'string' ? t.email : '';
  if (!email) return null;
  return (await varMi(email)) ? email : null;
}
