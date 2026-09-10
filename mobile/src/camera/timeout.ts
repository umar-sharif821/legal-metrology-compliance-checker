/**
 * Reject a promise that never settles.
 *
 * Lifted out of `useScanLoop` in `C-0`, unchanged, because the still capture the verdict
 * now rests on needs the same guard and for the same measured reason: at `D-2` on the
 * Nord 4 `takePictureAsync` stopped settling at pass 69 — no error, no rejection, just a
 * promise that never came back. A promise that never settles cannot be caught, only
 * outwaited (P9 — a stall must be visible, not look like slowness).
 */

/**
 * Reject if `work` has not settled within `ms`.
 *
 * The underlying call is *not* cancelled — there is no way to cancel it — so a caller
 * that gives up must also arrange to clean up after the abandoned work if it eventually
 * succeeds. Both call sites do that for the capture's file.
 */
export function withTimeout<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
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
