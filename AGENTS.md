# gm-workspace

Read docs/PROJECT_BRIEF.md and docs/DESIGN_SPEC.md before any task. Follow them exactly. Never commit PDFs or real module JSON.

- **What:** GM Workspace — offline iPad PWA that shows a prewritten RPG module's scenes from JSON and tracks table state. Details in `docs/PROJECT_BRIEF.md`.
- **Stack (planned, per the brief):** Vite + React + TypeScript, Zustand, Dexie, Zod, pdfjs-dist, vite-plugin-pwa, Vitest. No app code yet.
- **Run / test:** unknown, fill in once phase 1 adds `package.json` (brief says `npm run build` and `npm run test`).
- **Hosting:** GitHub Pages, source = GitHub Actions. The deploy workflow does not exist yet.
- **Do not touch:** `private/` and `campaigns/` hold real module data and stay out of git.
- **Running state:** vault folder `829 GM Workspace`.
