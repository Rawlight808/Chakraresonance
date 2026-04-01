import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import './AuthPage.css'

export function AuthPage() {
  const { user, loading, signUp, signIn } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && user) return <Navigate to="/dashboard" replace />

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (mode === 'signup' && password !== confirm) {
      setError('Passwords do not match')
      return
    }

    setSubmitting(true)
    const err =
      mode === 'signup' ? await signUp(email, password) : await signIn(email, password)
    setSubmitting(false)

    if (err) setError(err)
  }

  return (
    <div className="auth">
      <div className="auth__card">
        <h1 className="auth__title">Hundred Days</h1>
        <p className="auth__subtitle">of Hundred Percent</p>

        <div className="auth__toggle">
          <button
            type="button"
            className={`auth__toggle-btn ${mode === 'signin' ? 'auth__toggle-btn--active' : ''}`}
            onClick={() => {
              setMode('signin')
              setError(null)
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`auth__toggle-btn ${mode === 'signup' ? 'auth__toggle-btn--active' : ''}`}
            onClick={() => {
              setMode('signup')
              setError(null)
            }}
          >
            Sign Up
          </button>
        </div>

        <form className="auth__form" onSubmit={handleSubmit}>
          <input
            type="email"
            className="auth__input"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <input
            type="password"
            className="auth__input"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          />
          {mode === 'signup' && (
            <input
              type="password"
              className="auth__input"
              placeholder="Confirm password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
          )}
          {error && <p className="auth__error">{error}</p>}
          <button type="submit" className="auth__submit" disabled={submitting}>
            {submitting ? '…' : mode === 'signup' ? 'Create Account' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
