# gm-workspace

Read docs/PROJECT_BRIEF.md and docs/DESIGN_SPEC.md before any task. Follow them exactly. Never commit PDFs or real module JSON.

- **What:** GM Workspace — offline iPad PWA that shows a prewritten RPG module's scenes from JSON and tracks table state. Details in `docs/PROJECT_BRIEF.md`.
- **Stack:** Vite + React + TypeScript (`strict: true`), Zustand, Dexie, Zod, pdfjs-dist, vite-plugin-pwa, Vitest.
- **Run / test:** `npm run dev`, `npm run build`, `npm run preview`, `npm run test`.
- **Hosting:** GitHub Pages, source = GitHub Actions (`.github/workflows/deploy.yml`).
- **Do not touch:** `private/` and `campaigns/` hold real module data and stay out of git.
- **Running state:** vault folder `829 GM Workspace`.
