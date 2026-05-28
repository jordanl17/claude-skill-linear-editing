/*
 * Linear issue editor widget.
 *
 * State lives in module-scope locals. Event delegation reads and mutates
 * them, then triggers focused re-renders (chips + summary stay light;
 * the active form is rebuilt on chip/discard changes).
 *
 * Each issue is either a fresh draft (no linear_id) or an edit of an
 * existing Linear issue (linear_id set). Existing-issue rows hide the
 * Discard button (you cannot "discard" an issue that is already in
 * Linear) and show an "editing <id>" badge above the title row. The
 * Proceed payload tags existing-issue rows with UPDATE <linear_id>
 * instead of INCLUDED so the receiving turn knows to call save_issue
 * with the existing id rather than creating a new one.
 *
 * SKILL.md documents the full four-case agent contract: edits-as-content,
 * prompt-as-action, INCLUDED vs DISCARDED vs UPDATE, and empty-prompt
 * fallback to submit_instruction.
 */

import { readDataIsland, requireElement, sendPrompt } from '@visill/sdk';

interface IssueInput {
  id: string;
  linear_id?: string;
  title: string;
  description: string;
}

interface Payload {
  topic: string;
  submit_instruction: string;
  issues: IssueInput[];
}

interface IssueState extends IssueInput {
  discarded: boolean;
}

type EditableField = 'title' | 'description';

const chipsContainer = requireElement<HTMLDivElement>('#le-chips');
const formContainer = requireElement<HTMLDivElement>('#le-form');
const summaryElement = requireElement<HTMLSpanElement>('#le-summary');
const promptInput = requireElement<HTMLTextAreaElement>('#le-prompt-input');
const proceedButton = requireElement<HTMLButtonElement>('#le-proceed-btn');
const actionsElement = requireElement<HTMLDivElement>('#le-actions');

const payload = readDataIsland<Payload>('le-data');

const originalIssues: IssueInput[] = payload.issues.map((issue) => ({ ...issue }));
const issueStates: IssueState[] = payload.issues.map((issue) => ({ ...issue, discarded: false }));
const showChips = issueStates.length > 1;

let activeIndex = 0;
let promptText = '';
let submitted = false;

const escapeAttr = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const isExisting = (index: number): boolean => {
  const linearId = issueStates[index]?.linear_id;
  return typeof linearId === 'string' && linearId.length > 0;
};

const isLocalDraft = (index: number): boolean => !isExisting(index);

const canDiscardIssue = (index: number): boolean => issueStates.length > 1 && isLocalDraft(index);

const isEdited = (index: number): boolean => {
  const current = issueStates[index];
  const original = originalIssues[index];
  if (current === undefined || original === undefined) return false;
  return current.title !== original.title || current.description !== original.description;
};

const isDiscarded = (index: number): boolean => issueStates[index]?.discarded === true;

const editedCount = (): number =>
  issueStates.reduce((count, _issue, index) => count + (isEdited(index) ? 1 : 0), 0);

const discardedCount = (): number =>
  issueStates.reduce((count, _issue, index) => count + (isDiscarded(index) ? 1 : 0), 0);

const autoResize = (textarea: HTMLTextAreaElement): void => {
  textarea.style.height = 'auto';
  textarea.style.height = `${textarea.scrollHeight}px`;
};

const buildChipMarkup = (issue: IssueState, index: number): string => {
  const activeClass = index === activeIndex ? 'active' : '';
  const discardedClass = isDiscarded(index) ? 'discarded' : '';
  const dot = isEdited(index) ? '<span class="le-chip-dot" aria-hidden="true"></span>' : '';
  const baseTip = issue.title.length > 0 ? issue.title : '(untitled)';
  const flagParts = [
    isExisting(index) ? `editing ${issue.linear_id}` : null,
    isEdited(index) ? 'edited' : null,
    isDiscarded(index) ? 'discarded' : null,
  ].filter((flag): flag is string => flag !== null);
  const tip = flagParts.length > 0 ? `${baseTip} (${flagParts.join(', ')})` : baseTip;
  const selectedAttr = index === activeIndex ? 'true' : 'false';
  return `<button class="le-chip ${activeClass} ${discardedClass}" role="tab" type="button" data-index="${index}" aria-selected="${selectedAttr}" title="${escapeAttr(tip)}"><span class="le-chip-num">${index + 1}</span>${dot}</button>`;
};

const renderChips = (): void => {
  if (showChips) {
    chipsContainer.style.display = 'flex';
    chipsContainer.innerHTML = issueStates.map(buildChipMarkup).join('');
    return;
  }
  chipsContainer.style.display = 'none';
};

const renderForm = (): void => {
  const issue = issueStates[activeIndex];
  if (issue === undefined) {
    formContainer.innerHTML = '';
    return;
  }
  const existing = isExisting(activeIndex);
  const discarded = isDiscarded(activeIndex);
  const discardLabel = discarded ? 'Discarded' : 'Discard';
  const discardIcon = discarded ? 'ti-circle-check' : 'ti-circle-minus';
  const discardTitle = discarded
    ? 'Discarded, click to restore'
    : 'Discard this issue (its content stays in the payload for prompt reference)';
  const discardButton = canDiscardIssue(activeIndex)
    ? `<button class="le-discard ${discarded ? 'active' : ''}" type="button" data-discard aria-pressed="${discarded}" title="${discardTitle}"><i class="ti ${discardIcon}" style="font-size: 14px;" aria-hidden="true"></i>${discardLabel}</button>`
    : '';
  const existingBadge = existing
    ? `<div class="le-existing-badge" data-linear-id="${escapeAttr(issue.linear_id ?? '')}">Editing ${escapeAttr(issue.linear_id ?? '')}</div>`
    : '';
  const readonlyAttr = discarded ? 'readonly' : '';

  formContainer.innerHTML = `
    ${existingBadge}
    <div class="le-title-row">
      <input
        id="le-title"
        class="le-title-input ${discarded ? 'discarded' : ''}"
        type="text"
        value="${escapeAttr(issue.title)}"
        placeholder="Untitled issue"
        aria-label="Issue title"
        data-field="title"
        ${readonlyAttr}
      />
      ${discardButton}
    </div>
    <div class="le-field">
      <label class="le-label" for="le-description">Description</label>
      <textarea
        id="le-description"
        class="le-textarea ${discarded ? 'discarded' : ''}"
        placeholder="Markdown body"
        data-field="description"
        ${readonlyAttr}
      >${escapeAttr(issue.description)}</textarea>
    </div>
  `;
  const descriptionElement = formContainer.querySelector<HTMLTextAreaElement>('#le-description');
  if (descriptionElement !== null) autoResize(descriptionElement);
};

const renderSummary = (): void => {
  const baseLine = `${editedCount()} of ${issueStates.length} edited`;
  const discarded = discardedCount();
  const parts = discarded > 0 ? [baseLine, `${discarded} discarded`] : [baseLine];
  summaryElement.textContent = parts.join(' · ');
};

const renderAll = (): void => {
  renderChips();
  renderForm();
  renderSummary();
};

const isEditableField = (value: string | undefined): value is EditableField =>
  value === 'title' || value === 'description';

chipsContainer.addEventListener('click', (event) => {
  if (submitted) return;
  const target = event.target;
  if (target instanceof Element) {
    const chip = target.closest<HTMLButtonElement>('.le-chip');
    if (chip === null) return;
    const indexAttr = chip.getAttribute('data-index');
    if (indexAttr === null) return;
    activeIndex = Number(indexAttr);
    renderAll();
  }
});

formContainer.addEventListener('input', (event) => {
  if (submitted) return;
  const target = event.target;
  const isFieldElement =
    target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
  if (isFieldElement) {
    const fieldName = target.dataset['field'];
    if (isEditableField(fieldName)) {
      const current = issueStates[activeIndex];
      if (current === undefined) return;
      current[fieldName] = target.value;
      if (target instanceof HTMLTextAreaElement && fieldName === 'description') {
        autoResize(target);
      }
      renderChips();
      renderSummary();
    }
  }
});

formContainer.addEventListener('click', (event) => {
  if (submitted) return;
  const target = event.target;
  if (target instanceof Element) {
    const discardButton = target.closest<HTMLButtonElement>('[data-discard]');
    if (discardButton === null) return;
    if (canDiscardIssue(activeIndex)) {
      const current = issueStates[activeIndex];
      if (current === undefined) return;
      current.discarded = !current.discarded;
      renderAll();
    }
  }
});

promptInput.addEventListener('input', () => {
  if (submitted) return;
  promptText = promptInput.value;
  autoResize(promptInput);
});

const inclusionTag = (index: number): string => {
  const linearId = issueStates[index]?.linear_id;
  if (typeof linearId === 'string' && linearId.length > 0) return `UPDATE ${linearId}`;
  return isDiscarded(index) ? 'DISCARDED' : 'INCLUDED';
};

const updateCount = (): number =>
  issueStates.reduce((count, _issue, index) => count + (isExisting(index) ? 1 : 0), 0);

const createCount = (): number => issueStates.length - updateCount() - discardedCount();

const buildSubmissionLines = (): string => {
  const trimmedPrompt = promptText.trim();
  const issueCount = issueStates.length;
  const discardedTotal = discardedCount();
  const updateTotal = updateCount();
  const issuePlural = issueCount === 1 ? '' : 's';
  const headerLine = `The user reviewed ${issueCount} Linear issue${issuePlural} for: ${payload.topic}`;
  const authoritativeLine =
    'These versions are authoritative. Treat the title and description below as the final content for each issue. Any earlier draft text in this conversation is superseded.';
  const updateNotice =
    'Issues marked UPDATE <id> are edits of existing Linear issues. Call save_issue against that id with the title and description below; do not create a new issue.';
  const discardedNotice =
    'Issues marked DISCARDED are fresh drafts the user dropped. Do not create them. Their content is preserved here only in case the user references them in the instruction below (e.g. "combine the discarded one into issue 3").';

  const draftLines = issueStates.flatMap((issue, index) => {
    const editedFlag = isEdited(index) ? 'edited by user' : 'unchanged from your draft';
    return [
      `Issue ${index + 1} (${inclusionTag(index)}, ${editedFlag}):`,
      `  Title: ${issue.title}`,
      `  Description: ${issue.description}`,
      '',
    ];
  });

  const actionLines =
    trimmedPrompt.length > 0
      ? [
          trimmedPrompt,
          '',
          `(If the user's instruction above is ambiguous, fall back to: ${payload.submit_instruction})`,
        ]
      : [`(No instruction from the user.) Default action: ${payload.submit_instruction}`];

  const preamble = [headerLine, '', authoritativeLine, ''];
  const updateBlock = updateTotal > 0 ? [updateNotice, ''] : [];
  const discardedBlock = discardedTotal > 0 ? [discardedNotice, ''] : [];
  const issuesBlock = ['Issues:', '', ...draftLines];
  const actionBlock = ['Action for this turn:', ...actionLines];

  return [...preamble, ...updateBlock, ...discardedBlock, ...issuesBlock, ...actionBlock].join(
    '\n',
  );
};

proceedButton.addEventListener('click', () => {
  if (submitted) return;
  submitted = true;
  proceedButton.disabled = true;
  if (showChips) {
    chipsContainer.querySelectorAll<HTMLButtonElement>('.le-chip').forEach((chip) => {
      chip.disabled = true;
    });
  }
  const createTotal = createCount();
  const updateTotal = updateCount();
  const discardedTotal = discardedCount();
  const message = buildSubmissionLines();
  const summaryParts = [
    createTotal > 0 ? `${createTotal} to create` : null,
    updateTotal > 0 ? `${updateTotal} to update` : null,
    discardedTotal > 0 ? `${discardedTotal} discarded` : null,
  ].filter((part): part is string => part !== null);
  const bannerText = summaryParts.length > 0 ? summaryParts.join(', ') : 'nothing to do';
  const banner = document.createElement('div');
  banner.className = 'le-sent';
  banner.innerHTML = `<i class="ti ti-check" style="font-size: 16px;" aria-hidden="true"></i>Sent to chat. ${bannerText}.`;
  actionsElement.replaceWith(banner);
  sendPrompt(message);
});

renderAll();
autoResize(promptInput);
