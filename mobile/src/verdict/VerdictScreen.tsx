/**
 * The verdict screen — beats 3, 4 and 5 of the demo.
 *
 * What it renders, and why each part is not optional:
 *
 *  - **The judged image, with the boxes still on it.** The verdict is about *this* image
 *    — the full-quality still or the uploaded photo it was read from, never a preview
 *    frame that merely looked similar — and it stays on screen while the findings are
 *    read.
 *  - **The status, worded as narrowly as the method allows.** There is no `COMPLIANT`;
 *    the strongest thing this app may say is that it found no issue among the checks the
 *    pack runs, and the subtitle says exactly that (P3).
 *  - **A citation on every finding** — statute, rule, sub-clause, pack id and version. A
 *    finding without a citation is a vibe (P1, P6).
 *  - **The contest, where there is one.** Where the sub-clause letter is disputed, both
 *    readings are shown. Picking one quietly would be the most dishonest thing this
 *    screen could do, and it is the project's standing open legal question.
 *  - **Tap a finding, see the region it came from** (P7). A finding about an *absence*
 *    has no region, and says so rather than pointing at something arbitrary.
 *
 * Demo scaffolding. `T-3.6` is the real verdict screen.
 */
import { useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import Overlay, { type OverlayBox } from '../camera/Overlay';
import type { Size } from '../camera/projection';
import type { JudgedCapture } from '../camera/capture';
import FieldTrialBar from '../scan/FieldTrialBar';
import type { ExtractionResult } from '../scan/types';
import { NAV_BAR_INSET } from '../ui/layout';
import type { FieldReport, Finding, Verdict, VerdictStatus } from './types';

interface Props {
  readonly verdict: Verdict;
  readonly capture: JudgedCapture;
  /**
   * Carried through only so the field trial can record it (`D-3`).
   *
   * The screen itself renders `verdict`, which already holds everything it shows. The
   * extraction is the *working* — which stage recovered each value and how sure it was —
   * and that is precisely what a person tuning the lexicons a day later needs to see.
   */
  readonly extraction: ExtractionResult;
  readonly onResume: () => void;
}

interface StatusStyle {
  readonly label: string;
  readonly detail: string;
  readonly colour: string;
}

/**
 * The words on the badge.
 *
 * `NO_ISSUES_FOUND` is the one to read twice. Its detail line is not modesty — it is the
 * accurate scope of the claim, and it is what stops a green badge being read as a
 * clearance by a judge, or later by an officer.
 */
function statusStyle(verdict: Verdict): StatusStyle {
  const status: VerdictStatus = verdict.status;
  switch (status) {
    case 'INSUFFICIENT_EVIDENCE':
      return {
        label: 'INSUFFICIENT EVIDENCE',
        detail: 'No verdict was reached. Findings are withheld rather than shown partially.',
        colour: '#FBBF24',
      };
    case 'NO_ISSUES_FOUND':
      return {
        label: 'NO ISSUES FOUND',
        detail: `All ${verdict.counts.fieldsExpected} declarations this pack checks were located and passed. This is not a certificate of compliance.`,
        colour: '#4ADE80',
      };
    case 'ATTENTION':
      return {
        label: 'NEEDS ATTENTION',
        detail: `${verdict.findings.length} of the checks this pack runs did not pass.`,
        colour: '#FB923C',
      };
  }
}

function FieldChip({ field }: { field: FieldReport }) {
  return (
    <View style={[styles.chip, field.found ? styles.chipFound : styles.chipMissing]}>
      <Text style={styles.chipLabel} numberOfLines={1}>
        {field.found ? '✓' : '✕'} {field.shortLabel}
      </Text>
      <Text style={styles.chipValue} numberOfLines={1}>
        {field.found ? field.value : 'not found'}
      </Text>
      {field.found && (
        // Stage and confidence are on screen because *how* a value was recovered changes
        // how much weight it deserves. A stage-C hit is a shape with no anchor behind it,
        // and whoever reads this should be able to see that.
        //
        // A stage-B hit adds where the value sat relative to its label — `right 2.6×`
        // means 2.6 of the label's own text heights to its right. That is checkable
        // against the frozen frame by eye, which is the point of showing it (P7); a
        // stage-B hit with no geometry beside it was paired by reading order because the
        // engine gave the anchor no box, and says so by omission (P9).
        <Text style={styles.chipMeta} numberOfLines={1}>
          {field.stage} · {field.confidence}
          {field.association
            ? ` · ${field.association.direction} ${field.association.gapHeights}×`
            : ''}
        </Text>
      )}
    </View>
  );
}

function FindingCard({
  finding,
  selected,
  onPress,
}: {
  finding: Finding;
  selected: boolean;
  onPress: () => void;
}) {
  const { clause } = finding;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${finding.title}. Show the evidence for this finding.`}
      onPress={onPress}
      style={[styles.finding, selected && styles.findingSelected]}
    >
      <View style={styles.findingHead}>
        <Text style={styles.findingTitle}>{finding.title}</Text>
        <Text style={styles.severity}>{finding.severity}</Text>
      </View>

      <Text style={styles.requirement}>{finding.requirement}</Text>

      {/*
       * The citation: statute, rule, sub-clause, and the exact data that produced it.
       *
       * The sub-clause is concatenated raw, not wrapped in brackets — the pack already
       * writes it as `(1)(d)`, and adding a pair here produced `Rule 6((1)(d))` on the
       * device. The pack's own punctuation is the citation's punctuation (P6).
       */}
      <Text style={styles.citation}>
        {clause.statuteCode} · Rule {clause.rule}
        {clause.subClause} · {finding.packId} v{finding.packVersion}
      </Text>

      {clause.contested && (
        <Text style={styles.contested}>
          {'⚠'} Sub-clause letter unverified. This pack reads it as {clause.subClause}
          {clause.alternateSubClauses.length > 0
            ? `; it is also read as ${clause.alternateSubClauses.join(' or ')}`
            : ''}
          . No reading has been confirmed by a Legal Metrology officer.
        </Text>
      )}

      <Text style={styles.remedy}>
        <Text style={styles.remedyKey}>Remedy · </Text>
        {finding.remedy}
      </Text>

      {selected && (
        <View style={styles.evidence}>
          {finding.evidenceBox ? (
            <>
              <Text style={styles.evidenceKey}>Evidence — highlighted above</Text>
              {finding.evidenceText !== null && (
                <Text style={styles.evidenceText}>{finding.evidenceText}</Text>
              )}
            </>
          ) : (
            // An absence has no region. Saying so is the honest answer; pointing at some
            // arbitrary part of the label would be worse than pointing at nothing.
            <Text style={styles.evidenceKey}>
              Nothing to highlight — this declaration was not found anywhere in the frame.
            </Text>
          )}
        </View>
      )}
    </Pressable>
  );
}

export default function VerdictScreen({ verdict, capture, extraction, onResume }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [frameSize, setFrameSize] = useState<Size>({ width: 0, height: 0 });

  const status = statusStyle(verdict);
  const selected = verdict.findings.find((f) => f.declarationId === selectedId) ?? null;

  const onFrameLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setFrameSize({ width, height });
  };

  const image: Size = {
    width: capture.frame.imageWidth,
    height: capture.frame.imageHeight,
  };

  const boxes: OverlayBox[] = [];
  capture.frame.lines.forEach((line, index) => {
    if (line.box) boxes.push({ key: `line-${index}`, box: line.box, emphasis: 'line' });
  });
  if (selected?.evidenceBox) {
    boxes.push({ key: 'evidence', box: selected.evidenceBox, emphasis: 'evidence' });
  }

  return (
    <View style={styles.root}>
      <View style={styles.frame} onLayout={onFrameLayout}>
        <Image source={{ uri: capture.uri }} style={StyleSheet.absoluteFill} resizeMode="contain" />
        <Overlay boxes={boxes} image={image} view={frameSize} mode="contain" />
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        <View style={[styles.statusBar, { borderLeftColor: status.colour }]}>
          <Text style={[styles.statusLabel, { color: status.colour }]}>{status.label}</Text>
          <Text style={styles.statusDetail}>{status.detail}</Text>
        </View>

        {/* P9 in one block: the pack's own account of what it is and is not. */}
        <View style={styles.provenance}>
          <Text style={styles.provenanceLine}>
            {verdict.statuteLong} · {verdict.packId} v{verdict.packVersion} ·{' '}
            {verdict.provenanceStatus}
          </Text>
          {verdict.advisoryOnly && (
            <Text style={styles.provenanceWarn}>
              Every finding is advisory. Nothing here is a determination of law.
            </Text>
          )}
          <Text style={styles.provenanceNote}>{verdict.scopeNote}</Text>
        </View>

        {verdict.insufficientReason !== null && (
          <Text style={styles.insufficient}>{verdict.insufficientReason}</Text>
        )}

        <Text style={styles.sectionHead}>
          Declarations · {verdict.counts.fieldsFound} of {verdict.counts.fieldsExpected} located
        </Text>
        <View style={styles.chips}>
          {verdict.fields.map((field) => (
            <FieldChip key={field.fieldId} field={field} />
          ))}
        </View>

        {verdict.findings.length > 0 && (
          <>
            <Text style={styles.sectionHead}>Findings · tap one to see where it came from</Text>
            {verdict.findings.map((finding) => (
              <FindingCard
                key={finding.declarationId}
                finding={finding}
                selected={finding.declarationId === selectedId}
                onPress={() =>
                  setSelectedId((current) =>
                    current === finding.declarationId ? null : finding.declarationId,
                  )
                }
              />
            ))}
          </>
        )}

        {/*
         * Measured, not estimated — every number here was timed on this device (P8), and
         * since `C-0` the line also says what kind of image produced them. A verdict read
         * off a stock-camera photo and one read off a phone-held capture are not the same
         * measurement, and the difference has to be legible from the screen, not inferred
         * from which button somebody remembers pressing.
         *
         * An upload has no capture time this app can claim, and says so rather than
         * printing a zero (P4).
         */}
        <Text style={styles.timings}>
          {capture.source === 'upload' ? 'uploaded photo' : 'full-quality capture'} ·{' '}
          {capture.captureMs === null ? 'capture n/a' : `capture ${capture.captureMs} ms`} ·{' '}
          {verdict.counts.ocrLines} lines · OCR {verdict.timings.ocrMs} ms · extract{' '}
          {verdict.timings.extractMs} ms · evaluate {verdict.timings.evaluateMs} ms
        </Text>
      </ScrollView>

      {/* D-3 only. `D-5` decides whether the pitch shows it; deleting these two lines is
          the whole of that decision. */}
      <FieldTrialBar capture={capture} extraction={extraction} verdict={verdict} />

      <View style={styles.actions}>
        <Pressable accessibilityRole="button" style={styles.resume} onPress={onResume}>
          <Text style={styles.resumeText}>Scan again</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B1220' },
  frame: { height: '32%', backgroundColor: '#000' },

  body: { flex: 1 },
  bodyContent: { padding: 14, paddingBottom: 24 },

  statusBar: { borderLeftWidth: 4, paddingLeft: 12, paddingVertical: 4, marginBottom: 12 },
  statusLabel: { fontSize: 20, fontWeight: '800', letterSpacing: 0.5 },
  statusDetail: { color: '#CBD5E1', fontSize: 13, lineHeight: 18, marginTop: 4 },

  provenance: { backgroundColor: '#111C2E', borderRadius: 8, padding: 10, marginBottom: 14 },
  provenanceLine: { color: '#7DD3FC', fontSize: 11, lineHeight: 16 },
  provenanceWarn: { color: '#FBBF24', fontSize: 11, lineHeight: 16, marginTop: 4 },
  provenanceNote: { color: '#64748B', fontSize: 10, lineHeight: 15, marginTop: 4 },

  insufficient: { color: '#FBBF24', fontSize: 14, lineHeight: 20, marginBottom: 14 },

  sectionHead: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 6,
    marginBottom: 8,
  },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: {
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderWidth: 1,
    minWidth: '47%',
    flexGrow: 1,
    flexShrink: 1,
  },
  chipFound: { backgroundColor: 'rgba(74,222,128,0.08)', borderColor: 'rgba(74,222,128,0.45)' },
  chipMissing: { backgroundColor: 'rgba(251,146,60,0.08)', borderColor: 'rgba(251,146,60,0.45)' },
  chipLabel: { color: '#F8FAFC', fontSize: 12, fontWeight: '600' },
  chipValue: { color: '#CBD5E1', fontSize: 12, marginTop: 3 },
  chipMeta: { color: '#64748B', fontSize: 9, marginTop: 2 },

  finding: {
    backgroundColor: '#111C2E',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  findingSelected: { borderColor: '#FBBF24' },
  findingHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  findingTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
    paddingRight: 8,
  },
  severity: {
    color: '#FBBF24',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.5)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  requirement: { color: '#CBD5E1', fontSize: 12, lineHeight: 18, marginTop: 6 },
  citation: { color: '#7DD3FC', fontSize: 11, marginTop: 8, fontVariant: ['tabular-nums'] },
  contested: { color: '#FBBF24', fontSize: 10, lineHeight: 15, marginTop: 6 },
  remedy: { color: '#94A3B8', fontSize: 11, lineHeight: 17, marginTop: 8 },
  remedyKey: { color: '#F8FAFC', fontWeight: '700' },

  evidence: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#1E293B',
  },
  evidenceKey: { color: '#FBBF24', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  evidenceText: {
    color: '#E2E8F0',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
    fontStyle: 'italic',
  },

  timings: { color: '#475569', fontSize: 10, marginTop: 14, fontVariant: ['tabular-nums'] },

  actions: {
    padding: 12,
    paddingBottom: 12 + NAV_BAR_INSET,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#1E293B',
    backgroundColor: '#0B1220',
  },
  resume: {
    backgroundColor: '#F8FAFC',
    borderRadius: 999,
    paddingVertical: 13,
    alignItems: 'center',
  },
  resumeText: { color: '#0B1220', fontSize: 15, fontWeight: '700' },
});
