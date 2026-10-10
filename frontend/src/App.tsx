import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { RequireAuth, RequireRole } from './auth/guards'
import DashboardPage from './pages/DashboardPage'
import LoginPage from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'
import PlaceholderPage from './pages/PlaceholderPage'
import ProfilePage from './pages/ProfilePage'

/**
 * Peta halaman aplikasi. Hak akses per role diatur di src/lib/features.ts.
 * Saat halaman asli sudah jadi, ganti <PlaceholderPage feature="..." /> dengan halamannya,
 * misalnya <MonitoringPage />. Bungkus <RequireRole> jangan dihapus.
 */
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<RequireAuth />}>
            <Route index element={<DashboardPage />} />
            <Route path="profil" element={<ProfilePage />} />

            <Route
              path="monitoring"
              element={
                <RequireRole feature="monitoring">
                  <PlaceholderPage feature="monitoring" />
                </RequireRole>
              }
            />
            <Route
              path="forecasting"
              element={
                <RequireRole feature="forecasting">
                  <PlaceholderPage feature="forecasting" />
                </RequireRole>
              }
            />
            <Route
              path="ekspor"
              element={
                <RequireRole feature="ekspor">
                  <PlaceholderPage feature="ekspor" />
                </RequireRole>
              }
            />
            <Route
              path="pengaturan"
              element={
                <RequireRole feature="pengaturan">
                  <PlaceholderPage feature="pengaturan" />
                </RequireRole>
              }
            />
            <Route
              path="maintenance"
              element={
                <RequireRole feature="maintenance">
                  <PlaceholderPage feature="maintenance" />
                </RequireRole>
              }
            />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
