import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { FarmProvider } from './context/FarmContext'
import { ThemeProvider } from './context/ThemeContext'
import EntryPage from './pages/EntryPage'
import HomePage from './pages/HomePage'
import LotDetailPage from './pages/LotDetailPage'

export default function App() {
  return (
    <ThemeProvider>
      <FarmProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/entrada" element={<EntryPage />} />
              <Route path="/cepas/lote/:lotId" element={<LotDetailPage />} />
              <Route path="/engorde/:lotId" element={<LotDetailPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </FarmProvider>
    </ThemeProvider>
  )
}
