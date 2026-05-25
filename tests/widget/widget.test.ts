/**
 * jsdom runtime tests for the Linear issue editor widget.
 *
 * jsdom does not execute <script type="module"> natively, so each test
 * extracts the inlined script body from the freshly rendered bundle and
 * invokes it via `new Function()` after seeding the DOM. Slot filling is
 * delegated to the real `render.py` pipeline so these tests exercise the
 * production rendering path rather than an inline JS substitute.
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

interface IssueDraft {
  id: string;
  title: string;
  description: string;
}

interface RenderedBundle {
  html: string;
  script: string;
}

const renderBundle = (payload: unknown): RenderedBundle => {
  const result = spawnSync('python3', [renderPath], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(
      `render.py exited with status ${result.status}. Run \`pnpm build\` first.\nstderr: ${result.stderr}`,
    );
  }
  const scriptMatch = result.stdout.match(/<script\s+type="module">([\s\S]*?)<\/script>/);
  if (scriptMatch === null) {
    throw new Error('Rendered bundle has no <script type="module"> - run `pnpm build` first');
  }
  const html = result.stdout.replace(/<script\s+type="module">[\s\S]*?<\/script>/, '');
  return { html, script: scriptMatch[1] ?? '' };
};

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

const loadWidget = (payload: unknown): SendPromptSpy => {
  const bundle = renderBundle(payload);
  document.body.innerHTML = bundle.html;
  const spy = installSendPrompt();
  new Function(bundle.script)();
  return spy;
};

const dispatchInput = (element: HTMLInputElement | HTMLTextAreaElement, value: string): void => {
  element.value = value;
  element.dispatchEvent(new Event('input', { bubbles: true }));
};

const singleIssuePayload = {
  topic: 'spike review',
  submit_instruction: 'Save the issue to Linear in SAPP.',
  issues: [
    {
      id: 'spike-issue',
      title: 'Spike: investigate ingestion lag',
      description: 'Spike to investigate why ingestion lag spikes during deploys.',
    } satisfies IssueDraft,
  ],
};

const multiIssuePayload = {
  topic: 'telemetry audit',
  submit_instruction: 'Save these to Linear in the SAPP team.',
  issues: [
    {
      id: 'alert-issue',
      title: 'Add p99 latency alert for ingestion',
      description: 'Wire a Grafana alert when p99 > 300ms.',
    },
    {
      id: 'trace-issue',
      title: 'Backfill missing trace IDs',
      description: 'Several pipelines emit events without trace IDs.',
    },
    {
      id: 'dashboard-issue',
      title: 'Add latency dashboard for hot paths',
      description: 'Surface p50/p95/p99 by route, owner, and team.',
    },
  ],
};

describe('linear-editing widget', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('rendering', () => {
    it('renders the topic in the sub-header', () => {
      loadWidget(singleIssuePayload);
      const sub = document.querySelector('.le-sub');
      expect(sub?.textContent).toContain('spike review');
    });

    it('hides chip navigation when there is only one issue', () => {
      loadWidget(singleIssuePayload);
      const chips = document.querySelector<HTMLDivElement>('#le-chips');
      expect(chips?.style.display).toBe('none');
      expect(chips?.querySelectorAll('.le-chip')).toHaveLength(0);
    });

    it('omits the Discard button when there is only one issue', () => {
      loadWidget(singleIssuePayload);
      expect(document.querySelector('[data-discard]')).toBeNull();
    });

    it('renders one chip per issue when there are multiple', () => {
      loadWidget(multiIssuePayload);
      const chips = document.querySelectorAll('.le-chip');
      expect(chips).toHaveLength(3);
      expect(chips[0]?.classList.contains('active')).toBe(true);
      expect(chips[1]?.classList.contains('active')).toBe(false);
    });

    it('seeds the active form with the first issue values', () => {
      loadWidget(multiIssuePayload);
      const titleInput = document.querySelector<HTMLInputElement>('#le-title');
      const descriptionInput = document.querySelector<HTMLTextAreaElement>('#le-description');
      expect(titleInput?.value).toBe('Add p99 latency alert for ingestion');
      expect(descriptionInput?.value).toBe('Wire a Grafana alert when p99 > 300ms.');
    });

    it('summary starts at "0 of N edited" with no discard suffix', () => {
      loadWidget(multiIssuePayload);
      const summary = document.querySelector('#le-summary');
      expect(summary?.textContent).toBe('0 of 3 edited');
    });
  });

  describe('chip navigation', () => {
    it('clicking a chip switches the active issue and active chip class', () => {
      loadWidget(multiIssuePayload);
      const secondChip = document.querySelectorAll<HTMLButtonElement>('.le-chip')[1];
      secondChip?.click();
      const titleInput = document.querySelector<HTMLInputElement>('#le-title');
      expect(titleInput?.value).toBe('Backfill missing trace IDs');
      const activeChip = document.querySelector('.le-chip.active');
      expect(activeChip?.getAttribute('data-index')).toBe('1');
    });
  });

  describe('editing', () => {
    it('typing a new title flags the chip as edited and updates the summary', () => {
      loadWidget(multiIssuePayload);
      const titleInput = document.querySelector<HTMLInputElement>('#le-title');
      if (titleInput === null) throw new Error('title input missing');
      dispatchInput(titleInput, 'Add p99 latency alert for ingest path');
      const firstChip = document.querySelectorAll<HTMLButtonElement>('.le-chip')[0];
      expect(firstChip?.querySelector('.le-chip-dot')).not.toBeNull();
      expect(document.querySelector('#le-summary')?.textContent).toBe('1 of 3 edited');
    });

    it('reverting an edit clears the edited flag and summary', () => {
      loadWidget(multiIssuePayload);
      const titleInput = document.querySelector<HTMLInputElement>('#le-title');
      if (titleInput === null) throw new Error('title input missing');
      dispatchInput(titleInput, 'changed');
      dispatchInput(titleInput, 'Add p99 latency alert for ingestion');
      const firstChip = document.querySelectorAll<HTMLButtonElement>('.le-chip')[0];
      expect(firstChip?.querySelector('.le-chip-dot')).toBeNull();
      expect(document.querySelector('#le-summary')?.textContent).toBe('0 of 3 edited');
    });
  });

  describe('discard toggle', () => {
    it('marks the active issue as discarded, locks the inputs, and updates the chip', () => {
      loadWidget(multiIssuePayload);
      const discardButton = document.querySelector<HTMLButtonElement>('[data-discard]');
      discardButton?.click();
      const titleInput = document.querySelector<HTMLInputElement>('#le-title');
      const descriptionInput = document.querySelector<HTMLTextAreaElement>('#le-description');
      expect(titleInput?.readOnly).toBe(true);
      expect(titleInput?.classList.contains('discarded')).toBe(true);
      expect(descriptionInput?.readOnly).toBe(true);
      const firstChip = document.querySelectorAll<HTMLButtonElement>('.le-chip')[0];
      expect(firstChip?.classList.contains('discarded')).toBe(true);
      expect(document.querySelector('#le-summary')?.textContent).toBe(
        '0 of 3 edited · 1 discarded',
      );
    });

    it('toggling discard off restores the inputs', () => {
      loadWidget(multiIssuePayload);
      const discardButton = document.querySelector<HTMLButtonElement>('[data-discard]');
      discardButton?.click();
      const restoredButton = document.querySelector<HTMLButtonElement>('[data-discard]');
      restoredButton?.click();
      const titleInput = document.querySelector<HTMLInputElement>('#le-title');
      expect(titleInput?.readOnly).toBe(false);
      expect(titleInput?.classList.contains('discarded')).toBe(false);
      expect(document.querySelector('#le-summary')?.textContent).toBe('0 of 3 edited');
    });
  });

  describe('proceed payload', () => {
    it('case 1: edits + prompt produces an INCLUDED edited payload with the prompt as the action', () => {
      const spy = loadWidget(multiIssuePayload);
      const titleInput = document.querySelector<HTMLInputElement>('#le-title');
      if (titleInput === null) throw new Error('title input missing');
      dispatchInput(titleInput, 'Add ingestion p99 alert in Grafana');
      const promptInput = document.querySelector<HTMLTextAreaElement>('#le-prompt-input');
      if (promptInput === null) throw new Error('prompt input missing');
      dispatchInput(promptInput, 'save to Linear in SAPP and link to the audit doc');
      document.querySelector<HTMLButtonElement>('#le-proceed-btn')?.click();
      expect(spy.calls).toHaveLength(1);
      const message = spy.calls[0] ?? '';
      expect(message).toContain('The user reviewed 3 Linear issues for: telemetry audit');
      expect(message).toContain('Issue 1 (INCLUDED, edited by user):');
      expect(message).toContain('Issue 2 (INCLUDED, unchanged from your draft):');
      expect(message).toContain('Title: Add ingestion p99 alert in Grafana');
      expect(message).toContain('save to Linear in SAPP and link to the audit doc');
      expect(message).toContain(
        "(If the user's instruction above is ambiguous, fall back to: Save these to Linear in the SAPP team.)",
      );
    });

    it('case 2: edits without a prompt falls back to submit_instruction as the default action', () => {
      const spy = loadWidget(multiIssuePayload);
      const titleInput = document.querySelector<HTMLInputElement>('#le-title');
      if (titleInput === null) throw new Error('title input missing');
      dispatchInput(titleInput, 'Add ingestion p99 alert in Grafana');
      document.querySelector<HTMLButtonElement>('#le-proceed-btn')?.click();
      const message = spy.calls[0] ?? '';
      expect(message).toContain(
        '(No instruction from the user.) Default action: Save these to Linear in the SAPP team.',
      );
      expect(message).toContain('Issue 1 (INCLUDED, edited by user):');
    });

    it('case 3: no edits but a prompt sends the original drafts marked unchanged with the prompt as the action', () => {
      const spy = loadWidget(multiIssuePayload);
      const promptInput = document.querySelector<HTMLTextAreaElement>('#le-prompt-input');
      if (promptInput === null) throw new Error('prompt input missing');
      dispatchInput(promptInput, 'tighten the titles before saving');
      document.querySelector<HTMLButtonElement>('#le-proceed-btn')?.click();
      const message = spy.calls[0] ?? '';
      expect(message).toContain('tighten the titles before saving');
      expect(message).toContain('Issue 1 (INCLUDED, unchanged from your draft):');
      expect(message).toContain('Issue 2 (INCLUDED, unchanged from your draft):');
      expect(message).toContain('Issue 3 (INCLUDED, unchanged from your draft):');
    });

    it('case 4: no edits and no prompt falls back to submit_instruction with unchanged drafts', () => {
      const spy = loadWidget(multiIssuePayload);
      document.querySelector<HTMLButtonElement>('#le-proceed-btn')?.click();
      const message = spy.calls[0] ?? '';
      expect(message).toContain(
        '(No instruction from the user.) Default action: Save these to Linear in the SAPP team.',
      );
      expect(message).toContain('Issue 1 (INCLUDED, unchanged from your draft):');
    });

    it('includes a DISCARDED warning block and marks each discarded issue accordingly', () => {
      const spy = loadWidget(multiIssuePayload);
      const secondChip = document.querySelectorAll<HTMLButtonElement>('.le-chip')[1];
      secondChip?.click();
      document.querySelector<HTMLButtonElement>('[data-discard]')?.click();
      document.querySelector<HTMLButtonElement>('#le-proceed-btn')?.click();
      const message = spy.calls[0] ?? '';
      expect(message).toContain('Issues marked DISCARDED are fresh drafts the user dropped');
      expect(message).toContain('Issue 2 (DISCARDED, unchanged from your draft):');
      expect(message).toContain('Issue 1 (INCLUDED, unchanged from your draft):');
    });

    it('singular grammar for single-issue payloads in the header line', () => {
      const spy = loadWidget(singleIssuePayload);
      document.querySelector<HTMLButtonElement>('#le-proceed-btn')?.click();
      const message = spy.calls[0] ?? '';
      expect(message).toContain('The user reviewed 1 Linear issue for: spike review');
    });
  });

  describe('existing-issue edits (linear_id set)', () => {
    const existingIssuePayload = {
      topic: 'sapp 1234 scope rewrite',
      submit_instruction: 'Update each Linear issue with the edited content.',
      issues: [
        {
          id: 'sapp-1234',
          linear_id: 'SAPP-1234',
          title: 'Investigate ingestion lag during deploys',
          description: 'Lag spikes during the daily 09:00 deploy window. Out of scope: ...',
        },
        {
          id: 'sapp-5678',
          linear_id: 'SAPP-5678',
          title: 'Backfill missing trace IDs',
          description: 'Existing live description from Linear.',
        },
      ],
    };

    const mixedPayload = {
      topic: 'audit follow-ups',
      submit_instruction: 'Create the new drafts and update the existing one.',
      issues: [
        {
          id: 'new-alert',
          title: 'Add p99 latency alert',
          description: 'Wire a Grafana alert when p99 > 300ms.',
        },
        {
          id: 'existing-trace',
          linear_id: 'SAPP-7777',
          title: 'Backfill missing trace IDs',
          description: 'Existing live description from Linear.',
        },
      ],
    };

    it('renders the editing badge with the Linear ID on the active issue', () => {
      loadWidget(existingIssuePayload);
      const badge = document.querySelector('.le-existing-badge');
      expect(badge?.textContent).toBe('Editing SAPP-1234');
      expect(badge?.getAttribute('data-linear-id')).toBe('SAPP-1234');
    });

    it('hides the Discard button on existing-issue rows even with multiple issues', () => {
      loadWidget(existingIssuePayload);
      expect(document.querySelector('[data-discard]')).toBeNull();
    });

    it('keeps the Discard button on a fresh-draft row in a mixed batch', () => {
      loadWidget(mixedPayload);
      expect(document.querySelector('[data-discard]')).not.toBeNull();
      const secondChip = document.querySelectorAll<HTMLButtonElement>('.le-chip')[1];
      secondChip?.click();
      expect(document.querySelector('[data-discard]')).toBeNull();
      expect(document.querySelector('.le-existing-badge')?.textContent).toBe('Editing SAPP-7777');
    });

    it('emits UPDATE <linear_id> in the proceed payload and includes the update notice', () => {
      const spy = loadWidget(existingIssuePayload);
      document.querySelector<HTMLButtonElement>('#le-proceed-btn')?.click();
      const message = spy.calls[0] ?? '';
      expect(message).toContain('Issue 1 (UPDATE SAPP-1234, unchanged from your draft):');
      expect(message).toContain('Issue 2 (UPDATE SAPP-5678, unchanged from your draft):');
      expect(message).toContain('Issues marked UPDATE <id> are edits of existing Linear issues');
      expect(message).not.toContain('Some issues are marked DISCARDED');
    });

    it('mixes INCLUDED and UPDATE tags in mixed batches', () => {
      const spy = loadWidget(mixedPayload);
      document.querySelector<HTMLButtonElement>('#le-proceed-btn')?.click();
      const message = spy.calls[0] ?? '';
      expect(message).toContain('Issue 1 (INCLUDED, unchanged from your draft):');
      expect(message).toContain('Issue 2 (UPDATE SAPP-7777, unchanged from your draft):');
    });

    it('confirmation banner reports update counts for an all-existing batch', () => {
      loadWidget(existingIssuePayload);
      document.querySelector<HTMLButtonElement>('#le-proceed-btn')?.click();
      const banner = document.querySelector('.le-sent');
      expect(banner?.textContent).toContain('Sent to chat. 2 to update.');
    });

    it('confirmation banner reports create + update counts for a mixed batch', () => {
      loadWidget(mixedPayload);
      document.querySelector<HTMLButtonElement>('#le-proceed-btn')?.click();
      const banner = document.querySelector('.le-sent');
      expect(banner?.textContent).toContain('Sent to chat. 1 to create, 1 to update.');
    });
  });

  describe('post-submit lockdown', () => {
    it('replaces the actions row with a confirmation banner and disables the proceed button', () => {
      loadWidget(multiIssuePayload);
      const proceedButton = document.querySelector<HTMLButtonElement>('#le-proceed-btn');
      proceedButton?.click();
      expect(document.querySelector('#le-actions')).toBeNull();
      const banner = document.querySelector('.le-sent');
      expect(banner?.textContent).toContain('Sent to chat. 3 to create.');
      expect(proceedButton?.disabled).toBe(true);
    });

    it('confirmation banner reports both create and discarded counts when any are discarded', () => {
      loadWidget(multiIssuePayload);
      document.querySelector<HTMLButtonElement>('[data-discard]')?.click();
      document.querySelector<HTMLButtonElement>('#le-proceed-btn')?.click();
      const banner = document.querySelector('.le-sent');
      expect(banner?.textContent).toContain('Sent to chat. 2 to create, 1 discarded.');
    });

    it('further proceed clicks are ignored after the first submission', () => {
      const spy = loadWidget(multiIssuePayload);
      const proceedButton = document.querySelector<HTMLButtonElement>('#le-proceed-btn');
      proceedButton?.click();
      proceedButton?.click();
      proceedButton?.click();
      expect(spy.calls).toHaveLength(1);
    });
  });
});
