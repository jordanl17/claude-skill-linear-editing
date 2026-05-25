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

const validPayload = {
  topic: 'telemetry audit',
  submit_instruction: 'Save these to Linear in the SAPP team.',
  issues: [
    {
      id: 'first-id',
      title: 'Add p99 latency alert for ingestion path',
      description: 'Audit gap. Wire a Grafana alert at p99 > 300ms.',
    },
    {
      id: 'second-id',
      title: 'Backfill missing trace IDs for legacy events',
      description: 'Several pipelines emit events without trace IDs.',
    },
  ],
};

describe('render.py', () => {
  it('substitutes topic verbatim and embeds JSON variants in the data script', () => {
    const result = runRender(JSON.stringify(validPayload));
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('telemetry audit');
    expect(result.stdout).toContain('"topic": "telemetry audit"');
    expect(result.stdout).toContain('"first-id"');
    expect(result.stdout).toContain('Save these to Linear');
    expect(result.stdout).not.toContain('{{topic}}');
    expect(result.stdout).not.toContain('{{topic_json}}');
    expect(result.stdout).not.toContain('{{submit_instruction_json}}');
    expect(result.stdout).not.toContain('{{issues_json}}');
  });

  it('rejects payload missing a required top-level key with non-zero exit', () => {
    const broken = { topic: 'x', submit_instruction: 'y' };
    const result = runRender(JSON.stringify(broken));
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('issues');
  });

  it('rejects an empty issues array via minItems', () => {
    const broken = { ...validPayload, issues: [] };
    const result = runRender(JSON.stringify(broken));
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/issues|at least 1/i);
  });

  it('rejects an issue missing required fields', () => {
    const broken = {
      ...validPayload,
      issues: [{ id: 'only-id', title: 'no description' }],
    };
    const result = runRender(JSON.stringify(broken));
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('description');
  });

  it('rejects unexpected top-level properties', () => {
    const broken = { ...validPayload, mystery: 'unexpected' };
    const result = runRender(JSON.stringify(broken));
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('mystery');
  });

  it('rejects invalid JSON on stdin with non-zero exit', () => {
    const result = runRender('not-json');
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('invalid JSON');
  });

  it('accepts a payload that includes the optional linear_id on issues', () => {
    const payloadWithLinearId = {
      topic: 'sapp 1234 scope rewrite',
      submit_instruction: 'Update each Linear issue with the edited content.',
      issues: [
        {
          id: 'existing-1',
          linear_id: 'SAPP-1234',
          title: 'Investigate ingestion lag during deploys',
          description: 'Existing live description from Linear.',
        },
      ],
    };
    const result = runRender(JSON.stringify(payloadWithLinearId));
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('SAPP-1234');
    expect(result.stdout).toContain('sapp 1234 scope rewrite');
  });

  it('rejects empty stdin with usage message', () => {
    const result = runRender('');
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('stdin');
  });

  it('neutralizes literal </script> in payload values so the embedded JSON block parses', () => {
    const payloadWithEndTag = {
      topic: 'edge cases',
      submit_instruction: 'Save to Linear; user said "go".',
      issues: [
        {
          id: 'tricky',
          title: 'Handle the "edge" case',
          description:
            'User typed: "hello" and then </script><script>alert(1)</script>. Newline: a\nb',
        },
      ],
    };
    const result = runRender(JSON.stringify(payloadWithEndTag));
    expect(result.status).toBe(0);
    const dataMatch = result.stdout.match(/<script id="le-data"[^>]*>([\s\S]*?)<\/script>/);
    expect(dataMatch).not.toBeNull();
    const dataBody = dataMatch?.[1]?.trim() ?? '';
    expect(dataBody).not.toContain('</script>');
    const parsed = JSON.parse(dataBody) as {
      topic: string;
      issues: Array<{ title: string; description: string }>;
    };
    expect(parsed.topic).toBe('edge cases');
    expect(parsed.issues[0]?.title).toBe('Handle the "edge" case');
    expect(parsed.issues[0]?.description).toContain('</script>');
    expect(parsed.issues[0]?.description).toContain('\n');
  });
});
