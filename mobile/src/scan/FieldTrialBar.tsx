/**
 * The field-trial control — phase `D-3` only.
 *
 * Names the packet in front of the camera and writes the judged image's record to disk
 * (`record.ts`). Since `C-0` that image may be a full-quality still or a photo picked
 * from the gallery; the bar does not care which, and the record carries `source` so the
 * corpus can tell them apart later.
 *
 * Deliberately its own file and its own strip of screen, so that when `D-5` decides the
 * pitch should not show a debug control, removing it is deleting one import and one
 * element rather than untangling it from the verdict screen.
 *
 * The name field is not optional-with-a-default on purpose. A corpus of ten files called
 * `packet-1` … `packet-10` is not a corpus anybody can tune against a week later; the
 * three seconds of typing buys the record its only human-readable index.
 */
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { JudgedCapture } from '../camera/capture';
import type { Verdict } from '../verdict/types';
import { recordCapture, recordCount } from './record';
import type { ExtractionResult } from './types';

interface Props {
  readonly capture: JudgedCapture;
  readonly extraction: ExtractionResult;
  readonly verdict: Verdict;
}

type Outcome =
  | { readonly kind: 'idle' }
  | { readonly kind: 'saved'; readonly message: string }
  | { readonly kind: 'failed'; readonly message: string };

export default function FieldTrialBar({ capture, extraction, verdict }: Props) {
  const [packet, setPacket] = useState('');
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'idle' });
  /** Counted once per mount — one judged image yields one record, so it cannot drift. */
  const [alreadyHeld] = useState(recordCount);

  const onRecord = useCallback(() => {
    const name = packet.trim();
    if (name.length === 0) {
      setOutcome({ kind: 'failed', message: 'Name the packet first.' });
      return;
    }
    try {
      const saved = recordCapture({
        packet: name,
        captureUri: capture.uri,
        captureMs: capture.captureMs,
        source: capture.source,
        frame: capture.frame,
        extraction,
        verdict,
      });
      setOutcome({
        kind: 'saved',
        message: `Saved ${saved.jsonName} + ${saved.imageName} · ${saved.seq} of 10`,
      });
    } catch (caught) {
      // Surfaced, never swallowed. A trial that silently records nine of ten packets is
      // discovered at the laptop, with the packets already back on the shelf (P9).
      setOutcome({
        kind: 'failed',
        message: caught instanceof Error ? caught.message : String(caught),
      });
    }
  }, [capture, extraction, packet, verdict]);

  const saved = outcome.kind === 'saved';

  return (
    <View style={styles.root}>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          value={packet}
          onChangeText={setPacket}
          placeholder="Packet name — brand and product"
          placeholderTextColor="#64748B"
          autoCapitalize="words"
          autoCorrect={false}
          editable={!saved}
          returnKeyType="done"
          onSubmitEditing={onRecord}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Record this image to the field-trial corpus"
          style={[styles.button, saved && styles.buttonDone]}
          disabled={saved}
          onPress={onRecord}
        >
          <Text style={[styles.buttonText, saved && styles.buttonTextDone]}>
            {saved ? 'Recorded' : 'Record'}
          </Text>
        </Pressable>
      </View>

      {outcome.kind === 'idle' ? (
        <Text style={styles.note}>
          D-3 field trial · {alreadyHeld} packet{alreadyHeld === 1 ? '' : 's'} recorded on this
          device
        </Text>
      ) : (
        <Text style={outcome.kind === 'failed' ? styles.failed : styles.note}>
          {outcome.message}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    backgroundColor: '#0E1729',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1,
    color: '#E2E8F0',
    fontSize: 13,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#243449',
    backgroundColor: '#0B1220',
  },
  button: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: '#38BDF8',
  },
  buttonDone: { backgroundColor: '#1E3A52' },
  buttonText: { color: '#0B1220', fontSize: 13, fontWeight: '700' },
  buttonTextDone: { color: '#7DD3FC' },
  note: { color: '#64748B', fontSize: 11, marginTop: 6 },
  failed: { color: '#FCA5A5', fontSize: 11, marginTop: 6 },
});
