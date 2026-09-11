/**
 * The backend seam.
 *
 * The FastAPI service is Sprint 3 work and is not built, so the two calls here behave
 * very differently, and the difference matters:
 *
 *  - **Analysing an image never falls back to invented data.** It runs the real engine
 *    in this browser (`lib/engine.ts`) and, if that fails, it throws. An earlier version
 *    of this file answered an upload with a random record from the sample corpus and
 *    attached the user's own photograph to it. On a Verka lassi packet it reported
 *    Santoor toilet soap, with evidence boxes drawn on the real image. A toast saying
 *    "sample data" does not undo that: the screen was asserting a reading of a
 *    photograph it had never looked at. That path is gone and must not come back.
 *
 *  - **Listing past scans does fall back**, to the bundled corpus, because a repository
 *    of historical inspections is not a claim about anything the user just handed over.
 *    It is still labelled everywhere it appears.
 *
 * The rule underneath both: never pair a real artefact with a fabricated conclusion (P9).
 */
import { SAMPLE_SCANS } from './mock';
import { analyseInBrowser, type Stage } from './engine';
import { DECLARATIONS_BY_ID, PACK } from './rulepack';
import { formatDateTime } from './format';
import type { Scan } from './types';

const TIMEOUT_MS = 2500;

/** Where a record came from. `device` means this browser actually read the image. */
export type Origin = 'live' | 'sample' | 'device';

export interface Result<T> {
  readonly data: T;
  readonly origin: Origin;
}

async function withTimeout(input: RequestInfo, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * `POST /api/scan` — multipart upload — with on-device analysis as the real path.
 *
 * The server is tried first because when it exists it will do this better, with a
 * stronger engine and the applicability gates this pack does not model. Until then the
 * browser does the work itself, with the same `extract` and `evaluate` the phone runs.
 *
 * There is no third branch. If neither can read the image, this throws and the screen
 * reports a failed read.
 */
export async function analyseImage(
  file: File,
  onStage?: (stage: Stage) => void,
): Promise<Result<Scan>> {
  const objectUrl = URL.createObjectURL(file);
  // Only the URL the report ends up displaying should survive this call. The other —
  // and both of them, if the read fails — is released rather than left alive for the
  // life of the page.
  let keep = false;

  try {
    try {
      const body = new FormData();
      body.append('image', file);
      const res = await withTimeout('/api/scan', { method: 'POST', body });
      if (!res.ok) throw new Error(`POST /api/scan responded ${res.status}`);
      const data = (await res.json()) as Scan;
      keep = true;
      return { data: { ...data, imageUrl: objectUrl, sample: false }, origin: 'live' };
    } catch {
      // No server. Read it here — and let any failure propagate to the caller.
      const data = await analyseInBrowser(file, objectUrl, onStage);
      keep = data.imageUrl === objectUrl;
      return { data, origin: 'device' };
    }
  } finally {
    if (!keep) URL.revokeObjectURL(objectUrl);
  }
}

/** `GET /api/scans` — the repository behind the Scan Explorer. */
export async function fetchScans(): Promise<Result<readonly Scan[]>> {
  try {
    const res = await withTimeout('/api/scans');
    if (!res.ok) throw new Error(`GET /api/scans responded ${res.status}`);
    const data = (await res.json()) as Scan[];
    return { data: data.map((s) => ({ ...s, sample: false })), origin: 'live' };
  } catch {
    return { data: SAMPLE_SCANS, origin: 'sample' };
  }
}

/**
 * `GET /api/scan/{id}/report` — the PDF notice.
 *
 * With no backend the notice is composed client-side and handed to the browser's own
 * print-to-PDF, which produces a real document rather than a dead button.
 */
export async function downloadNotice(scan: Scan): Promise<Origin> {
  try {
    const res = await withTimeout(`/api/scan/${scan.id}/report`);
    if (!res.ok) throw new Error(`report responded ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${scan.id}-notice.pdf`;
    // Firefox ignores a click on an anchor that is not in the document, and revoking
    // the URL in the same tick can cancel the download before it starts.
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      a.remove();
      URL.revokeObjectURL(url);
    }, 0);
    return 'live';
  } catch {
    openPrintableNotice(scan);
    return 'sample';
  }
}

const esc = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);

function openPrintableNotice(scan: Scan): void {
  const w = window.open('', '_blank', 'width=860,height=1000');
  if (!w) return;

  const rows = scan.findings
    .map((f) => {
      const d = DECLARATIONS_BY_ID.get(f.declarationId);
      if (!d) return '';
      const alt = d.clause.alternates.map((a) => a.sub_clause).join(' or ');
      return `<tr>
        <td class="cite">${esc(d.clause.cite)}${
          d.clause.contested
            ? `<div class="contested">letter contested — also read as ${esc(alt)}</div>`
            : ''
        }</td>
        <td>
          <div class="t">${esc(d.title)}</div>
          <div class="r">${esc(d.requirement)}</div>
          ${f.evidenceText ? `<div class="e">Observed: ${esc(f.evidenceText)}</div>` : ''}
        </td>
        <td class="sev">${esc(f.severity)}</td>
      </tr>`;
    })
    .join('');

  const fieldRows = scan.fields
    .map(
      (f) => `<tr>
        <td>${esc(f.label)}</td>
        <td>${f.found ? esc(f.value ?? '') : '<span class="miss">not found</span>'}</td>
      </tr>`,
    )
    .join('');

  w.document.write(`<!doctype html><html><head><meta charset="utf-8">
<title>${esc(scan.id)} — inspection note</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { font: 11.5px/1.55 -apple-system, "Segoe UI", Roboto, sans-serif; color: #0a1a2f; }
  h1 { font-size: 17px; margin: 0 0 2px; letter-spacing: -0.01em; }
  .sub { color: #5b6b85; font-size: 11px; margin-bottom: 14px; }
  .warn { border: 1.5px solid #8e1f1f; background: #fceded; color: #8e1f1f;
          padding: 10px 12px; border-radius: 6px; margin: 0 0 16px; font-size: 11px; }
  .warn b { display: block; margin-bottom: 3px; text-transform: uppercase; letter-spacing: .05em; font-size: 10px; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: #5b6b85;
       margin: 18px 0 6px; border-bottom: 1px solid #e3e8f0; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; }
  td, th { padding: 6px 8px; border-bottom: 1px solid #eef1f6; vertical-align: top; text-align: left; }
  .meta td:first-child { color: #5b6b85; width: 34%; }
  .cite { font-family: ui-monospace, Consolas, monospace; white-space: nowrap; width: 20%; font-size: 10.5px; }
  .contested { color: #78530a; font-family: inherit; font-size: 9.5px; margin-top: 3px; white-space: normal; }
  .t { font-weight: 600; }
  .r { color: #33445f; margin-top: 2px; }
  .e { color: #8e1f1f; margin-top: 3px; }
  .sev { text-transform: uppercase; font-size: 9.5px; letter-spacing: .05em; color: #78530a; width: 11%; }
  .miss { color: #8e1f1f; }
  footer { margin-top: 22px; padding-top: 10px; border-top: 1px solid #e3e8f0;
           color: #5b6b85; font-size: 10px; }
</style></head><body>
<h1>Inspection note — ${esc(scan.id)}</h1>
<div class="sub">${esc(PACK.statuteLong)} · rule pack ${esc(PACK.id)} v${esc(PACK.version)}</div>

<div class="warn">
  <b>Advisory only — not a determination of law</b>
  ${esc(PACK.provenanceNote)}
</div>

<h2>Package</h2>
<table class="meta">
  <tr><td>Brand</td><td>${esc(scan.brand)}</td></tr>
  <tr><td>Commodity</td><td>${esc(scan.commodity)}</td></tr>
  <tr><td>Category</td><td>${esc(scan.category)}</td></tr>
  <tr><td>Captured</td><td>${esc(formatDateTime(scan.capturedAt))}</td></tr>
  <tr><td>Officer</td><td>${esc(scan.officer)}</td></tr>
  <tr><td>District</td><td>${esc(scan.district)}</td></tr>
</table>

<h2>Declarations read from the label</h2>
<table>${fieldRows}</table>

<h2>Findings (${scan.findings.length})</h2>
${rows ? `<table>${rows}</table>` : '<p>No issue found among the declarations checked.</p>'}

<h2>Scope of this check</h2>
<p>${esc(PACK.scopeNote)}</p>
<p>Frame quality: ${scan.admission.unmeasured.length ? `not measured for ${esc(scan.admission.unmeasured.join(' or '))}.` : 'fully measured.'}
   A capture can pass every check this tool runs and still be unfit to read.</p>

<footer>
  ${scan.sample ? 'GENERATED FROM THE BUNDLED SAMPLE CORPUS — not a record of a real inspection. ' : ''}
  Rule pack status: ${esc(PACK.provenanceStatus)}. Every finding above is capped at
  <b>advisory</b> and must be confirmed by a Legal Metrology officer before any action is taken.
</footer>
<script>window.onload = () => setTimeout(() => window.print(), 250);<\/script>
</body></html>`);
  w.document.close();
}
