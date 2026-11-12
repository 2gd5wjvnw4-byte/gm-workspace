# GM Workspace

GM Workspace is a touch-first heads-up display and quick reference for a game master running a prewritten tabletop RPG module, at the table or solo. It loads module data from JSON files, shows the current scene, and tracks what happens at the table. It works for any genre and any system. It is an installable, offline-first PWA aimed at iPad Safari in landscape, hosted as static files. It is not a virtual tabletop, not an AI app, and has no server or accounts: everything stays on the device.

## Docs

- `docs/PROJECT_BRIEF.md` — source of truth for scope, stack, architecture and rules. Read before every task.
- `docs/DESIGN_SPEC.md` — layout, theme tokens and components, with exact numbers.
- `docs/ui-reference-mockup.html` — the approved visual prototype. Reference only; it does not run on its own.
- `docs/gm-workspace-field-reference.md` — explains every field in the module JSON format (schema 1.0).
- `docs/gm-workspace-extraction-prompt.md` — prompt for turning one act of a real module into JSON with an AI chat.
- `docs/gm-workspace-verify-prompt.md` — prompts for checking and fixing that extracted JSON.
- `samples/silent-relay-a1.json` — sample module chunk that follows the field reference.
- `PHASE_PLAN.md` — the nine build phases and what to test on the iPad after each.
- `AGY_PROMPTS.md` — one build prompt per phase.

Real module JSON goes in `private/` or `campaigns/`, which git ignores. PDFs are never committed.
