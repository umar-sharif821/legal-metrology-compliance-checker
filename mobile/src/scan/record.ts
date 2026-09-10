/**
 * Field-trial recorder — phase `D-3`.
 *
 * `docs/DEMO_PLAN.md` §4 D-3 says: "for each packet: capture, record the raw OCR lines,
 * note what was missed", then "add each real line set to the test fixtures as it is
 * found, so tuning cannot regress an earlier packet". Nothing in the app could do the
 * recording half. This module is that half; `corpus.test.ts` is the other.
 *
 * Two things are written per packet, into the **document** directory rather than the
 * cache, because the cache is exactly where the scan loop deletes things and where
 * Android may reclaim space mid-trial:
 *
 * - `NNN-<slug>.json` — the raw lines with their boxes, what the cascade made of them,
 *   and the verdict that followed. This is the artefact a fixture is written from.
 * - `NNN-<slug>.jpg` — the frame itself, copied out of the loop's cache before the loop
 *   resumes and deletes it.
 *
 * The record is descriptive, never normative: it says what the app *did*, and the `expect`
 * block a reviewer adds later says what it *should* do. Having the device write both
 * would only enshrine today's behaviour as correct.
 *
 * Demo scaffolding, like the rest of `mobile/`. The real corpus is `T-2.8`'s gold set.
 */
import { Directory, File, Paths } from 'expo-file-system';

import { RECORD_SCHEMA_ID, TRIAL_DIR, slugify, type FieldTrialRecord } from './recordTypes';
import type { CaptureSource, ExtractionResult, OcrFrame } from './types';
import type { Verdict } from '../verdict/types';

export { RECORD_SCHEMA_ID, TRIAL_DIR } from './recordTypes';
export type { FieldTrialRecord } from './recordTypes';

function trialDirectory(): Directory {
  const dir = new Directory(Paths.document, TRIAL_DIR);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/**
 * How many records this device already holds.
 *
 * Counted from the directory rather than held in state, so the numbering survives an app
 * restart. A field trial spanning a lunch break must not start again at 001 and overwrite
 * the morning's packets.
 */
export function recordCount(): number {
  try {
    return trialDirectory()
      .list()
      .filter((entry) => entry instanceof File && entry.uri.endsWith('.json')).length;
  } catch {
    return 0;
  }
}

export interface RecordInput {
  readonly packet: string;
  readonly captureUri: string;
  readonly captureMs: number | null;
  /** Where the image came from. Carried, never guessed — see `recordTypes.ts`. */
  readonly source: CaptureSource;
  readonly frame: OcrFrame;
  readonly extraction: ExtractionResult;
  readonly verdict: Verdict;
}

export interface RecordResult {
  readonly seq: number;
  readonly jsonName: string;
  readonly imageName: string;
  readonly directoryUri: string;
}

/**
 * Write one packet's record to disk.
 *
 * Synchronous by design. It runs on a frozen frame with the loop stopped, the payload is
 * tens of kilobytes, and an operator standing over a packet needs to know the record
 * landed *before* they put the packet down — an async write whose failure surfaces two
 * screens later is how a trial ends up with nine records and no idea which packet is
 * missing (P9).
 *
 * Throws on failure. The caller shows the message.
 */
export function recordCapture(input: RecordInput): RecordResult {
  const dir = trialDirectory();
  const seq = recordCount() + 1;
  const stem = `${String(seq).padStart(3, '0')}-${slugify(input.packet)}`;
  const imageName = `${stem}.jpg`;
  const jsonName = `${stem}.json`;

  // The image first. If it fails there is no half-record naming an image that is not
  // there — a JSON file pointing at a missing JPEG is worse than no record at all.
  const image = new File(dir, imageName);
  if (image.exists) image.delete();
  new File(input.captureUri).copySync(image);

  const record: FieldTrialRecord = {
    schema: RECORD_SCHEMA_ID,
    recordedAt: new Date().toISOString(),
    seq,
    packet: input.packet,
    imageFile: imageName,
    source: input.source,
    frame: {
      imageWidth: input.frame.imageWidth,
      imageHeight: input.frame.imageHeight,
      coordinatesTransposed: input.frame.coordinatesTransposed,
    },
    timings: {
      captureMs: input.captureMs,
      ocrMs: input.frame.ocrMs,
      extractMs: input.extraction.extractMs,
      evaluateMs: input.verdict.timings.evaluateMs,
    },
    lines: input.frame.lines.map((line) => ({ text: line.text, box: line.box })),
    extracted: input.extraction.fields.map((field) => ({
      fieldId: field.fieldId,
      value: field.value,
      sourceText: field.sourceText,
      stage: field.stage,
      confidence: field.confidence,
    })),
    verdict: {
      status: input.verdict.status,
      insufficientReason: input.verdict.insufficientReason,
      packId: input.verdict.packId,
      packVersion: input.verdict.packVersion,
      findings: input.verdict.findings.map((finding) => ({
        declarationId: finding.declarationId,
        fieldId: finding.fieldId,
        title: finding.title,
        severity: finding.severity,
        hasEvidenceBox: finding.evidenceBox !== null,
      })),
    },
  };

  const json = new File(dir, jsonName);
  if (json.exists) json.delete();
  json.create();
  json.write(`${JSON.stringify(record, null, 2)}\n`);

  return { seq, jsonName, imageName, directoryUri: dir.uri };
}
