/**
 * The decision layer.
 *
 * **This function is where the project's first principle lives.** OCR is statistical and
 * extraction is heuristic, but the step that turns extracted facts into a flag is a pure
 * function of `(fields, pack)` — no learned parameters, no thresholds of its own, no
 * clock, no network, no randomness (P1). Called twice with the same arguments it returns
 * the same verdict, and every finding it emits carries a statute, a rule, a sub-clause
 * and a rule-pack version.
 *
 * Three properties are enforced here rather than trusted:
 *
 *  1. **Advisory cap.** Severity comes from `capSeverity` at pack-load time and is
 *     asserted again before a finding is emitted. An unreviewed pack cannot produce a
 *     `violation` even if a declaration asks for one.
 *  2. **Silence beats a guess.** Below the pack's evidence thresholds the verdict is
 *     `INSUFFICIENT_EVIDENCE`, never `NO_ISSUES_FOUND`. A bad capture must not read as
 *     a clean label (P3, P9).
 *  3. **No cascading flags.** When a field is absent, its presence check fires once;
 *     the checks about the *shape* of that absent value are skipped rather than each
 *     firing their own finding. One missing declaration is one finding.
 *
 * Demo scaffolding. The real evaluator is `T-1.7`, with a Python twin (`T-1.8`) held to
 * it by a conformance suite (`T-1.9`). Do not promote this file.
 */

import type { CompiledCheck, CompiledDeclaration, CompiledPack } from '../rulepack/pack';
import type { ExtractedField, ExtractionResult, OcrFrame } from '../scan/types';
import type { FieldReport, Finding, Verdict, VerdictStatus } from './types';

/** Outcome of a single check. `skipped` carries no finding and no false comfort. */
type CheckOutcome = 'passed' | 'failed' | 'skipped';

function runCheck(
  check: CompiledCheck,
  extracted: ExtractedField | undefined,
  wholeText: string,
): CheckOutcome {
  switch (check.kind) {
    case 'field_present':
      return extracted ? 'passed' : 'failed';

    case 'value_wellformed':
      // The field's absence is already reported by its presence check. Reporting the
      // shape of a value that was never found would be a second finding for one fact.
      if (!extracted) return 'skipped';
      return check.shape.re.test(extracted.value) ? 'passed' : 'failed';

    case 'context_phrase_present':
      // Likewise: a phrase qualifying a declaration is only meaningful once the
      // declaration itself has been found.
      if (!extracted) return 'skipped';
      return check.anyOf.some((phrase) => wholeText.includes(phrase)) ? 'passed' : 'failed';
  }
}

function toFinding(
  declaration: CompiledDeclaration,
  pack: CompiledPack,
  extracted: ExtractedField | undefined,
): Finding {
  const field = pack.fieldById(declaration.fieldId);
  if (!field) {
    // Unreachable: the loader refuses a declaration naming an unknown field. Kept
    // explicit so a future loader change cannot silently produce a label-less finding.
    throw new Error(`declaration ${declaration.id} names unknown field ${declaration.fieldId}`);
  }

  if (
    declaration.severityIfFailed === 'violation' &&
    pack.metadata.provenanceStatus !== 'REVIEWED'
  ) {
    throw new Error(
      `declaration ${declaration.id} would emit a violation from a ${pack.metadata.provenanceStatus} pack`,
    );
  }

  return {
    declarationId: declaration.id,
    fieldId: declaration.fieldId,
    fieldLabel: field.label,
    title: declaration.title,
    requirement: declaration.requirement,
    remedy: declaration.remedy,
    severity: declaration.severityIfFailed,
    clause: {
      statuteCode: pack.metadata.statuteCode,
      statuteLong: pack.metadata.statuteLong,
      rule: declaration.clause.rule,
      subClause: declaration.clause.subClause,
      contested: declaration.clause.contested,
      alternateSubClauses: declaration.clause.alternateReadings.map((a) => a.subClause),
      note: declaration.clause.note,
      verification: declaration.clause.verification,
    },
    packId: pack.metadata.packId,
    packVersion: pack.metadata.packVersion,
    // A finding about something that *is* present can point at it. A finding about an
    // absence has nothing to point at, and says null rather than inventing a region.
    evidenceBox: extracted?.box ?? null,
    evidenceText: extracted?.sourceText ?? null,
  };
}

function buildFieldReports(pack: CompiledPack, byField: ReadonlyMap<string, ExtractedField>) {
  const reports: FieldReport[] = [];
  for (const field of pack.fields) {
    const hit = byField.get(field.id);
    reports.push({
      fieldId: field.id,
      label: field.label,
      shortLabel: field.shortLabel,
      found: hit !== undefined,
      value: hit?.value ?? null,
      stage: hit?.stage ?? null,
      confidence: hit?.confidence ?? null,
      box: hit?.box ?? null,
    });
  }
  return reports;
}

/**
 * Decide whether there is enough evidence to reach a verdict at all.
 *
 * Returns the reason as a sentence when there is not, and null when there is. Both
 * thresholds come from the pack — they are method parameters, and the demo tunes them
 * by editing data.
 */
function insufficiency(pack: CompiledPack, ocrLines: number, fieldsFound: number): string | null {
  const { minOcrLines, minFieldsFound } = pack.metadata;
  if (ocrLines < minOcrLines) {
    return `Only ${ocrLines} line${ocrLines === 1 ? '' : 's'} of text were read, below the ${minOcrLines} needed to judge a label. Move closer, steady the phone, and try again.`;
  }
  if (fieldsFound < minFieldsFound) {
    return `Text was read, but only ${fieldsFound} of the ${pack.fields.length} declarations could be located. This is probably not the declaration panel — try the rear or side of the pack.`;
  }
  return null;
}

/**
 * Evaluate one scan.
 *
 * Pure. `frame` and `extraction` carry their own measured timings; this function adds
 * only its own, so every number on the screen was measured rather than assumed (P8).
 */
export function evaluate(
  pack: CompiledPack,
  frame: OcrFrame,
  extraction: ExtractionResult,
): Verdict {
  const startedAt = Date.now();

  const byField = new Map(extraction.fields.map((f) => [f.fieldId, f]));
  const fieldReports = buildFieldReports(pack, byField);

  const findings: Finding[] = [];
  for (const declaration of pack.declarations) {
    const extracted = byField.get(declaration.fieldId);
    if (runCheck(declaration.check, extracted, extraction.normalisedText) === 'failed') {
      findings.push(toFinding(declaration, pack, extracted));
    }
  }

  const ocrLines = frame.lines.length;
  const fieldsFound = extraction.fields.length;
  const insufficientReason = insufficiency(pack, ocrLines, fieldsFound);

  const status: VerdictStatus = insufficientReason
    ? 'INSUFFICIENT_EVIDENCE'
    : findings.length > 0
      ? 'ATTENTION'
      : 'NO_ISSUES_FOUND';

  return {
    status,
    // When the evidence is insufficient the findings are withheld, not shown greyed
    // out. Half a verdict reads as a verdict.
    findings: status === 'INSUFFICIENT_EVIDENCE' ? [] : findings,
    fields: fieldReports,
    insufficientReason,
    packId: pack.metadata.packId,
    packVersion: pack.metadata.packVersion,
    statuteLong: pack.metadata.statuteLong,
    scopeNote: pack.metadata.scopeNote,
    provenanceStatus: pack.metadata.provenanceStatus,
    provenanceNote: pack.metadata.provenanceNote,
    advisoryOnly: pack.metadata.provenanceStatus !== 'REVIEWED',
    counts: {
      fieldsExpected: pack.fields.length,
      fieldsFound,
      ocrLines,
    },
    timings: {
      ocrMs: frame.ocrMs,
      extractMs: extraction.extractMs,
      evaluateMs: Date.now() - startedAt,
    },
  };
}
