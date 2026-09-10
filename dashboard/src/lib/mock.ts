/**
 * The bundled sample corpus.
 *
 * WHY THIS EXISTS: the backend is Sprint 3 work and does not exist yet. Rather than
 * render an empty shell, every screen runs against this corpus so the application is
 * demonstrable end to end with nothing running behind it.
 *
 * WHAT IT IS NOT: a measurement. Every record carries `sample: true`, every screen
 * that shows a figure derived from it says so on the screen, and no accuracy or
 * latency figure anywhere in this app is presented as measured (P8). The timings
 * below are plausible values for a mid-range Android device, not recorded ones, and
 * they are labelled as such wherever they appear.
 *
 * The legal content — clause letters, titles, requirement and remedy text, severity —
 * is NOT invented here. It is read from the rule pack (P6). What this file invents is
 * only which declarations a fictional package happened to be missing.
 */
import { DECLARATIONS, FRAME_ADMISSION, cappedSeverity } from './rulepack';
import type { Admission, Box, FieldReport, Finding, FrameCheck, Scan, ScanStatus } from './types';

const OFFICERS = [
  'A. Deshmukh',
  'S. Kulkarni',
  'R. Iyer',
  'M. Sheikh',
  'P. Rane',
  'N. Gaikwad',
] as const;

const DISTRICTS = [
  'Pune City',
  'Pimpri-Chinchwad',
  'Nashik',
  'Nagpur',
  'Thane',
  'Chhatrapati Sambhajinagar',
] as const;

/** Where each declaration sits on the drawn sample label, normalised 0..1. */
const FIELD_BOX: Record<string, Box> = {
  commodity_name: { x: 0.045, y: 0.116, w: 0.62, h: 0.062 },
  net_quantity: { x: 0.045, y: 0.42, w: 0.27, h: 0.073 },
  retail_sale_price: { x: 0.545, y: 0.42, w: 0.4, h: 0.095 },
  date_of_packing: { x: 0.045, y: 0.553, w: 0.46, h: 0.043 },
  manufacturer_address: { x: 0.045, y: 0.659, w: 0.78, h: 0.129 },
  consumer_care: { x: 0.045, y: 0.822, w: 0.75, h: 0.063 },
};

interface Template {
  readonly key: string;
  readonly brand: string;
  readonly commodity: string;
  readonly category: string;
  /** Field id -> printed value. A field absent from this map was not found. */
  readonly values: Readonly<Record<string, string>>;
  /** Declaration ids that failed for a reason other than the field being absent. */
  readonly defects?: Readonly<Record<string, string>>;
  /** Set when the frame itself was refused; no verdict is offered for it. */
  readonly refused?: { readonly check: string; readonly measured: number };
  readonly weight: number;
}

const TEMPLATES: readonly Template[] = [
  {
    key: 'parle-g',
    brand: 'Parle',
    commodity: 'Glucose biscuits',
    category: 'Bakery & confectionery',
    weight: 30,
    values: {
      commodity_name: 'Glucose biscuits',
      manufacturer_address:
        'Mfd. by Parle Products Pvt. Ltd., Village Bhandup, Mumbai 400078, Maharashtra',
      net_quantity: '250 g',
      retail_sale_price: '₹45.00 (incl. of all taxes)',
      date_of_packing: '08/2026',
      consumer_care: 'care@example.in · 1800 200 1100',
    },
  },
  {
    key: 'tata-salt',
    brand: 'Tata',
    commodity: 'Iodised salt',
    category: 'Packaged staples',
    weight: 22,
    values: {
      commodity_name: 'Iodised salt',
      manufacturer_address: 'Mfd. by Tata Chemicals Ltd., Mithapur 361345, Gujarat',
      net_quantity: '1 kg',
      retail_sale_price: '₹28.00 (incl. of all taxes)',
      date_of_packing: '07/2026',
      consumer_care: 'consumercare@example.in · 1800 419 8000',
    },
  },
  {
    key: 'bisleri',
    brand: 'Bisleri',
    commodity: 'Packaged drinking water',
    category: 'Beverages',
    weight: 18,
    values: {
      commodity_name: 'Packaged drinking water',
      manufacturer_address: 'Packed by Bisleri International Pvt. Ltd., Pune 411018, Maharashtra',
      net_quantity: '1 L',
      retail_sale_price: '₹20.00 (incl. of all taxes)',
      date_of_packing: '09/2026',
      consumer_care: 'care@example.in · 1800 121 1000',
    },
  },
  {
    key: 'fortune-oil',
    brand: 'Fortune',
    commodity: 'Refined sunflower oil',
    category: 'Edible oils',
    weight: 9,
    defects: {
      'LMPC-6-1-MRP-INCLUSIVE':
        'MRP ₹145.00 — no "inclusive of all taxes" wording anywhere on the panel',
    },
    values: {
      commodity_name: 'Refined sunflower oil',
      manufacturer_address: 'Mfd. by Adani Wilmar Ltd., Mundra 370421, Gujarat',
      net_quantity: '1 L',
      retail_sale_price: '₹145.00',
      date_of_packing: '08/2026',
      consumer_care: 'customercare@example.in · 1800 103 1030',
    },
  },
  {
    key: 'amul-butter',
    brand: 'Amul',
    commodity: 'Table butter',
    category: 'Dairy',
    weight: 7,
    values: {
      commodity_name: 'Table butter',
      manufacturer_address: 'Mfd. by Kaira District Co-op Milk Producers Union, Anand 388001',
      net_quantity: '100 g',
      retail_sale_price: '₹62.00 (incl. of all taxes)',
      consumer_care: 'info@example.in · 1800 258 3333',
    },
  },
  {
    key: 'santoor',
    brand: 'Santoor',
    commodity: 'Toilet soap',
    category: 'Personal care',
    weight: 7,
    values: {
      commodity_name: 'Toilet soap',
      manufacturer_address: 'Mfd. by Wipro Enterprises Ltd., Amalner 425401, Maharashtra',
      net_quantity: '125 g',
      retail_sale_price: '₹40.00 (incl. of all taxes)',
      date_of_packing: '06/2026',
    },
  },
  {
    key: 'surf',
    brand: 'Surf Excel',
    commodity: 'Detergent powder',
    category: 'Household cleaning',
    weight: 6,
    defects: {
      'LMPC-6-1-NETQTY-UNIT': 'Net Qty: 500 — declared with no unit of measurement',
    },
    values: {
      commodity_name: 'Detergent powder',
      manufacturer_address: 'Mfd. by Hindustan Unilever Ltd., Mumbai 400099, Maharashtra',
      net_quantity: '500',
      retail_sale_price: '₹99.00 (incl. of all taxes)',
      date_of_packing: '07/2026',
      consumer_care: 'care@example.in · 1800 220 3000',
    },
  },
  {
    key: 'everest',
    brand: 'Everest',
    commodity: 'Garam masala',
    category: 'Spices & condiments',
    weight: 6,
    values: {
      commodity_name: 'Garam masala',
      net_quantity: '100 g',
      retail_sale_price: '₹85.00 (incl. of all taxes)',
      date_of_packing: '05/2026',
      consumer_care: 'care@example.in · 1800 222 111',
    },
  },
  {
    key: 'unbranded-namkeen',
    brand: 'Unbranded (local packer)',
    commodity: 'Namkeen mixture',
    category: 'Snacks',
    weight: 9,
    values: {
      commodity_name: 'Namkeen mixture',
      net_quantity: '200 g',
    },
  },
  {
    key: 'refused-frame',
    brand: 'Unbranded (local packer)',
    commodity: 'Not established',
    category: 'Snacks',
    weight: 6,
    refused: { check: 'text_height', measured: 0.006 },
    values: {},
  },
];

// ---------------------------------------------------------------------------
// Deterministic generation. Seeded so the demo is identical on every reload — a
// corpus that reshuffles between rehearsal and presentation is a liability.
// ---------------------------------------------------------------------------

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function pick<T>(rand: () => number, xs: readonly T[]): T {
  return xs[Math.floor(rand() * xs.length) % xs.length] as T;
}

function weightedTemplate(rand: () => number): Template {
  const total = TEMPLATES.reduce((n, t) => n + t.weight, 0);
  let r = rand() * total;
  for (const t of TEMPLATES) {
    r -= t.weight;
    if (r <= 0) return t;
  }
  return TEMPLATES[0] as Template;
}

function admissionFor(t: Template, rand: () => number): Admission {
  const raw: Omit<FrameCheck, 'passed'>[] = [
    {
      id: 'text_height',
      label: 'Print size',
      question: 'Is the print large enough in frame to be resolvable?',
      measured: t.refused?.check === 'text_height' ? t.refused.measured : 0.019 + rand() * 0.016,
      threshold: FRAME_ADMISSION.minTextHeightFraction,
      format: 'percent',
      direction: 'min',
    },
    {
      id: 'text_coverage',
      label: 'Panel coverage',
      question: 'Is a declaration panel actually in frame, or one word on a shelf?',
      measured: t.refused?.check === 'text_coverage' ? t.refused.measured : 0.05 + rand() * 0.09,
      threshold: FRAME_ADMISSION.minTextCoverage,
      format: 'percent',
      direction: 'min',
    },
    {
      id: 'edge_touch',
      label: 'Panel cropping',
      question: 'How much of the text is flush against the frame border?',
      measured: t.refused?.check === 'edge_touch' ? t.refused.measured : rand() * 0.16,
      threshold: FRAME_ADMISSION.maxEdgeTouchFraction,
      format: 'percent',
      direction: 'max',
    },
  ];

  const checks: FrameCheck[] = raw.map((c) => ({
    ...c,
    passed:
      c.measured === null
        ? null
        : c.direction === 'min'
          ? c.measured >= c.threshold
          : c.measured <= c.threshold,
  }));

  const failed = checks.filter((c) => c.passed === false);
  const hintFor = (id: string): string =>
    id === 'text_height'
      ? 'Move closer until the declaration panel fills the frame'
      : id === 'text_coverage'
        ? 'Frame the whole declaration panel, not a single line'
        : 'Pull back — the panel is cut off at the frame edge';

  return {
    admitted: failed.length === 0,
    reason:
      failed.length === 0
        ? null
        : 'Frame refused before any verdict was formed: ' +
          failed.map((c) => c.label.toLowerCase()).join(', ') +
          ' below what the method needs. No finding is offered for this capture.',
    checks,
    unmeasured: FRAME_ADMISSION.unscored,
    hints: failed.map((c) => hintFor(c.id)),
  };
}

function buildScan(index: number, rand: () => number, nowMs: number): Scan {
  const t = weightedTemplate(rand);
  const admission = admissionFor(t, rand);

  const daysAgo = Math.floor(rand() * 30);
  const captured = new Date(nowMs - daysAgo * 86400000 - Math.floor(rand() * 8 * 3600000));

  const fields: FieldReport[] = DECLARATIONS.reduce<FieldReport[]>((acc, d) => {
    if (acc.some((f) => f.fieldId === d.fieldId)) return acc;
    const printed = t.values[d.fieldId];
    const found = admission.admitted && printed !== undefined;
    const stage = !found
      ? null
      : d.fieldId === 'manufacturer_address' || d.fieldId === 'consumer_care'
        ? 'anchored'
        : rand() < 0.55
          ? 'geometry'
          : 'anchored';
    acc.push({
      fieldId: d.fieldId,
      label: d.fieldLabel,
      shortLabel: d.fieldShortLabel,
      found,
      value: found ? (printed as string) : null,
      stage,
      confidence: !found ? null : rand() < 0.72 ? 'high' : rand() < 0.8 ? 'medium' : 'low',
      association:
        found && stage === 'geometry'
          ? 'Paired with its label by geometry — the value sits ' +
            (1.1 + rand() * 2.4).toFixed(1) +
            ' text-heights to the right of the anchor, on the same row'
          : found
            ? 'Read from the anchor’s own line'
            : null,
      box: found ? (FIELD_BOX[d.fieldId] ?? null) : null,
    });
    return acc;
  }, []);

  const foundIds = new Set(fields.filter((f) => f.found).map((f) => f.fieldId));

  const findings: Finding[] = admission.admitted
    ? DECLARATIONS.filter((d) => {
        if (d.checkKind === 'field_present') return !foundIds.has(d.fieldId);
        if (!foundIds.has(d.fieldId)) return false;
        return t.defects?.[d.id] !== undefined;
      }).map((d) => ({
        declarationId: d.id,
        severity: cappedSeverity(d),
        evidenceText: t.defects?.[d.id] ?? null,
        evidenceBox: foundIds.has(d.fieldId) ? (FIELD_BOX[d.fieldId] ?? null) : null,
      }))
    : [];

  const status: ScanStatus = !admission.admitted
    ? 'INSUFFICIENT_EVIDENCE'
    : findings.length === 0
      ? 'NO_ISSUES_FOUND'
      : 'ATTENTION';

  return {
    id: 'SC-' + String(24000 + index).padStart(5, '0'),
    capturedAt: captured.toISOString(),
    officer: pick(rand, OFFICERS),
    district: pick(rand, DISTRICTS),
    category: t.category,
    brand: t.brand,
    commodity: t.commodity,
    status,
    source: rand() < 0.82 ? 'device' : 'upload',
    imageUrl: null,
    fields,
    findings,
    admission,
    insufficientReason: admission.reason,
    packId: 'demo-lmpc-v0',
    packVersion: '0.1.0',
    timings: {
      ocrMs: Math.round(380 + rand() * 520),
      extractMs: Math.round(4 + rand() * 11),
      evaluateMs: Math.round(1 + rand() * 3),
    },
    sample: true,
  };
}

// Anchored to load time, not to a fixed instant: a corpus dated in the future
// reports every row as "just now". Only the timestamps move; which packets exist
// and what each one is missing stays fully deterministic.
const NOW = Date.now();

export const SAMPLE_SCANS: readonly Scan[] = (() => {
  const rand = lcg(26034);
  return Array.from({ length: 148 }, (_, i) => buildScan(i, rand, NOW)).sort(
    (a, b) => Date.parse(b.capturedAt) - Date.parse(a.capturedAt),
  );
})();

export const SAMPLE_OFFICERS = OFFICERS;
export const SAMPLE_DISTRICTS = DISTRICTS;

// `sampleScanFor` used to live here: it fabricated a record for an uploaded image so the
// upload flow would always "work". It was deleted rather than fixed. Pairing a real
// photograph with an invented verdict is the one thing this project must never do, and a
// helper that makes it easy is a loaded gun in the drawer. Uploads go through
// `lib/engine.ts`, which reads the image or fails out loud.
