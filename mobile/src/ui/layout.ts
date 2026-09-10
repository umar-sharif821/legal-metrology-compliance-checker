/**
 * Screen chrome insets.
 *
 * Android 15 forces edge-to-edge, so a bottom-anchored control is drawn *under* the
 * navigation bar unless something reserves the space — measured on the Nord 4, where the
 * button came out half-hidden behind it. The top banner takes its inset from
 * `StatusBar.currentHeight`, but the platform exposes no matching number for the bottom,
 * and `react-native-safe-area-context` was already rejected for this app: a native
 * dependency costing a full Gradle rebuild mid-demo, for one measurement.
 *
 * 48 is the height of the three-button bar and comfortably clears the gesture pill, so it
 * is safe in both modes — generous by a couple of dp under gestures, which is the right
 * way to be wrong here.
 *
 * This lives in its own module because it did not, and the second screen was missed.
 * `VerdictScreen` reserved the inset; `ScanScreen` did not, which put the lower third of
 * *Use a photo from the gallery* inside the navigation bar's touch region — a tap aimed at
 * it went to HOME. Any bottom-anchored control on any screen adds this to its offset.
 */
export const NAV_BAR_INSET = 48;
