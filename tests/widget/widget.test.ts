/**
 * jsdom runtime tests for the hello-world widget.
 *
 * jsdom does not execute <script type="module"> natively, so we extract
 * the script body and invoke it via `new Function()` after populating
 * the DOM.
 *
 * Slot filling is delegated to the real `render.py` pipeline (spawned via
 * python3) so these tests exercise the production rendering path rather
 * than an inline JS substitute.
 *
 * Extend:
 *   - One test per interaction. Load the widget, act, assert DOM state
 *     and sendPrompt calls.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const packageJson = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8')) as {
  name: string;
};
const skillName = packageJson.name.replace(/^claude-skill-/, '');
const renderPath = resolve(__dirname, '../../skill', skillName, 'scripts/render.py');

const renderResult = spawnSync('python3', [renderPath], {
  input: JSON.stringify({ title: 'Test title', prompt: 'Test prompt' }),
  encoding: 'utf8',
});
if (renderResult.status !== 0) {
  throw new Error(
    `render.py exited with status ${renderResult.status}. Run \`pnpm build\` first.\nstderr: ${renderResult.stderr}`,
  );
}
const filledBundle = renderResult.stdout;

const scriptMatch = filledBundle.match(/<script\s+type="module">([\s\S]*?)<\/script>/);
if (scriptMatch === null) {
  throw new Error('Rendered bundle has no <script type="module"> - run `pnpm build` first');
}
const scriptBody = scriptMatch[1] ?? '';
const htmlWithoutScript = filledBundle.replace(/<script\s+type="module">[\s\S]*?<\/script>/, '');

interface SendPromptSpy {
  calls: string[];
}

const installSendPrompt = (): SendPromptSpy => {
  const spy: SendPromptSpy = { calls: [] };
  (globalThis as unknown as { sendPrompt: (text: string) => void }).sendPrompt = (text) => {
    spy.calls.push(text);
  };
  return spy;
};

const loadWidget = (): SendPromptSpy => {
  document.body.innerHTML = htmlWithoutScript;
  const spy = installSendPrompt();
  new Function(scriptBody)();
  return spy;
};

describe('widget runtime', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders title and prompt from slot values', () => {
    loadWidget();
    const heading = document.querySelector('h1');
    const sub = document.querySelector('.sub');
    expect(heading?.textContent).toBe('Test title');
    expect(sub?.textContent).toBe('Test prompt');
  });

  it('apply button is disabled when input is empty', () => {
    loadWidget();
    const applyButton = document.querySelector<HTMLButtonElement>('#applyBtn');
    expect(applyButton?.disabled).toBe(true);
  });

  it('typing in the input enables the apply button and updates the count', () => {
    loadWidget();
    const input = document.querySelector<HTMLTextAreaElement>('.response-input');
    const applyButton = document.querySelector<HTMLButtonElement>('#applyBtn');
    const counter = document.querySelector<HTMLElement>('.count');
    if (!input || !applyButton || !counter) throw new Error('missing element');

    input.value = 'Hello';
    input.dispatchEvent(new Event('input'));

    expect(applyButton.disabled).toBe(false);
    expect(counter.textContent).toBe('Response ready');
  });

  it('clearing the input disables the apply button again', () => {
    loadWidget();
    const input = document.querySelector<HTMLTextAreaElement>('.response-input');
    const applyButton = document.querySelector<HTMLButtonElement>('#applyBtn');
    if (!input || !applyButton) throw new Error('missing element');

    input.value = 'Hello';
    input.dispatchEvent(new Event('input'));
    expect(applyButton.disabled).toBe(false);

    input.value = '';
    input.dispatchEvent(new Event('input'));
    expect(applyButton.disabled).toBe(true);
  });

  it('clicking apply calls sendPrompt with the input value', () => {
    const spy = loadWidget();
    const input = document.querySelector<HTMLTextAreaElement>('.response-input');
    const applyButton = document.querySelector<HTMLButtonElement>('#applyBtn');
    if (!input || !applyButton) throw new Error('missing element');

    input.value = 'Hello world';
    input.dispatchEvent(new Event('input'));
    applyButton.click();

    expect(spy.calls).toEqual(['Template widget response: Hello world']);
  });

  it('clicking apply with whitespace-only input is a no-op', () => {
    const spy = loadWidget();
    const input = document.querySelector<HTMLTextAreaElement>('.response-input');
    const applyButton = document.querySelector<HTMLButtonElement>('#applyBtn');
    if (!input || !applyButton) throw new Error('missing element');

    input.value = '   ';
    input.dispatchEvent(new Event('input'));
    applyButton.click();

    expect(spy.calls).toEqual([]);
  });
});
