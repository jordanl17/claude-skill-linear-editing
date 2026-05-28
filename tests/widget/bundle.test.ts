import { createBundleTests } from '@visill/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const packageJson = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8')) as {
  name: string;
};
const skillName = packageJson.name.replace(/^claude-skill-/, '');
const bundlePath = resolve(__dirname, '../../skill', skillName, 'assets/widget-bundled.html');

createBundleTests({
  bundlePath,
  dataScriptId: 'le-data',
  doubleStacheTokens: ['topic'],
  tripleStacheTokens: ['topic_json', 'submit_instruction_json', 'issues_json'],
  literals: [
    'sendPrompt',
    'le-data',
    'le-chips',
    'le-form',
    'le-proceed-btn',
    'le-prompt-input',
    'le-actions',
    'le-summary',
  ],
  sizeLimit: 24_576,
});
