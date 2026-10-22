import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { RequireAuth, RequireRole } from './auth/guards'
import { NotificationProvider } from './notifications/NotificationProvider'
import DashboardPage from './pages/DashboardPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import MaintenancePage from './pages/maintenance/MaintenancePage'
import MonitoringEnergy from './pages/maintenance/MonitoringEnergy'
import LoginPage from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'
import PlaceholderPage from './pages/PlaceholderPage'
import ProfilePage from './pages/ProfilePage'
import RegisterPage from './pages/RegisterPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import SupportPage from './pages/SupportPage'
import UsersPage from './pages/UsersPage'

/**...
 * Peta halaman aplikasi. Hak akses per role diatur di src/lib/features.ts..
 * Saat halaman asli sudah jadi, ganti <PlaceholderPage feature="..." /> dengan halamannya,
 * misalnya <MonitoringPage />. Bungkus <RequireRole> jangan dihapus.
 */
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/daftar" element={<RegisterPage />} />
          <Route path="/lupa-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/bantuan" element={<SupportPage />} />

          <Route element={<RequireAuth />}>
            <Route index element={<DashboardPage />} />
            <Route path="profil" element={<ProfilePage />} />

            <Route
              path="monitoring"
              element={
                <RequireRole feature="monitoring">
                  <MonitoringEnergy />
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
              path="pengguna"
              element={
                <RequireRole feature="pengguna">
                  <UsersPage />
                </RequireRole>
              }
            />
            <Route
              path="maintenance"
              element={
                <RequireRole feature="maintenance">
                  <MaintenancePage />
                </RequireRole>
              }
            />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
