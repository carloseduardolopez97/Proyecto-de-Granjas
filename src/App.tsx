import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { CepaProvider } from './context/CepaContext'
import { FeedProvider } from './context/FeedContext'
import { PharmacyProvider } from './context/PharmacyContext'
import { ThemeProvider } from './context/ThemeContext'
import CepaPage from './pages/CepaPage'
import EngordePage from './pages/EngordePage'
import FeedPage from './pages/FeedPage'
import PharmacyPage from './pages/PharmacyPage'
import SettingsPage from './pages/SettingsPage'

export default function App() {
  return (
    <ThemeProvider>
      <PharmacyProvider>
        <FeedProvider>
          <CepaProvider>
            <BrowserRouter>
              <Routes>
                <Route element={<Layout />}>
                  <Route path="/" element={<PharmacyPage />} />
                  <Route path="/cepa" element={<CepaPage />} />
                  <Route path="/engorde" element={<EngordePage />} />
                  <Route path="/alimento" element={<FeedPage />} />
                  <Route path="/ajustes" element={<SettingsPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </CepaProvider>
        </FeedProvider>
      </PharmacyProvider>
    </ThemeProvider>
  )
}
