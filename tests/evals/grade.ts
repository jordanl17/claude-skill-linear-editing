/**
 * Programmatic graders for the eval suite.
 *
 * Each scenario id in evals.json maps to a grader. Each grader returns
 * Assertion[] - one entry per objectively-verifiable check. The CLI
 * iterates per-condition runs and writes grading.json.
 *
 * Universal assertions (apply to every scenario):
 *   - meta.activated matches expected_activation
 *   - if activated: no leaked {{TOKEN}} in widget.html
 *   - if activated: response.md is the lead-in, not the duplicated draft
 *
 * Skill-specific assertions depend on the widget. Common shapes:
 *   - "widget contains N units" (class count)
 *   - "verbatim section X appears unchanged" (string contains)
 *   - "data-id values are contiguous from 1" (regex extract)
 */

import { resolve } from 'node:path';
import type { Assertion } from './shared.js';
import { assertion, loadOutputs } from './shared.js';

// Placeholder grader. Replace with per-scenario graders once your
// widget produces output worth grading.
const gradeHelloWorld = (runDir: string, isBaseline: boolean): Assertion[] => {
  const outputs = loadOutputs(runDir);
  const expectedActivation = false;
  return [
    assertion(
      `meta.activated matches expected (${expectedActivation})`,
      outputs.meta.activated === expectedActivation,
      `meta.activated=${outputs.meta.activated}, isBaseline=${isBaseline}`,
    ),
  ];
};

// One entry per scenario id in evals.json. Keys must match exactly.
const GRADERS: Record<string, (runDir: string, isBaseline: boolean) => Assertion[]> = {
  'hello-world-skip': gradeHelloWorld,
};

// Implement the per-run loop:
//   1. List eval-* under iterationDir
//   2. For each condition (with_skill, without_skill):
//      - Resolve scenario id, look up grader, run it
//      - Compute summary, write grading.json, print one-line summary
const main = (): void => {
  const iterationDir = process.argv[2];
  if (!iterationDir) {
    console.error('Usage: pnpm eval:grade <iteration-dir>');
    process.exit(1);
  }
  const knownGraders = Object.keys(GRADERS).join(', ');
  console.log(`[Template] Replace tests/evals/grade.ts with your skill's grader logic.`);
  console.log(`Iteration: ${resolve(iterationDir)}`);
  console.log(`Known graders: ${knownGraders}`);
};

main();
