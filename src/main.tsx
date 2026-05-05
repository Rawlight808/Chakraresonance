import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import './index.css'
import App from './App.tsx'
import { applyNativeChrome } from './lib/native'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element not found')

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Apply native-only chrome (status bar style, etc.) on app boot. No-ops on
// the web build, so this is safe to call unconditionally.
applyNativeChrome()

// The PWA service worker is only useful for the public web build. Inside
// the Capacitor WebView the bundle is loaded from capacitor://localhost,
// so SW caching can pin stale assets across app updates and serve the
// wrong index.html after a TestFlight push. Skip registration on native.
if ('serviceWorker' in navigator && !Capacitor.isNativePlatform()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
  })
}
