import type { CapacitorConfig } from '@capacitor/cli';

// Native shell config for the Vite/React app. The web build is copied into
//   ios/App/App/public               (iOS WKWebView)
//   android/app/src/main/assets/public  (Android WebView)
// on every `npx cap sync` so both platforms ship the exact same dist/.
//
// Per-platform options below are kept symmetric where possible so the boot
// experience matches: dark background to avoid a white flash before React
// mounts, content drawn edge-to-edge with the web app handling safe-area
// insets via env(safe-area-inset-*).
const config: CapacitorConfig = {
  appId: 'com.chakraresonance.app',
  appName: 'Chakra Resonance',
  webDir: 'dist',
  ios: {
    backgroundColor: '#12101f',
    // Let the web app paint into the safe area; React handles its own layout
    // for notches via env(safe-area-inset-*).
    contentInset: 'never',
  },
  android: {
    // Same dark backdrop as iOS — Android paints this behind the WebView
    // during the brief launch window, and again during cold-start before
    // index.html is parsed. Matches the marketing theme so users never see
    // a flash of white.
    backgroundColor: '#12101f',
  },
};

export default config;
