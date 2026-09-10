/**
 * The real pipeline, run in the browser.
 *
 * This module imports the project's actual engine — `extract`, `evaluate` and `admit`,
 * the same functions the phone runs and the same ones the 152-test suite covers. It is
 * not a re-implementation and it is not a mock. The only thing this file does is
 * translate between the engine's types and the dashboard's view types.
 *
 * Which means the web app's verdicts are produced by the same deterministic code as the
 * app's (P1), against the same rule pack (P6). If the two ever disagreed on the same
 * OCR output, that would be a bug rather than a difference of opinion.
 *
 * Everything the engine cannot know from an image alone — which officer, which district,
 * which commodity category — is reported as not recorded. It is never filled in with a
 * plausible-looking value.
 */
import { DEMO_PACK } from '@engine/rulepack/pack';
import { extract } from '@engine/scan/extract';
import { hintsFor } from '@engine/scan/admit';
import { evaluate } from '@engine/verdict/evaluate';
import type { AdmissionResult } from '@engine/scan/admit';
import type {
  Association,
  Box as PixelBox,
  ExtractionStage as EngineStage,
} from '@engine/scan/types';
import type { FieldReport as EngineField, Verdict } from '@engine/verdict/types';

import { recognise } from './ocr';
import type { Admission, Box, FieldReport, Finding, FrameCheck, Scan } from './types';

export type Stage = 'ocr' | 'extract' | 'evaluate';

/** What each admission check is actually asking, in words fit for a screen. */
const CHECK_QUESTION: Record<string, string> = {
  text_height: 'Is the print large enough in frame to be resolvable?',
  text_coverage: 'Is a declaration panel actually in frame, or one word on a shelf?',
  edge_touch: 'How much of the text is flush against the frame border?',
};

const STAGE_LABEL: Record<EngineStage, FieldReport['stage']> = {
  A_anchored_inline: 'anchored',
  B_anchored_adjacent: 'geometry',
  C_shape_only: 'shape_only',
};

/**
 * The extraction's working, in a sentence an officer can check against the photograph.
 *
 * A stage-B value with no association was paired by reading order because the engine
 * reported no box for the anchor line. That is a materially weaker basis than geometry,
 * so it says so rather than staying silent (P9).
 */
function workingFor(stage: EngineStage | null, association: Association | null): string | null {
  if (stage === null) return null;
  if (stage === 'A_anchored_inline') return 'Read from the anchor’s own line';
  if (stage === 'C_shape_only') {
    return 'Recovered from the value’s shape alone — no label for it was found in the frame';
  }
  if (!association) {
    return 'Paired with its label by reading order, not geometry — the engine reported no box for the anchor line';
  }
  const where = association.direction === 'right' ? 'to the right of' : 'below';
  const margin =
    association.runnerUpScore === null
      ? ', and it was the only candidate'
      : `, scoring ${association.score.toFixed(2)} against ${association.runnerUpScore.toFixed(2)} for the next best`;
  return `Paired with its label by geometry — the value sits ${association.gapHeights.toFixed(1)} text-heights ${where} the anchor${margin}`;
}

function normaliser(width: number, height: number) {
  return (box: PixelBox | null): Box | null =>
    box === null
      ? null
      : {
          x: box.x / width,
          y: box.y / height,
          w: box.width / width,
          h: box.height / height,
        };
}

function toAdmission(result: AdmissionResult): Admission {
  const checks: FrameCheck[] = result.checks.map((c) => ({
    id: c.id,
    label: c.label,
    question: CHECK_QUESTION[c.id] ?? '',
    measured: c.measured,
    threshold: c.threshold,
    format: 'percent',
    direction: c.bound,
    // An unmeasurable check is neither passed nor failed, and the third state is kept
    // all the way to the screen rather than being collapsed into "failed".
    passed: c.measured === null ? null : c.passed,
  }));

  return {
    admitted: result.admitted,
    reason: result.refusedReason,
    checks,
    unmeasured: result.unscored,
    hints: hintsFor(result),
  };
}

function toFields(
  fields: readonly EngineField[],
  norm: ReturnType<typeof normaliser>,
): FieldReport[] {
  return fields.map((f) => ({
    fieldId: f.fieldId,
    label: f.label,
    shortLabel: f.shortLabel,
    found: f.found,
    value: f.value,
    stage: f.stage === null ? null : STAGE_LABEL[f.stage],
    confidence: f.confidence,
    association: workingFor(f.stage, f.association),
    box: norm(f.box),
  }));
}

function commodityFrom(verdict: Verdict): string {
  const field = verdict.fields.find((f) => f.fieldId === 'commodity_name');
  return field?.found && field.value ? field.value : 'Not established from the label';
}

/**
 * Read one image and reach a verdict on it.
 *
 * Throws if the image cannot be read. It never returns a record it invented — a failed
 * read has to look like a failed read.
 */
export async function analyseInBrowser(
  file: File,
  imageUrl: string,
  onStage?: (stage: Stage) => void,
): Promise<Scan> {
  onStage?.('ocr');
  const { frame, width, height } = await recognise(file);

  onStage?.('extract');
  const extraction = extract(DEMO_PACK, frame.lines);

  onStage?.('evaluate');
  const verdict = evaluate(DEMO_PACK, frame, extraction);

  const norm = normaliser(width, height);
  const findings: Finding[] = verdict.findings.map((f) => ({
    declarationId: f.declarationId,
    severity: f.severity,
    evidenceText: f.evidenceText,
    evidenceBox: norm(f.evidenceBox),
  }));

  return {
    id: `SC-${Date.now().toString(36).toUpperCase().slice(-6)}`,
    capturedAt: new Date().toISOString(),
    // Not derivable from a photograph. Said plainly rather than guessed.
    officer: 'This device',
    district: 'Not recorded',
    category: 'Not classified',
    brand: '',
    commodity: commodityFrom(verdict),
    status: verdict.status,
    source: 'upload',
    imageUrl,
    fields: toFields(verdict.fields, norm),
    findings,
    admission: toAdmission(verdict.admission),
    insufficientReason: verdict.insufficientReason,
    ocrLines: frame.lines.map((l) => l.text),
    packId: verdict.packId,
    packVersion: verdict.packVersion,
    timings: {
      ocrMs: verdict.timings.ocrMs,
      extractMs: verdict.timings.extractMs,
      evaluateMs: verdict.timings.evaluateMs,
    },
    // Measured on this machine, from this image. Not a sample record.
    sample: false,
  };
}
