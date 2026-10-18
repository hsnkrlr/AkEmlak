import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/** İçerik Güvenlik Politikası: yalnızca kendi alan adımızdan kod/görsel yüklenir. */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-src 'none'",
  "worker-src 'none'",
  "manifest-src 'self'",
].join('; ');

// Geliştirme sunucusu satır içi betik kullandığı için CSP yalnızca derlemede eklenir.
const cspPlugin = (): Plugin => ({
  name: 'akemlak-csp',
  apply: 'build',
  transformIndexHtml: (html) =>
    html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
});

export default defineConfig({
  plugins: [react(), cspPlugin()],
  build: { sourcemap: false, target: 'es2021' },
});
