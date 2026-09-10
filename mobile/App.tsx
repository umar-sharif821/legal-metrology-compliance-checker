import { StatusBar } from 'expo-status-bar';
import { StatusBar as RNStatusBar, StyleSheet, Text, View } from 'react-native';

import ScanScreen from './src/camera/ScanScreen';
import { DEMO_PACK } from './src/rulepack/pack';

/**
 * App shell.
 *
 * The `DEMO_PACK` import is load-bearing beyond the banner it renders: `pack.ts` compiles
 * and validates the pack at module scope, so a malformed pack throws here, at startup, in
 * front of a person — rather than halfway through a scan.
 *
 * The banner itself is P9 in one line. The pack is unreviewed, so nothing this app says
 * is more than advisory, and the screen says so continuously rather than in a disclaimer
 * someone has to go looking for.
 *
 * The inset is taken from `StatusBar.currentHeight` rather than a safe-area provider:
 * Android 15 forces edge-to-edge, so the banner would otherwise sit under the status bar,
 * and `react-native-safe-area-context` is a native dependency that would cost a full
 * Gradle rebuild mid-demo for a single number this platform already exposes to JS.
 */
export default function App() {
  const meta = DEMO_PACK.metadata;
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View style={[styles.banner, { paddingTop: RNStatusBar.currentHeight ?? 0 }]}>
        <Text style={styles.bannerText} numberOfLines={1}>
          {meta.packId} v{meta.packVersion} · {meta.provenanceStatus} — advisory only
        </Text>
      </View>
      <View style={styles.scan}>
        <ScanScreen />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B1220' },
  banner: { backgroundColor: '#1E293B' },
  bannerText: {
    color: '#FBBF24',
    fontSize: 11,
    textAlign: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  scan: { flex: 1 },
});
