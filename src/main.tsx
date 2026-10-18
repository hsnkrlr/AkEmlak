import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource-variable/inter';
import './styles.css';
import App from './App';

// Tıklama hırsızlığına (clickjacking) karşı: site başka bir sayfanın içine gömülürse çalışmaz.
if (window.top !== window.self) {
  document.documentElement.innerHTML = '';
  throw new Error('Çerçeve içinde çalıştırma engellendi.');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
