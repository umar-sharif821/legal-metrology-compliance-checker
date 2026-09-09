import { describe, expect, it } from 'vitest';
import { RULE_ENGINE_TS_PACKAGE } from '../src/index.js';

// Proves the TS toolchain, path resolution and test runner are wired end to end.
// Replaced by real evaluator tests at T-1.7.
describe('rule-engine-ts scaffold', () => {
  it('resolves the package entry point', () => {
    expect(RULE_ENGINE_TS_PACKAGE).toBe('@sih/rule-engine-ts');
  });
});
