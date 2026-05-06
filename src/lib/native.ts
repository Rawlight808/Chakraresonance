/**
 * Native-shell helpers for the Capacitor iOS / Android build.
 *
 * The web build is the default, so every export here is a no-op on the web
 * (Capacitor.isNativePlatform() returns false). Code in src/ can import
 * these freely without branching — the helper does the right thing in
 * both contexts.
 *
 * What lives here:
 *   - applyNativeChrome(): one-shot setup that runs on app boot. Sets the
 *     iOS status bar to Light style (white text) since the entire UI is
 *     dark, and matches the system bar background to the app theme.
 *   - setStatusBarVisible(visible): used by ChakraJourney to hide the
 *     status bar when the screensaver enters fullscreen, and restore it
 *     on close. Keeping this here (rather than inline in the component)
 *     means future native polish (haptics, share, etc.) lives next to it.
 */
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'

const isNative = (): boolean => {
  try {
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}

export async function applyNativeChrome(): Promise<void> {
  if (!isNative()) return
  try {
    // Light = white foreground content, intended for dark backgrounds.
    // The whole app is #12101f-based so this is correct everywhere except
    // the (transient) screensaver, which we hide entirely.
    await StatusBar.setStyle({ style: Style.Light })
    // setBackgroundColor only takes effect on Android — iOS draws the
    // status bar over the app content. Calling it on iOS is harmless.
    await StatusBar.setBackgroundColor({ color: '#12101f' })
  } catch (err) {
    console.warn('[native] applyNativeChrome failed', err)
  }
}

export async function setStatusBarVisible(visible: boolean): Promise<void> {
  if (!isNative()) return
  try {
    if (visible) {
      await StatusBar.show()
    } else {
      await StatusBar.hide()
    }
  } catch (err) {
    console.warn('[native] setStatusBarVisible failed', err)
  }
}

/**
 * Light tap — for selection events (changing a song, toggling loop, etc.).
 * Maps to UIImpactFeedbackGenerator(.light) on iOS, a short Vibrator pulse
 * on Android, and a no-op everywhere else.
 */
export async function hapticTap(): Promise<void> {
  if (!isNative()) return
  try {
    await Haptics.impact({ style: ImpactStyle.Light })
  } catch {
    // Haptic engine unavailable (older device, low-power mode) — silent.
  }
}

/**
 * Success notification — used when a meaningful action completes
 * (share link copied, journey finished). Maps to
 * UINotificationFeedbackGenerator(.success) on iOS — a distinctive
 * tap-tap pattern that tells the user something landed.
 */
export async function hapticSuccess(): Promise<void> {
  if (!isNative()) return
  try {
    await Haptics.notification({ type: NotificationType.Success })
  } catch {
    // See hapticTap() — silent fallback.
  }
}
