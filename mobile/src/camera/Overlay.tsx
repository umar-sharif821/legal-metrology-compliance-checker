/**
 * The boxes drawn over the preview and over the frozen frame.
 *
 * Plain `View`s with borders rather than SVG: `react-native-svg` is a native dependency,
 * and the demo's whole native surface was fixed before the first Gradle run
 * (`docs/DEMO_PLAN.md` §3). A rectangle is a rectangle, and this costs one view per line.
 *
 * The component holds no geometry logic of its own — every coordinate comes from
 * `projection.ts`, which is pure and unit-tested. Anything that cannot be projected
 * (a box that clamped away, a view not yet laid out) is simply not drawn.
 */
import { StyleSheet, View } from 'react-native';

import type { Box } from '../scan/types';
import { projectBox, type FitMode, type Size } from './projection';

/**
 * How prominent a box is.
 *
 * `line` is every recognised line — proof the app is reading, not guessing (beat 2).
 * `evidence` is the single region a finding points at, and is deliberately loud: it is
 * the thing a person is being invited to check for themselves (P7).
 */
export type Emphasis = 'line' | 'evidence';

export interface OverlayBox {
  readonly key: string;
  readonly box: Box;
  readonly emphasis: Emphasis;
}

export interface OverlayProps {
  readonly boxes: readonly OverlayBox[];
  /** Pixel dimensions of the image the boxes are relative to. */
  readonly image: Size;
  /** Pixel dimensions of the view they are being drawn into. */
  readonly view: Size;
  readonly mode: FitMode;
}

export default function Overlay({ boxes, image, view, mode }: OverlayProps) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {boxes.map(({ key, box, emphasis }) => {
        const rect = projectBox(box, image, view, mode);
        if (!rect) return null;
        return (
          <View
            key={key}
            style={[
              styles.box,
              emphasis === 'evidence' ? styles.evidence : styles.line,
              { left: rect.x, top: rect.y, width: rect.width, height: rect.height },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { position: 'absolute', borderRadius: 2 },
  line: { borderWidth: 1, borderColor: 'rgba(125,211,252,0.75)' },
  evidence: {
    borderWidth: 2.5,
    borderColor: '#FBBF24',
    backgroundColor: 'rgba(251,191,36,0.18)',
    borderRadius: 3,
  },
});
