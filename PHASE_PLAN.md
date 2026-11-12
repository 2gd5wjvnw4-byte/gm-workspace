# GM Workspace — Phase Plan

## Before you start

1. Make a new folder and a new GitHub repository, for example `gm-workspace`.
2. Unzip `gm-workspace-agy-kit.zip` into that folder. You get `docs/`, `samples/`, `AGY_PROMPTS.md`, and this file.
3. Open Antigravity CLI in that folder.
4. Use one prompt from `AGY_PROMPTS.md` for each session, in order.
5. After each prompt, test on the iPad. Do not continue until the test passes.

## The phases

| # | Build | You can test this on the iPad |
|---|---|---|
| 1 | App shell, themes, storage | The app installs to the Home Screen and opens offline. The 5 zones show. Themes change. |
| 2 | JSON import, campaigns, Review list | You import the sample JSON. A broken JSON loads and shows Review items. You export the carry-over IDs. |
| 3 | Scene stage, scene list, exits, Solo Mask | You walk from scene 1 to 3. You reveal a clue, and a hidden exit opens. Solo Mask hides the correct items. |
| 4 | Entities, trackers, search | You track the HP of each drone. You summon a roaming creature. You open an NPC card. Search finds names. |
| 5 | Clocks, timeline, clues, factions, random tables | The clue matrix updates. The dice roll gives correct results. The Day tracker highlights events. |
| 6 | Node map with pinch and zoom | You pinch, pan, tap, and arrange the nodes. A large module stays usable. |
| 7 | PDF drawer and backup | The PDF opens at the correct page. You save a backup to Files and restore it. |
| 8 | Map images, cropper, pins | You crop a map from the PDF, add pins, and use all 4 map views. |
| 9 | iPad polish | A full play session has no layout or touch problems. |

You can play a real session after phase 5. Phases 6 to 9 add the maps, the PDF, and the backup.

**Important:** phase 7 adds the backup. Until then, do not keep table notes that you cannot lose.

## Rules for each session

- Give AGY one prompt only.
- If AGY asks a question, answer it. If AGY wants to add a feature that is not in the prompt, say no.
- If a test fails, tell AGY what you saw on the iPad. Do not start the next prompt.
- Commit to GitHub after each phase passes.

## Test the data pipeline in parallel

You can do this at any time, also before phase 1:
1. Run the extraction prompt on one real act.
2. Run the verify prompt and the fix prompt.
3. Keep the JSON. In phase 2, import it into the app.

If the real JSON shows a problem with the template, fix the template first. Then update `docs/gm-workspace-field-reference.md` and `samples/` in the repo.
