# GM Workspace — Verify Prompt and Fix Prompt (schema 1.0)

## How to use these prompts

1. Start a **new chat**. Do not use the extraction chat. If possible, use a different AI.
2. Attach these files:
   - The same PDF chunk.
   - The JSON from the extraction chat.
   - `gm-workspace-field-reference.md`
   - The carry-over ID list (for chunk 2 and later).
3. Paste the **Verify Prompt**.
4. Copy the report that it gives you.
5. Go back to the **extraction chat**. Paste the **Fix Prompt** and the report.
6. Load the fixed JSON into the app.
7. Open 5 random page links in the app. Make sure that each one opens the correct page.

---

## Verify Prompt

VERIFY PROMPT START

You are a strict checker for a tabletop RPG reference app called GM Workspace.
Another AI turned the attached PDF chunk into the attached JSON file.
Your job is to find errors. You do **not** fix them. You do **not** rewrite the JSON.

The field reference explains every field and every allowed value.
The PDF is the only source of truth.

## Check these things

Work through the PDF from start to end. Compare each part with the JSON.

1. **Missing:** a scene, NPC, creature, item, exit, clue, table, clock, or event in the PDF that is not in the JSON.
2. **Invented:** content in the JSON that is not in the PDF. This includes a check or DC that the book does not give.
3. **Wrong value:** a wrong page number, check, DC, stat, count, range, or name.
4. **Wrong page offset:** open two scenes. Make sure that printed page + `meta.page_offset` = the PDF page.
5. **Spoiler:** secret content in `tier1_sensory`, a tier 2 `label`, a `summary`, or a `title`.
6. **Wrong tier:** a hidden thing in tier 2, or an obvious thing in tier 3.
7. **Wrong link:** an `entity_ids`, `truth_id`, `unlocks_connection_id`, `faction_id`, `entity_id`, `from`, or `to` that points to the wrong item, or to an ID that does not exist in this file, the carry-over list, or a later act.
8. **Missing link:** a clue with no `truth_id`. An item that opens a path but has no `unlocks_connection_id`. An entity in a scene that is not in `entity_ids`.
9. **Rule break:** a bad ID format, a duplicate ID, a value that is not allowed, a new field, a renamed field, or a carry-over entity with a new ID.
10. **Wrong pointer or wrong numbers:** a `read_aloud` page or `starts_with` that does not match the start of the boxed text in the PDF; a scene with boxed text but `read_aloud` is `null`; a `stat_line` number that does not match the PDF; a `source_quote` that is not in the PDF. Copied read-aloud text in the JSON is also an error: it must be a pointer only.
11. **Incomplete:** `meta.complete` is `false`, or the JSON stops before the end of the chunk.
12. **Not an allowed value:** a value outside these lists — archetype: physical_zone, open_hub, investigation, action_stage · kind: hazard, clue, loot, tech, social, other · connection type: door, travel, poi, clue_lead, event · connection state: open, locked, sealed, hidden · entity type: npc, creature, vehicle, hazard · disposition/attitude: allied, neutral, suspicious, hostile · importance: core, optional. "friendly", "path", and "skill" are errors.
13. **Broken navigation:** a scene with no connection leading in, or no connection leading out. The module's first and final scenes are the only exceptions. Also flag a route that the book describes but the JSON does not have.
14. **Unlock conflict:** an item's `unlocks_connection_id` points to a connection whose `state` is `open`. A connection that starts open has nothing to unlock.
15. **Wrong stat block or count:** a `stat_line` taken from a different entity's block (for example, a rider given his vehicle's stats), or a `count` that does not match the scene text.
16. **Missing clock or copied text:** a stated timer in the book ("12 hours", "in 5 rounds", "within a day") with no clock; or an escalation or text block copied between scenes where the book's text differs.

## Severity

- **CRITICAL:** breaks play or spoils the game. Missing scenes, broken navigation, wrong links, unlock conflicts, values outside the allowed lists, spoilers, wrong page offset, invented content.
- **MINOR:** small value errors, short text problems, style problems.

## Output format

Use exactly this format. Do not add other text.

```
VERIFY REPORT — [chunk_id]
Critical: [number]   Minor: [number]

1. [CRITICAL] [Missing] PDF p.8: Scene "Galley" is not in the JSON.
2. [CRITICAL] [Spoiler] a1-s02 tier1_sensory[1]: Says the cook is the killer.
3. [MINOR] [Wrong value] a1-s03 page: JSON 12, PDF 13.
4. [MINOR] [Wrong link] a1-s04 entity_ids: "e-drone" does not exist. Should be "e-drones".
```

- Each line names the ID and field, or the PDF page for missing content.
- Each line says what is wrong and, if clear, what the correct value is.
- Put CRITICAL items first.
- If you find no errors, write only: `VERIFY REPORT — [chunk_id]: No errors found.`

VERIFY PROMPT END

---

## Fix Prompt

Paste this in the **extraction chat**, followed by the verify report.

FIX PROMPT START

A checker compared your JSON with the PDF. Its report is below.

1. Check each item in the report against the PDF.
2. Fix each item that is correct.
3. If an item in the report is wrong, do not change the JSON for it. List it under "Rejected" with one line that says why.
4. Do not change any ID that the report does not name.
5. Do not change anything else.
6. Output the full corrected JSON in one code block.
7. After the code block, write a short list: "Fixed" (item numbers) and "Rejected" (item numbers with reasons).

REPORT:
[paste the verify report here]

FIX PROMPT END
