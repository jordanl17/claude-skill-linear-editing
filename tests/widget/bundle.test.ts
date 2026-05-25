/**
 * Static checks against the built widget bundle.
 *
 * Catches build-config regressions that only surface in production - e.g.
 * type="module" lost (script runs before DOM), terser mangling sendPrompt
 * (silent broken Proceed), or accidental bloat (~80 output tokens per KB
 * of streaming).
 *
 * Extend:
 *   - Add {{TOKEN}} names to `runtimeTokens` as you introduce them.
 *   - Add identifiers to `literals` for any host APIs beyond sendPrompt.
 *   - Raise the size budget only with intent.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const packageJson = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8')) as {
  name: string;
};
const skillName = packageJson.name.replace(/^claude-skill-/, '');
const bundlePath = resolve(__dirname, '../../skill', skillName, 'assets/widget-bundled.html');
const bundle = readFileSync(bundlePath, 'utf8');

describe('bundle integrity', () => {
  describe('script execution timing', () => {
    it('the inlined <script> declares type="module" so it defers past DOM parsing', () => {
      expect(bundle).toMatch(/<script\s+type="module">/);
    });

    it('does NOT contain a bare <script> without attributes (legacy non-deferred pattern)', () => {
      expect(bundle).not.toMatch(/<script>\s*(?:var|const|let|function|document)/);
    });

    it('the embedded JSON payload script keeps its type="application/json" attribute', () => {
      expect(bundle).toMatch(/<script[^>]*id="le-data"[^>]*type="application\/json"/);
    });
  });

  describe('runtime slot tokens preserved (filled by Claude / render.py at render time)', () => {
    const runtimeTokens: readonly string[] = [
      'topic',
      'topic_json',
      'submit_instruction_json',
      'issues_json',
    ];

    runtimeTokens.forEach((token) => {
      it(`{{${token}}} is present in the bundled HTML`, () => {
        expect(bundle).toContain(`{{${token}}}`);
      });
    });
  });

  describe('critical string literals survive JS minification', () => {
    const literals: readonly string[] = [
      'sendPrompt',
      'le-data',
      'le-chips',
      'le-form',
      'le-proceed-btn',
      'le-prompt-input',
      'le-actions',
      'le-summary',
    ];

    literals.forEach((literal) => {
      it(`"${literal}" appears in the bundled output`, () => {
        expect(bundle).toContain(literal);
      });
    });
  });

  describe('size budget', () => {
    it('bundle stays under 24 KB (24,576 bytes)', () => {
      expect(bundle.length).toBeLessThan(24_576);
    });
  });
});
