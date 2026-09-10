/**
 * Google Gemini as a recognition adapter.
 *
 * WHY: Tesseract is a glyph matcher with no language understanding. On creased, glossy,
 * angled Indian packaging it produced readings like "sanedoched by: Sui Food rvs LI",
 * and a night of measured tuning — segmentation modes, upscaling, panel cropping,
 * best-of-N, a PaddleOCR trial — moved it by roughly one target string in ten. The
 * ceiling is the engine. A vision model reads a label the way a person does, using
 * context to resolve a damaged glyph, so this is the step change that tuning cannot give.
 *
 * WHAT THIS DOES **NOT** DO, and it is the point of the whole design: it does not decide
 * anything. It returns text and boxes. Every judgement downstream — which declarations
 * are present, which rule they answer to, what severity a finding carries — is the same
 * pure function of `(fields, geometry, pack)` it has always been (P1). A model's opinion
 * is not reproducible; an enforcement action has to be. So the statistical part is
 * confined to perception, exactly where the project always said it belonged.
 *
 * PLAN POSITION: `T-3.3` names cloud recognition as an intended adapter. This is that
 * task's browser-side half, sitting behind the same seam `A-0` built.
 *
 * OFFLINE: this breaks P2 for the web app, and the app says so rather than hiding it.
 * Tesseract remains the default and the fallback, so the network stays an enhancement
 * path and never a dependency; the Android app is untouched and still reaches a verdict
 * with no network at all.
 *
 * PRIVACY: the image is sent to Google. The UI states that before the key is accepted.
 * For a pilot over retail packaging that is a reasonable trade; for a production
 * deployment this adapter is the thing you swap for a self-hosted model or a vendor under
 * a data-processing agreement, which is a configuration change rather than a rewrite.
 */
import type { Box, OcrFrame, OcrLine } from '@engine/scan/types';
import { canvasBase64, loadImageElement, renderTo, type Candidate } from './imaging';

/** Long edge sent to the model. Beyond this costs tokens without helping the read. */
const MAX_EDGE = 1600;

const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta';

/**
 * The models to try, best first.
 *
 * Resolved against the account's own model list rather than assumed, because model
 * availability changes and a hard-coded name that 404s during a demonstration is a
 * failure with no diagnosis attached.
 */
const PREFERRED = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];

let resolvedModel: string | null = null;

async function pickModel(key: string): Promise<string> {
  if (resolvedModel) return resolvedModel;

  const res = await fetch(`${API_ROOT}/models?key=${encodeURIComponent(key)}`);
  if (!res.ok) {
    throw new Error(
      res.status === 400 || res.status === 403
        ? 'Google rejected that API key. Check it was copied whole from aistudio.google.com.'
        : `Could not reach Google (HTTP ${res.status}).`,
    );
  }
  const body = (await res.json()) as {
    models?: { name?: string; supportedGenerationMethods?: string[] }[];
  };

  const usable = (body.models ?? [])
    .filter((m) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
    .map((m) => (m.name ?? '').replace(/^models\//, ''))
    .filter(Boolean);

  const chosen =
    PREFERRED.find((p) => usable.includes(p)) ??
    usable.find((m) => m.includes('flash') && !m.includes('thinking')) ??
    usable[0];

  if (!chosen) throw new Error('That key has no models available for image reading.');
  resolvedModel = chosen;
  return chosen;
}

/**
 * The prompt.
 *
 * Deliberately narrow. It asks for transcription and geometry and nothing else — no
 * interpretation, no field names, no compliance opinion. The moment a model is asked
 * "is this compliant?" the determinism argument collapses, and that argument is the
 * project. Spacing is called out because word boundaries are what the pack's anchors
 * match on, and a run-together transcription silently defeats every one of them.
 */
const PROMPT = `Transcribe every line of printed text visible on this product package.

Rules:
- One entry per visual line, in reading order.
- Copy the text exactly as printed, preserving spaces between words and original punctuation.
- Do not translate, correct spelling, expand abbreviations, or add anything not printed.
- Keep text from separate panels or columns as separate lines; never join them.
- Transcribe Devanagari and other scripts in their own script.
- If a line is unreadable, omit it rather than guessing.

For each line give box_2d as [ymin, xmin, ymax, xmax], integers 0-1000, normalised to the image.`;

const SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      text: { type: 'STRING' },
      box_2d: { type: 'ARRAY', items: { type: 'INTEGER' } },
    },
    required: ['text', 'box_2d'],
  },
} as const;

interface ModelLine {
  text?: string;
  box_2d?: number[];
}

/**
 * Gemini reports boxes as [ymin, xmin, ymax, xmax] normalised to 0-1000.
 *
 * Returns null rather than a guess when the quadruple is missing or degenerate: a null
 * box costs the evidence region for that line, which the report already handles and
 * states, whereas an invented box would point an officer at the wrong part of the label.
 */
function toBox(raw: number[] | undefined, width: number, height: number): Box | null {
  if (!Array.isArray(raw) || raw.length !== 4) return null;
  const [ymin, xmin, ymax, xmax] = raw;
  if ([ymin, xmin, ymax, xmax].some((n) => typeof n !== 'number' || !Number.isFinite(n))) {
    return null;
  }
  const x = (Math.min(xmin as number, xmax as number) / 1000) * width;
  const y = (Math.min(ymin as number, ymax as number) / 1000) * height;
  const w = (Math.abs((xmax as number) - (xmin as number)) / 1000) * width;
  const h = (Math.abs((ymax as number) - (ymin as number)) / 1000) * height;
  if (!(w > 0) || !(h > 0)) return null;
  return { x, y, width: w, height: h };
}

/** Read one image with Gemini. Throws rather than returning anything invented. */
export async function recogniseGemini(
  file: File,
  key: string,
): Promise<{ candidates: Candidate[] }> {
  const trimmed = key.trim();
  if (!trimmed) throw new Error('No Google AI Studio API key has been set.');

  const { img, revoke } = await loadImageElement(file);
  try {
    const { canvas, width, height } = renderTo(img, MAX_EDGE);
    const model = await pickModel(trimmed);

    const startedAt = performance.now();
    const res = await fetch(
      `${API_ROOT}/models/${model}:generateContent?key=${encodeURIComponent(trimmed)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: PROMPT },
                { inline_data: { mime_type: 'image/jpeg', data: canvasBase64(canvas) } },
              ],
            },
          ],
          generationConfig: {
            // Zero temperature: transcription is not a creative task, and a demonstration
            // that reads the same packet differently twice is worse than one that reads
            // it imperfectly the same way twice.
            temperature: 0,
            responseMimeType: 'application/json',
            responseSchema: SCHEMA,
          },
        }),
      },
    );

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(
        res.status === 429
          ? 'Google rate-limited the request. Wait a moment and try again.'
          : `Google returned HTTP ${res.status}. ${detail.slice(0, 200)}`,
      );
    }

    const ocrMs = Math.round(performance.now() - startedAt);
    const body = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const payload = body.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    let parsed: ModelLine[];
    try {
      parsed = JSON.parse(payload) as ModelLine[];
    } catch {
      throw new Error('Google returned a response this build could not read as JSON.');
    }

    const lines: OcrLine[] = (Array.isArray(parsed) ? parsed : [])
      .map((l) => ({ text: (l.text ?? '').trim(), box: toBox(l.box_2d, width, height) }))
      .filter((l) => l.text.length > 0);

    const frame: OcrFrame = {
      lines,
      imageWidth: width,
      imageHeight: height,
      coordinatesTransposed: false,
      ocrMs,
    };

    return { candidates: [{ frame, width, height, canvas, fraction: 1 }] };
  } finally {
    revoke();
  }
}
