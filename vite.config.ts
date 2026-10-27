import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { seoPrerender } from './scripts/seo-plugin';

// Firebase (başvuru formu): Firestore, Storage, anonim oturum, App Check (reCAPTCHA Enterprise)
const FIREBASE_CONNECT = [
  'https://firestore.googleapis.com',
  'https://firebasestorage.googleapis.com',
  'https://identitytoolkit.googleapis.com',
  'https://securetoken.googleapis.com',
  'https://firebaseappcheck.googleapis.com',
  'https://content-firebaseappcheck.googleapis.com',
  'https://www.google.com',
];
// Yalnızca emülatörle test derlemesinde (VITE_FIREBASE_EMULATOR=1) yerel emülatörlere izin verilir
const EMULATOR_CONNECT = process.env.VITE_FIREBASE_EMULATOR === '1' ? ['http://127.0.0.1:9099', 'http://127.0.0.1:8080', 'http://127.0.0.1:9199'] : [];

/** İçerik Güvenlik Politikası: kod ve bağlantılar yalnızca kendi alan adımıza ve gerekli Google hizmetlerine izinli. */
const CSP = [
  "default-src 'self'",
  "script-src 'self' https://*.googletagmanager.com https://www.google.com https://www.gstatic.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.google-analytics.com https://*.googletagmanager.com",
  "font-src 'self' data:",
  ["connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com", ...FIREBASE_CONNECT, ...EMULATOR_CONNECT].join(' '),
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  // reCAPTCHA Enterprise (App Check) görünmez bir iframe kullanır
  'frame-src https://www.google.com https://recaptcha.google.com',
  "worker-src 'self' blob:",
  "manifest-src 'self'",
].join('; ');

/**
 * Yönetim uygulaması (/yonetim) CSP'si: Analytics yok; Firebase'e ek olarak bildirim (FCM), Cloud Functions
 * ve başvuru fotoğrafları (blob:) için izin. Google girişi aynı alan adındaki /__/auth/ sayfasını iframe'de açar.
 */
const ADMIN_CSP = [
  "default-src 'self'",
  "script-src 'self' https://www.google.com https://www.gstatic.com https://apis.google.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  [
    "connect-src 'self'",
    ...FIREBASE_CONNECT,
    'https://fcmregistrations.googleapis.com',
    'https://firebaseinstallations.googleapis.com',
    'https://europe-west3-akemlak-ilan.cloudfunctions.net',
    ...EMULATOR_CONNECT,
    ...(process.env.VITE_FIREBASE_EMULATOR === '1' ? ['http://127.0.0.1:5001'] : []),
  ].join(' '),
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  // Google girişi Firebase'in kendi alan adındaki gizli iframe ile tamamlanır
  "frame-src 'self' https://akemlak-ilan.firebaseapp.com https://www.google.com https://recaptcha.google.com" + (process.env.VITE_FIREBASE_EMULATOR === '1' ? ' http://127.0.0.1:9099' : ''),
  "worker-src 'self'",
  "manifest-src 'self'",
].join('; ');

// Geliştirme sunucusu satır içi betik kullandığı için CSP yalnızca derlemede eklenir.
const cspPlugin = (): Plugin => ({
  name: 'akemlak-csp',
  apply: 'build',
  transformIndexHtml: (html, ctx) =>
    html.replace(
      '<meta charset="UTF-8" />',
      `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${ctx.path.startsWith('/yonetim/') ? ADMIN_CSP : CSP}" />`,
    ),
});

export default defineConfig({
  plugins: [react(), cspPlugin(), seoPrerender()],
  build: {
    sourcemap: false,
    target: 'es2021',
    // Yönetim uygulaması ayrı giriş noktasıdır; kodu ziyaretçi paketine girmez.
    rollupOptions: { input: { main: 'index.html', yonetim: 'yonetim/index.html' } },
  },
});
