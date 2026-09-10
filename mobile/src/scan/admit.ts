/**
 * Frame admission — decide whether a frame is worth judging at all (`D-4`).
 *
 * **The point is to prevent a wrong verdict at the source**, rather than to catch one
 * afterwards. A frame that fails admission is refused: no findings are offered for it and
 * the screen says which check it failed, so an officer sees *why* rather than seeing a
 * confident answer drawn from a picture that could not support one (**P3**, **P9**).
 *
 * **What this does NOT do, stated here because it is the honest limit of the phase.**
 * `DEMO_PLAN` §4 D-4 asks for blur, glare and text coverage scored *before* OCR runs.
 * Coverage is here; blur and glare are not, and could not be. Both need raw pixels, and
 * the app has no pixel access — `expo-camera` hands back a file, there is no frame
 * processor until `T-1.12`, and decoding a 12 MP JPEG in JS per frame is not viable. The
 * tempting substitute, some function of OCR line count or text density called a "blur
 * score", would be a number the method cannot support (**P4**). So sharpness is left
 * unmeasured and *said* to be unmeasured; `FrameAdmission.unscored` carries the list and
 * the UI prints it.
 *
 * It also means admission runs *after* OCR rather than before it, since text geometry is
 * the only signal available. The CPU saving the plan wanted is therefore not achieved —
 * only the correctness half is. That is a real deviation and is recorded as one.
 *
 * Pure and free of React Native imports, so it runs under Node in the test suite.
 */
import type { FrameAdmission } from '../rulepack/pack';
import type { Box, OcrFrame } from './types';

/** One admission check's working, kept so the screen can show the number (**P7**). */
export interface AdmissionCheck {
  readonly id: 'text_height' | 'text_coverage' | 'edge_touch';
  /** What a person should read: "Print size", not "minTextHeightFraction". */
  readonly label: string;
  /** The measured value, or null when the frame carried no geometry to measure. */
  readonly measured: number | null;
  readonly threshold: number;
  /** Which side of the threshold passes — `min` means measured must be at least it. */
  readonly bound: 'min' | 'max';
  readonly passed: boolean;
  /** Why it failed, in words fit for a screen. Null when it passed. */
  readonly reason: string | null;
  /**
   * The same failure as a coach hint — a few words an operator can act on mid-scan.
   *
   * Separate from `reason` because the two are read in different places at different
   * speeds: `reason` explains a refusal on the verdict screen, where there is room and
   * the scan is already over; `hint` sits over a live viewfinder, where anything longer
   * than a glance is not read at all. Null when the check passed.
   */
  readonly hint: string | null;
}

export interface AdmissionResult {
  readonly admitted: boolean;
  readonly checks: readonly AdmissionCheck[];
  /** The failed checks' reasons, joined for the screen. Null when admitted. */
  readonly refusedReason: string | null;
  /** What was not measured at all, carried through from the pack (**P9**). */
  readonly unscored: readonly string[];
  /**
   * True when the engine reported no boxes, so nothing could be measured.
   *
   * Distinct from failing: an unmeasurable frame is not a bad frame, and saying so is the
   * difference between "this picture is poor" and "I could not tell" (**P9**).
   */
  readonly unmeasurable: boolean;
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

/** Does the box run into the frame's border, within a tolerance of its own height? */
function touchesEdge(b: Box, width: number, height: number): boolean {
  // A box genuinely at the panel's edge sits a glyph-height or so inside the frame; one
  // that is cut off ends flush against it. The tolerance scales with the text so it does
  // not become a pixel count tied to one camera distance.
  const slack = b.height * 0.25;
  return (
    b.x <= slack ||
    b.y <= slack ||
    b.x + b.width >= width - slack ||
    b.y + b.height >= height - slack
  );
}

/**
 * Score a frame's geometry against the pack's admission thresholds.
 *
 * Every threshold is pack data; this function holds none of its own (**P6**). The one
 * bare number here is `touchesEdge`'s quarter-height slack, which is a definition of
 * "flush against the border" rather than a tunable quality bar.
 */
export function admit(frame: OcrFrame, thresholds: FrameAdmission): AdmissionResult {
  const boxes = frame.lines.map((l) => l.box).filter((b): b is Box => b !== null);
  const area = frame.imageWidth * frame.imageHeight;

  if (boxes.length === 0 || area <= 0) {
    const checks: AdmissionCheck[] = [
      unmeasured('text_height', 'Print size', thresholds.minTextHeightFraction, 'min'),
      unmeasured('text_coverage', 'Panel in frame', thresholds.minTextCoverage, 'min'),
      unmeasured('edge_touch', 'Panel cut off', thresholds.maxEdgeTouchFraction, 'max'),
    ];
    return {
      // Not admitted, but not blamed on the frame either — nothing was measurable.
      admitted: false,
      checks,
      refusedReason:
        'The engine reported no text positions for this frame, so its quality could not be judged at all. This is a limit of the reading, not a verdict about the picture.',
      unscored: thresholds.unscored,
      unmeasurable: true,
    };
  }

  const heightFraction = median(boxes.map((b) => b.height)) / frame.imageHeight;
  const coverage = boxes.reduce((sum, b) => sum + b.width * b.height, 0) / area;
  const edgeTouch =
    boxes.filter((b) => touchesEdge(b, frame.imageWidth, frame.imageHeight)).length / boxes.length;

  const checks: AdmissionCheck[] = [
    check(
      'text_height',
      'Print size',
      heightFraction,
      thresholds.minTextHeightFraction,
      'min',
      'The print is too small in the frame to be read reliably. Move closer, or fill more of the screen with the declaration panel.',
      'Move closer',
    ),
    check(
      'text_coverage',
      'Panel in frame',
      coverage,
      thresholds.minTextCoverage,
      'min',
      'Very little of this frame is text, so it is probably not a declaration panel. Point at the panel on the rear or side of the pack.',
      'Find the declaration panel',
    ),
    check(
      'edge_touch',
      'Panel cut off',
      edgeTouch,
      thresholds.maxEdgeTouchFraction,
      'max',
      'Much of the text runs off the edge of the frame, so the panel is cut off. Pull back until the whole panel is inside the picture.',
      'Pull back — panel is cut off',
    ),
  ];

  const failed = checks.filter((c) => !c.passed);
  return {
    admitted: failed.length === 0,
    checks,
    refusedReason: failed.length === 0 ? null : failed.map((c) => c.reason).join(' '),
    unscored: thresholds.unscored,
    unmeasurable: false,
  };
}

function check(
  id: AdmissionCheck['id'],
  label: string,
  measured: number,
  threshold: number,
  bound: 'min' | 'max',
  reason: string,
  hint: string,
): AdmissionCheck {
  const passed = bound === 'min' ? measured >= threshold : measured <= threshold;
  return {
    id,
    label,
    measured,
    threshold,
    bound,
    passed,
    reason: passed ? null : reason,
    hint: passed ? null : hint,
  };
}

function unmeasured(
  id: AdmissionCheck['id'],
  label: string,
  threshold: number,
  bound: 'min' | 'max',
): AdmissionCheck {
  return { id, label, measured: null, threshold, bound, passed: false, reason: null, hint: null };
}

/**
 * The coach hints for a frame, in the order they should be shown. Empty when admitted.
 *
 * Deliberately not deduplicated or ranked by severity: the checks are already in the
 * order an operator would fix them — get closer, find the panel, then fit it in frame.
 */
export function hintsFor(result: AdmissionResult): readonly string[] {
  return result.checks.map((c) => c.hint).filter((h): h is string => h !== null);
}

/**
 * Is `a` a better frame to freeze on than `b`? (`D-4`, best-of-N.)
 *
 * **Lexicographic, with no weighting constant.** More checks passed wins; ties break on
 * how much of the frame is text, which is the closest thing to "more of the panel was
 * legible" that the geometry supports. The alternative — a weighted composite quality
 * score — would need two or three weights that nothing in the method justifies, and P4
 * bars inventing them. An ordering needs no units; a score would have to mean something.
 *
 * An unmeasurable frame never beats a measurable one: it is not known to be worse, but
 * freezing on it would be choosing the frame we know least about.
 */
export function isBetterFrame(a: AdmissionResult, b: AdmissionResult): boolean {
  if (a.unmeasurable !== b.unmeasurable) return b.unmeasurable;
  const passed = (r: AdmissionResult): number => r.checks.filter((c) => c.passed).length;
  if (passed(a) !== passed(b)) return passed(a) > passed(b);
  return coverageOf(a) > coverageOf(b);
}

function coverageOf(r: AdmissionResult): number {
  return r.checks.find((c) => c.id === 'text_coverage')?.measured ?? 0;
}
