/**
 * The continuous capture loop, with backpressure.
 *
 * **One capture in flight at a time, never a queue.** That is the whole design constraint
 * (`docs/DEMO_PLAN.md` §4, D-2). A timer that fires every N ms would keep firing while a
 * capture is still being OCR'd, and on a phone where one pass costs ~850 ms the queue
 * would grow without bound until the app stalled and the overlay lagged the world by
 * several seconds. So the loop is a serial `while` over `await`: the next pass cannot
 * start until the previous one has finished, and `LOOP_INTERVAL_MS` is a *floor* between
 * passes rather than a period.
 *
 * The loop is the app's only OCR source. **Freeze does not take a new picture** — it
 * keeps the most recent completed pass, which has already been recognised. That is what
 * makes beat 3 ("Freeze → verdict in under a second") true rather than aspirational: at
 * freeze time the only work left is `extract` and `evaluate`, both pure and sub-millisecond,
 * and the frame shown on screen is exactly the frame the verdict was computed from.
 *
 * Demo scaffolding. `T-1.12` replaces the still-capture loop with a real frame processor.
 */
import type { CameraView } from 'expo-camera';
import { File } from 'expo-file-system';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { OcrFrame } from '../scan/types';
import { recognise } from './ocr';

/**
 * Minimum milliseconds between the end of one pass and the start of the next.
 *
 * The one number to turn on the day (D-3). On the Nord 4 a pass costs ~850 ms end to end
 * — 370 ms capture plus 455 ms OCR on a label panel, measured in D-1 — so this floor is
 * almost never the binding constraint; it exists to stop a fast device from pinning the
 * camera and the CPU at 100% and cooking the phone during a rehearsal.
 */
export const LOOP_INTERVAL_MS = 250;

/**
 * How many consecutive failures before the loop gives up and shows the error.
 *
 * A loop that retries a permanently broken camera forever burns battery behind a screen
 * that looks merely slow. Stopping and naming the failure is P9 — degrade visibly.
 */
export const MAX_CONSECUTIVE_ERRORS = 3;

/**
 * How long one pass may take before it is abandoned.
 *
 * **Measured, not hypothetical.** On the Nord 4 at D-2 the loop stalled dead at pass 69:
 * `takePictureAsync` never settled, the preview kept running at 25 fps, and the serial
 * loop — which by design waits for the pass in flight — waited forever. No error, no
 * change on screen, just a frozen counter behind a live picture. That is the exact
 * failure P9 exists to forbid, and roughly seventy passes is about a minute of scanning,
 * so it lands *during* a demo rather than after one.
 *
 * A promise that never settles cannot be caught, only outwaited. Six seconds is about
 * seven times the ~850 ms a healthy pass costs, so a slow pass is never mistaken for a
 * hung one.
 */
export const PASS_TIMEOUT_MS = 6000;

/**
 * Reject if `work` has not settled within `ms`.
 *
 * The underlying call is *not* cancelled — there is no way to cancel it — so a caller
 * that gives up must also arrange to clean up after the abandoned work if it eventually
 * succeeds. The loop below does that for the capture's file.
 */
function withTimeout<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} did not return within ${ms} ms`)),
      ms,
    );
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

export interface LiveCapture {
  /** The still on disk, so the frozen frame can be displayed and drawn over. */
  readonly uri: string;
  readonly frame: OcrFrame;
  /** Shutter-to-file milliseconds, kept apart from `frame.ocrMs` (P8). */
  readonly captureMs: number;
  /** Increases with every pass; lets the UI distinguish a fresh frame from a repeat. */
  readonly seq: number;
}

export interface ScanLoopState {
  readonly capture: LiveCapture | null;
  readonly error: string | null;
  /** Completed passes this session — the visible sign that the loop is actually running. */
  readonly passes: number;
  /**
   * Restart a loop that gave up.
   *
   * Without this, a transient failure — the camera briefly claimed by another app, a
   * capture that timed out — leaves the screen dead with no way back except killing the
   * app. Mid-demo that is the difference between a stumble and a stop.
   */
  readonly retry: () => void;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Delete a capture the loop has finished with.
 *
 * Every pass writes a full-resolution JPEG into the cache directory. At roughly one pass
 * a second an unattended rehearsal would leave hundreds of megabytes behind, on the demo
 * phone, during the demo. The file being replaced is always safe to remove; the newest
 * one is kept, because Freeze may be about to display it.
 *
 * Failure here is swallowed deliberately — a cache file that would not delete is not a
 * reason to interrupt a scan, and it is not something a person can act on.
 */
function discard(uri: string | null): void {
  if (!uri) return;
  try {
    new File(uri).delete();
  } catch {
    /* best effort */
  }
}

/**
 * Run the capture → OCR loop while `active` is true.
 *
 * `active` is the freeze switch: false stops the loop after the pass in flight and leaves
 * the last capture standing. Turning it back on resumes from a clean slate.
 */
export function useScanLoop(
  cameraRef: React.RefObject<CameraView | null>,
  active: boolean,
): ScanLoopState {
  const [capture, setCapture] = useState<LiveCapture | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [passes, setPasses] = useState(0);
  /** Bumped by `retry`; it is in the effect's deps, so a bump tears the loop down and starts a new one. */
  const [attempt, setAttempt] = useState(0);
  /** Held in a ref, not state: the loop must read the *current* uri, not a closed-over one. */
  const liveUri = useRef<string | null>(null);
  const seq = useRef(0);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    setError(null);

    void (async () => {
      let consecutiveErrors = 0;

      while (!cancelled) {
        const startedAt = Date.now();
        const camera = cameraRef.current;

        if (!camera) {
          // The ref arrives a frame after mount. Wait rather than treating it as an error.
          await sleep(LOOP_INTERVAL_MS);
          continue;
        }

        try {
          // `skipProcessing` skips the rotate-and-rescale pipeline, which is most of the
          // shutter latency; ML Kit reads the EXIF orientation itself. The file comes back
          // in the sensor's own frame, and which frame the OCR coordinates land in is
          // measured downstream by `resolveCoordinateFrame` rather than assumed here.
          const shot = camera.takePictureAsync({ skipProcessing: true, shutterSound: false });

          // If the wait below times out, this call may still finish minutes later and
          // leave a full-resolution JPEG behind. Nothing else will ever hear about that
          // file, so the cleanup has to be attached here, before it can happen.
          let abandoned = false;
          void shot.then(
            (late) => {
              if (abandoned) discard(late?.uri ?? null);
            },
            () => {
              /* already reported through the await below */
            },
          );

          let picture;
          try {
            picture = await withTimeout(shot, PASS_TIMEOUT_MS, 'camera capture');
          } catch (timedOut) {
            abandoned = true;
            throw timedOut;
          }

          if (cancelled) {
            discard(picture?.uri ?? null);
            break;
          }
          if (!picture) throw new Error('takePictureAsync resolved without a picture');

          const captureMs = Date.now() - startedAt;
          const uri = picture.uri;
          let frame;
          try {
            frame = await withTimeout(
              recognise(uri, picture.width, picture.height),
              PASS_TIMEOUT_MS,
              'text recognition',
            );
          } catch (timedOut) {
            // This file is ours and nothing downstream will see it.
            discard(uri);
            throw timedOut;
          }

          if (cancelled) {
            discard(picture.uri);
            break;
          }

          discard(liveUri.current);
          liveUri.current = picture.uri;
          seq.current += 1;

          consecutiveErrors = 0;
          setError(null);
          setCapture({ uri: picture.uri, frame, captureMs, seq: seq.current });
          setPasses((n) => n + 1);
        } catch (caught) {
          if (cancelled) break;
          consecutiveErrors += 1;
          const message = caught instanceof Error ? caught.message : String(caught);
          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            setError(`${message} (${consecutiveErrors} consecutive failures — loop stopped)`);
            return;
          }
        }

        const elapsed = Date.now() - startedAt;
        await sleep(Math.max(0, LOOP_INTERVAL_MS - elapsed));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [active, attempt, cameraRef]);

  return { capture, error, passes, retry };
}
