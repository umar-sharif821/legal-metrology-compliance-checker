/**
 * Rule pack.
 *
 * Plan §12: this screen is "what makes the governance story real rather than
 * aspirational" — a legal reviewer can see exactly which thresholds are verified and
 * which are pending. Everything on it is read from the pack; nothing is written here.
 */
import { Card, CardHead, ClauseChip, Note, Pill, SeverityBadge } from '../components/ui';
import { IconAlert, IconBook, IconShield } from '../components/icons';
import {
  ADVISORY_ONLY,
  DECLARATIONS,
  EVIDENCE_THRESHOLDS,
  FIELDS,
  FRAME_ADMISSION,
  PACK,
  cappedSeverity,
} from '../lib/rulepack';

const CHECK_LABEL: Record<string, string> = {
  field_present: 'Declaration present',
  value_wellformed: 'Value well-formed',
  context_phrase_present: 'Required phrase present',
};

export function RulePackPage() {
  const contested = DECLARATIONS.filter((d) => d.clause.contested);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <Card className="animate-rise">
        <div className="flex flex-wrap items-start gap-4 p-5">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-navy-900 text-white">
            <IconBook width={20} height={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-[17px] font-semibold tracking-tight text-ink-900">
              {PACK.statuteLong}
            </h2>
            <p className="mt-1 font-mono text-[12px] text-ink-500">
              {PACK.id} · v{PACK.version} · {PACK.statuteCode} · {PACK.jurisdiction}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <Pill tone="advisory">
              <IconShield width={11} height={11} />
              {PACK.provenanceStatus.replace(/_/g, ' ')}
            </Pill>
            <span className="text-[11px] text-ink-400">
              Reviewer: {PACK.reviewer ?? 'none assigned'}
            </span>
          </div>
        </div>

        <div className="border-t border-line-200 p-5">
          <Note tone="advisory" icon={<IconAlert width={15} height={15} className="mt-px shrink-0" />}>
            <b className="font-semibold">No entry in this pack has been reviewed.</b>{' '}
            {PACK.provenanceNote}
          </Note>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-[11px] tracking-[0.05em] text-ink-400 uppercase">Declarations</p>
          <p className="mt-1.5 text-[24px] leading-none font-semibold text-ink-900">
            {DECLARATIONS.length}
          </p>
          <p className="mt-1.5 text-[11.5px] text-ink-500">across {FIELDS.length} label fields</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] tracking-[0.05em] text-ink-400 uppercase">Verified clauses</p>
          <p className="mt-1.5 text-[24px] leading-none font-semibold text-ink-900">0</p>
          <p className="mt-1.5 text-[11.5px] text-ink-500">
            every sub-clause letter is unverified
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] tracking-[0.05em] text-ink-400 uppercase">Contested letters</p>
          <p className="mt-1.5 text-[24px] leading-none font-semibold text-advisory-ink">
            {contested.length}
          </p>
          <p className="mt-1.5 text-[11.5px] text-ink-500">
            have a competing reading recorded in the pack
          </p>
        </Card>
      </div>

      <Card className="animate-rise overflow-hidden">
        <CardHead
          title="Declarations"
          hint="Every check the evaluator can run, with the clause it comes from and its review status"
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem]">
            <thead>
              <tr className="border-b border-line-200 text-left text-[11px] tracking-[0.04em] text-ink-500 uppercase">
                <th className="px-5 py-2.5 font-medium">Clause</th>
                <th className="px-3 py-2.5 font-medium">Declaration</th>
                <th className="px-3 py-2.5 font-medium">Check</th>
                <th className="px-3 py-2.5 font-medium">Max severity</th>
                <th className="px-3 py-2.5 font-medium">Verification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-200">
              {DECLARATIONS.map((d) => (
                <tr key={d.id} className="align-top transition-colors hover:bg-canvas">
                  <td className="px-5 py-3">
                    <ClauseChip cite={d.clause.cite} contested={d.clause.contested} />
                    <p className="mt-1.5 font-mono text-[10px] text-ink-400">{d.id}</p>
                  </td>
                  <td className="px-3 py-3">
                    <p className="text-[12.5px] font-medium text-ink-900">{d.title}</p>
                    <p className="mt-0.5 text-[11.5px] text-ink-500">{d.fieldLabel}</p>
                    {d.clause.contested && (
                      <p className="mt-1.5 text-[11px] leading-snug text-advisory-ink">
                        Also read as{' '}
                        {d.clause.alternates.map((a) => a.sub_clause).join(' or ')} —{' '}
                        {d.clause.alternates[0]?.note}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-3 text-[12px] text-ink-700">
                    {CHECK_LABEL[d.checkKind] ?? d.checkKind}
                  </td>
                  <td className="px-3 py-3">
                    <SeverityBadge severity={cappedSeverity(d)} />
                    {ADVISORY_ONLY && d.severity !== cappedSeverity(d) && (
                      <p className="mt-1 text-[10.5px] text-ink-400">capped from {d.severity}</p>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <Pill tone="unknown">{d.clause.verification.toLowerCase()}</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHead
            title="Method parameters"
            hint="Not statutory values — tuning constants that live in the pack so changing them is a data change"
          />
          <ul className="flex flex-col divide-y divide-line-200 text-[12.5px]">
            {[
              ['Minimum print height, fraction of frame', `${(FRAME_ADMISSION.minTextHeightFraction * 100).toFixed(1)}%`],
              ['Minimum panel coverage, fraction of frame', `${(FRAME_ADMISSION.minTextCoverage * 100).toFixed(1)}%`],
              ['Maximum text flush to frame border', `${(FRAME_ADMISSION.maxEdgeTouchFraction * 100).toFixed(0)}%`],
              ['Minimum text lines for a verdict', String(EVIDENCE_THRESHOLDS.minOcrLines)],
              ['Minimum declarations located for a verdict', String(EVIDENCE_THRESHOLDS.minFieldsFound)],
            ].map(([label, value]) => (
              <li key={label} className="flex items-center justify-between gap-3 px-5 py-2.5">
                <span className="text-ink-700">{label}</span>
                <span className="tnum shrink-0 font-mono text-[12px] text-ink-900">{value}</span>
              </li>
            ))}
          </ul>
          <div className="px-5 pb-5 pt-3">
            <Note tone="advisory" icon={<IconAlert width={15} height={15} className="mt-px shrink-0" />}>
              <b className="font-semibold">
                Unmeasured entirely: {FRAME_ADMISSION.unscored.join(' and ')}.
              </b>{' '}
              No threshold exists for them because no number is produced for them. Deriving one from
              text density and calling it a sharpness score would be a figure the method cannot
              support.
            </Note>
          </div>
        </Card>

        <Card>
          <CardHead title="Scope, stated plainly" hint="What this pack does and does not decide" />
          <div className="flex flex-col gap-3 p-5 text-[12.5px] leading-relaxed text-ink-700">
            <p>{PACK.scopeNote}</p>
            <p>
              <b className="font-semibold text-ink-900">The open legal question.</b> The sub-clause
              letters under Rule 6(1) are not settled. This project&rsquo;s own earlier
              specification placed the retail sale price and the date at different letters than the
              common reading, and no Legal Metrology officer has confirmed either. Rather than pick
              one and present it as settled, the pack records both readings and every affected
              finding carries the alternate beside its citation.
            </p>
            <p>
              Until an officer signs off, no finding this tool produces may be presented as a
              determination of law — which is why every severity above is capped at{' '}
              <b className="font-semibold text-ink-900">advisory</b>, in data rather than by
              convention.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
