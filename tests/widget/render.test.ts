import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8')) as {
  name: string;
};
const skillName = packageJson.name.replace(/^claude-skill-/, '');
const renderPath = resolve(__dirname, '../../skill', skillName, 'scripts/render.py');

const runRender = (payload: string) =>
  spawnSync('python3', [renderPath], { input: payload, encoding: 'utf8' });

describe('render.py', () => {
  it('substitutes title and prompt slots with valid JSON piped to stdin', () => {
    const result = runRender(JSON.stringify({ title: 'Hello', prompt: 'How are you?' }));
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Hello');
    expect(result.stdout).toContain('How are you?');
    expect(result.stdout).not.toContain('{{title}}');
    expect(result.stdout).not.toContain('{{prompt}}');
  });

  it('rejects missing required slot with non-zero exit and stderr mention', () => {
    const result = runRender(JSON.stringify({ title: 'Hello' }));
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('prompt');
  });

  it('rejects invalid JSON on stdin with non-zero exit', () => {
    const result = runRender('not-json');
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('invalid JSON');
  });

  it('rejects empty stdin with usage message', () => {
    const result = runRender('');
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('stdin');
  });
});
