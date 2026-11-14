# GM Workspace — Design Spec

This spec describes the approved mockup (`docs/ui-reference-mockup.html`). Build to these numbers.

## 1. Theme tokens

Implement as CSS custom properties on the app root. Switch themes by swapping the property set. Store the choice in the live layer. Default theme comes from `meta.genre` (contains "fantasy" → Fantasy Light; otherwise Sci-Fi Dark); the user can override.

| Token | Sci-Fi Dark | Fantasy Light | Fantasy Dark | Use |
|---|---|---|---|---|
| `--bg` | #0D1117 | #EFE6D4 | #15120E | App background, inputs |
| `--panel` | #151B23 | #FAF5EA | #1E1A15 | Top bar, side panels, cards |
| `--p2` | #1C232D | #F2E9D8 | #27221B | Raised cards, stepper groups |
| `--p3` | #262F3B | #E6D9C0 | #332C23 | Small buttons (−, +, Close) |
| `--line` | #2A3340 | #D8C8A8 | #3A3228 | Borders |
| `--line2` | #3A4553 | #BFA982 | #4E4436 | Strong/dashed borders, map rooms |
| `--text` | #E6EDF3 | #2B2118 | #EFE6D4 | Body text |
| `--muted` | #9AA7B4 | #6A5843 | #B3A48C | Labels, secondary text |
| `--faint` | #6B7785 | #9A8A72 | #7D705D | Disabled / not loaded |
| `--accent` | #56D4E8 | #9A4416 | #E39A5B | Current location, active tab, open exits |
| `--accentBg` | #10262B | #F5E0D0 | #3A2516 | Fill behind accent items |
| `--onAccent` | #0D1117 | #FFFFFF | #15120E | Text on solid accent |
| `--gold` | #F2B33D | #835C00 | #E2B754 | Clocks, Review, notes, loot |
| `--goldBg` | #2A2213 | #F7EACB | #2E2414 | |
| `--goldLine` | #6B5320 | #C9A55A | #6E5526 | |
| `--deltaBg` | #3A2A0B | #F6E2B5 | #3B2B10 | "Table change" banner fill |
| `--deltaText` | #FBE3B0 | #4A3510 | #F6E2B5 | "Table change" banner text |
| `--red` | #F47C7C | #A12F2F | #EB8A7E | Hazards, hostile, escalation |
| `--redBg` | #2A1717 | #F6DEDA | #331B18 | |
| `--redLine` | #5A2E2E | #D9A39B | #6A342D | |
| `--escBg` | #1F1416 | #F8E6E2 | #2A1915 | Escalation rows |
| `--teal` | #45C9A9 | #2C6A4D | #7CC79E | Clues, found, allied, backup |
| `--tealBg` | #12251F | #DFEDE2 | #17291F | |
| `--tealLine` | #2D5A50 | #9CC4AA | #33573F | |
| `--blue` | #79B8FF | #2A5B8A | #8FB8E6 | Check text, tech items |
| `--violet` | #C8B2FF | #69498F | #C9B0E8 | Archetype chip, social, Solo Mask on, unvisited |
| `--violetBg` | #2A2240 | #ECE3F4 | #2B2238 | |
| `--violetLine` | #4B3F6B | #BFA9D6 | #54456B | |
| `--readText` | #D5DEE7 | #3B2F22 | #E2D7C2 | Read-aloud and results |
| `--mapBg` | #10161D | #F3EAD6 | #1A1612 | Map and node map canvas |
| `--grid` | #1A222C | #E4D6BA | #262019 | Map grid lines (24px) |
| `--edge` | #3E5566 | #A88F68 | #6E5E48 | Open node-map edges, visited node border |
| `--stripe` | #19202A | #F0E6D2 | #231E18 | Masked-card stripe |
| `--tagBg` | #E6EDF3 | #3B2F22 | #EFE6D4 | Scene tag pills (inverted) |
| `--tagText` | #0D1117 | #FAF5EA | #15120E | |

Kind colors: hazard `--red`, clue `--teal`, loot `--gold`, tech `--blue`, social `--violet`, other `--muted`.
Disposition colors: allied `--teal`, neutral `--muted`, suspicious `--gold`, hostile `--red`.

## 2. Typography

| Role | Sci-Fi | Fantasy (both) |
|---|---|---|
| Body `--body` | IBM Plex Sans 400/500/600/700 | Alegreya Sans 400/500/700 |
| Headings `--head` | IBM Plex Sans 700 | Cinzel 600/700 |
| Labels/codes `--mono` | IBM Plex Mono 400/600 | Alegreya Sans 500/700 |

Self-host the fonts (offline PWA). Sizes: body 14, scene title 30/700, read-aloud line 16 italic line-height 1.55, tier items 15, section labels 11–12 uppercase with letter-spacing .1em in `--mono`, chips 11/700 uppercase.

## 3. Layout (iPad landscape)

```
┌──────────────────────────── Top bar 64px ─────────────────────────────┐
├──────────┬────────────────────────────────────────────┬───────────────┤
│ Left     │ Center                                     │ Right         │
│ 300px    │ flex                                       │ 300px         │
│ scrolls  │ [map area: off | PiP | split 360px | full] │ scrolls       │
│          │ scene stage (scrolls)                      │               │
│          ├────────────────────────────────────────────┤               │
│          │ Exits bar (fixed, wraps)                   │               │
└──────────┴────────────────────────────────────────────┴───────────────┘
Drawers slide over from the right edge, under the top bar: PDF 480px, Entity 420px.
```

On widths < 1200px the right panel collapses to a 56px rail with icons that open it as an overlay.

### Top bar (left → right, gap 10, padding 0 14)
1. Brand block: "GM WORKSPACE" (11px mono, muted) over campaign/act switcher button (head font 15/700, "▾").
2. Tracker steppers from `trackers` (scoped to `global` + current act): group with `--p2` fill, `[−] label/value [+]`, buttons 44×44 `--p3`, value 18px mono.
3. Search field: flex 1, 44px, `--bg` fill, search icon. Results drop down under it, grouped by type, tap to jump.
4. Review button (gold) with count. Hidden when count is 0.
5. Map mode segmented control: Text / PiP / Split / Map. Active = solid `--accent` with `--onAccent` text.
6. Solo Mask toggle: eye icon + "GM"/"Solo". Solo ON = violet styling.
7. PDF button: book icon + "PDF".

### Left panel
- Tabs: Scene List | Node Map (44px, active = accent border/fill).
- **Scene List**: group headers (11px mono uppercase) from `scene.group`, acts as top-level groups. Row ≥44px: `#code` (mono, 44px column), title, status chip (Here = accent, Visited = muted, New = violet, Not loaded = faint dashed row). Current row: `--accentBg` fill + accent border.
- **Node Map**: canvas 440px tall, `--mapBg`, rounded 12. Nodes 116×48, radius 10: code line (11px mono muted) + title (12/600). Current: 2px accent border, `--accentBg`, pulse animation. Visited: `--edge` border, `--p2`. Unvisited: 1px dashed `--line2`. Not-loaded: dashed, `--faint` text. Edges: 2px lines, solid `--edge` when open, dashed `--line2` when hidden/locked/not loaded. Zoom buttons (+, −, FIT) stacked top-right, 44×44. Caption bottom-left: "Pinch to zoom · drag to move · 100%".
- **In This Scene** dock: entity cards (`--p2`, radius 12, padding 10): name (tap → inspector) + disposition chip, summary (12px muted), one row per track per copy (the scene's `entity_counts` override when present, else `count`): label, [−] value/max [+].
- **Roaming**: dashed cards with red "Summon" button.

### Center
- Scene header: `scene id · #code` (13 mono accent) + archetype chip (violet) + "Needs review" chip (gold, when flagged) / title 30px head font / tag pills (`--tagBg`). "Book p.N" button on the right.
- **Table change banner** (live notes on this scene): `--deltaBg`, 1px `--gold` border, label "TABLE CHANGE" in gold mono. Always above the read-aloud.
- **Read-aloud**: card with header "READ-ALOUD". For a pointer: one line "p.N — starts: “<starts_with>…”" (italic, `--readText`) and a 44px "Open in PDF" button that opens the PDF drawer at that page. For an old plain-text value: the text, foldable ("Tap to fold"). Hidden when `read_aloud` is null.
- **Tier 1**: section label "TIER 1 · <label>" + bullet list 15px.
- **Tier 2 cards** (`--panel`, 1px `--line`, radius 12, padding 12/14): row [kind chip][label 15/600][action button] / "Check: …" (13 mono `--blue`) / result (14 `--readText`) or "Result hidden. Roll, then tap Reveal."
- **Tier 3 cards**: same; when masked use stripes `repeating-linear-gradient(135deg, --panel 0 10px, --stripe 10px 20px)` + dashed `--line2` border, chip "Hidden", title "Something is hidden here".
- Action button: 44px tall; unrevealed = `--p3`; revealed = teal outline/fill. Label: GM "Mark found"/"Found", Solo "Reveal"/"Revealed".
- **Escalation**: rows on `--escBg` with `--redLine` border; "Round N" in red mono 64px column.
- **GM tip**: dashed card, muted text.
- **Exits bar** (fixed bottom, `--panel`, top border): label from archetype, then buttons 48px: [TYPE in 11px mono][label][state 11px]. Open = accent outline on `--accentBg`. Sealed/locked = gold, disabled. Hidden = muted, `???` in Solo. Not loaded = muted, disabled.

### Map area (center)
- Modes: PiP = floating 320×220 bottom-right of center (above exits bar), radius 12, shadow; Split = 360px band above scene; Map = fills center (scene hidden, exits bar stays).
- Map image with pins: 44px circles at `xPct/yPct`. Current = solid accent + pulse; visited = `--p3` with `--edge` border; known-unvisited = violet border, "?" in Solo.
- Same zoom controls and gestures as the node map.

### Right panel (sections, each collapsible, order below)
1. **Clocks**: card with ring button 84px (tap = +1 segment), conic fill in `--gold`, empty `--line2`, segment gaps every 360/segments deg; inner 58px circle with "n/N"; name, `when_full` text, "Rewind" button.
2. **Timeline**: cards sorted by `order`; event with `day` ≤ current Day tracker gets `--deltaBg` + gold border; "Mark done"/"Reveal".
3. **Clue Matrix**: per truth card: question (14/600) + status chip (Found n/m teal, Core·open gold, Optional muted), answer text, clue rows with 8px dot (teal found / `--line2` not), source label, "Found/Not yet". Core truth with < 2 clues shows a small gold "1 clue only" warning.
4. **Factions**: name, attitude chip (tap to cycle, saved to live layer), goal, secret (Solo mask).
5. **Random Tables**: table name + dice + "Roll" button (48px). Result card shows the roll and the entry; entries with `entity_id` show "Add to scene". Roll log (last 10) collapsible.
6. **Scratchpad**: "Add note / override" (gold, 48px), "Loose Notes (n)", "Last backup: …" + "Save Backup" (teal).
7. **Theme**: three 44px buttons with a 28×20 swatch (bg | accent | gold).

### Drawers
- PDF drawer 480px: header "Source PDF · printed p.N (PDF p.M)" + Close; pdf.js page canvas; footer "Crop map from this page" (teal) + "Go to page…".
- Entity inspector 420px: name (head font) + disposition chip + Close; type · book page; stat line in mono box on `--bg`; VOICE / GOAL / SECRET labels; clue cards (`--tealBg`), each with check text, clue text, and Reveal/Mark found.

## 4. Motion
- Current-location pulse: `box-shadow 0 0 0 0 var(--accent)` → `0 0 0 12px transparent`, 2s infinite. Respect `prefers-reduced-motion` (no pulse; keep the 2px ring).
- Drawers slide 200ms ease-out. No other animation.

## 5. Gestures (node map and map image)
- Pointer Events on the canvas container with `touch-action: none`.
- One pointer: pan after 6px of movement. Two pointers: pinch-zoom around the midpoint. Zoom range 40%–300%.
- A drag never triggers a tap: suppress the click for 80ms after a gesture that moved > 6px.
- + / − zoom 1.25× around the center; FIT resets to fit all nodes/the whole image.
- Desktop: trackpad pinch (`wheel` with `ctrlKey`) and scroll-to-pan.
- Node Map edit mode: long-press (500ms) a node to drag it; save to `nodePositions`.
- Default node layout when no saved positions: simple layered layout by BFS depth from the act's first scene, rows of up to 3.

## 6. Accessibility
- Real `<button>`/`<input>`/`<label>`. `aria-pressed` on toggles, `aria-expanded` on folds, `aria-label` on icon-only buttons.
- Text contrast ≥ 4.5:1 in all three themes (the tokens above pass).
- Status is never color-only: chips carry words.
