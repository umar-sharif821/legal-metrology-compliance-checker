/**
 * Phase D-1 — the shell on the phone.
 *
 * The smallest thing that proves the device path end to end: permission, live preview,
 * one shutter, capture → ML Kit → recognised lines on screen. No extraction, no verdict,
 * no overlay; those are D-2.
 *
 * Its real job is to falsify the last unproven assumption in the stack — that the ML Kit
 * native binding works under the New Architecture on this device. So every failure is
 * rendered, in full, rather than swallowed into an empty result (P9).
 */
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { OcrFrame } from '../scan/types';
import { OCR_SCRIPT_NAME, recognise } from './ocr';

/** Enough lines to tell at a glance whether the panel was read; not a results screen. */
const LINES_SHOWN = 12;

interface Capture {
  readonly frame: OcrFrame;
  /** Shutter-to-file milliseconds, kept separate from `frame.ocrMs` (P8). */
  readonly captureMs: number;
}

/**
 * Do the box coordinates live in the same pixel frame as the reported image size?
 *
 * D-2 scales these boxes onto the preview, and that scaling is wrong — silently, and in a
 * way that looks like an OCR bug — if `skipProcessing` handed us an unrotated file whose
 * width and height are transposed relative to the coordinates ML Kit returns after it
 * honours the EXIF orientation. Printing the extent next to the image size makes the
 * mismatch visible on the day instead of in the middle of the next phase.
 *
 * Measured on the Nord 4 in D-1: extents track the reported size (4083×3070 against a
 * 4096×3072 capture), so the coordinates are already in the image's own frame and D-2
 * needs no transposition. Two things it does still need: a clamp, because one capture
 * reported a bottom of 3086 against a height of 3072 — an axis-aligned box around a
 * tilted line can overhang the edge — and a rotation, because the capture is landscape
 * while the preview is portrait.
 */
function geometrySummary(frame: OcrFrame): string {
  const boxed = frame.lines.filter((line) => line.box !== null);
  if (boxed.length === 0) return 'no geometry reported — evidence crops unavailable';
  let right = 0;
  let bottom = 0;
  for (const line of boxed) {
    if (!line.box) continue;
    right = Math.max(right, line.box.x + line.box.width);
    bottom = Math.max(bottom, line.box.y + line.box.height);
  }
  return `${boxed.length}/${frame.lines.length} boxed · extent ${Math.round(right)}×${Math.round(bottom)}`;
}

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [capture, setCapture] = useState<Capture | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onShutter = useCallback(async () => {
    const camera = cameraRef.current;
    if (!camera || busy) return;
    setBusy(true);
    setError(null);
    try {
      const startedAt = Date.now();
      // `skipProcessing` is the demo plan's route A: it skips the rotate-and-rescale
      // pipeline, which is most of the shutter latency. ML Kit reads the EXIF orientation
      // itself, so the text still comes back upright.
      const picture = await camera.takePictureAsync({
        skipProcessing: true,
        shutterSound: false,
      });
      const captureMs = Date.now() - startedAt;
      if (!picture) throw new Error('takePictureAsync resolved without a picture');
      const frame = await recognise(picture.uri, picture.width, picture.height);
      setCapture({ frame, captureMs });
    } catch (caught) {
      setCapture(null);
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }, [busy]);

  if (!permission) {
    return (
      <Centered>
        <ActivityIndicator color="#F8FAFC" />
      </Centered>
    );
  }

  if (!permission.granted) {
    return (
      <Centered>
        <Text style={styles.title}>Camera access</Text>
        <Text style={styles.body}>
          LM Scan reads the printed declarations on a package label. Images stay on the device and
          the app makes no network requests.
        </Text>
        {permission.canAskAgain ? (
          <Pressable style={styles.button} onPress={() => void requestPermission()}>
            <Text style={styles.buttonText}>Allow camera</Text>
          </Pressable>
        ) : (
          <Text style={styles.warn}>
            Permission was denied permanently. Grant it in Settings → Apps → LM Scan → Permissions.
          </Text>
        )}
      </Centered>
    );
  }

  return (
    <View style={styles.root}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        onCameraReady={() => setReady(true)}
        onMountError={(event) => setError(`camera mount failed: ${event.message}`)}
      />

      <View style={styles.results}>
        {error !== null && (
          <>
            <Text style={styles.errorTitle}>Capture failed</Text>
            <Text style={styles.errorBody}>{error}</Text>
          </>
        )}

        {error === null && capture === null && (
          <Text style={styles.hint}>
            Point at any printed text and press the shutter. {OCR_SCRIPT_NAME} script only.
          </Text>
        )}

        {error === null && capture !== null && (
          <>
            <Text style={styles.stats}>
              {capture.frame.imageWidth}×{capture.frame.imageHeight} · {capture.frame.lines.length}{' '}
              lines · capture {capture.captureMs} ms · OCR {capture.frame.ocrMs} ms
            </Text>
            <Text style={styles.stats}>{geometrySummary(capture.frame)}</Text>
            {capture.frame.lines.length === 0 ? (
              <Text style={styles.warn}>
                No {OCR_SCRIPT_NAME} text found. The engine ran and returned nothing — that is not
                the same as the engine failing.
              </Text>
            ) : (
              <ScrollView style={styles.lines}>
                {capture.frame.lines.slice(0, LINES_SHOWN).map((line, index) => (
                  <Text key={index} style={styles.line} numberOfLines={1}>
                    {line.box === null ? '· ' : ''}
                    {line.text}
                  </Text>
                ))}
                {capture.frame.lines.length > LINES_SHOWN && (
                  <Text style={styles.more}>+{capture.frame.lines.length - LINES_SHOWN} more</Text>
                )}
              </ScrollView>
            )}
          </>
        )}
      </View>

      <View style={styles.shutterBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Capture and read text"
          disabled={!ready || busy}
          onPress={() => void onShutter()}
          style={[styles.shutter, (!ready || busy) && styles.shutterDisabled]}
        >
          {busy ? <ActivityIndicator color="#0B1220" /> : <View style={styles.shutterCore} />}
        </Pressable>
      </View>
    </View>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return <View style={styles.centered}>{children}</View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B1220' },
  centered: {
    flex: 1,
    backgroundColor: '#0B1220',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: { color: '#F8FAFC', fontSize: 24, fontWeight: '700' },
  body: { color: '#94A3B8', fontSize: 14, marginTop: 12, textAlign: 'center', lineHeight: 20 },
  button: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 999,
    backgroundColor: '#F8FAFC',
  },
  buttonText: { color: '#0B1220', fontSize: 15, fontWeight: '600' },
  warn: { color: '#FBBF24', fontSize: 13, marginTop: 12, textAlign: 'center', lineHeight: 18 },

  results: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    maxHeight: '52%',
    padding: 16,
    backgroundColor: 'rgba(11,18,32,0.82)',
  },
  hint: { color: '#94A3B8', fontSize: 13, lineHeight: 18 },
  stats: { color: '#7DD3FC', fontSize: 12, fontVariant: ['tabular-nums'] },
  lines: { marginTop: 10 },
  line: { color: '#F8FAFC', fontSize: 14, lineHeight: 21 },
  more: { color: '#64748B', fontSize: 12, marginTop: 6 },
  errorTitle: { color: '#FCA5A5', fontSize: 15, fontWeight: '700' },
  errorBody: { color: '#FCA5A5', fontSize: 12, marginTop: 6, lineHeight: 17 },

  shutterBar: { position: 'absolute', left: 0, right: 0, bottom: 40, alignItems: 'center' },
  shutter: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: 'rgba(248,250,252,0.28)',
    borderWidth: 3,
    borderColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterDisabled: { opacity: 0.4 },
  shutterCore: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#F8FAFC' },
});
