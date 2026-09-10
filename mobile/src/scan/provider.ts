/**
 * The OCR provider seam — phase `A-0`.
 *
 * `docs/DEMO_PLAN.md` §4 A-0: *"`OCRProvider` interface in `mobile/src/scan/`, with ML Kit
 * as the first implementation… The interface is what makes every later engine cheap."*
 * Plan §5.1 specifies the same shape for `T-3.3`; this is that work brought forward.
 *
 * Two things live here, and the split is the point:
 *
 * - **`OcrProvider`** — the thing that reads an image. Only the app runs one, and only
 *   `camera/` can implement one, because an implementation imports a native module.
 * - **`PROVIDERS`** — the *descriptors*, id and label and nothing executable. The corpus
 *   scorer runs under Node against JSON records and must name the engine that produced a
 *   line set without being able to load it. A record naming an engine this table does not
 *   know is refused rather than scored (P9): an unattributed line set is not a measurement.
 *
 * There is deliberately no registry of *implementations*. The demo ships one engine
 * (`DEMO_PLAN` §2.1 — no server of any kind), and a second engine is scored by replaying
 * a committed JPEG on a host and appending its lines to the record, not by running it on
 * the phone. A map of one entry would only look like a plan that does not exist.
 */
import type { OcrFrame } from './types';

/**
 * Every engine whose lines may appear in the corpus.
 *
 * Adding one is this line plus a `PROVIDERS` entry. Nothing in `corpus.test.ts` names an
 * engine, so no test changes — which is the `A-0` acceptance condition.
 */
export type OcrProviderId = 'mlkit';

export interface OcrProviderDescriptor {
  readonly id: OcrProviderId;
  /** Shown in the UI and used as the corpus report's column heading. */
  readonly label: string;
  /** Where the reading was taken. `host` means a replay of a committed image, offline. */
  readonly runsOn: 'device' | 'host';
  /** Why this engine is in the table — kept so a column heading explains itself. */
  readonly note: string;
}

export const PROVIDERS: readonly OcrProviderDescriptor[] = [
  {
    id: 'mlkit',
    label: 'ML Kit (Latin)',
    runsOn: 'device',
    note: 'On-device, ships with the app, and the only engine that reaches a verdict offline (P2).',
  },
];

/**
 * The engine the app actually runs, and the one every `expect` block was written against.
 *
 * That second half is load-bearing for the scorer. A reviewer writes `net_quantity:
 * "84.9g"` by reading what *this* engine returned, spacing and all; another engine
 * reporting `84.9 g` is not wrong about the packet, but it is not a string match either.
 * So the reference provider is **asserted** against `expect` and a candidate is only
 * **measured** — see `score.ts`.
 */
export const REFERENCE_PROVIDER_ID: OcrProviderId = 'mlkit';

/** Look up a descriptor by an id read from a record — `null` when the table does not know it. */
export function describeProvider(id: string): OcrProviderDescriptor | null {
  return PROVIDERS.find((p) => p.id === id) ?? null;
}

/**
 * The descriptor for a known id, for an implementation that needs its own label.
 *
 * Throws rather than returning null: the argument's type restricts it to the union, so an
 * id with no entry means the union and the table have drifted apart, and a label is not
 * worth inventing (P4). `provider.test.ts` pins the two together so this cannot ship.
 */
export function providerDescriptor(id: OcrProviderId): OcrProviderDescriptor {
  const found = describeProvider(id);
  if (!found) throw new Error(`No descriptor for OCR provider "${id}"`);
  return found;
}

/** An image on disk, with the pixel dimensions the layer that produced it reported. */
export interface OcrRequest {
  readonly uri: string;
  readonly width: number;
  readonly height: number;
}

/**
 * One OCR engine, behind the only shape the pipeline downstream of it will ever see.
 *
 * `recognise` returns an `OcrFrame`, so `extract` and `evaluate` cannot tell engines
 * apart — which is what lets a new engine be scored without touching either (`A-0`).
 */
export interface OcrProvider {
  readonly id: OcrProviderId;
  readonly label: string;
  recognise(request: OcrRequest): Promise<OcrFrame>;
}
