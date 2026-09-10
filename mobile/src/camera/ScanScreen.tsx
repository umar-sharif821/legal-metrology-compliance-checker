/**
 * Phase D-2 — the core loop, and the demo itself. Reworked by `C-0`.
 *
 * Live preview with recognised text boxed on it, the controls that produce a verdict, and
 * the verdict screen behind them. The five beats of `docs/DEMO_PLAN.md` §1 run through
 * this component.
 *
 * **What `C-0` changed, and why.** Until now the button was `Freeze`, and it did not take
 * a picture: it kept the loop's most recent recognised pass, so the verdict appeared
 * instantly and the frame on screen was provably the frame the verdict came from. The
 * second half of that is worth keeping and is kept. The first half was paid for with
 * `skipProcessing: true` — no autofocus settle, no HDR, no multi-frame noise reduction —
 * on the one frame where those matter most. `C-0` takes the other side of that trade:
 *
 *  - The live preview is a **viewfinder**. It keeps the tracking boxes (beat 2 rests on
 *    them) and answers "is there text, is it big enough, is it in frame". It no longer
 *    produces a verdict, and `LiveCapture`'s `source: 'viewfinder'` makes that a type
 *    error rather than a rule to remember.
 *  - **Capture** takes a full-quality still and judges *that*. It costs a shutter and an
 *    OCR pass — the verdict is no longer instant, and the screen says so while it works
 *    rather than appearing to have hung (P9).
 *  - **Upload** runs a photo taken with the stock camera app through the identical path.
 *    Full sensor resolution, HDR, proper autofocus: materially better input than any live
 *    frame, and the way ten packets get collected in five minutes instead of ten live
 *    passes that each have to land.
 *
 * The frame under the overlay is still exactly the frame that was judged. Only its
 * provenance changed.
 *
 * **`expo-image-picker` is deliberately not registered in `app.json`'s `plugins`.** Its
 * Android half adds `RECORD_AUDIO` (for picking video) and crop-tool colours, and this
 * app picks neither video nor crops anything. `launchImageLibraryAsync` goes through the
 * Android photo picker, which needs no runtime permission at all — so registering it
 * would buy nothing and make the app ask for a microphone it never uses.
 *
 * Demo scaffolding. `T-1.12` and `T-3.6` own the real versions of these two screens.
 */
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import type { OcrFrame } from '../scan/types';
import { NAV_BAR_INSET } from '../ui/layout';
import VerdictScreen from '../verdict/VerdictScreen';
import { judge, type Judgement } from './capture';
import { hintsFor } from '../scan/admit';
import Overlay, { type OverlayBox } from './Overlay';
import { OCR_SCRIPT_NAME } from './ocr';
import type { Size } from './projection';
import { withTimeout } from './timeout';
import { discard, useScanLoop } from './useScanLoop';

/**
 * How long a judged capture may take before it is abandoned.
 *
 * Longer than the loop's `PASS_TIMEOUT_MS` on purpose. A processed still does strictly
 * more work than a `skipProcessing` one — it waits for autofocus to settle, and on this
 * phone it may merge several exposures — so six seconds calibrated against an ~850 ms
 * preview pass would start rejecting healthy captures. Twelve seconds is long enough that
 * only a genuine wedge trips it, and short enough that a person watching a spinner finds
 * out inside a demo rather than after one.
 */
const JUDGE_TIMEOUT_MS = 12000;

/** What the app is doing while no verdict is on screen. */
type Busy =
  | { readonly kind: 'idle' }
  | { readonly kind: 'working'; readonly what: 'capture' | 'upload' }
  | { readonly kind: 'failed'; readonly message: string };

/** An image ready to be judged, whatever produced it. */
interface PendingImage {
  readonly uri: string;
  readonly width: number;
  readonly height: number;
  readonly captureMs: number | null;
  readonly source: 'still' | 'upload';
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
  const [judged, setJudged] = useState<Judgement | null>(null);
  const [busy, setBusy] = useState<Busy>({ kind: 'idle' });
  /** Judged captures this session. Numbered separately from the loop's viewfinder passes. */
  const judgedSeq = useRef(0);
  /**
   * Bumped to force a brand-new `CameraView`.
   *
   * When the camera wedges — measured on the Nord 4, where `takePictureAsync` stopped
   * settling after ~70 passes — restarting the loop alone changes nothing, because the
   * loop is not what is stuck. Changing the key tears the camera session down and opens a
   * fresh one, which is the only recovery available from JavaScript.
   */
  const [cameraGeneration, setCameraGeneration] = useState(0);

  // The loop runs only while the camera is up, nothing is judged, nothing has failed, and
  // nothing else is holding the camera.
  const live = useScanLoop(
    cameraRef,
    ready && judged === null && mountError === null && busy.kind !== 'working',
  );
  const hints = live.admission === null ? [] : hintsFor(live.admission);

  /**
   * Run one judged capture, with the camera to itself and the loop held off.
   *
   * `produce` returns the image to judge, or `null` if the operator backed out — a
   * cancelled gallery pick is not a failure and must not be reported as one.
   */
  const runJudged = useCallback(
    (what: 'capture' | 'upload', produce: () => Promise<PendingImage | null>) => {
      setBusy({ kind: 'working', what });
      void live
        .exclusive(async () => {
          const image = await produce();
          if (image === null) return null;
          judgedSeq.current += 1;
          try {
            return await withTimeout(
              judge({ ...image, seq: judgedSeq.current }),
              JUDGE_TIMEOUT_MS,
              what === 'upload' ? 'reading the photo' : 'full-quality capture',
            );
          } catch (failed) {
            // No verdict means no `onResume`, so nothing else will ever reach this file.
            // Same rule as the loop's: whoever abandons a capture cleans up after it. An
            // upload is exempt for the same reason as there — that URI may not be ours.
            if (image.source === 'still') discard(image.uri);
            throw failed;
          }
        })
        .then(
          (result) => {
            setBusy({ kind: 'idle' });
            if (result !== null) setJudged(result);
          },
          (caught: unknown) => {
            setBusy({
              kind: 'failed',
              message: caught instanceof Error ? caught.message : String(caught),
            });
          },
        );
    },
    [live],
  );

  const onCapture = useCallback(() => {
    runJudged('capture', async () => {
      const camera = cameraRef.current;
      if (!camera) throw new Error('the camera is not mounted');
      const startedAt = Date.now();
      // No `skipProcessing` — this is the whole of `C-0`'s first change. The pipeline it
      // used to skip is what makes 1–2 mm print legible, and it also settles the EXIF
      // orientation, which is why the judged frame no longer sometimes lies on its side.
      const picture = await camera.takePictureAsync({ shutterSound: false });
      if (!picture) throw new Error('takePictureAsync resolved without a picture');
      return {
        uri: picture.uri,
        width: picture.width,
        height: picture.height,
        captureMs: Date.now() - startedAt,
        source: 'still' as const,
      };
    });
  }, [runJudged]);

  const onUpload = useCallback(() => {
    runJudged('upload', async () => {
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        // Full resolution, and no crop step. Re-encoding or cropping the one input that is
        // better than anything this app can capture would defeat the point of the feature.
        quality: 1,
        allowsEditing: false,
      });
      if (picked.canceled) return null;
      const asset = picked.assets[0];
      if (!asset) return null;
      return {
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        // No shutter this app can time. `null`, never a zero (P4).
        captureMs: null,
        source: 'upload' as const,
      };
    });
  }, [runJudged]);

  const onPreviewLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setPreviewSize({ width, height });
  }, []);

  const onResume = useCallback(() => {
    // The loop never saw the judged still, so it leaks one full-resolution JPEG per
    // verdict unless it is dropped here. An upload is left alone: the picker's copy is
    // cheap, and the cost of being wrong about whose file that URI names is somebody's
    // photo.
    if (judged?.capture.source === 'still') discard(judged.capture.uri);
    setJudged(null);
  }, [judged]);

  const onRestart = useCallback(() => {
    // Order matters only in that both must happen: a fresh camera, then a fresh loop
    // waiting for it to report ready.
    setReady(false);
    setBusy({ kind: 'idle' });
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

  if (judged) {
    return (
      <VerdictScreen
        verdict={judged.verdict}
        capture={judged.capture}
        extraction={judged.extraction}
        onResume={onResume}
      />
    );
  }

  const working = busy.kind === 'working';
  const error = mountError ?? (busy.kind === 'failed' ? busy.message : null) ?? live.error;
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
       * the label rather than guessing at it, and telling the operator whether the panel
       * is framed before they spend a capture on it.
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
              ? `Starting the viewfinder… ${OCR_SCRIPT_NAME} script only.`
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
            {/*
             * P9, and the point of C-0 stated on the screen it changed. Somebody watching
             * boxes track the label will assume those boxes are what gets judged. They
             * are not, and that difference is the whole phase.
             */}
            <Text style={styles.viewfinder}>
              Viewfinder — fast, unprocessed, for framing only. Capture takes the photo the verdict
              is read from.
            </Text>
            {capture.frame.lines.length === 0 && (
              <Text style={styles.warn}>
                No {OCR_SCRIPT_NAME} text in view. The engine ran and returned nothing — that is not
                the same as the engine failing.
              </Text>
            )}
            {/*
             * Coach hints (D-4). These have a measurement behind them now rather than
             * being guesses: each one is a frame-admission check that the frame on screen
             * is currently failing. They are shown while scanning, when the operator can
             * still act on them, and they say nothing about sharpness — that is not
             * measured and the verdict screen says so.
             */}
            {hints.length > 0 && <Text style={styles.coach}>{hints.join(' · ')}</Text>}
          </>
        )}
      </View>

      <View style={styles.controls}>
        {working && (
          <View style={styles.workingRow}>
            <ActivityIndicator color="#F8FAFC" />
            <Text style={styles.workingText}>
              {busy.what === 'upload'
                ? 'Reading the photo…'
                : 'Full-quality capture — focusing, then reading…'}
            </Text>
          </View>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Take a full-quality photo and check its declarations"
          disabled={!ready || working}
          onPress={onCapture}
          style={[styles.capture, (!ready || working) && styles.disabled]}
        >
          <Text style={styles.captureText}>Capture</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Check a photo already taken with the camera app"
          disabled={working}
          onPress={onUpload}
          style={[styles.upload, working && styles.disabled]}
        >
          <Text style={styles.uploadText}>Use a photo from the gallery</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return <View style={styles.centered}>{children}</View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A1D36' },
  centered: {
    flex: 1,
    backgroundColor: '#0A1D36',
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
  buttonText: { color: '#0A1D36', fontSize: 15, fontWeight: '600' },
  warn: { color: '#FBBF24', fontSize: 13, marginTop: 8, lineHeight: 18 },

  hud: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    padding: 14,
    backgroundColor: 'rgba(10,29,54,0.78)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.10)',
  },
  hint: { color: '#94A3B8', fontSize: 13, lineHeight: 18 },
  coach: {
    alignSelf: 'flex-start',
    color: '#FBBF24',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.45)',
    backgroundColor: 'rgba(251,191,36,0.12)',
  },
  stats: { color: '#7DD3FC', fontSize: 12, fontVariant: ['tabular-nums'] },
  viewfinder: { color: '#94A3B8', fontSize: 11, lineHeight: 16, marginTop: 6 },
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

  controls: {
    position: 'absolute',
    left: 0,
    right: 0,
    // Without the inset the gallery link's lower third falls inside the navigation bar's
    // touch region and a tap aimed at it reaches HOME instead. Measured on the Nord 4.
    bottom: 36 + NAV_BAR_INSET,
    alignItems: 'center',
  },
  workingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: 'rgba(10,29,54,0.88)',
  },
  workingText: { color: '#F8FAFC', fontSize: 13 },
  capture: {
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 999,
    backgroundColor: '#F8FAFC',
    borderWidth: 3,
    borderColor: 'rgba(248,250,252,0.35)',
    elevation: 6,
  },
  captureText: { color: '#0A1D36', fontSize: 17, fontWeight: '800', letterSpacing: 0.5 },
  upload: { marginTop: 14, paddingVertical: 8, paddingHorizontal: 18 },
  uploadText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  disabled: { opacity: 0.4 },
});
