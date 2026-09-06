import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { PharmacyProvider } from './context/PharmacyContext'
import { ThemeProvider } from './context/ThemeContext'
import PharmacyPage from './pages/PharmacyPage'

export default function App() {
  return (
    <ThemeProvider>
      <PharmacyProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<PharmacyPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </PharmacyProvider>
    </ThemeProvider>
  )
}
