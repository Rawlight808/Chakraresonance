import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { LandingPage } from './pages/LandingPage'
import { LearnPage } from './pages/LearnPage'
import { JourneyPage } from './pages/JourneyPage'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/learn" element={<LearnPage />} />
        <Route path="/journey" element={<JourneyPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
