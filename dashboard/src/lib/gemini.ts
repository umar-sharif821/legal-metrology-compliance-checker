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

/**
 * Long edge sent to the model, and the JPEG quality it is encoded at.
 *
 * A phone photograph is several megabytes; sending it whole costs upload time on a
 * venue's connection without helping a model that is reading text, not inspecting grain.
 * 1400px keeps small print legible while cutting the payload to a few hundred kilobytes.
 */
const MAX_EDGE = 1400;
const JPEG_QUALITY = 0.85;

const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta';

/**
 * Model preference, newest first.
 *
 * This list is only an ordering hint. The real mechanism is that every candidate is
 * TRIED, in order, until one answers — because a hard-coded name is a liability. Google
 * retires models for new accounts while still returning them from the model list:
 * `gemini-2.5-flash` appeared as available and then answered a real call with "no longer
 * available to new users, please use models/gemini-3.6-flash". Picking one name and
 * giving up turns that into a dead demonstration with no route forward.
 */
const PREFERRED = [
  'gemini-3.6-flash',
  'gemini-3-flash',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
];

/**
 * The model known to answer, per API key.
 *
 * Keyed by the key itself: a single global meant swapping keys reused a model the new
 * account may never have had access to, producing a 404 that looked like a code fault.
 */
const resolvedModels = new Map<string, string>();

/** Model families that cannot read an image, or are far too slow to sit in a scan. */
const UNSUITABLE = /embedding|aqa|imagen|veo|tts|audio|learnlm|gemma|thinking|-pro/i;

/** At most this many models are probed before giving up. */
const MAX_PROBES = 4;

/**
 * Abort any single request that takes longer than this.
 *
 * Generous on purpose. A slower answer is worth far more than a failed one here, and the
 * newest model is the busiest — waiting for a less fashionable one to finish beats
 * reporting a failure the operator can do nothing about.
 */
const REQUEST_TIMEOUT_MS = 60_000;
const PROBE_TIMEOUT_MS = 8_000;

/** A model that is merely busy is worth waiting for, briefly, before moving on. */
const OVERLOAD_RETRY_MS = 1_500;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * True when the failure is Google being busy rather than anything about the request.
 *
 * 503 UNAVAILABLE means "this model is experiencing high demand" and is temporary. The
 * newest model attracts the most load, so the answer is to wait a moment and then try a
 * less fashionable one, not to give up.
 */
function isOverloaded(status: number, detail: string): boolean {
  return status === 503 || /UNAVAILABLE|high demand|overloaded/i.test(detail);
}

async function withTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Rank the account's usable models: preferred names first, then any other flash model.
 *
 * Cached per key. Re-listing on every scan meant a transient failure at Google's model
 * endpoint could fail a scan that a already-known-good model would have served, and it
 * spent a round trip on every scan for an answer that does not change.
 */
const modelListCache = new Map<string, string[]>();

async function candidateModels(key: string): Promise<string[]> {
  const cached = modelListCache.get(key);
  if (cached) return cached;

  // Bounded like every other request here. An unbounded fetch was the one path that
  // could hang a scan indefinitely with nothing on screen.
  const res = await withTimeout(
    `${API_ROOT}/models?key=${encodeURIComponent(key)}`,
    {},
    PROBE_TIMEOUT_MS,
  ).catch(() => {
    throw new Error('Google did not answer when asked which models this key can use.');
  });
  if (!res.ok) {
    throw new Error(
      res.status === 400 || res.status === 403
        ? 'Google rejected that API key. Check it was copied whole from aistudio.google.com.'
        : `Could not reach Google (HTTP ${res.status}).`,
    );
  }
  const listed = (await res.json()) as {
    models?: { name?: string; supportedGenerationMethods?: string[] }[];
  };

  const usable = (listed.models ?? [])
    .filter((m) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
    .map((m) => (m.name ?? '').replace(/^models\//, ''))
    .filter((m) => m && !UNSUITABLE.test(m));

  const preferred = PREFERRED.filter((p) => usable.includes(p));
  const otherFlash = usable.filter((m) => m.includes('flash') && !preferred.includes(m));
  const rest = usable.filter((m) => !preferred.includes(m) && !otherFlash.includes(m));

  // Capped. An account can list dozens of models, and walking all of them turns one
  // failed scan into a minute of waiting.
  const ranked = [...preferred, ...otherFlash, ...rest].slice(0, MAX_PROBES);
  if (ranked.length === 0) throw new Error('That key has no models available for image reading.');
  modelListCache.set(key, ranked);
  return ranked;
}

/** True when a failure means "try the next model" rather than "stop and report". */
function isModelUnavailable(status: number, detail: string): boolean {
  return status === 404 || /not (?:found|available)|no longer available|unsupported/i.test(detail);
}

/**
 * Find a model this key can actually call, using a text-only request.
 *
 * The account's model list is not sufficient on its own — `gemini-2.5-flash` was listed
 * as available and then refused a real call as "no longer available to new users". Only
 * an attempt settles it.
 *
 * The attempt is deliberately tiny. The first version of this retried with the full
 * photograph attached, so probing four models meant uploading a multi-megapixel image
 * four times and a failed scan took a minute. Probing costs a few words; the picture is
 * sent once, to a model already known to answer.
 */
async function resolveModel(key: string): Promise<string> {
  const known = resolvedModels.get(key);
  if (known) return known;

  const models = await candidateModels(key);
  let lastDetail = '';

  for (const model of models) {
    try {
      const probe = await withTimeout(
        `${API_ROOT}/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'ok' }] }],
            generationConfig: { temperature: 0, maxOutputTokens: 1 },
          }),
        },
        PROBE_TIMEOUT_MS,
      );
      if (probe.ok) {
        resolvedModels.set(key, model);
        return model;
      }
      lastDetail = await probe.text().catch(() => '');
      if (probe.status === 429) {
        throw new Error('Google rate-limited the request. Wait a moment and try again.');
      }
      // Retired, or simply busy. Either way this model is not the one for this scan.
      if (
        !isModelUnavailable(probe.status, lastDetail) &&
        !isOverloaded(probe.status, lastDetail)
      ) {
        throw new Error(`Google returned HTTP ${probe.status}. ${lastDetail.slice(0, 200)}`);
      }
    } catch (e) {
      // A timeout or network abort on a probe is a reason to try the next model.
      if (e instanceof Error && !/rate-limited|returned HTTP/.test(e.message)) {
        lastDetail = e.message;
        continue;
      }
      throw e;
    }
  }

  throw new Error(
    `No model this key can use accepted a request. Last response: ${lastDetail.slice(0, 200)}`,
  );
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
    const parts = [
      { text: PROMPT },
      { inline_data: { mime_type: 'image/jpeg', data: canvasBase64(canvas, JPEG_QUALITY) } },
    ];
    const generationConfig = {
      // Zero temperature: transcription is not a creative task, and a demonstration that
      // reads the same packet differently twice is worse than one that reads it
      // imperfectly the same way twice.
      temperature: 0,
      // Bounded so a model that starts repeating itself cannot run until the timeout.
      maxOutputTokens: 4096,
      responseMimeType: 'application/json',
      responseSchema: SCHEMA,
    };

    /**
     * Thinking off.
     *
     * Gemini 2.5 and later reason internally before answering, by default. For open
     * questions that is the point; for transcribing a label it is pure latency, and it
     * is what made a scan sit at thirty seconds and time out. `thinkingBudget: 0` turns
     * it off. Older models reject the field, so the request is retried without it.
     */
    const withThinkingOff = JSON.stringify({
      contents: [{ parts }],
      generationConfig: { ...generationConfig, thinkingConfig: { thinkingBudget: 0 } },
    });
    const withoutThinkingConfig = JSON.stringify({ contents: [{ parts }], generationConfig });

    // The model is settled with a few words before the picture is sent, so the image
    // travels exactly once against a model that is known to answer. The rest of the list
    // is kept, because a working model can still be too busy to serve a request.
    const primary = await resolveModel(trimmed);
    const fallbacks = (await candidateModels(trimmed)).filter((m) => m !== primary);
    const order = [primary, ...fallbacks];

    const send = (model: string, body: string) =>
      withTimeout(
        `${API_ROOT}/models/${model}:generateContent?key=${encodeURIComponent(trimmed)}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body },
        REQUEST_TIMEOUT_MS,
      );

    /**
     * One model, with a single retry if it is merely busy.
     *
     * Returns null to mean "this model is not going to serve us, try another"; anything
     * genuinely wrong with the request throws instead, because trying a different model
     * would only bury it.
     */
    const attempt = async (model: string): Promise<Response | null> => {
      for (let tries = 0; tries < 2; tries += 1) {
        let res: Response;
        try {
          res = await send(model, withThinkingOff);
        } catch {
          return null; // timed out or aborted — move on
        }

        if (!res.ok && res.status === 400) {
          const detail = await res.text().catch(() => '');
          // Older models reject `thinkingConfig`. Send it again without.
          if (/thinking/i.test(detail)) {
            try {
              res = await send(model, withoutThinkingConfig);
            } catch {
              return null;
            }
          } else {
            throw new Error(`Google returned HTTP 400. ${detail.slice(0, 200)}`);
          }
        }

        if (res.ok) return res;

        const detail = await res.text().catch(() => '');
        if (isOverloaded(res.status, detail)) {
          if (tries === 0) {
            await sleep(OVERLOAD_RETRY_MS);
            continue; // same model, once more
          }
          return null; // still busy — let the caller try a different model
        }
        // A retired or unavailable model is the case this whole adapter exists to
        // survive. Only the probed model is known to answer; a fallback taken from the
        // account's list can still be one Google has withdrawn.
        if (isModelUnavailable(res.status, detail)) return null;
        if (res.status === 429) {
          throw new Error('Google rate-limited the request. Wait a moment and try again.');
        }
        throw new Error(`Google returned HTTP ${res.status}. ${detail.slice(0, 200)}`);
      }
      return null;
    };

    const startedAt = performance.now();
    let res: Response | null = null;

    for (const model of order) {
      res = await attempt(model);
      if (res) {
        // Remember whichever model actually served us, so the next scan starts there.
        resolvedModels.set(trimmed, model);
        break;
      }
    }

    if (!res) {
      throw new Error(
        `Every available model was busy or unreachable (tried ${order.join(', ')}). Google's capacity fluctuates — try again in a moment, or switch to the on-device engine, which needs no network.`,
      );
    }

    const ocrMs = Math.round(performance.now() - startedAt);
    const answer = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
      promptFeedback?: { blockReason?: string };
    };

    const blocked = answer.promptFeedback?.blockReason;
    if (blocked) throw new Error(`Google declined to read that image (${blocked}).`);

    const finish = answer.candidates?.[0]?.finishReason;
    const payload = answer.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    let parsed: ModelLine[];
    try {
      parsed = JSON.parse(payload) as ModelLine[];
    } catch {
      // A truncated answer is the likely cause and is worth naming, because the remedy
      // differs from a malformed one.
      throw new Error(
        finish === 'MAX_TOKENS'
          ? 'That label had more text than one response could hold. Crop closer to the declaration panel and try again.'
          : `Google returned a response this build could not read as JSON${finish ? ` (finished: ${finish})` : ''}.`,
      );
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
