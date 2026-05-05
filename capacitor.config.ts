import type { CapacitorConfig } from '@capacitor/cli';

// iOS WebView wrapper for the existing Vite/React app. The web build is copied
// into ios/App/App/public on `npx cap sync` and served from there at runtime.
//
// Phase 1 goals:
//   1. Boot the app in the iOS Simulator with the same UI as the web build.
//   2. Avoid the default white flash before React mounts (app theme is #12101f).
//   3. Render under the status bar so the chakra background fills the screen
//      (we'll add explicit safe-area handling in Phase 3).
const config: CapacitorConfig = {
  appId: 'com.chakraresonance.app',
  appName: 'Chakra Resonance',
  webDir: 'dist',
  ios: {
    // Match the marketing dark theme so the WebView host view doesn't flash
    // white during the brief moment before the bundled HTML renders.
    backgroundColor: '#12101f',
    // Let the web app paint into the safe area; React handles its own layout
    // for notches via env(safe-area-inset-*).
    contentInset: 'never',
  },
};

export default config;
