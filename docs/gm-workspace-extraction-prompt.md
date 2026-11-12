# GM Workspace — Extraction Prompt (schema 1.0)

## How to use this prompt

1. Start a **new chat** with a capable AI.
2. Attach these files:
   - The PDF chunk (one act or chapter, about 20–40 pages).
   - `gm-workspace-template.json`
   - `gm-workspace-field-reference.md`
   - The carry-over ID list from the app (for chunk 2 and later).
3. Fill in the **Chunk details** block below.
4. Paste everything from "PROMPT START" to "PROMPT END".

---

PROMPT START

You are a data extractor for a tabletop RPG reference app called GM Workspace.
You turn one chunk of a prewritten adventure module into one JSON file.
The app shows this data to a game master during play. It does not use AI.
So the JSON must be correct, complete, and follow the template exactly.

## Chunk details

- Module title: [TITLE]
- Game system: [SYSTEM, for example Shadowdark, Mothership 1e, Delta Green]
- Genre: [GENRE]
- Chunk ID: [for example chunk-a2]
- Chunk title: [for example Act 2: The Motel]
- Act ID for this chunk: [for example a2]
- Printed pages in this chunk: [for example 23-48]
- Carry-over ID list: [paste the list from the app, or write "none" for the first chunk]

## Your files

- `gm-workspace-template.json` is a full example. Copy its structure exactly. Do not copy its content.
- `gm-workspace-field-reference.md` explains every field and every allowed value. Follow it.
- The PDF chunk is the only source of content.

## Core rules

1. **Do not invent.** Every fact must come from the PDF. If the PDF does not give a value, use `null` or `[]`.
2. **Do not add mechanics.** If the book gives no check, `check` is `null`. Do not guess a DC.
3. **Copy word for word** only these fields: `read_aloud`, `stat_line`, `source_quote`. Write everything else as short, plain summaries.
4. **Keep it short.** `summary` is one line. `tier1_sensory` items are a few words each. `result` is one or two sentences.
5. **Use the template's field names and allowed values only.** Do not add new fields. Do not rename fields.
6. **When you are not sure, say so.** Set `needs_review: true` on that item. Do not leave it out.
7. **Output valid JSON only.** No comments. No trailing commas. Use `null`, not empty strings, for missing single values.

## Allowed values

Use these values exactly. Any other value is an error.

- `archetype`: `physical_zone`, `open_hub`, `investigation`, `action_stage`
- item `kind`: `hazard`, `clue`, `loot`, `tech`, `social`, `other`
- connection `type`: `door`, `travel`, `poi`, `clue_lead`, `event`
- connection `state`: `open`, `locked`, `sealed`, `hidden`
- entity `type`: `npc`, `creature`, `vehicle`, `hazard`
- `disposition` and faction `attitude`: `allied`, `neutral`, `suspicious`, `hostile` — never "friendly"; a friendly NPC is `allied`
- truth `importance`: `core`, `optional`

Do not invent values such as "path" or "skill". A hallway or path inside a site is a `door` connection. A journey is `travel`. A skill task is kind `other`. When nothing fits, use the closest listed value and set `needs_review: true`.

## ID rules

- Scenes: `<act id>-s01`, `<act id>-s02`, in book order.
- Scene items: `<scene id>-i1` for tier 2, `<scene id>-h1` for tier 3.
- Connections: `<act id>-x01`, `<act id>-x02`.
- Entities `e-`, truths `t-`, factions `f-`, clocks `k-`, timeline `ev-`, tables `rt-`, trackers `tr-`. Use short, readable names: `e-okafor`, `t-sabotage`.
- NPC clues: `<entity id>-c1`.
- **Carry-over list:** if an entity, truth, faction, clock, table, or tracker is already on that list, use the **same ID**. Do not make a new one. Do not repeat its full record unless this chunk adds new information about it. If it adds new information, repeat the full record with the same ID.

## Page rules

- `page` is the **printed** page number on the page itself.
- Use one rule for every scene: `page` = the printed page where the scene's keyed text starts. Do not use the page of a stat block or an appendix.
- When the book puts a scene's battle or encounter section on a different page than its story text, put the story page in `page` and the other page in the optional `encounter_page` field.
- Every scene's `page` must fall inside its act's `page_start` to `page_end` range. If it does not, the act range or the page is wrong. Fix it.
- Set `meta.page_offset` so that PDF page = printed page + offset. Check this on two different pages.
- If the pages have no printed numbers, use the PDF page number, set `page_offset` to 0, and set `needs_review: true` on the first scene.

## Scene rules

- Make one scene for each keyed location, scene, or encounter in the book.
- Choose `archetype`:
  - `physical_zone`: a room, area, deck, or site that the party explores.
  - `open_hub`: a town, station, district, or sector with places to visit in any order.
  - `investigation`: a crime scene, interview, social event, or research scene.
  - `action_stage`: a chase, battle, timed escape, or set piece.
- `tier1_sensory`: what anyone notices on arrival.
- `tier2_interactive`: things players can see and use. The label is not a spoiler. The check and result can be.
- `tier3_hidden`: traps, ambushes, hidden loot, deep clues, secret doors. Anything that spoils the scene if seen early.
- If an item reveals a key fact, set `truth_id`. An item of any `kind` can carry a `truth_id` — a hazard or a social item can also reveal a truth. Use `kind: "clue"` when revealing information is the item's main point.
- If revealing an item opens a path, set `unlocks_connection_id`. That connection must start as `hidden`, `locked`, or `sealed`.
- `entity_ids`: every entity that is in this scene at the start.
- `entity_counts`: optional. When a shared entity appears in this scene in a different number than its `count` (for example 2 stormtroopers here, 4 elsewhere), add `"entity_counts": {"<entity id>": <number in this scene>}`.
- `escalation`: only when this scene's own text describes things that get worse over rounds, turns, or triggers. Never copy an escalation or any other block from a different scene.
- `default_map_id` is always `null`.

## Connection rules

- Make one connection for every exit, path, travel route, lead, or event that moves the party to another scene.
- Doors and paths are `two_way: true` unless the book says one way.
- Navigation must be complete. Every scene needs at least one connection leading in and at least one leading out. The only exceptions are the first scene of the module and a final scene. When the book implies a route but does not state it (for example, rooms that open off one hallway or common area), add the missing connection — or add the hallway as its own scene — and set `needs_review: true` on it.
- When an item has `unlocks_connection_id`, that connection's `state` must be `hidden`, `locked`, or `sealed`. A connection that starts `open` has nothing to unlock.
- A connection can point to a scene in a later act. Use the act ID and your best guess of the scene number, and set `needs_review: true`.

## Entity rules

- One entity for each named NPC, creature type, vehicle, or major hazard.
- Groups of the same creature: one entity with `count`. `count` must match the number the text states. When different scenes use different numbers, set the most common number here and override per scene with `entity_counts`.
- `stat_line`: copy the stat block as one line. Separate stats with " · ". Copy from this entity's own stat block only — a rider and his vehicle have separate blocks. Do not mix them.
- `tracks`: only HP, wounds, stress, hull, or similar values that change during play.
- `roleplay.secret`: what the NPC hides.
- `clues`: facts the NPC knows that point to a truth.
- `roaming: true` only if the creature or NPC moves between scenes.

## Truths, clocks, timeline, factions, tables

- `truths`: the key facts that the players must or can uncover. Set `core` only when the plot needs it AND this chunk gives the players at least one clue to find it. A background fact that only the GM can know is `optional`.
- Every clue in scenes and NPCs must point to a truth in this file or in the carry-over list.
- `clocks`: countdowns and progress tracks. Make a clock for every stated timer in the book — "12 hours of travel", "the ship arrives in 5 rounds", "arrives within one day". If the book gives a timer without segments, choose a segment count from 4 to 12 and set `needs_review: true`.
- `timeline`: dated or scheduled events.
- `factions`: groups with goals.
- `random_tables`: copy each table entry in short form. Keep the book's dice and ranges.
- `trackers`: only resources the book tells the GM to track (time, light, stress, heat, supplies).

## Before you answer, check your work

Check these items. Fix any problem before you output.

1. Every scene, entity, and table in the PDF chunk is in the JSON.
2. Every `entity_ids`, `truth_id`, `unlocks_connection_id`, `faction_id`, `entity_id`, `from`, and `to` points to a real ID in this file, the carry-over list, or a later act.
3. No ID is used twice.
4. Every `core` truth has at least two clues if the book gives two.
5. Nothing that spoils a scene is in `tier1_sensory`, a tier 2 `label`, or a `summary`.
6. All page numbers use the same rule, each scene's `page` is inside its act's page range, and you tested `page_offset` on two different pages.
7. Every value is on the allowed-values lists. No "friendly", no "path", no "skill".
8. Every scene has a way in and a way out, except the module's first and final scenes.
9. Every connection named in an `unlocks_connection_id` starts as `hidden`, `locked`, or `sealed`.
10. Each `stat_line` and `count` comes from that entity's own stat block and matches the scene text.
11. Every stated timer in the book has a clock.
12. The JSON is valid.

## Output

- If the chunk is complete, output **only** the JSON, in one code block.
- If you run out of space, stop after a complete scene. Close the JSON so that it is valid. Set `meta.complete` to `false` and `meta.stopped_at_page` to the last printed page that you finished. I will ask you to continue from there.
- If the chunk is complete, set `meta.complete` to `true` and `meta.stopped_at_page` to `null`.

PROMPT END
