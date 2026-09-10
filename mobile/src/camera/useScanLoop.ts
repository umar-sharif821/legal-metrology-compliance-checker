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
 * **Since `C-0` the loop no longer produces verdicts.** It is a viewfinder: it keeps the
 * tracking boxes, which are the demo's best visual and what beat 2 rests on, and its job
 * is framing feedback — is there text, is it big enough, is it in frame. The frame a
 * verdict rests on is a separate, fully processed still (`capture.ts`). `LiveCapture` is
 * typed as `source: 'viewfinder'` so the compiler enforces that rather than a comment.
 *
 * The loop is still the only thing that drives the camera continuously, so anything else
 * that wants the camera — the still capture, or the gallery picker — must go through
 * `exclusive`. Two `takePictureAsync` calls in flight on one session is precisely the
 * contention that wedged the Nord 4 at `D-2`.
 *
 * Demo scaffolding. `T-1.12` replaces the still-capture loop with a real frame processor.
 */
import type { CameraView } from 'expo-camera';
import { File } from 'expo-file-system';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { Capture } from './capture';
import { mlKitProvider } from './ocr';
import { withTimeout } from './timeout';

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
 * A live loop pass.
 *
 * Since `C-0` this is a *viewfinder* frame and nothing else: `source` is `'viewfinder'`,
 * which `JudgedCapture` excludes, so the compiler refuses to let one reach a verdict.
 */
export type LiveCapture = Capture & { readonly source: 'viewfinder' };

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
  /**
   * Run `work` with the loop held off and the camera to itself.
   *
   * Suspends the loop, waits for the pass already in flight to finish — it cannot be
   * cancelled, only awaited — runs `work`, then resumes. Every other camera user in the
   * app goes through here, so "one capture in flight at a time" stays true of the whole
   * app and not merely of the loop.
   *
   * It is also what stops the loop burning the camera and the CPU behind a gallery picker
   * the operator may sit in for a minute.
   */
  readonly exclusive: <T>(work: () => Promise<T>) => Promise<T>;
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
 * one is kept, because it is the frame currently drawn under the overlay.
 *
 * Exported since `C-0` so `ScanScreen` can clean up the judged still, which the loop
 * never sees and would otherwise leak one full-resolution JPEG per verdict.
 *
 * Failure here is swallowed deliberately — a cache file that would not delete is not a
 * reason to interrupt a scan, and it is not something a person can act on.
 */
export function discard(uri: string | null): void {
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
  /** Settles when the pass in flight ends; `null` between passes. */
  const inFlight = useRef<Promise<void> | null>(null);
  /** While true the loop starts no new pass. Held in a ref so `exclusive` needs no re-render. */
  const suspended = useRef(false);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const exclusive = useCallback(async <T>(work: () => Promise<T>): Promise<T> => {
    suspended.current = true;
    try {
      // Never rejects — the loop's own error handling has already dealt with a failed
      // pass — but awaiting it is what guarantees the camera is idle before `work` runs.
      await inFlight.current;
      return await work();
    } finally {
      suspended.current = false;
    }
  }, []);

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    setError(null);

    void (async () => {
      let consecutiveErrors = 0;

      while (!cancelled) {
        if (suspended.current) {
          // Somebody else has the camera. Idle rather than contend; `exclusive` clears this.
          await sleep(LOOP_INTERVAL_MS);
          continue;
        }

        const startedAt = Date.now();
        const camera = cameraRef.current;

        if (!camera) {
          // The ref arrives a frame after mount. Wait rather than treating it as an error.
          await sleep(LOOP_INTERVAL_MS);
          continue;
        }

        // Published before the first `await` below, so an `exclusive` caller that arrives
        // mid-pass has something to wait on rather than racing the shutter.
        let passDone = () => {};
        inFlight.current = new Promise<void>((resolve) => {
          passDone = resolve;
        });

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
              mlKitProvider.recognise({ uri, width: picture.width, height: picture.height }),
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
          setCapture({
            uri: picture.uri,
            frame,
            captureMs,
            seq: seq.current,
            source: 'viewfinder',
            provider: mlKitProvider.id,
          });
          setPasses((n) => n + 1);
        } catch (caught) {
          if (cancelled) break;
          consecutiveErrors += 1;
          const message = caught instanceof Error ? caught.message : String(caught);
          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            setError(`${message} (${consecutiveErrors} consecutive failures — loop stopped)`);
            return;
          }
        } finally {
          // Runs on every exit from the pass — success, throw, `break`, and the `return`
          // above. An `exclusive` caller left waiting on a settled-but-uncleared promise
          // would hang the capture button, so this cannot be conditional.
          passDone();
          inFlight.current = null;
        }

        const elapsed = Date.now() - startedAt;
        await sleep(Math.max(0, LOOP_INTERVAL_MS - elapsed));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [active, attempt, cameraRef]);

  return { capture, error, passes, retry, exclusive };
}
