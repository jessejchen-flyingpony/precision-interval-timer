# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev              # Vite dev server on port 3000 (web only)
npm run electron:dev     # Concurrently runs Vite + Electron (full desktop dev)

# Build
npm run build            # Vite production build → dist/
npm run electron:build   # Vite build + electron-builder → release/ (portable .exe)

# Utilities
npm run lint             # TypeScript type checking (tsc --noEmit)
npm run preview          # Local preview of production build
```

No test framework is configured in this project.

## Architecture

This is a **single-page React app** that runs as both a **GitHub Pages web app** and an **Electron desktop app**. All timer and audio logic lives in the renderer; Electron's role is window management and one IPC channel.

### Key Files

- **`src/App.tsx`** — The entire application: timer logic, alarm state, UI, localStorage persistence. The core loop is a `useEffect` with a 100ms `setInterval` that calls `checkAlarms()`, which iterates over all seconds between the last check and now (up to a 10s catch-up window) to handle browser tab throttling.

- **`src/services/beeper.ts`** — Singleton audio engine wrapping Web Audio API and Speech Synthesis API. Maintains a silent keepalive oscillator (-80dBFS) to prevent Chrome from freezing the AudioContext when the tab is backgrounded. Also handles stuck speech synthesis detection (>12s timeout with auto-retry). Speech text uses spelled-out English words instead of digits (e.g. "thirty-six seconds left") to avoid Chinese TTS voices reading numbers in Chinese.

- **`electron/main.cjs`** — Electron main process. Creates a BrowserWindow with `backgroundThrottling: false`, loads `dist/index.html` in production (detected via `app.isPackaged`) or `http://localhost:3000` in dev. Listens for the `alarm-triggered` IPC message and restores/focuses the window if minimized. Forces `--lang=en-US` via `app.commandLine.appendSwitch` before app ready.

- **`electron/preload.cjs`** — Exposes `window.electronAPI.alarmTriggered()` to the renderer via `contextBridge`. This is the only IPC surface. In `App.tsx`, calls are guarded with `(window as any).electronAPI?.alarmTriggered()` so the web build is unaffected.

### Alarm Types

Two alarm rule types are supported:

- **Interval**: Fires every N minutes at wall-clock multiples (e.g., every 5 min fires at :00, :05, :10...). Trigger condition: `secondsSinceMidnight % intervalSeconds === 0`.
- **Mark**: Fires at a specific offset within a repeating cycle (e.g., at 4m within a 5m cycle). Trigger condition: `secondsSinceMidnight % intervalSeconds === markSeconds`.

Voice alarms auto-announce "X minutes Y seconds left" for mark alarms, or the custom label for interval alarms.

### State Persistence

All alarm rules and form settings are persisted to `localStorage` via `useEffect` watchers. There is no backend.

### Build Notes

- `vite.config.ts` sets `base: '/precision-interval-timer/'` for GitHub Pages subdirectory deployment. The Electron build overrides this with `--base ./` to use relative paths from `dist/index.html`.
- `GEMINI_API_KEY` is injected at build time via `vite.config.ts` but is not currently used in the application code.
- The Electron build targets Windows portable `.exe` (no installer). Output goes to `release/`.
- GitHub Actions (`.github/workflows/deploy.yml`) auto-deploys to GitHub Pages on push to `master`.

### Theme

The UI uses a hardware/terminal aesthetic: dark background (`#121212`), matrix-green accent (`#00ff41`), monospace fonts. Theme variables are defined in `src/index.css`.
