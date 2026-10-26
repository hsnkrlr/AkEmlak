/**
 * Yeni başvuruda yetkililerin telefonlarına (FCM web push) bildirim. Şüpheli başvurular için gönderilmez.
 * Saf modül: token listesi ve gönderici dışarıdan verilir (index.ts Firestore ve getMessaging() ile bağlar).
 */
export const TYPE_LABEL: Record<string, string> = {
  daire: 'Daire',
  mustakil: 'Müstakil Ev',
  villa: 'Villa',
  arsa: 'Arsa',
  tarla: 'Tarla / Bahçe',
  isyeri: 'Dükkan / İş Yeri',
  arac: 'Araç',
  diger: 'Diğer',
};

const GECERSIZ = ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token', 'messaging/invalid-argument'];

export async function bildirimGonder(o: {
  basvuru: { id: string; number: string; status: string; listing: { type: string; district?: unknown; city?: unknown } };
  tokenlar: { ref: { delete(): Promise<unknown> }; token: string }[];
  gonder: (mesajlar: object[]) => Promise<{ responses: { success: boolean; error?: { code: string } }[] }>;
}): Promise<{ gonderilen: number; silinen: number }> {
  const { basvuru, tokenlar } = o;
  if (basvuru.status === 'supheli' || !tokenlar.length) return { gonderilen: 0, silinen: 0 };
  const yer = [basvuru.listing.district, basvuru.listing.city].find((v) => typeof v === 'string' && v.trim()) as string | undefined;
  const title = `Yeni ilan başvurusu ${basvuru.number}`;
  const body = [TYPE_LABEL[basvuru.listing.type] ?? basvuru.listing.type, yer].filter(Boolean).join(' · ');
  const link = `https://ak-emlak.vercel.app/yonetim/#/basvuru/${basvuru.id}`;
  const mesajlar = tokenlar.map((t) => ({
    token: t.token,
    notification: { title, body },
    webpush: { fcmOptions: { link }, notification: { icon: '/yonetim/icon-192.png', tag: basvuru.id } },
  }));
  const { responses } = await o.gonder(mesajlar);
  let gonderilen = 0;
  let silinen = 0;
  for (const [i, r] of responses.entries()) {
    if (r.success) gonderilen++;
    else if (r.error && GECERSIZ.includes(r.error.code)) {
      await tokenlar[i].ref.delete().catch(() => undefined);
      silinen++;
    }
  }
  return { gonderilen, silinen };
}
