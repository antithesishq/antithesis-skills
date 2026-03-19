// Applies a text filter to the finding page's inline log viewer.
//
// IMPORTANT: The inline log viewer's filter input does not respond to
// JavaScript value changes (the framework ignores .value assignment and
// dispatched events). Use agent-browser fill instead:
//
//   agent-browser --cdp $CDP_PORT fill ".sequence_filter__input:visible" "fault:{"
//
// To clear the filter:
//
//   agent-browser --cdp $CDP_PORT fill ".sequence_filter__input:visible" ""
//
// The ":visible" pseudo-selector is required because the page renders
// multiple filter inputs (for each tab panel) but only one is visible.
//
// After applying or clearing a filter, wait ~300ms for the virtual scroll
// to re-render before reading events.
//
// This file is kept as a reference — it documents the correct selector
// and usage pattern, but the filter must be applied via agent-browser fill,
// not via eval.
