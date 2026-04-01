import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LandingPage } from './pages/LandingPage'
import { LearnPage } from './pages/LearnPage'
import { JourneyPage } from './pages/JourneyPage'
import { AuthPage } from './pages/AuthPage'
import { SetupPage } from './pages/SetupPage'
import { SelectPage } from './pages/SelectPage'
import { DashboardPage } from './pages/DashboardPage'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/learn" element={<LearnPage />} />
          <Route path="/journey" element={<JourneyPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route
            path="/setup"
            element={
              <ProtectedRoute>
                <SetupPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/select"
            element={
              <ProtectedRoute>
                <SelectPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
