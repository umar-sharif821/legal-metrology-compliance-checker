import { describe, expect, it } from 'vitest';

import rawPack from '../rulepack/demo-lmpc-v0.json';
import { compilePack, DEMO_PACK } from '../rulepack/pack';
import { extract } from '../scan/extract';
import * as fx from '../scan/fixtures';
import type { OcrFrame, OcrLine } from '../scan/types';
import { evaluate } from './evaluate';

/**
 * Lay the same texts out as a large, well-centred panel.
 *
 * Used only where a test needs to hold framing constant while varying something else —
 * `fx.linesFrom`'s small boxes fail D-4's coverage check, which is correct for most
 * fixtures and gets in the way when the point is what happens *after* admission passes.
 */
function wellFramedLines(texts: readonly string[]): OcrLine[] {
  return texts.map((text, i) => ({
    text,
    box: { x: 300, y: 600 + i * 100, width: 400, height: 60 },
  }));
}

function scan(texts: readonly string[], opts: { wellFramed?: boolean } = {}) {
  const lines = opts.wellFramed ? wellFramedLines(texts) : fx.linesFrom(texts);
  const frame: OcrFrame = {
    lines,
    imageWidth: 1080,
    imageHeight: 1920,
    coordinatesTransposed: false,
    ocrMs: 0,
  };
  const verdict = evaluate(DEMO_PACK, frame, extract(DEMO_PACK, lines));
  return { verdict, ids: verdict.findings.map((f) => f.declarationId) };
}

describe('verdict', () => {
  it('finds no issue on a complete, well-formed label', () => {
    const { verdict, ids } = scan(fx.COMPLETE_LABEL);
    expect(ids).toEqual([]);
    expect(verdict.status).toBe('NO_ISSUES_FOUND');
  });

  it('never claims compliance — only that it found no issue', () => {
    // The demo checks eight declarations out of a much larger statute. `COMPLIANT`
    // would be a claim it cannot support (P3); the status vocabulary has no such member.
    const { verdict } = scan(fx.COMPLETE_LABEL);
    expect(['INSUFFICIENT_EVIDENCE', 'NO_ISSUES_FOUND', 'ATTENTION']).toContain(verdict.status);
    expect(JSON.stringify(verdict)).not.toContain('COMPLIANT');
  });

  it('flags an absent price declaration', () => {
    const { verdict, ids } = scan(fx.NO_PRICE);
    expect(verdict.status).toBe('ATTENTION');
    expect(ids).toContain('LMPC-6-1-MRP-PRESENT');
  });

  it('flags a price that omits the prescribed tax wording', () => {
    const { ids } = scan(fx.PRICE_WITHOUT_TAX_WORDING);
    expect(ids).toContain('LMPC-6-1-MRP-INCLUSIVE');
    expect(ids).not.toContain('LMPC-6-1-MRP-PRESENT');
  });

  it('will not call the tax wording absent on a price it found by shape alone', () => {
    // Measured on D-3 record 002. The packet does carry "INCL. OF ALL TAXES"; OCR
    // returned `MIRP RS. 20/- (NCL. OF 42L TAYES)`, so no MRP anchor was recognised,
    // the price was recovered from the surviving rupee sign alone (stage C), and the
    // phrase check flagged a compliant declaration. Claiming the prescribed wording is
    // absent is a claim about what is printed, and a scan that could not read the
    // letters M-R-P has no warrant to make it (P3, P9).
    const { ids } = scan([
      'SOME BRAND',
      'MIRP RS. 20/- (NCL. OF 42L TAYES)',
      'Consumer Care: care@example.com',
      'a line',
      'another line',
      'and another',
    ]);
    expect(ids).not.toContain('LMPC-6-1-MRP-INCLUSIVE');
    expect(ids).not.toContain('LMPC-6-1-MRP-PRESENT');
  });

  it('still calls the tax wording absent on a price it found by anchor', () => {
    // The control: the same check must keep firing where the label was read well
    // enough to say so. `PRICE_WITHOUT_TAX_WORDING` carries `M.R.P. Rs. 30.00`, an
    // anchored stage-A match, and genuinely omits the wording.
    const { ids } = scan(fx.PRICE_WITHOUT_TAX_WORDING);
    expect(ids).toContain('LMPC-6-1-MRP-INCLUSIVE');
  });

  it('distinguishes a malformed declaration from an absent one', () => {
    // `Net Wt. 250` is present but carries no standard unit. That is one finding about
    // its form, not a finding that the declaration is missing.
    const { ids } = scan(fx.QUANTITY_WITHOUT_UNIT);
    expect(ids).toContain('LMPC-6-1-NETQTY-UNIT');
    expect(ids).not.toContain('LMPC-6-1-NETQTY-PRESENT');
  });

  it('emits one finding per missing declaration, not one per check', () => {
    // Both net-quantity rules key off the same field. When it is absent entirely, only
    // the presence rule fires — the shape rule is skipped, not failed.
    const withoutQty = fx.COMPLETE_LABEL.filter((l) => !l.startsWith('Net Wt.'));
    const { ids } = scan(withoutQty);
    expect(ids.filter((id) => id.startsWith('LMPC-6-1-NETQTY'))).toEqual([
      'LMPC-6-1-NETQTY-PRESENT',
    ]);
  });

  it('flags a best-before date as no date of manufacture', () => {
    const { ids } = scan(fx.BEST_BEFORE_ONLY);
    expect(ids).toContain('LMPC-6-1-DATE-PRESENT');
  });
});

describe('degrading visibly', () => {
  it('refuses a verdict when barely any text was read', () => {
    const { verdict } = scan(fx.NEARLY_BLANK);
    expect(verdict.status).toBe('INSUFFICIENT_EVIDENCE');
    // Since D-4 the reason names the *cause* — how the picture was framed — rather than
    // the line count, which is only its symptom. A count tells an officer that it failed;
    // the framing tells them what to do differently.
    expect(verdict.insufficientReason).toMatch(/frame|panel|closer/i);
    expect(verdict.admission.admitted).toBe(false);
  });

  it('still refuses on the line-count floor when the framing itself was fine', () => {
    // D-2's threshold has to survive D-4 sitting in front of it: a frame that passes
    // admission and still carries too little text must be refused for that reason, or
    // adding admission would have quietly retired min_ocr_lines.
    const { verdict } = scan(fx.NEARLY_BLANK, { wellFramed: true });
    expect(verdict.admission.admitted).toBe(true);
    expect(verdict.status).toBe('INSUFFICIENT_EVIDENCE');
    expect(verdict.insufficientReason).toMatch(/line/i);
  });

  it('refuses a verdict on a front-of-pack capture rather than reporting it clean', () => {
    // This is the failure that matters: branding with no declaration panel must never
    // read as a label with nothing wrong with it (P3, P9).
    const { verdict } = scan(fx.FRONT_OF_PACK_ONLY);
    expect(verdict.status).toBe('INSUFFICIENT_EVIDENCE');
    expect(verdict.status).not.toBe('NO_ISSUES_FOUND');
  });

  it('withholds findings entirely when the evidence is insufficient', () => {
    // Half a verdict reads as a verdict.
    const { verdict } = scan(fx.NEARLY_BLANK);
    expect(verdict.findings).toEqual([]);
  });

  it('says why, in words fit for the screen', () => {
    const { verdict } = scan(fx.FRONT_OF_PACK_ONLY);
    expect(verdict.insufficientReason).toBeTruthy();
    expect(verdict.insufficientReason?.length).toBeGreaterThan(30);
  });
});

describe('the advisory-only invariant', () => {
  it('caps every finding at advisory while the pack is unreviewed', () => {
    const { verdict } = scan(fx.NO_PRICE);
    expect(verdict.advisoryOnly).toBe(true);
    for (const f of verdict.findings) expect(f.severity).toBe('advisory');
  });

  it('holds even if a declaration asks for a violation', () => {
    const tampered = structuredClone(rawPack) as Record<string, unknown>;
    for (const d of tampered.declarations as { severity_if_failed: string }[]) {
      d.severity_if_failed = 'violation';
    }
    const pack = compilePack(tampered);
    expect(pack.metadata.provenanceStatus).toBe('PENDING_LEGAL_REVIEW');
    for (const d of pack.declarations) expect(d.severityIfFailed).toBe('advisory');
  });
});

describe('citations', () => {
  it('gives every finding a statute, rule, sub-clause and pack version', () => {
    const { verdict } = scan(fx.NO_PRICE);
    expect(verdict.findings.length).toBeGreaterThan(0);
    for (const f of verdict.findings) {
      expect(f.clause.statuteCode).toBe('LMPC-2011');
      expect(f.clause.rule).toBe('6');
      expect(f.clause.subClause).toMatch(/^\(1\)\([a-z]\)$/);
      expect(f.packId).toBe('demo-lmpc-v0');
      expect(f.packVersion).toBeTruthy();
    }
  });

  it('carries both readings of a contested sub-clause rather than picking one', () => {
    const { verdict } = scan(fx.NO_PRICE);
    const mrp = verdict.findings.find((f) => f.declarationId === 'LMPC-6-1-MRP-PRESENT');
    expect(mrp?.clause.contested).toBe(true);
    expect(mrp?.clause.alternateSubClauses).toContain('(1)(f)');
    expect(mrp?.clause.subClause).toBe('(1)(e)');
  });

  it('points at an image region for a finding about something present', () => {
    const { verdict } = scan(fx.PRICE_WITHOUT_TAX_WORDING);
    const f = verdict.findings.find((x) => x.declarationId === 'LMPC-6-1-MRP-INCLUSIVE');
    expect(f?.evidenceBox).not.toBeNull();
    expect(f?.evidenceText).toBeTruthy();
  });

  it('reports null evidence for an absence rather than inventing a region', () => {
    const { verdict } = scan(fx.NO_PRICE);
    const f = verdict.findings.find((x) => x.declarationId === 'LMPC-6-1-MRP-PRESENT');
    expect(f?.evidenceBox).toBeNull();
  });
});

describe('determinism', () => {
  it('returns the same verdict for the same input', () => {
    const a = scan(fx.PRICE_WITHOUT_TAX_WORDING).verdict;
    const b = scan(fx.PRICE_WITHOUT_TAX_WORDING).verdict;
    expect({ ...a, timings: null }).toEqual({ ...b, timings: null });
  });
});
