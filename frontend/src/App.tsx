import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { RequireAuth, RequireRole } from './auth/guards'
import { NotificationProvider } from './notifications/NotificationProvider'
import DashboardPage from './pages/DashboardPage'
import ExportPage from './pages/ExportPage'
import ForecastingPage from './pages/ForecastingPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import MaintenancePage from './pages/maintenance/MaintenancePage'
import MonitoringEnergy from './pages/maintenance/MonitoringEnergy'
import LoginPage from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'
import ProfilePage from './pages/ProfilePage'
import SettingsPage from './pages/SettingsPage'
import RegisterPage from './pages/RegisterPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import SupportPage from './pages/SupportPage'
import UsersPage from './pages/UsersPage'
import VerifyEmailPage from './pages/VerifyEmailPage'


export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/daftar" element={<RegisterPage />} />
          <Route path="/verifikasi-email" element={<VerifyEmailPage />} />
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
                  <ForecastingPage />
                </RequireRole>
              }
            />
            <Route
              path="ekspor"
              element={
                <RequireRole feature="ekspor">
                  <ExportPage />
                </RequireRole>
              }
            />
            <Route
              path="pengaturan"
              element={
                <RequireRole feature="pengaturan">
                  <SettingsPage />
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
