/**
 * Deterministic rule evaluator — the on-device half of the shared rule core (plan §5.2).
 *
 * The evaluator itself is T-1.7. This module currently declares nothing but the
 * package marker, deliberately: the public surface is derived from the rule-pack
 * schema (T-1.2), and inventing it before the schema exists would put statutory
 * structure in code instead of in `rulepack/` (P6).
 */

/** Marker so the workspace has a real, type-checked export before T-1.7 lands. */
export const RULE_ENGINE_TS_PACKAGE = '@sih/rule-engine-ts' as const;
