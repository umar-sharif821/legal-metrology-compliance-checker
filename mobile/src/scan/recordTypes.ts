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
 *
 * `/3` is `A-0`: the flat `lines` / `frame` / `timings.ocrMs` triple became `readings`, a
 * list, each entry naming the engine that produced it. All three were always per-*engine*
 * facts wearing per-*packet* clothing — a second engine reading the same JPEG can report
 * different text, a different coordinate frame and a different duration — and `A-0` exists
 * to put two engines side by side on one packet. The two `/2` records were rewritten in
 * place into a single reading declaring `provider: "mlkit"`, which is what they always
 * were: ML Kit is the only engine this project has ever run. Annotation again, not
 * change — every line, box and millisecond is byte-identical to what was committed.
 */
export const RECORD_SCHEMA_ID = 'lmscan.field-trial/3';

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

/**
 * One engine's reading of one packet's image.
 *
 * Added by `A-0`. The device writes exactly one of these, for the engine it ships; a
 * candidate engine earns a column in the corpus report by replaying `imageFile` on a host
 * and having its reading appended here. That is the whole mechanism by which a new engine
 * is scored against packets already collected, without re-photographing anything — with
 * one real limit: the JPEGs are deliberately not committed, so the replay can only happen
 * on a machine that still holds them (`mobile/field-trial/README.md`).
 */
export interface TrialReading {
  /**
   * The engine that produced these lines — an id from `scan/provider.ts`'s `PROVIDERS`.
   *
   * Typed as `string`, not the union, for the same reason `stage` is: this shape is
   * parsed from a file on disk, and a record naming an engine this build does not know
   * must survive being read so the suite can say so plainly, rather than fail to parse.
   */
  readonly provider: string;
  /** When this reading was taken. Not the packet's `recordedAt` — a replay happens later. */
  readonly readAt: string;
  /** Wall-clock milliseconds this engine took, on whatever hardware ran it (P8). */
  readonly ocrMs: number;
  /**
   * The pixel frame *this engine's* boxes are expressed in.
   *
   * Per reading, not per packet: two engines handed the same JPEG can disagree about its
   * EXIF orientation, and a box read against the wrong frame lands an evidence crop on
   * the wrong part of the label (P7).
   */
  readonly frame: {
    readonly imageWidth: number;
    readonly imageHeight: number;
    readonly coordinatesTransposed: boolean;
  };
  /** The raw lines, exactly as this engine returned them. Never mutated. */
  readonly lines: readonly OcrLine[];
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
  /**
   * Which reading the device itself took — the one `extracted`, `verdict` and the
   * `extractMs` / `evaluateMs` timings below describe.
   *
   * Named rather than left as "the first one". Every other reading in the list was
   * appended later by replaying `imageFile` on a host, and nothing about those was ever
   * on a phone; a reader who cannot tell which is which cannot tell a measured latency
   * from an imported one (P8).
   */
  readonly recordedProvider: string;
  /**
   * One entry per engine that has read this packet's image. At least one.
   *
   * This list is the whole point of the record. Everything else is the app's opinion and
   * can be recomputed; these lines are the measurement, and once the packet is back on a
   * shelf they cannot be obtained again.
   */
  readonly readings: readonly TrialReading[];
  readonly timings: {
    /**
     * Shutter-to-file milliseconds, or `null` for an upload.
     *
     * A photo taken minutes ago by another app has no shutter latency this app can claim.
     * `null` says so; a zero would be a number the method cannot support, and it would
     * quietly drag down any latency average computed over the corpus (P4, P8).
     */
    readonly captureMs: number | null;
    readonly extractMs: number;
    readonly evaluateMs: number;
  };
  /** What the cascade recovered at record time — the "note what was missed" column. */
  readonly extracted: readonly {
    readonly fieldId: string;
    readonly value: string;
    readonly sourceText: string;
    readonly stage: string;
    readonly confidence: string;
    /**
     * The stage-B geometry that chose this value, or null when geometry did not choose it.
     *
     * Kept in the record because it is the working behind the pairing, and a reviewer
     * writing an `expect` block needs to see *why* a value was tied to its anchor before
     * agreeing that it should have been. Widened to `string`/`number` here for the same
     * reason `stage` is: a record written by an older build must still parse.
     *
     * **Optional, and absent on records 001 and 002**, which were taken before `A-4`
     * existed. The schema id is deliberately not bumped for it: `extracted` is the
     * descriptive half of a record and the replay reads only `lines` and `expect`, so a
     * record without this key is not a record the suite cannot use.
     */
    readonly association?: {
      readonly direction: string;
      readonly gapHeights: number;
      readonly score: number;
      readonly runnerUpScore: number | null;
    } | null;
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
