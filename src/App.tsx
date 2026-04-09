import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { LandingPage } from './pages/LandingPage'
import { LearnPage } from './pages/LearnPage'
import { JourneyPage } from './pages/JourneyPage'
import { NotFoundPage } from './pages/NotFoundPage'
import './App.css'

function AnimatedRoutes() {
  const location = useLocation()

  return (
    <div key={location.pathname} className="page-transition">
      <Routes location={location}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/learn" element={<LearnPage />} />
        <Route path="/journey" element={<JourneyPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AnimatedRoutes />
    </BrowserRouter>
  )
}

export default App
