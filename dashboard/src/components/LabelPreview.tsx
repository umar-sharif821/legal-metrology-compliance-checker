/**
 * The evidence surface.
 *
 * P7 — every finding carries the image region a person can look at to agree or
 * disagree. That means the report cannot be a list of sentences: the officer has to be
 * able to point at the panel. When the scan carries a real photograph this renders the
 * photograph; when it comes from the sample corpus it draws the label the corpus
 * describes, so the evidence boxes still land on something a person can read.
 *
 * A drawn label is labelled as drawn. It is never presented as a photograph.
 */
import { useId } from 'react';
import type { Box, Scan } from '../lib/types';

const W = 420;
const H = 560;

function wrap(text: string, max: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if ((line + ' ' + word).trim().length > max) {
      if (line) lines.push(line.trim());
      line = word;
    } else {
      line = (line + ' ' + word).trim();
    }
  }
  if (line) lines.push(line);
  return lines;
}

function DrawnLabel({ scan }: { scan: Scan }) {
  const value = (id: string) => scan.fields.find((f) => f.fieldId === id)?.value ?? null;

  const commodity = value('commodity_name');
  const netQty = value('net_quantity');
  const mrp = value('retail_sale_price');
  const date = value('date_of_packing');
  const mfr = value('manufacturer_address');
  const care = value('consumer_care');

  return (
    <g>
      <rect x={0} y={0} width={W} height={H} fill="#fbfaf7" />
      <rect x={0} y={0} width={W} height={10} fill="#0a1d36" />

      <text x={26} y={62} fontSize={13} fill="#8a8070" letterSpacing="1.6">
        {scan.brand.toUpperCase()}
      </text>

      {commodity && (
        <text x={26} y={90} fontSize={23} fontWeight={700} fill="#14202f">
          {commodity}
        </text>
      )}

      <line x1={26} y1={120} x2={W - 26} y2={120} stroke="#ded7c8" strokeWidth={1} />

      <text x={26} y={158} fontSize={11} fill="#8a8070" letterSpacing="0.6">
        DECLARATIONS
      </text>

      {netQty && (
        <>
          <text x={26} y={248} fontSize={11} fill="#8a8070">
            Net Qty.
          </text>
          <text x={26} y={268} fontSize={17} fontWeight={600} fill="#14202f">
            {netQty}
          </text>
        </>
      )}

      {mrp &&
        (() => {
          // Split on the parenthetical rather than by character count, which cut
          // "(incl. of all taxes)" mid-word.
          const cut = mrp.indexOf(' (');
          const amount = cut === -1 ? mrp : mrp.slice(0, cut);
          const note = cut === -1 ? null : mrp.slice(cut + 1);
          return (
            <>
              <text x={236} y={248} fontSize={11} fill="#8a8070">
                M.R.P.
              </text>
              <text x={236} y={268} fontSize={17} fontWeight={600} fill="#14202f">
                {amount}
              </text>
              {note && (
                <text x={236} y={283} fontSize={9.5} fill="#5c5647">
                  {note}
                </text>
              )}
            </>
          );
        })()}

      {date && (
        <text x={26} y={325} fontSize={12.5} fill="#14202f">
          Mfg. / Packed: {date}
        </text>
      )}

      {mfr && (
        <>
          <text x={26} y={382} fontSize={10.5} fill="#8a8070">
            MANUFACTURED / PACKED BY
          </text>
          {wrap(mfr, 46)
            .slice(0, 3)
            .map((l, i) => (
              <text key={i} x={26} y={400 + i * 15} fontSize={11.5} fill="#14202f">
                {l}
              </text>
            ))}
        </>
      )}

      {care && (
        <>
          <text x={26} y={470} fontSize={10.5} fill="#8a8070">
            CONSUMER CARE
          </text>
          {/* Two lines, not one: on a narrow panel the single line ran off the edge. */}
          {wrap(care, 42)
            .slice(0, 2)
            .map((l, i) => (
              <text key={i} x={26} y={487 + i * 14} fontSize={11.5} fill="#14202f">
                {l}
              </text>
            ))}
        </>
      )}

      <text x={26} y={H - 16} fontSize={8.5} fill="#b3ab99">
        ILLUSTRATIVE — DRAWN FROM THE SAMPLE RECORD, NOT A PHOTOGRAPH
      </text>
    </g>
  );
}

export function LabelPreview({
  scan,
  highlight,
  className = '',
}: {
  scan: Scan;
  /** Boxes to outline, e.g. the regions behind the selected finding. */
  highlight?: readonly { box: Box; tone: 'clear' | 'advisory' | 'violation' }[];
  className?: string;
}) {
  const clipId = useId();
  const tone = {
    clear: '#0ca30c',
    advisory: '#d9860a',
    violation: '#d03b3b',
  } as const;

  return (
    <div
      className={`relative overflow-hidden rounded-lg border border-line-200 bg-canvas ${className}`}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full"
        role="img"
        aria-label="Label evidence"
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={0} y={0} width={W} height={H} rx={0} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clipId})`}>
          {scan.imageUrl ? (
            <image
              href={scan.imageUrl}
              x={0}
              y={0}
              width={W}
              height={H}
              preserveAspectRatio="xMidYMid slice"
            />
          ) : (
            <DrawnLabel scan={scan} />
          )}

          {highlight?.map((h, i) => (
            <g key={i}>
              <rect
                x={h.box.x * W}
                y={h.box.y * H}
                width={h.box.w * W}
                height={h.box.h * H}
                fill={tone[h.tone]}
                opacity={0.12}
              />
              <rect
                x={h.box.x * W}
                y={h.box.y * H}
                width={h.box.w * W}
                height={h.box.h * H}
                fill="none"
                stroke={tone[h.tone]}
                strokeWidth={2.5}
                rx={3}
              />
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
