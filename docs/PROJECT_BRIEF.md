# GM Workspace — Project Brief

Read this file before every task. It is the source of truth for scope, stack, and rules.

## What the app is

A touch-first heads-up display and quick reference for a game master running a **prewritten tabletop RPG module** at the table (or solo).
It loads module data from JSON files, shows the current scene, and tracks what happens at the table.

It works for **any genre and any system**: fantasy dungeons, sci-fi derelicts, modern investigations, political intrigue, chases.

## What the app is NOT

- Not a virtual tabletop. No player tokens, no drawing tools, no fog-of-war on map art.
- Not an AI app. No LLM calls, no generators, no PDF text parsing. All module data comes from the JSON.
- Not a server app. No accounts, no cloud sync, no backend. Everything is local on the device.

## Platform

- Installable PWA. Primary target: **iPad Safari, landscape, added to Home Screen** (1180×820 to 1366×1024).
- Must also work in desktop Safari and Chrome on macOS.
- Hosted as static files (GitHub Pages or Cloudflare Pages).
- Works fully offline after first load.

## Stack

- Vite + React + TypeScript (`strict: true`).
- Zustand for app state.
- Dexie (IndexedDB) for storage.
- Zod for tolerant JSON parsing.
- pdfjs-dist for the PDF drawer and the map cropper.
- vite-plugin-pwa for the service worker and manifest.
- Vitest for unit tests.
- No other runtime dependencies without a clear reason stated in the PR/commit message. Write pinch-zoom, dice rolling, and cropping by hand.

## Core architecture

### 1. Base data (read-only)
- A **campaign** holds one or more **chunks**. A chunk is one JSON file that follows `samples/silent-relay-a1.json` and `docs/gm-workspace-field-reference.md`.
- Base data is never edited by the UI. Re-importing a chunk with the same `meta.chunk_id` replaces that chunk's base data.
- Records are merged by `id` across chunks. If two chunks define the same entity/truth/faction/clock/table/tracker `id`, the later import wins and a Review entry is logged.

### 2. Live layer (the table state)
Everything that happens at the table. Stored separately from base data, keyed by IDs. Never deleted by an import.
- `currentSceneId`, `visited{sceneId}`, `revealed{itemId|clueId|eventId|secretId}`
- `connectionState{connectionId: open|locked|sealed|hidden}` (overrides)
- `trackerValues{}`, `clockValues{}`, `timelineDone{}`
- `entityTracks{entityId: number[][]}` (per copy, per track), `entityDisposition{}`, `factionAttitude{}`
- `summoned{sceneId: entityId[]}`, `improvisedEntities[]`
- `notes[{id, targetId, text, createdAt}]` → shown as the amber "Table change" banner on that target
- `looseNotes[]` (notes whose target no longer exists)
- `nodePositions{sceneId:{x,y}}`, `maps[]`, `pins{sceneId:{mapId,xPct,yPct}}`, `sceneMap{sceneId: mapId}`
- `rollLog[]` (last 50), `theme`, `ui` (nav view, map mode, solo mask)

### 3. Storage module
All IndexedDB access lives in **one module** (`src/storage/`) behind a small interface:
`listCampaigns, loadCampaign, saveLive (debounced), importChunk, deleteChunk, putBlob, getBlob, exportBackup, importBackup, requestPersist`.
No other file touches Dexie. This keeps a later native wrapper (Capacitor/Tauri) a one-module change.

### 4. Tolerant import (never break)
The importer refuses a file **only** if it is not valid JSON. Everything else loads:
- Missing field → default value + Review entry.
- Unknown `archetype` → treated as a generic layout. Unknown `kind`/`type`/`state` → `other`/defaults.
- Duplicate ID inside a chunk → keep both, rename second to `<id>-2`, Review entry.
- Link to unknown ID → keep the record, show a "broken link" badge, Review entry.
- Scene with no connection in or out (the module's first and final scenes excepted), or an `unlocks_connection_id` whose target connection starts `open` → loads, Review warning.
- Link to a scene in an act that is not loaded → grey "not loaded" node/exit; works once that act loads.
- Unknown extra fields → ignored but preserved in the stored raw JSON.
- `read_aloud` is normally a pointer `{page, starts_with}`. A plain string (older files) is also accepted and shown as text. Anything else → `null`, Review entry.
- `meta.complete === false` → warning banner on the chunk.
- Live-layer notes pointing at IDs that disappear → moved to `looseNotes`, never deleted.

### 5. Backup
- **Save Backup**: one JSON file `<module_id>_<YYYY-MM-DD>.json` with `{format:"gm-workspace-backup", version:1, exportedAt, campaign, chunks, live, maps (base64)}`. Excludes the PDF.
- Deliver with the Web Share API (`navigator.share({files})`) so iPad shows "Save to Files"; fall back to a download link.
- **Load Backup**: `<input type="file">`. Restores everything. The app asks the user to re-attach the PDF, matched by `module_id`.
- Show "Last backup: X ago" and remind after each session.
- On launch, call `navigator.storage.persist()`. If the app is not running standalone (not from Home Screen), show a warning banner.

## Solo Mask rules

One global toggle. When ON:
- Tier 2 items: label + check visible; result hidden until revealed.
- Tier 3 items: whole item hidden ("Something is hidden here" + check) until revealed.
- NPC `roleplay.secret` and NPC clues: hidden until revealed.
- Truth answers: hidden until any linked clue is revealed.
- Timeline events with `hidden: true`: text hidden until revealed.
- Clocks with `hidden: true`: name shown, segments hidden.
- Scenes not visited and not reachable: hidden from list, node map, and map pins. Reachable but unvisited: shown as `???`.
- Connections with state `hidden` that are not unlocked: shown as `???` and disabled.
When OFF (GM view) everything is visible; the reveal buttons read "Mark found".

Revealing an item with `unlocks_connection_id` opens that connection.

## Archetype labels

| archetype | Tier 1 | Tier 2 | Tier 3 | Exits bar |
|---|---|---|---|---|
| physical_zone | Sensory | Interactive | Hidden Threats & Loot | Exits |
| open_hub | Atmosphere | Points of Interest & Hooks | Secrets | Go To |
| investigation | Surface Observations | Leads & Evidence | Deep Forensics & Secrets | Follow Leads |
| action_stage | The Stage | Tools & Complications | Hidden Threats | Outcomes |
| (unknown) | Details | Interactive | Hidden | Exits |

One scene component. Archetype changes labels only.

## UI rules

- Follow `docs/DESIGN_SPEC.md` exactly for layout, tokens, and components.
- `docs/ui-reference-mockup.html` is the approved visual prototype. It is a design-tool file and does not run on its own. Read its markup for structure and its `THEMES` object for exact colors. Rebuild it as real React components; do not copy its runtime.
- Touch targets ≥ 44×44 px. No hover-only actions. No browser `alert/confirm/prompt`; use in-app modals.
- Modals that take text open anchored to the top of the screen so the iPad keyboard does not cover them.
- Side panels and the center scroll independently. The top bar and the exits bar never scroll.

## Coding rules

- YAGNI. Build only what the current task asks for.
- Small files. One component per file. Pure logic (import, merge, dice, solo-mask rules, reachability) in `src/lib/` with unit tests.
- No `any`. No silent `catch {}`.
- Every task ends with: `npm run build` passes, `npm run test` passes, and a short list of what changed and how to check it on iPad.
