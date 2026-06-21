# Running in the browser

Most of ADHDashboard works when you open `index.html` directly (`file://`), including tasks, the focus timer, and planner.

**Voice notes** use the MediaRecorder API and IndexedDB. Many browsers block or limit these on `file://` URLs.

## Local server (recommended)

From the **project root** (the folder containing `index.html`):

```bash
python3 -m http.server 8080
```

Then open [http://localhost:8080](http://localhost:8080).

Node alternative:

```bash
npx --yes serve -p 8080
```

## Data storage

All task and settings data is stored in your browser's `localStorage` under keys prefixed with `adhd4_`. Nothing is sent to a server. Audio recordings are stored in IndexedDB on the same device and are **not** included in JSON backups.
