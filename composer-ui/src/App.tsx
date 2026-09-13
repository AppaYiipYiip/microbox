import { Routes, Route } from 'react-router'
import { PageNav } from './components/PageNav'
import { TopBar } from './components/TopBar'
import { HomePage } from './pages/HomePage'
import { ComposerPage } from './pages/ComposerPage'
import { RunPipelinePage } from './pages/RunPipelinePage'
import { HistoryPage } from './pages/HistoryPage'
import './App.css'

export default function App() {
  return (
    <div className="app-shell">
      <PageNav />
      <div className="app-shell__main">
        <TopBar />
        <div className="app-shell__content">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/composer" element={<ComposerPage />} />
            <Route path="/run" element={<RunPipelinePage />} />
            <Route path="/history" element={<HistoryPage />} />
          </Routes>
        </div>
      </div>
    </div>
  )
}
