import { Routes, Route } from 'react-router'
import { NavBar } from './components/NavBar'
import { ComposerPage } from './pages/ComposerPage'
import { HistoryPage } from './pages/HistoryPage'
import './App.css'

export default function App() {
  return (
    <div className="app-shell">
      <NavBar />
      <Routes>
        <Route path="/" element={<ComposerPage />} />
        <Route path="/history" element={<HistoryPage />} />
      </Routes>
    </div>
  )
}
