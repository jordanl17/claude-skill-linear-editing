# Manual trigger walkthrough

<!--
PLACEHOLDER: a list of prompts you type into a fresh Claude Code session
in an unrelated directory to verify the skill activates (or correctly
skips) for each one.

Why this exists: the eval suite (Surface 3) grades the widget OUTPUT but
cannot tell you whether the skill DECISION (to activate or not) is correct
in conversational context. This file is a 5-minute manual sanity check
after editing the SKILL.md description.

For each case below:
1. Open a fresh CC session in a directory that does NOT contain this repo
2. Type the prompt verbatim
3. Observe: did CC read SKILL.md? Did it attempt to render the widget?
   Was that the right call?

Aim for 6-10 cases organised as:
- A few should-fire cases (different phrasings of the trigger intent)
- A few should-skip cases (cases that should NOT activate)
- 1-2 ambiguous cases (test boundary behaviour - document the expected
  result so the test is unambiguous)
-->

## Should fire

<!-- PLACEHOLDER: prompts that should trigger the skill. Format:

### Case 1: <short description>

Prompt:
> <verbatim prompt to paste>

Expected: skill activates, widget renders with <expected structure>.
-->

## Should skip

<!-- PLACEHOLDER: prompts that should NOT trigger the skill. -->

## Ambiguous boundary

<!-- PLACEHOLDER: prompts on the boundary. Document the expected
behaviour so the test result is unambiguous. -->
