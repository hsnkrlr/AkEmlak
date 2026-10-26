import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <p style={{ padding: 24, fontFamily: 'system-ui' }}>Yükleniyor…</p>
  </StrictMode>,
);
