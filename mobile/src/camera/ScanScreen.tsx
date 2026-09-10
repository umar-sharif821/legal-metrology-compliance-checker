/**
 * Phase D-2 — the core loop, and the demo itself.
 *
 * Live preview with recognised text boxed on it, a Freeze button, and the verdict screen
 * behind it. The five beats of `docs/DEMO_PLAN.md` §1 run through this component.
 *
 * The one structural decision worth stating: **Freeze does not take a picture.** The
 * scan loop is the only thing that captures, and Freeze keeps the most recent pass it has
 * already recognised. Two things follow. The verdict appears immediately, because all
 * that remains is `extract` and `evaluate`, both pure and sub-millisecond. And the frame
 * on screen is provably the frame the verdict came from — not a second, similar picture
 * taken a moment later, whose boxes would not be the boxes the findings cite (P7).
 *
 * Demo scaffolding. `T-1.12` and `T-3.6` own the real versions of these two screens.
 */
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import { DEMO_PACK } from '../rulepack/pack';
import { extract } from '../scan/extract';
import type { OcrFrame } from '../scan/types';
import { evaluate } from '../verdict/evaluate';
import type { Verdict } from '../verdict/types';
import VerdictScreen from '../verdict/VerdictScreen';
import Overlay, { type OverlayBox } from './Overlay';
import { OCR_SCRIPT_NAME } from './ocr';
import type { Size } from './projection';
import { useScanLoop, type LiveCapture } from './useScanLoop';

interface Frozen {
  readonly capture: LiveCapture;
  readonly verdict: Verdict;
}

/**
 * The image's dimensions beside the boxes' own extent and their mean shape.
 *
 * `wide` versus `tall` is the diagnostic that matters: lines of text are wide and short
 * *in whatever frame the coordinates are expressed in*, so if the mean box is tall the
 * coordinates are in a frame turned 90° from the one being drawn into, and the overlay
 * needs the opposite turn. Reading that off the screen takes a second; inferring it from
 * a misaligned overlay takes an afternoon.
 */
function geometrySummary(frame: OcrFrame): string {
  const boxed = frame.lines.flatMap((line) => (line.box ? [line.box] : []));
  const size = `${frame.imageWidth}×${frame.imageHeight}`;
  if (boxed.length === 0) return `${size} · no geometry reported — evidence unavailable`;

  let right = 0;
  let bottom = 0;
  let wide = 0;
  for (const box of boxed) {
    right = Math.max(right, box.x + box.width);
    bottom = Math.max(bottom, box.y + box.height);
    if (box.width >= box.height) wide += 1;
  }
  const shape = wide * 2 >= boxed.length ? 'wide' : 'tall';
  const frameNote = frame.coordinatesTransposed ? ' · frame transposed' : '';
  return `${size} · extent ${Math.round(right)}×${Math.round(bottom)} · ${boxed.length}/${frame.lines.length} boxed, mostly ${shape}${frameNote}`;
}

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [ready, setReady] = useState(false);
  const [mountError, setMountError] = useState<string | null>(null);
  const [previewSize, setPreviewSize] = useState<Size>({ width: 0, height: 0 });
  const [frozen, setFrozen] = useState<Frozen | null>(null);
  /**
   * Bumped to force a brand-new `CameraView`.
   *
   * When the camera wedges — measured on the Nord 4, where `takePictureAsync` stopped
   * settling after ~70 passes — restarting the loop alone changes nothing, because the
   * loop is not what is stuck. Changing the key tears the camera session down and opens a
   * fresh one, which is the only recovery available from JavaScript.
   */
  const [cameraGeneration, setCameraGeneration] = useState(0);

  // The loop runs only while the camera is up, nothing is frozen, and nothing has failed.
  const live = useScanLoop(cameraRef, ready && frozen === null && mountError === null);

  const onFreeze = useCallback(() => {
    const capture = live.capture;
    if (!capture) return;
    const extraction = extract(DEMO_PACK, capture.frame.lines);
    const verdict = evaluate(DEMO_PACK, capture.frame, extraction);
    setFrozen({ capture, verdict });
  }, [live.capture]);

  const onPreviewLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setPreviewSize({ width, height });
  }, []);

  const onRestart = useCallback(() => {
    // Order matters only in that both must happen: a fresh camera, then a fresh loop
    // waiting for it to report ready.
    setReady(false);
    setCameraGeneration((n) => n + 1);
    live.retry();
  }, [live]);

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

  if (frozen) {
    return (
      <VerdictScreen
        verdict={frozen.verdict}
        capture={frozen.capture}
        onResume={() => setFrozen(null)}
      />
    );
  }

  const error = mountError ?? live.error;
  const capture = live.capture;
  const boxes: OverlayBox[] =
    capture?.frame.lines.flatMap((line, index) =>
      line.box ? [{ key: `line-${index}`, box: line.box, emphasis: 'line' as const }] : [],
    ) ?? [];

  return (
    <View style={styles.root} onLayout={onPreviewLayout}>
      <CameraView
        key={cameraGeneration}
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        onCameraReady={() => setReady(true)}
        onMountError={(event) => setMountError(`camera mount failed: ${event.message}`)}
      />

      {/*
       * The boxes lag the world by one pass — roughly a second on this device. That is
       * inherent to a still-capture loop and is exactly what `T-1.12`'s frame processor
       * fixes. They still do the job they are here for: showing that the app is reading
       * the label rather than guessing at it.
       */}
      {capture && (
        <Overlay
          boxes={boxes}
          image={{ width: capture.frame.imageWidth, height: capture.frame.imageHeight }}
          view={previewSize}
          mode="cover"
        />
      )}

      <View style={styles.hud}>
        {error !== null ? (
          <>
            <Text style={styles.errorTitle}>Scanning stopped</Text>
            <Text style={styles.errorBody}>{error}</Text>
            {/* A mount failure is not recoverable from here; a loop failure is. */}
            {mountError === null && (
              <Pressable accessibilityRole="button" style={styles.retry} onPress={onRestart}>
                <Text style={styles.retryText}>Restart scanning</Text>
              </Pressable>
            )}
          </>
        ) : capture === null ? (
          <Text style={styles.hint}>
            {ready
              ? `Starting the scan loop… ${OCR_SCRIPT_NAME} script only.`
              : 'Waiting for the camera…'}
          </Text>
        ) : (
          <>
            <Text style={styles.stats}>
              {capture.frame.lines.length} lines · capture {capture.captureMs} ms · OCR{' '}
              {capture.frame.ocrMs} ms · pass {live.passes}
            </Text>
            {/*
             * Kept from D-1, and kept for good. The image size next to the boxes' own
             * extent and mean shape is the only way a projection bug announces itself:
             * misaligned boxes otherwise look exactly like an OCR failure.
             */}
            <Text style={styles.stats}>{geometrySummary(capture.frame)}</Text>
            {capture.frame.lines.length === 0 && (
              <Text style={styles.warn}>
                No {OCR_SCRIPT_NAME} text in view. The engine ran and returned nothing — that is not
                the same as the engine failing.
              </Text>
            )}
          </>
        )}
      </View>

      <View style={styles.freezeBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Freeze this frame and check its declarations"
          disabled={capture === null}
          onPress={onFreeze}
          style={[styles.freeze, capture === null && styles.freezeDisabled]}
        >
          <Text style={styles.freezeText}>Freeze</Text>
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
  warn: { color: '#FBBF24', fontSize: 13, marginTop: 8, lineHeight: 18 },

  hud: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    padding: 14,
    backgroundColor: 'rgba(11,18,32,0.72)',
  },
  hint: { color: '#94A3B8', fontSize: 13, lineHeight: 18 },
  stats: { color: '#7DD3FC', fontSize: 12, fontVariant: ['tabular-nums'] },
  errorTitle: { color: '#FCA5A5', fontSize: 15, fontWeight: '700' },
  errorBody: { color: '#FCA5A5', fontSize: 12, marginTop: 6, lineHeight: 17 },
  retry: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  retryText: { color: '#FCA5A5', fontSize: 13, fontWeight: '700' },

  freezeBar: { position: 'absolute', left: 0, right: 0, bottom: 40, alignItems: 'center' },
  freeze: {
    paddingVertical: 16,
    paddingHorizontal: 52,
    borderRadius: 999,
    backgroundColor: '#F8FAFC',
    borderWidth: 3,
    borderColor: 'rgba(248,250,252,0.35)',
  },
  freezeDisabled: { opacity: 0.4 },
  freezeText: { color: '#0B1220', fontSize: 17, fontWeight: '800', letterSpacing: 0.5 },
});
