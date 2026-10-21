// Tek sayfa uygulaması: /detay/... adresleri doğrudan açıldığında da
// index.html sunulabilsin diye (GitHub Pages vb.) 404.html kopyası oluşturulur.
import { copyFile } from 'node:fs/promises';
await copyFile('dist/index.html', 'dist/404.html');
console.log('✓ dist/404.html oluşturuldu');
