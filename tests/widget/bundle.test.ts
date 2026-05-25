/**
 * Static checks against the built widget bundle.
 *
 * Catches build-config regressions that only surface in production - e.g.
 * type="module" lost (script runs before DOM), terser mangling sendPrompt
 * (silent broken Apply), or accidental bloat (~80 output tokens per KB
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
      // Vite hoists the <script> near the top. Without type="module" it
      // runs synchronously and module-top requireElement() calls fail.
      expect(bundle).toMatch(/<script\s+type="module">/);
    });

    it('does NOT contain a bare <script> without attributes (legacy non-deferred pattern)', () => {
      expect(bundle).not.toMatch(/<script>\s*(?:var|const|let|function|document)/);
    });
  });

  describe('runtime slot tokens preserved (filled by Claude at render time)', () => {
    const runtimeTokens: readonly string[] = ['title', 'prompt'];

    runtimeTokens.forEach((token) => {
      it(`{{${token}}} is present in the bundled HTML`, () => {
        expect(bundle).toContain(`{{${token}}}`);
      });
    });
  });

  describe('critical string literals survive JS minification', () => {
    // Terser keeps string literals by default. A future config change
    // could break this silently.
    const literals: readonly string[] = ['sendPrompt', 'applyBtn', 'response-input'];

    literals.forEach((literal) => {
      it(`"${literal}" appears in the bundled output`, () => {
        expect(bundle).toContain(literal);
      });
    });
  });

  describe('size budget', () => {
    it('bundle stays under 16 KB (16,384 bytes)', () => {
      // Hello-world: ~2.7 KB. Full widgets typically reach 10-15 KB.
      expect(bundle.length).toBeLessThan(16_384);
    });
  });
});
