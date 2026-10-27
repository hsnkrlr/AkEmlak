import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import Detail from './pages/Detail';
import Kvkk from './pages/Kvkk';
import Landing from './pages/Landing';
import { ConsentBanner } from './components/ConsentBanner';

// Başvuru formu (ve Firebase kütüphaneleri) yalnızca o sayfa açılınca yüklenir
const Apply = lazy(() => import('./pages/Apply'));

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/detay/:slug" element={<Detail />} />
        <Route
          path="/ilan-basvurusu"
          element={
            <Suspense fallback={<div className="container section" aria-busy="true" />}>
              <Apply />
            </Suspense>
          }
        />
        <Route path="/kvkk" element={<Kvkk />} />
        <Route path="/emlak/:slug" element={<Landing />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ConsentBanner />
    </>
  );
}
