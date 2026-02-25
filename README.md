# LinkedIn Feed Filter (CRXJS + Embeddings)

This extension uses `@crxjs/vite-plugin` for MV3 packaging and runs `Xenova/all-MiniLM-L6-v2` in the extension background service worker.

## Architecture

- `src/manifest.js`: MV3 manifest source for CRXJS.
- `src/content.js`: Scans LinkedIn posts, requests semantic score, blurs matched posts.
- `src/background.js`: Loads embedding model and scores text via message passing.
- `vite.config.js`: Vite + CRXJS build config.

## Why this fixes your Worker error

Content scripts run in the page context and cannot directly create extension worker scripts from `chrome-extension://...` URLs the way you tried. Scoring now happens in `background.service_worker`, which is the correct MV3 extension context.

## Build and load

1. Install dependencies:

```bash
npm install
```

2. Build:

```bash
npm run build
```

3. Load unpacked extension:
- Open `chrome://extensions`
- Enable Developer mode
- Click **Load unpacked**
- Select `dist/`

## Permissions note

`host_permissions` includes Hugging Face domains because model files are fetched remotely on first use.