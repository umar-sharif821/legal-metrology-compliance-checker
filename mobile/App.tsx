import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

import { DEMO_PACK } from './src/rulepack/pack';

/**
 * Placeholder shell for phase D-0.
 *
 * Its only job is to prove the rule pack compiles on the device: if `pack.ts` throws
 * on a malformed pack, it throws here, at startup, in front of a person — rather than
 * halfway through a scan. The camera screen arrives in D-1.
 */
export default function App() {
  const m = DEMO_PACK.metadata;
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Text style={styles.title}>LM Scan</Text>
      <Text style={styles.sub}>{m.statuteLong}</Text>
      <Text style={styles.meta}>
        rule pack {m.packId} v{m.packVersion} · {DEMO_PACK.fields.length} declarations ·{' '}
        {DEMO_PACK.declarations.length} checks
      </Text>
      <Text style={styles.warn}>{m.provenanceStatus} — findings are advisory only</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1220',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: { color: '#F8FAFC', fontSize: 34, fontWeight: '700' },
  sub: { color: '#94A3B8', fontSize: 14, marginTop: 8, textAlign: 'center' },
  meta: { color: '#64748B', fontSize: 12, marginTop: 20, textAlign: 'center' },
  warn: { color: '#FBBF24', fontSize: 12, marginTop: 12, textAlign: 'center' },
});
