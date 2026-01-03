
# feat-mvp-between-sessions
a mental wellness app
# Between Sessions — Mental wellness companion

This is a lightweight, server-rendered launchpad for between-session support. It ships with:

- A simple Node HTTP server that serves static assets and a `/health` endpoint.
- A single-page experience with check-ins, guided 4-7-8 breathing, quick focus actions, and session prep checklists.
- Local persistence for check-ins via `localStorage`.

## Running locally

```bash
npm install
npm run start
```

Then open `http://localhost:3000` in your browser.

> If you prefer a one-liner without `npm install`, you can also run `node server.js` because no external dependencies are required.
