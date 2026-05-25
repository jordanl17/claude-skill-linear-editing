/**
 * Programmatic graders for the eval suite.
 *
 * Each scenario id in evals.json maps to a with_skill grader. Each grader
 * returns Assertion[] - one entry per objectively-verifiable check. The
 * baseline (without_skill) condition uses a universal check that the
 * skill did NOT activate, since the baseline agent is explicitly told to
 * ignore it.
 *
 * The CLI walks each `iteration-N/eval-{id}/{condition}/run-1` directory,
 * runs the right grader, writes grading.json next to the run dir, and
 * prints a one-line summary per run plus a final per-condition pass rate.
 */

import { existsSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Assertion, Grading, GradingSummary } from './shared.js';
import { activatedAssertion, assertion, loadOutputs, summarize } from './shared.js';

// Counts issues by reading the embedded <script id="le-data" type="application/json">
// payload. The chip buttons themselves are rendered by JS at runtime, so static-HTML
// scans see the JS template-string literal instead of real DOM nodes.
const countIssuesInPayload = (html: string): number => {
  const match = html.match(/<script[^>]*id="le-data"[^>]*>([\s\S]*?)<\/script>/);
  if (match === null) return 0;
  const body = match[1]?.trim() ?? '';
  try {
    const parsed = JSON.parse(body) as { issues?: unknown[] };
    return Array.isArray(parsed.issues) ? parsed.issues.length : 0;
  } catch {
    return 0;
  }
};

const widgetHasNoLeakedTokens = (html: string): boolean => html.includes('{{') === false;

const widgetHasDataScript = (html: string): boolean => html.includes('id="le-data"');

const gradeMultiDraftFires = (runDir: string): Assertion[] => {
  const outputs = loadOutputs(runDir);
  const activationCheck = activatedAssertion(outputs.meta, true);
  if (outputs.meta.activated !== true) return [activationCheck];
  return [
    activationCheck,
    assertion(
      'embedded payload carries three issues',
      countIssuesInPayload(outputs.widget) === 3,
      `issues=${countIssuesInPayload(outputs.widget)}`,
    ),
    assertion(
      'no leaked Mustache tokens in the rendered widget',
      widgetHasNoLeakedTokens(outputs.widget),
      'widget should not contain "{{" after render',
    ),
    assertion(
      'embedded payload script is present',
      widgetHasDataScript(outputs.widget),
      'expected id="le-data" in the rendered HTML',
    ),
  ];
};

const gradeSingleDraftFires = (runDir: string): Assertion[] => {
  const outputs = loadOutputs(runDir);
  const activationCheck = activatedAssertion(outputs.meta, true);
  if (outputs.meta.activated !== true) return [activationCheck];
  return [
    activationCheck,
    assertion(
      'embedded payload carries exactly one issue',
      countIssuesInPayload(outputs.widget) === 1,
      `issues=${countIssuesInPayload(outputs.widget)}`,
    ),
    assertion(
      'embedded payload script is present',
      widgetHasDataScript(outputs.widget),
      'expected id="le-data" in the rendered HTML',
    ),
    assertion(
      'no leaked Mustache tokens in the rendered widget',
      widgetHasNoLeakedTokens(outputs.widget),
      'widget should not contain "{{" after render',
    ),
  ];
};

const gradeQueueTicketsFires = (runDir: string): Assertion[] => {
  const outputs = loadOutputs(runDir);
  const activationCheck = activatedAssertion(outputs.meta, true);
  if (outputs.meta.activated !== true) return [activationCheck];
  return [
    activationCheck,
    assertion(
      'embedded payload carries at least two issues',
      countIssuesInPayload(outputs.widget) >= 2,
      `issues=${countIssuesInPayload(outputs.widget)}`,
    ),
    assertion(
      'embedded payload script is present',
      widgetHasDataScript(outputs.widget),
      'expected id="le-data" in the rendered HTML',
    ),
    assertion(
      'no leaked Mustache tokens in the rendered widget',
      widgetHasNoLeakedTokens(outputs.widget),
      'widget should not contain "{{" after render',
    ),
  ];
};

const payloadIssuesField = (html: string, field: 'linear_id'): string[] => {
  const match = html.match(/<script[^>]*id="le-data"[^>]*>([\s\S]*?)<\/script>/);
  if (match === null) return [];
  const body = match[1]?.trim() ?? '';
  try {
    const parsed = JSON.parse(body) as { issues?: Array<Record<string, unknown>> };
    if (Array.isArray(parsed.issues) === false) return [];
    return parsed.issues
      .map((issue) => issue[field])
      .filter((value): value is string => typeof value === 'string');
  } catch {
    return [];
  }
};

const gradeExistingEditFires = (runDir: string): Assertion[] => {
  const outputs = loadOutputs(runDir);
  const activationCheck = activatedAssertion(outputs.meta, true);
  if (outputs.meta.activated !== true) return [activationCheck];
  const linearIds = payloadIssuesField(outputs.widget, 'linear_id');
  return [
    activationCheck,
    assertion(
      'embedded payload carries exactly one issue',
      countIssuesInPayload(outputs.widget) === 1,
      `issues=${countIssuesInPayload(outputs.widget)}`,
    ),
    assertion(
      'the one issue has a linear_id set',
      linearIds.length === 1,
      `linear_ids=${JSON.stringify(linearIds)}`,
    ),
    assertion(
      'no leaked Mustache tokens in the rendered widget',
      widgetHasNoLeakedTokens(outputs.widget),
      'widget should not contain "{{" after render',
    ),
  ];
};

const gradeSkipCase = (runDir: string): Assertion[] => {
  const outputs = loadOutputs(runDir);
  return [activatedAssertion(outputs.meta, false)];
};

const gradeBaseline = (runDir: string): Assertion[] => {
  const outputs = loadOutputs(runDir);
  return [
    activatedAssertion(
      outputs.meta,
      false,
      'baseline run did not activate the skill (explicitly instructed to ignore)',
    ),
  ];
};

const WITH_SKILL_GRADERS: Record<string, (runDir: string) => Assertion[]> = {
  'multi-draft-fires': gradeMultiDraftFires,
  'single-draft-fires': gradeSingleDraftFires,
  'queue-tickets-fires': gradeQueueTicketsFires,
  'existing-edit-fires': gradeExistingEditFires,
  'save-without-review-skips': gradeSkipCase,
  'search-existing-skips': gradeSkipCase,
  'single-field-edit-skips': gradeSkipCase,
};

interface RunResult {
  scenarioId: string;
  condition: 'with_skill' | 'without_skill';
  runDir: string;
  summary: GradingSummary;
}

const gradeRun = (
  scenarioId: string,
  condition: 'with_skill' | 'without_skill',
  runDir: string,
): RunResult | null => {
  if (existsSync(runDir) === false) return null;
  const grader =
    condition === 'with_skill' ? (WITH_SKILL_GRADERS[scenarioId] ?? gradeSkipCase) : gradeBaseline;
  const expectations = grader(runDir);
  const summary = summarize(expectations);
  const grading: Grading = { expectations, summary };
  writeFileSync(join(runDir, 'grading.json'), `${JSON.stringify(grading, null, 2)}\n`, 'utf8');
  return { scenarioId, condition, runDir, summary };
};

const formatSummaryLine = (result: RunResult): string => {
  const passText = `${result.summary.passed}/${result.summary.total}`;
  const percent = Math.round(result.summary.pass_rate * 100);
  return `  ${result.condition.padEnd(15)} ${passText.padEnd(6)} (${percent}%) - ${result.runDir}`;
};

const formatGroupSummary = (label: string, results: RunResult[]): string => {
  const totalPassed = results.reduce((sum, result) => sum + result.summary.passed, 0);
  const totalAssertions = results.reduce((sum, result) => sum + result.summary.total, 0);
  const passRate = totalAssertions === 0 ? 0 : totalPassed / totalAssertions;
  const percent = Math.round(passRate * 100);
  return `${label}: ${totalPassed}/${totalAssertions} assertions (${percent}%)`;
};

const main = (): void => {
  const iterationArg = process.argv[2];
  if (iterationArg === undefined) {
    console.error('Usage: pnpm eval:grade <iteration-dir>');
    process.exit(1);
  }
  const iterationDir = resolve(iterationArg);
  if (existsSync(iterationDir) === false || statSync(iterationDir).isDirectory() === false) {
    throw new Error(`Iteration directory not found: ${iterationDir}`);
  }

  const evalDirs = readdirSync(iterationDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('eval-'))
    .sort((left, right) => left.name.localeCompare(right.name));

  const conditions = ['with_skill', 'without_skill'] as const;

  const results: RunResult[] = evalDirs.flatMap((entry) => {
    const scenarioId = entry.name.slice('eval-'.length);
    return conditions.flatMap((condition) => {
      const runDir = join(iterationDir, entry.name, condition, 'run-1');
      const result = gradeRun(scenarioId, condition, runDir);
      return result === null ? [] : [result];
    });
  });

  console.log(`Iteration: ${iterationDir}\n`);
  results.forEach((result) => {
    console.log(formatSummaryLine(result));
  });

  const withSkillResults = results.filter((result) => result.condition === 'with_skill');
  const baselineResults = results.filter((result) => result.condition === 'without_skill');

  console.log('');
  console.log(formatGroupSummary('with_skill   ', withSkillResults));
  console.log(formatGroupSummary('without_skill', baselineResults));
};

main();
