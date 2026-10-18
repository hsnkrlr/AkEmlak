import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import Detail from './pages/Detail';

// Yönetim paneli ayrı bir parça olarak yüklenir; ziyaretçilerin indirdiği koda dahil olmaz.
const AdminApp = lazy(() => import('./pages/admin/AdminApp'));

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/detay/:slug" element={<Detail />} />
      <Route
        path="/admin/*"
        element={
          <Suspense fallback={null}>
            <AdminApp />
          </Suspense>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
