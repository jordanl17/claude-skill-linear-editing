import { chmodSync, cpSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

const repoRoot = dirname(fileURLToPath(import.meta.url));

// Derive the skill folder name from package.json. Strips the
// `claude-skill-` prefix if present. Update package.json + `mv skill/<old>
// skill/<new>` to rename.
const packageJson = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf8')) as {
  name: string;
};
const skillName = packageJson.name.replace(/^claude-skill-/, '');
const assetsDir = resolve(repoRoot, 'skill', skillName, 'assets');

// Post-processing passes applied in order to the inlined HTML.
// `rel="stylesheet"` and `crossorigin` are leftovers from the original
// <link>/<script src=...> tags and are meaningless on the inlined <style>/
// <script> blocks. `type="module"` MUST stay - it defers execution until the
// DOM is parsed, so module-top DOM lookups (requireElement) find their targets
// even when Vite hoists the <script> to the top of the document.
const htmlTransforms: Array<(html: string) => string> = [
  (html) => html.replace(/<style\s+rel="stylesheet"\s+crossorigin>/g, '<style>'),
  (html) => html.replace(/<script\s+type="module"\s+crossorigin>/g, '<script type="module">'),
  (html) =>
    html
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join('\n'),
];

function finalizeBundle(): Plugin {
  return {
    name: 'finalize-bundle',
    enforce: 'post',
    writeBundle(options) {
      const outDir = options.dir ?? assetsDir;
      const source = join(outDir, 'widget.html');
      const target = join(outDir, 'widget-bundled.html');
      const finalized = htmlTransforms.reduce(
        (html, transform) => transform(html),
        readFileSync(source, 'utf8'),
      );
      writeFileSync(target, finalized, 'utf8');
      unlinkSync(source);
      const byteLength = Buffer.byteLength(finalized, 'utf8');
      this.info(`finalize-bundle: wrote ${target} (${byteLength.toLocaleString()} bytes)`);
    },
  };
}

// Wrap the pretty-printed schema in a fenced ```json block so it can be
// substituted into SKILL.md verbatim. Kept deliberately simple - any
// richer presentation (slot tables, etc.) can layer on later.
function renderSchemaReference(schemaObject: unknown): string {
  const pretty = JSON.stringify(schemaObject, null, 2);
  return ['```json', pretty, '```'].join('\n');
}

function assembleSkill(): Plugin {
  const skillDir = resolve(repoRoot, 'skill', skillName);
  const skillSrcDir = resolve(repoRoot, 'skill-src');
  return {
    name: 'assemble-skill',
    enforce: 'post',
    writeBundle() {
      const schemaSourcePath = join(skillSrcDir, 'assets', 'schema.json');
      const schemaRaw = readFileSync(schemaSourcePath, 'utf8');
      const schemaObject = JSON.parse(schemaRaw) as unknown;

      const skillMdSourcePath = join(skillSrcDir, 'SKILL.md');
      const skillMdSource = readFileSync(skillMdSourcePath, 'utf8');
      const schemaReference = renderSchemaReference(schemaObject);
      const skillMdFinal = skillMdSource.replace('{{SCHEMA}}', schemaReference);
      const skillMdTarget = join(skillDir, 'SKILL.md');
      writeFileSync(skillMdTarget, skillMdFinal, 'utf8');

      const schemaTargetPath = join(skillDir, 'assets', 'schema.json');
      writeFileSync(schemaTargetPath, schemaRaw, 'utf8');

      const scriptsSource = join(skillSrcDir, 'scripts');
      const scriptsTarget = join(skillDir, 'scripts');
      cpSync(scriptsSource, scriptsTarget, { recursive: true });

      const renderScript = join(scriptsTarget, 'render.py');
      chmodSync(renderScript, 0o755);

      const referencesSource = join(skillSrcDir, 'references');
      const referencesTarget = join(skillDir, 'references');
      cpSync(referencesSource, referencesTarget, { recursive: true });

      const licenseSource = resolve(repoRoot, 'LICENSE');
      const licenseTarget = join(skillDir, 'LICENSE');
      writeFileSync(licenseTarget, readFileSync(licenseSource, 'utf8'), 'utf8');

      this.info(
        `assemble-skill: wrote ${skillMdTarget}, ${schemaTargetPath}, ${scriptsTarget}/, ${referencesTarget}/, ${licenseTarget}`,
      );
    },
  };
}

export default defineConfig({
  root: 'widget-src',
  base: './',
  plugins: [viteSingleFile({ removeViteModuleLoader: true }), finalizeBundle(), assembleSkill()],
  css: {
    transformer: 'lightningcss',
  },
  build: {
    outDir: assetsDir,
    emptyOutDir: false,
    modulePreload: false,
    minify: 'terser',
    cssMinify: 'lightningcss',
    terserOptions: {
      ecma: 2020,
      compress: { drop_console: true },
      mangle: { toplevel: false },
      format: { comments: false },
    },
    rollupOptions: {
      input: resolve(repoRoot, 'widget-src/widget.html'),
    },
  },
});
