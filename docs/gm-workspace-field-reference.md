# GM Workspace — JSON Field Reference (schema 1.0)

This file explains every field in `gm-workspace-template.json`.
The extraction prompt and the app both follow these rules.

## General rules

- One JSON file = one **chunk** of a module (usually one act or chapter).
- A campaign holds many chunks. A new chunk **adds** data. It never deletes the live table state.
- **IDs never change.** The live layer saves everything by ID.
- Scene, item, and connection IDs start with the act: `a1-s03`, `a1-s03-i1`, `a1-x07`.
- Entity, truth, faction, clock, and table IDs use a type prefix: `e-`, `t-`, `f-`, `k-`, `rt-`, `ev-`, `tr-`.
- An NPC who appears again in a later chunk **keeps the same ID**. Give the AI the carry-over ID list that the app exports.
- `page` = the **printed** page number. The app adds `meta.page_offset` to open the PDF.
- `scope` = `global` or an act ID (`a1`). It controls where the app shows the item.
- Use `null` for an empty single value. Use `[]` for an empty list.
- `needs_review: true` = the AI is not sure. The app lists these items for you.
- `source_quote` = about 10 words copied from the PDF, so the verifier can find the item.

## Tolerance (the app never breaks)

- Link to an unknown ID → item kept, "broken link" badge, added to the Review list.
- A scene with no way in or out, or an unlocking item whose target connection starts `open` → loaded as-is, Review warning.
- Link to a scene in an act that is not loaded → grey "not loaded" node. It works when that act loads.
- Missing field → default value, added to the Review list.
- Unknown `archetype` or `kind` → general layout or `other`.
- Duplicate ID → both kept, `-2` added to the second, added to the Review list.
- Your notes on a changed or removed scene → moved to the Loose Notes list. Never deleted.
- Dice or range the app cannot read → the table shows as a list only.
- The app refuses a file only when it is not valid JSON.

## meta

| Field | Meaning |
|---|---|
| `module_id` | Same in every chunk of one module. |
| `title`, `system`, `genre` | Display only. |
| `check_format` | How checks are written in this system. Guides the AI. |
| `page_offset` | PDF page = printed page + this number. |
| `chunk_id`, `chunk_title`, `chunk_pages` | Which part of the book this file covers. |
| `complete` | `false` if the AI ran out of space. The app shows a warning. |
| `stopped_at_page` | Last printed page finished when `complete` is `false`. Else `null`. |

## trackers (top-bar steppers)

`id`, `label`, `min`, `max`, `start`, `scope`.
A tracker with label `Day` drives the timeline highlight.

## acts

`id`, `title`, `page_start`, `page_end`, `summary`.

## scenes

| Field | Meaning |
|---|---|
| `id`, `code`, `title`, `act_id` | Identity. `code` is the book's own code. |
| `archetype` | `physical_zone`, `open_hub`, `investigation`, `action_stage`. Changes block labels only. |
| `group` | Group name in the scene list (deck, district, floor). |
| `page` | Printed page where the scene's keyed text starts. |
| `encounter_page` | Optional. Printed page of the scene's separate battle or encounter section, when the book splits it from the story text. |
| `summary` | One line. Used by the node map and search. |
| `tags` | Short badges ("Vacuum", "Dim Light"). |
| `read_aloud` | Full boxed text, word for word. `null` if none. |
| `tier1_sensory` | List of short strings. What players notice first. |
| `tier2_interactive` | Items players can see. Check and result hidden in Solo Mode. |
| `tier3_hidden` | Items fully hidden in Solo Mode. |
| `entity_ids` | Entities present in this scene. |
| `entity_counts` | Optional. Per-scene override of an entity's `count`: `{"e-stormtrooper": 2}`. |
| `gm_tips` | Book advice to the GM. |
| `escalation` | List of `{ "at", "text" }`. Optional for any scene type. |
| `default_map_id` | Always `null` from the AI. You set maps in the app. |

### Scene items (tier 2 and tier 3)

| Field | Meaning |
|---|---|
| `id` | `<scene id>-i1` (tier 2) or `<scene id>-h1` (tier 3). |
| `label` | The visible hook. |
| `check` | The check as text, or `null`. |
| `result` | What happens or what they learn. |
| `kind` | `hazard`, `clue`, `loot`, `tech`, `social`, `other`. Sets the color. |
| `truth_id` | The truth this item reveals. Allowed on any `kind` — the clue matrix counts every item that has one. |
| `unlocks_connection_id` | Revealing this item opens that connection. |

Clues and secrets live **inside** scenes and entities. There is no separate clue list.

## connections

| Field | Meaning |
|---|---|
| `from`, `to` | Scene IDs. `to` can point to a later act. |
| `type` | `door`, `travel`, `poi`, `clue_lead`, `event`. Sets the button and line style. |
| `label` | Button text. |
| `two_way` | `true` = one record for both directions. |
| `state` | Start state: `open`, `locked`, `sealed`, `hidden`. |
| `requires` | Free text. Shown only, not checked. |

A connection named in an item's `unlocks_connection_id` must start `locked`, `sealed`, or `hidden` — never `open`.

## entities

| Field | Meaning |
|---|---|
| `type` | `npc`, `creature`, `vehicle`, `hazard`. |
| `summary` | One line. |
| `count` | Number in the group. The app shows one set of tracks for each. |
| `stat_line` | Stat block copied word for word. Display only. |
| `tracks` | `{ "label", "max" }` boxes with − / + (HP, stress, hull). |
| `roleplay` | `voice`, `goal`, `secret`. `secret` is hidden in Solo Mode. |
| `clues` | List of `{ id, text, check, truth_id, hidden }`. What this NPC knows. |
| `disposition` | `allied`, `neutral`, `suspicious`, `hostile`. |
| `faction_id` | Faction ID or `null`. |
| `roaming` | `true` = shown on the Roaming tab. |

The scene lists its entities. The entity does not list its scenes.

## truths

`id`, `title` (the question), `text` (the answer, hidden in Solo Mode), `importance` (`core` or `optional`), `scope`, `page`.
The clue matrix collects every scene item and NPC clue with a matching `truth_id`.
A `core` truth with only one clue gets a soft warning.

## clocks

`id`, `name`, `segments` (4–12), `start`, `when_full`, `hidden`, `scope`.

## timeline

`id`, `when` (free text), `day` (number or `null`), `order` (sort number), `text`, `trigger`, `hidden`, `scene_id`, `scope`.

## factions

`id`, `name`, `summary`, `goal`, `attitude` (`allied`, `neutral`, `suspicious`, `hostile`), `secret`, `scope`, `page`.

## random_tables

`id`, `name`, `dice` (`1d6`, `2d6`, `1d100`), `entries` (`range` like `"1-2"` or `"6"`, `text`, `entity_id`), `scope`, `page`.
An entry with `entity_id` gets a button that adds that entity to the current scene.

## Not in the JSON

- Maps. You add them in the app (upload or PDF cropper).
- Node map positions, reveals, notes, tracker values, roll log. These are live layer data.
