/*
 * Hello-world widget interaction.
 *
 * The required pattern:
 *   1. Resolve DOM elements at module top via requireElement(). Missing
 *      selectors throw before any event handler runs.
 *   2. Track state in module-level Maps/Sets keyed by data-id.
 *   3. Update the action bar (count + Apply state) on every change.
 *   4. Build the payload and call sendPrompt() on Apply. Tests stub the
 *      global to assert on the call.
 *
 * Replace:
 *   - Add state per action type (one Map or Set each).
 *   - Add event listeners. Toggle classes for visual state.
 *   - In Apply, serialise state into Claude's payload.
 */

export {};

// Throws on missing markup. Use at module top.
const requireElement = <ElementType extends Element>(selector: string): ElementType => {
  const found = document.querySelector(selector);
  if (!found) throw new Error(`Required element not found: ${selector}`);
  return found as ElementType;
};

const responseInput = requireElement<HTMLTextAreaElement>('.response-input');
const applyButton = requireElement<HTMLButtonElement>('#applyBtn');
const counter = requireElement<HTMLElement>('.count');

// Reflects the count of marked state. Extend to cover every interaction
// type you add.
const updateBar = (): void => {
  const value = responseInput.value.trim();
  if (value.length > 0) {
    counter.textContent = 'Response ready';
    applyButton.disabled = false;
  } else {
    counter.textContent = 'No response yet';
    applyButton.disabled = true;
  }
};

responseInput.addEventListener('input', updateBar);

// Build your real payload here. The hello-world echoes the input. Real
// widgets emit one line per user action plus closing instructions.
applyButton.addEventListener('click', () => {
  const value = responseInput.value.trim();
  if (value.length === 0) return;
  sendPrompt(`Template widget response: ${value}`);
});
