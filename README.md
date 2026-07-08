# PulseCheck — deploy guide

A self-contained React app. No backend, no database, no API keys. It builds to
plain static files (HTML/JS/CSS), so any free static host will run it.

## Run locally first

You need Node.js 18+ installed (https://nodejs.org).

```bash
npm install
npm run dev       # opens http://localhost:5173
```

Build the production files:

```bash
npm run build     # outputs the static site into  dist/
npm run preview   # preview the built site locally
```

Everything the host needs is inside `dist/` after `npm run build`.

---

## Free hosting — pick ONE

### Option A — Netlify Drop (easiest, no account chores, no CLI)
1. Run `npm run build`.
2. Go to https://app.netlify.com/drop
3. Drag the whole **`dist`** folder onto the page.
4. You get a live URL instantly (e.g. `random-name.netlify.app`). Done.

### Option B — Vercel
1. Push this folder to a GitHub repo.
2. Go to https://vercel.com → "Add New Project" → import the repo.
3. Vercel auto-detects Vite. Framework: **Vite**, Build: `npm run build`,
   Output dir: `dist`. Click Deploy.

### Option C — GitHub Pages (free, tied to your GitHub)
1. Push this folder to a GitHub repo (say, `pulsecheck`).
2. Add the deploy helper: `npm install --save-dev gh-pages`
3. Add these two lines to the `"scripts"` block in `package.json`:
   ```json
   "predeploy": "npm run build",
   "deploy": "gh-pages -d dist"
   ```
4. Run `npm run deploy`.
5. In the repo: Settings → Pages → Source = branch `gh-pages`.
   Site appears at `https://<your-user>.github.io/<repo>/`.
   (`base: "./"` in vite.config.js already handles the subpath.)

### Option D — Cloudflare Pages
1. Push to GitHub.
2. Cloudflare dashboard → Pages → "Connect to Git" → pick the repo.
3. Build command `npm run build`, output directory `dist`. Deploy.

---

## Notes

- **Math (LaTeX)** loads KaTeX from a public CDN at runtime — it needs internet
  in the viewer's browser. If a browser blocks the CDN, math shows as raw
  `$...$` text instead of breaking. To make it fully offline, `npm install katex`
  and import it directly instead of the CDN loader.
- **Data is in-memory** for one browser session. Use the CSV import to load
  questions and the XLSX export to save results. There is no shared server, so
  student logins do not sync across different devices — see the note below.
- **Multi-device classrooms:** this static build is for a single projected
  screen, a pass-the-device model, or authoring/testing. Real phone-in-hand
  joining across many devices needs a small realtime backend (e.g. Firebase,
  Supabase, or a WebSocket server) wired into the same components.
