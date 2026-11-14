# GM Workspace — Prompts for Antigravity CLI

Paste one prompt per session, in order. Do not start the next prompt until the current one passes its checks on your iPad.

Every prompt assumes these files are in the repo:
- `docs/PROJECT_BRIEF.md`
- `docs/DESIGN_SPEC.md`
- `docs/gm-workspace-field-reference.md`
- `docs/ui-reference-mockup.html`
- `samples/silent-relay-a1.json`

---

## Prompt 1 — App shell, themes, storage

```
Read docs/PROJECT_BRIEF.md and docs/DESIGN_SPEC.md first. Follow them exactly.

Build the app shell for GM Workspace.

1. Scaffold Vite + React + TypeScript (strict) with Zustand, Dexie, Zod, Vitest, and vite-plugin-pwa. Add npm scripts: dev, build, preview, test. Add a GitHub Actions workflow that builds and deploys to GitHub Pages on push to main (set the Vite base path from the repo name).
2. PWA: manifest (name "GM Workspace", landscape, standalone, dark theme color), icons (simple generated placeholder), offline caching of the app shell and self-hosted fonts (IBM Plex Sans, IBM Plex Mono, Cinzel, Alegreya Sans).
3. Themes: implement the three token sets in DESIGN_SPEC section 1 as CSS custom properties. A theme store with setTheme(). Fonts per section 2.
4. Layout: the five zones from DESIGN_SPEC section 3 as empty, correctly sized components: TopBar (64px), LeftPanel (300px), Center (scene area + fixed ExitsBar), RightPanel (300px), and a Drawer host. Each panel scrolls on its own. Put placeholder text in each zone. Add the Theme section in the right panel with the three theme buttons working.
5. Storage module in src/storage/ with the interface in PROJECT_BRIEF "Storage module". Dexie tables: campaigns, chunks, live, blobs. Implement listCampaigns, loadCampaign, saveLive (debounced 500ms), putBlob, getBlob, requestPersist. Leave importChunk/exportBackup/importBackup as typed stubs that throw "not implemented". No other file may import Dexie.
6. On launch call requestPersist(). If the app is not running standalone (display-mode: standalone / navigator.standalone), show a dismissible amber banner: "Add GM Workspace to your Home Screen so iPad keeps your data."
7. Unit tests for the storage module using fake-indexeddb.

Done when: npm run build and npm run test pass; the deployed page installs to the iPad Home Screen, opens offline, shows the five zones at 1366×1024 and 1180×820, and the theme buttons switch all colors and fonts. Reply with what changed and how I check it on iPad.
```

---

## Prompt 2 — Import, campaigns, Review list

```
Read docs/PROJECT_BRIEF.md, docs/DESIGN_SPEC.md, and docs/gm-workspace-field-reference.md first. Use samples/silent-relay-a1.json as the reference chunk.

Build the module import system.

1. Types: TypeScript types for every section in the field reference (meta, trackers, acts, scenes, scene items, connections, entities, entity clues, truths, clocks, timeline, factions, random_tables).
2. Tolerant parser in src/lib/import/: Zod schemas where every field has a safe default (.catch / .default). Implement every rule in PROJECT_BRIEF "Tolerant import". The parser returns { chunk, review: ReviewEntry[] } and only throws when the text is not valid JSON. ReviewEntry = { severity: "warn" | "info", chunkId, recordId, field, message }.
3. Link checker: after merge, check every reference field (entity_ids, truth_id, unlocks_connection_id, faction_id, entity_id, scene_id, from, to, act_id) across all loaded chunks. Unknown IDs → Review entry + mark the link broken. IDs whose prefix is an act that is not loaded → mark "not loaded", no warning. Also warn when a core truth has fewer than two clues across scenes and entities, when a scene has no connection in or out (skip the module's first and final scenes), and when an item's unlocks_connection_id points to a connection whose state is open.
4. Merge: campaign = all chunks merged by id (later import wins, log a Review info entry). Re-importing the same chunk_id replaces that chunk. Live layer is never touched. Live notes whose target ID no longer exists move to looseNotes.
5. Implement storage importChunk and deleteChunk.
6. UI: a Campaign screen shown when no campaign is open: list campaigns, "New campaign", "Open". Inside a campaign, the act switcher in the top bar opens a sheet with: loaded chunks (title, pages, complete/incomplete badge, import date), "Import JSON" (file picker), "Remove chunk", and "Export carry-over IDs" (copies and downloads a plain text list of all entity, truth, faction, clock, table, and tracker IDs with names).
7. Review button in the top bar with count; opens a Review sheet grouped by chunk; each entry shows severity, record ID, field, and message.
8. Unit tests: the sample chunk imports with zero warnings; a broken copy of the sample (missing fields, duplicate IDs, bad links, unknown archetype, trailing garbage fields) imports without throwing and produces the expected Review entries; invalid JSON throws; re-import replaces; carry-over list output.

Done when: build and tests pass; on iPad I can create a campaign, import the sample JSON from Files, see it in the chunk list, import a broken file and see Review entries, and export the carry-over list. Reply with what changed and how I check it.
```

---

## Prompt 3 — Scene stage, scene list, exits, Solo Mask

```
Read docs/PROJECT_BRIEF.md and docs/DESIGN_SPEC.md first. Open docs/ui-reference-mockup.html and match its center zone and scene list visually.

Build the scene view and navigation.

1. Center scene stage per DESIGN_SPEC "Center": header with code, archetype chip, Needs review chip, title, tags, Book page button (no action in this task); Table change banner from live notes; read-aloud card per DESIGN_SPEC (pointer line with page and first words, plus an Open in PDF button with no action in this task; plain-text fallback); Tier 1 list; Tier 2 cards; Tier 3 cards; escalation; GM tip. One component for all archetypes; labels from the archetype table in PROJECT_BRIEF.
2. Exits bar: all connections from the current scene plus two_way connections into it. States and styles per DESIGN_SPEC. Tapping an open exit moves to that scene and marks it visited. Not-loaded targets are disabled.
3. Live layer: currentSceneId, visited, revealed, connectionState. Reveal / Mark found buttons on items toggle revealed. Revealing an item with unlocks_connection_id opens that connection. Persist with saveLive.
4. Solo Mask toggle in the top bar implementing every rule in PROJECT_BRIEF "Solo Mask rules" that applies to scenes, items, exits, and the scene list. Put the rules in src/lib/solo.ts as pure functions with unit tests (reachability, masking).
5. Left panel Scene List tab per DESIGN_SPEC: grouped by act then scene.group, status chips, current row highlight, not-loaded rows for linked scenes in unloaded acts.
6. Add note / override: a top-anchored modal with a text field and a target (defaults to the current scene). Saved notes show in the Table change banner; tap a note to edit or delete. Also allow setting a connection's state (open / locked / sealed / hidden) from the modal.

Done when: build and tests pass; on iPad with the sample loaded I can walk 1 → 2 → 3, reveal the terminal, see the hidden exit to scene 4 open, add a table note that shows as the amber banner, and toggle Solo Mask to see masking exactly as the rules say. Reply with what changed and how I check it.
```

---

## Prompt 4 — Entities, trackers, search

```
Read docs/PROJECT_BRIEF.md and docs/DESIGN_SPEC.md first. Match docs/ui-reference-mockup.html for the entity dock and top bar.

Build entities, trackers, and search.

1. In This Scene dock (left panel): entities from scene.entity_ids plus summoned ones. Card per DESIGN_SPEC with one row of −/+ per track per copy (the scene's entity_counts override when present, else count). Values in live entityTracks, default = track max.
2. Roaming list: entities with roaming: true that are not in the scene; Summon adds them to summoned for the current scene; a small remove control on summoned cards.
3. Entity inspector drawer (420px) per DESIGN_SPEC: stat_line, voice, goal, secret (Solo-masked), clues with Reveal/Mark found (feed revealed). Disposition chip taps to cycle allied/neutral/suspicious/hostile, saved to entityDisposition.
4. Improvised NPC: in the Add note / override modal, add "New NPC" with name, summary, disposition, one optional track (label + max). Saved to improvisedEntities and placed in the current scene. Show an "Improvised" chip.
5. Top bar tracker steppers from trackers whose scope is global or the current act. Values in trackerValues, clamped to min/max.
6. Global search: as the user types, search scene codes/titles/summaries, entity names, item labels, truth titles, faction names, table names. Results grouped by type in a dropdown. Tapping a scene jumps to it; an entity opens the inspector; an item jumps to its scene and scrolls to it. In Solo Mask, search does not return masked text.

Done when: build and tests pass; on iPad I can damage each of the 3 drones separately, summon the Vent Thing into scene 3, open Okafor's inspector and reveal his clue, change his disposition, add an improvised NPC, use the trackers, and find "Okafor" and "terminal" with search. Reply with what changed and how I check it.
```

---

## Prompt 5 — World panel: clocks, timeline, clues, factions, tables

```
Read docs/PROJECT_BRIEF.md and docs/DESIGN_SPEC.md first. Match docs/ui-reference-mockup.html for the right panel.

Build the right panel sections in this order, each collapsible: Clocks, Timeline, Clue Matrix, Factions, Random Tables, Scratchpad, Theme.

1. Clocks: ring per DESIGN_SPEC with the correct number of segments; tap = advance, Rewind = back; values in clockValues; when full, show when_full in a gold banner on the card. Scope filter (global + current act). Hidden clocks masked in Solo.
2. Timeline: sorted by order; Mark done / Reveal; highlight events whose day ≤ the value of a tracker labeled "Day" (case-insensitive); tap scene_id to jump.
3. Clue Matrix: per truth, collect clues from every scene item that has a truth_id (any kind) and every entity clue; show found state from revealed; status chip; answer masked in Solo until a clue is found; "1 clue only" warning for core truths with < 2 clues; tap a clue to jump to its scene or open its entity.
4. Factions: name, attitude chip (tap to cycle, saved to factionAttitude), summary, goal, secret (Solo-masked).
5. Random Tables: dice parser in src/lib/dice.ts supporting NdM, NdM+K, NdM-K, d100/1d100, d66 (two dice read as tens/ones), and ranges like "1", "1-2", "01-05", "00" (= 100), "66". Roll button shows result and matching entry; entries with entity_id get "Add to scene". If dice or ranges cannot be parsed, show the table as a plain list with no Roll button. Roll log (last 50) in the live layer; show last 10. Full unit tests for the dice parser.
6. Scratchpad: Add note / override button (opens the existing modal), Loose Notes (n) list with delete, and a "Last backup" line that reads "Never" when no backup time is stored.

Done when: build and tests pass; on iPad all sections work with the sample; the clue matrix updates when I reveal the terminal and Okafor's clue; rolling the Relay table gives the right entries over many rolls; the Day tracker at 3 highlights the rescue ship event. Reply with what changed and how I check it.
```

---

## Prompt 6 — Node map

```
Read docs/PROJECT_BRIEF.md and docs/DESIGN_SPEC.md (sections 3 "Node Map" and 5 "Gestures"). Match docs/ui-reference-mockup.html.

Build the Node Map tab in the left panel.

1. Nodes for every scene in the current act, plus grey not-loaded nodes for linked scenes in unloaded acts. Edges for every connection; styles per DESIGN_SPEC.
2. Default layout when nodePositions has no entry: layered by BFS depth from the act's first scene, up to 3 per row, then saved positions override.
3. Gestures exactly as DESIGN_SPEC section 5, written by hand with Pointer Events (no gesture library): one-finger pan, two-finger pinch zoom around the midpoint, 40%–300%, drag never triggers a tap, + / − / FIT buttons, desktop trackpad pinch and scroll pan.
4. Edit mode toggle ("Arrange"): long-press a node 500ms then drag to move it; positions saved to nodePositions; "Reset layout" button.
5. Solo Mask rules for nodes and edges per PROJECT_BRIEF.
6. Tapping a node goes to that scene.
7. Put the gesture math in src/lib/panzoom.ts with unit tests (zoom around a point, clamping). Keep it independent of the node map so any zoomable view can use it.
8. Add an "Expand" button that shows the node map over the center zone at full size, with the same controls, and a Close button.

Done when: build and tests pass; on iPad pinch, pan, tap, arrange, and expand all work smoothly with the sample; a test chunk with 30 scenes stays usable. Reply with what changed and how I check it.
```

---

## Prompt 7 — PDF drawer and backup

```
Read docs/PROJECT_BRIEF.md ("Backup") and docs/DESIGN_SPEC.md ("Drawers").

Build the PDF drawer and backup/restore.

1. Attach PDF: in the act switcher sheet, "Attach PDF" stores the file as a blob keyed by meta.module_id. Show the attached file name and size.
2. PDF drawer (480px) with pdfjs-dist: opens at printed page + meta.page_offset for the current scene (PDF button and Book p.N button). Prev/next page, "Go to page…" (printed page numbers), pinch zoom on the page canvas using src/lib/panzoom.ts. Render only the visible page. If no PDF is attached, the drawer shows "Attach the PDF for this module" with the attach button.
3. The read-aloud card's Open in PDF button opens the drawer at read_aloud.page. Entity inspector and other records with a page field get a small "p.N" button that opens the drawer at that page. Scenes with encounter_page get a second button for that page.
4. Backup: implement exportBackup / importBackup in the storage module with the format in PROJECT_BRIEF. "Save Backup" uses navigator.share({ files }) when available, else a download. Record lastBackupAt. "Load Backup" in the Campaign screen uses a file picker, validates format/version, and restores as a new campaign or replaces the open one (ask with an in-app modal). After restore, prompt to re-attach the PDF if missing.
5. Reminders: show "Last backup: X ago" in the Scratchpad; when the app goes to background (visibilitychange hidden) after changes since the last backup, show a gentle reminder banner on next open.
6. Round-trip unit test: export then import gives an identical campaign and live layer.

Done when: build and tests pass; on iPad the PDF opens at the right page for each scene; Save Backup shows the iPad share sheet with Save to Files; I can delete the campaign, Load Backup from Files, and get everything back. Reply with what changed and how I check it.
```

---

## Prompt 8 — Maps: upload, crop, pins, map modes

```
Read docs/PROJECT_BRIEF.md and docs/DESIGN_SPEC.md ("Map area", "Gestures").

Build map images.

1. Map library (sheet from the Map control long-press or a "Maps" button in the act sheet): upload .png/.jpg/.webp; title; scale tag (Tactical, District, Regional, Relationship); delete; set as the default map for selected scenes (sceneMap). Images stored as blobs; included in backups.
2. PDF cropper: in the PDF drawer, "Crop map from this page" enters crop mode: drag a rectangle (resize handles, 44px touch areas) over the page; "Save crop" renders that region at 2× device pixel ratio from pdf.js to a PNG blob and adds it to the map library with a title prompt. Manual only.
3. Map modes from the top bar (Text, PiP, Split, Map) per DESIGN_SPEC. The shown map is sceneMap[currentScene] or the last used map.
4. Pins: "Edit pins" mode lists unpinned scenes; tap a scene then tap the map to place it; drag to move; stored as xPct/yPct in pins. Pin styles and Solo rules per DESIGN_SPEC/PROJECT_BRIEF. Tapping a pin goes to the scene. Moving to a scene pans the map to its pin.
5. Pan/zoom with src/lib/panzoom.ts, same controls as the node map.
6. Pin badge: amber dot when the scene has table notes.

Done when: build and tests pass; on iPad I can crop a map from the PDF, place 4 pins, use all four map modes, pinch/pan the map, and the map follows me between scenes; backup and restore keep the maps and pins. Reply with what changed and how I check it.
```

---

## Prompt 9 — iPad polish pass

```
Read docs/PROJECT_BRIEF.md and docs/DESIGN_SPEC.md.

Do a polish and hardening pass. No new features.

1. Responsive: below 1200px wide, the right panel becomes a 56px icon rail that opens the panel as an overlay; check 1180×820, 1366×1024, and portrait 820×1180 (left panel becomes a slide-over).
2. Keyboard safety: every text modal anchored to the top; nothing important hidden by the iPad keyboard.
3. prefers-reduced-motion: remove the pulse, keep the 2px ring; drawers appear without sliding.
4. Contrast check of every text/background pair in all three themes (≥ 4.5:1); fix any failures in the tokens and update docs/DESIGN_SPEC.md.
5. Performance: a generated test campaign with 6 chunks, 150 scenes, 200 entities stays smooth (scene change < 100ms). Memoize where needed.
6. Default theme from meta.genre per DESIGN_SPEC.
7. Error boundary around each zone: a bug in one zone shows a small error card, never a blank app.
8. Write docs/USER_GUIDE.md: install to Home Screen, import a chunk, Solo Mask, notes, backup/restore, maps, the AI extraction workflow (point to the prompt files).

Done when: build and tests pass, and a full play-through of the sample on iPad has no layout or gesture issues. Reply with what changed and anything I must test by hand.
```
