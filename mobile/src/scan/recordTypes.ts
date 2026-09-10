/**
 * The shape of one `D-3` field-trial record.
 *
 * Split away from `record.ts` for one reason: `record.ts` writes files and therefore
 * imports `expo-file-system`, which cannot load under Node. The replay suite
 * (`corpus.test.ts`) runs under Node and needs these types, so they live in a module with
 * no import at all. Same discipline as `scan/types.ts` — everything downstream of the
 * camera stays plain TypeScript.
 */
import type { CaptureSource, OcrLine } from './types';
import type { VerdictStatus } from '../verdict/types';

/**
 * Bump when the record's shape changes, so a pulled corpus can never be misread.
 *
 * `/2` is `C-0`: `source` was added and `timings.captureMs` became nullable. The two `/1`
 * records were rewritten in place to declare `source: "viewfinder"`, which is what they
 * always were — every capture before `C-0` was a `skipProcessing` live frame. That is an
 * annotation of a measurement, not a change to one; no line, box or timing was touched.
 * There is deliberately no compatibility branch, because a corpus with one schema in it
 * is a corpus nobody has to reason about.
 */
export const RECORD_SCHEMA_ID = 'lmscan.field-trial/2';

/** Directory name under `Paths.document` on the device, and under `mobile/` on the host. */
export const TRIAL_DIR = 'field-trial';

/**
 * What a reviewer decided this packet *should* produce.
 *
 * Written by a person after looking at the packet and at the lines it actually produced —
 * never by the device, which would only be recording its own current behaviour as
 * correct. That distinction is the whole value of the block: it turns a log into a test.
 */
export interface TrialExpectation {
  /**
   * Field id → the value that must be extracted, or `null` for a field that must *not* be.
   *
   * `null` is not "we did not check". It is a reviewer stating that this packet contains
   * nothing that legitimately fills the field, so a value appearing there is a false
   * positive — the `commodity_name: "may differ."` failure in `docs/PROGRESS.md` (P3).
   */
  readonly fields: Readonly<Record<string, string | null>>;
  readonly status: VerdictStatus;
  /** Declaration ids of every finding expected, in any order. */
  readonly findings: readonly string[];
  /** Free text: what the reviewer noticed, and what tuning it prompted. */
  readonly notes?: string;
}

export interface FieldTrialRecord {
  readonly schema: string;
  readonly recordedAt: string;
  /** Sequence within this device's corpus — the `NNN` in the filenames. */
  readonly seq: number;
  /** Free text the operator typed to name the packet. Never parsed, only displayed. */
  readonly packet: string;
  readonly imageFile: string;
  /**
   * What kind of image this packet was read from.
   *
   * Added by `C-0`, and the field that makes the corpus comparable. Two records of the
   * same packet, one a viewfinder frame and one a stock-camera photo, will disagree — and
   * without this, whoever reads them a week later has no way to know that the disagreement
   * is the point rather than a bug (P8).
   */
  readonly source: CaptureSource;
  readonly frame: {
    readonly imageWidth: number;
    readonly imageHeight: number;
    readonly coordinatesTransposed: boolean;
  };
  readonly timings: {
    /**
     * Shutter-to-file milliseconds, or `null` for an upload.
     *
     * A photo taken minutes ago by another app has no shutter latency this app can claim.
     * `null` says so; a zero would be a number the method cannot support, and it would
     * quietly drag down any latency average computed over the corpus (P4, P8).
     */
    readonly captureMs: number | null;
    readonly ocrMs: number;
    readonly extractMs: number;
    readonly evaluateMs: number;
  };
  /**
   * The raw lines, exactly as the engine returned them.
   *
   * This is the whole point of the record. Everything else here is the app's opinion and
   * can be recomputed; these lines are the measurement, and once the packet is back on a
   * shelf they cannot be obtained again.
   */
  readonly lines: readonly OcrLine[];
  /** What the cascade recovered at record time — the "note what was missed" column. */
  readonly extracted: readonly {
    readonly fieldId: string;
    readonly value: string;
    readonly sourceText: string;
    readonly stage: string;
    readonly confidence: string;
  }[];
  /** The verdict the device reached at record time. Descriptive, not normative. */
  readonly verdict: {
    readonly status: VerdictStatus;
    readonly insufficientReason: string | null;
    readonly packId: string;
    readonly packVersion: string;
    readonly findings: readonly {
      readonly declarationId: string;
      readonly fieldId: string;
      readonly title: string;
      readonly severity: string;
      readonly hasEvidenceBox: boolean;
    }[];
  };
  /** Added by hand after review. Absent until then, and the suite says so loudly. */
  readonly expect?: TrialExpectation;
}

/** `Bhujialalji Navratna Mix` → `bhujialalji-navratna-mix`, for a filename. */
export function slugify(packet: string): string {
  const slug = packet
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return slug.length > 0 ? slug : 'packet';
}
