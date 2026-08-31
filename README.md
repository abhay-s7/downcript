# Downcript

Download media, generate transcripts, and extract Meta ad creatives — one desktop app for
Windows and macOS. No Python, FFmpeg, Node.js, or yt-dlp installation required; everything the
app needs is bundled.

## 1. Product overview

Downcript combines three workflows that used to be separate tools:

- **Download** — paste a link, pick a quality, save the file.
- **Transcript** — turn a video into a clean, readable transcript (TXT/DOCX/SRT), transcribed
  locally on your machine.
- **Meta Ads** — paste a Meta/Facebook Ad Library link and pull the ad's video, image, or
  carousel creatives, with optional transcription for any video creative.

Each has its own queue and runs independently, so you can start a download, check a transcript,
and extract an ad without one blocking the others.

## 2. Features

- One shared, always-running queue per section (Download / Transcript / Meta Ads), running in the
  background while you use another section. Download runs a small, configurable number of jobs
  at once (default 2, Settings); Transcript and Meta Ads process one at a time.
- Real pause/resume, cancel (the underlying process is actually killed, not just abandoned), and
  retry — a paused/retried download picks back up via yt-dlp's own partial-file continuation
  rather than restarting from zero.
- A persistent, searchable **Media Library** (§9) collecting everything downloaded or generated,
  independent of any one tab's own queue.
- Collision-safe file naming — nothing gets silently overwritten.
- Choose where files save, per section or as a shared default (Settings).
- Friendly error messages in the UI; technical details go to a debug log (Settings → View logs).
- A short completion sound (toggleable in Settings, on by default, persists across restarts) when
  a task finishes — once per logical task, not per internal step, and once per batch (e.g.
  Download All on a carousel) rather than once per file. Silent on failure or cancellation. Also
  shows a silent native OS notification as a visual backstop for when the window isn't focused.

## 3. Supported download sources

The Download section uses [yt-dlp](https://github.com/yt-dlp/yt-dlp) under the hood, so it
supports every site yt-dlp does — YouTube, Instagram, TikTok, Twitter/X, Facebook, Vimeo, Twitch,
SoundCloud, Dailymotion, Pinterest, Tumblr, Threads, LinkedIn, Loom, Streamable, and more. The
platform badge shown on each queue card is cosmetic; yt-dlp does its own site detection
internally regardless of what's shown.

Audio-only (MP3) or a specific video quality can be picked per link before downloading.

**Not supported here:** Meta/Facebook Ad Library links (`facebook.com/ads/library/...`). Those go
through the separate Meta Ads section — yt-dlp cannot resolve them (see §5).

## 4. Transcript functionality

Sources: YouTube (captions, no local processing), Instagram Reels, Dailymotion, local file
upload (MP4), and public Google Drive folders. Transcription runs locally via
[faster-whisper](https://github.com/SYSTRAN/faster-whisper); language is auto-detected per video
(no manual language picker). An optional **Hinglish** output mode transliterates Hindi audio to
Romanized text — meant specifically for Hindi content; using it on other languages will produce
nonsense.

Exports: TXT, DOCX, and SRT, either per-video or combined across every completed job in the
queue. Cancel stops the actual ffmpeg/Whisper/yt-dlp process for that job, not just the UI.

## 5. Meta Ads functionality

Paste a Meta Ad Library URL (`https://www.facebook.com/ads/library/?id=...`). The app:

1. Resolves the ad — this specifically requires the desktop app, not a browser tab (see
   §18, Known limitations, for why).
2. Detects whether it's a single video, a single image, or multiple creatives.
3. Lets you download any creative, or all of them, into a `MetaAd_<id>/` folder.
4. For any video creative, offers **Download Video**, **Download Transcript**, and **Download
   Video + Transcript**. A **Transcript Format** checkbox group (TXT/DOCX/SRT, plus a Select All
   convenience checkbox — defaults to DOCX only) applies to every video creative in the panel,
   including each video in a carousel; only the formats you have checked get written. Whisper
   still runs once regardless of how many formats are selected — only the export step is
   selective.

### 6. Video ads
Downloaded as `MetaAd_<id>_Video.mp4` (or `_Creative_NN.mp4` if there's more than one creative).
Transcript files, if generated, sit right next to it — only for the format(s) you selected, e.g.
`..._Transcript.docx` alone if that's all you checked.

### 7. Static image ads
Downloaded at the best quality Meta's page exposes (the original creative, not a resized
preview), as `MetaAd_<id>_Image.<ext>` (or `_Creative_NN.<ext>`) — the extension matches the
actual image format (JPG/PNG/WebP/etc.), detected from the response if Meta's URL doesn't spell
it out. A thumbnail preview shows in the queue before you download. Images are never sent through
transcription, and video-only actions (Download Video / Transcript Only / Download Video +
Transcript) never appear for an image creative.

### 8. Carousel ads
Each creative downloads and (for videos) transcribes independently — one failing doesn't stop
the rest. Note: Meta also uses multiple `cards` for **Dynamic Creative Optimization (DCO)** ads
(several auto-tested variants of one ad), which Downcript also surfaces as separate downloadable
creatives, distinguished from a true carousel using Meta's own `display_format` field where
available.

## 9. Media Library

Everything Download, Meta Ads, and Transcript's export buttons produce is automatically collected
into one searchable **Library** (top nav), persisted in a JSON file under the app's own data
folder — it survives restarts, independent of any one tab's own queue.

- **Auto-registration, three paths**: Download and Meta Ads register a library entry themselves
  the moment a job completes or fails. The main Transcript module's Export DOCX/TXT/SRT buttons
  are deliberately left as plain browser-style downloads (unchanged from an earlier phase), so
  those are instead caught passively via Electron's own download-completion event — the export
  still goes through the normal Save dialog, the app just also notices where it landed.
- **Pre-existing files**: "Scan for existing files" walks the default (and any custom) output
  folder for recognized file types not yet registered — for files that were already there before
  this feature existed, or added by hand — without moving or reorganizing anything.
- **Search, sort (Date/Name/Size/Type/Source), and filter** (by type, and by completed/failed
  status).
- **Per-item actions**: Open file, Open containing folder, Copy path, Rename (renames the real
  file, not just the label), Delete (move the file to Trash, or remove just the library record),
  and — for a completed video entry — **Transcribe**, which reuses the same transcription route
  Meta Ads' video creatives already use.
- **Thumbnails** show only when already known from elsewhere (e.g. yt-dlp's own thumbnail for a
  Download entry) — the Library does not generate thumbnails itself (see §18).

## 10. Windows installation

Run the installer (`Downcript Setup.exe`), choose an install location, and launch. No other
software needs to be installed first.

## 11. macOS installation

Open the `.dmg`, drag Downcript to Applications. The build is currently **ad-hoc signed, not
notarized, and Apple Silicon (arm64) only** — see §18.

## 12. Usage instructions

Launch the app → pick a starting point from Home (or use the top nav) → paste a link or choose a
file → follow the on-screen queue. Settings lets you change where files save by default.

## 13. Troubleshooting

The app shows plain-language errors ("Unable to process this URL...") and keeps the technical
detail (exit codes, stderr, stack traces) in a log file — Settings → **View logs**. If something
fails:

- **A download or transcript fails immediately** — the source may be private, deleted, or
  region-restricted. yt-dlp itself may also just be out of date relative to a site's latest
  changes (sites like YouTube change their extraction requirements often); this is expected to
  need periodic yt-dlp updates over the app's lifetime.
- **Meta Ads fails to resolve an ad** — either the ad genuinely doesn't exist/was deleted (the app
  shows this distinctly), or Meta changed their page format, which will need an app update to fix
  (see §18).
- **"Meta Ads extraction needs to run inside the desktop app"** — you're viewing this in a plain
  browser tab during development; run the actual desktop app instead.

## 14. Development setup

```bash
npm install
npm run dev              # Next.js only, in a browser — Download/Transcript work,
                          # Meta Ads shows the desktop-only message
npm run electron:dev      # Next.js + Electron together, with a real window.desktop
```

Requires Node.js ≥20 for development. A local Python 3 with `faster-whisper`, `aksharamukha`, and
`yt-dlp` (see `requirements.txt`) lets `electron:dev`/`dev` fall back to system tools instead of
the frozen binaries — only needed for development, never for a packaged install.

## 15. Build commands

| Command | What it does |
|---|---|
| `npm run build` | Next.js production build (standalone server output) |
| `npm run build:python` | Freezes `transcribe`/`hinglish`/`ensure_models` via PyInstaller, for whichever OS you run it on (no cross-compiling) |
| `npm run verify:runtime -- <platform>` | Fails loudly if a bundled binary is missing before packaging |
| `npm run dist:mac` | Full macOS pipeline: build → build:python → download yt-dlp (darwin) → verify → package `.dmg` (arm64) |
| `npm run dist:win` | Same, for Windows (x64 NSIS installer) — **must run on an actual Windows machine**, not cross-compiled from macOS/Linux |

## 16. Packaging

Electron-builder handles both targets (config lives in `package.json`'s `build` key). The actual
Next.js server, the frozen Python tools, and the yt-dlp binary are injected via
`scripts/after-pack.js` and electron-builder's `extraResources` respectively — see
`electron/main.js` for how the app locates each of them at runtime (falls back to system
Python/yt-dlp only in unpackaged dev mode; a packaged build never does).

CI: `.github/workflows/windows-build.yml` builds, packages, silent-installs, and smoke-tests a
real Windows installer on `windows-latest` (the only reliable way to verify a Windows build, since
PyInstaller/ffmpeg-static can't cross-compile from macOS). It currently covers Upload
transcription and Dailymotion's bundled `yt-dlp.exe` — it does not yet cover the Download or Meta
Ads modules; see §18.

## 17. Project architecture

```
app/
├── api/                    Next.js API routes — the "backend" (download, transcription,
│                           Meta Ads creative download/transcribe, job cancel)
├── components/             React UI
├── hooks/                  Per-section queue state (useDownloadQueue -- a small concurrent lane
│                           pool; useTranscriptionQueue, useMetaQueue -- one sequential worker
│                           each; useLibrary -- backed by the main process, not local state)
└── lib/
    ├── services/
    │   ├── downloader/     yt-dlp invocation, format selection, progress parsing
    │   ├── meta/           Ad snapshot parsing/classification (pure, no Electron dependency)
    │   ├── library/        Shared LibraryEntry type + a thin fire-and-forget client wrapper
    │   └── filesystem/     Shared filename sanitizing + collision-safe dedup
    ├── jobRegistry.ts       Cancel-token registry shared by every job type
    ├── ytdlpRuntime.ts       /
    ├── pythonRuntime.ts       > resolve bundled-vs-dev-mode binaries
    └── transcribeVideoFile.ts /
electron/
├── main.js                 Spawns the Next.js server as a child process; owns everything only
│                           Electron can do -- a hidden BrowserWindow that resolves Meta Ad
│                           Library links (see §18), the Media Library's JSON store + IPC
│                           (list/upsert/rename/delete/open/scan), and the will-download hook
│                           that passively catches Transcript-tab exports into that store
└── preload.js               Minimal contextBridge surface (models, folder picker, Meta resolve,
                              library)
scripts/                     Build-time only: PyInstaller freeze, yt-dlp download, CI smoke tests
```

Electron's main process and the Next.js server are separate processes talking over a local HTTP
port (dynamically chosen, never hardcoded) plus a small IPC surface for what only Electron can
do. Almost everything else — including all of Download's yt-dlp work — runs as ordinary Next.js
API routes, the same pattern the app inherited from its transcription pipeline.

## 18. Known limitations

- **Meta Ads requires the desktop app, not a browser tab.** Every `facebook.com/ads/...` URL sits
  behind a JS-executing bot-challenge that a plain HTTP request cannot pass. Downcript resolves
  ads via a hidden Electron `BrowserWindow` (reusing Chromium Electron already ships — no extra
  bundled browser), which has no equivalent outside the desktop app.
- **Meta can change their page format at any time**, which may break ad resolution until the app
  is updated. This is a structural risk of reading an undocumented page rather than an official
  API — there is no way to fully insulate against it.
- **Meta's Ad Library ToS technically restricts automated access.** The Ad Library is a public
  transparency tool with a different legal posture than scraping a logged-in surface, and
  enforcement in practice has been technical (challenge/format changes) rather than legal action
  against small-scale personal tools — but this is a real consideration for how you use the
  feature, not a guarantee.
- **A Meta Ad Library URL's `id=` doesn't always resolve to that exact ad.** Meta collates related
  ads from the same advertiser under one representative ad in some cases; you may see a different
  (but real) ad ID than the one you pasted. An invalid or deleted ad ID is still detected
  correctly and shown as unavailable, not confused with this collation behavior.
- **macOS build is ad-hoc signed, not notarized, and arm64-only** (no Intel Mac support, no
  universal binary). Gatekeeper may warn on a machine stricter than the one this was built on.
- **No auto-update.** Reinstalling is currently the only way to update — there is no
  `electron-updater` dependency, no update-check code in `electron/main.js`, no `publish`
  configuration, and no GitHub Releases are created (CI uploads the Windows `.exe` as a plain
  build artifact via `--publish never`; macOS has no release CI at all). The macOS build is also
  ad-hoc signed rather than notarized, which would block an update from applying even if the rest
  were wired up. See [`docs/AUTO_UPDATE_HANDOFF.md`](docs/AUTO_UPDATE_HANDOFF.md) for the full
  audit and a concrete implementation plan.
- **CI does not yet cover the Download or Meta Ads modules** — only Upload transcription and
  Dailymotion's bundled yt-dlp are smoke-tested on a real Windows machine today.
- **Upload accepts MP4 only** (a deliberate, pre-existing scope limit, not new to this app).
- **No manual language selection for transcription** — language is auto-detected per video.
- **Completion-sound batch behavior (Meta Ads "Download All" on a multi-creative ad) was verified
  by careful code tracing rather than a live end-to-end run** — Meta's ad collation was resolving
  every test ad to a single creative on the day this was built, so a genuine multi-creative batch
  couldn't be reproduced live in that session. Every other completion-sound path (single download,
  transcript-only, the combo action, sound on/off, persistence, and cancel) was verified live.
- **The Media Library never generates thumbnails.** It only ever shows one already known from
  elsewhere (e.g. yt-dlp's own thumbnail URL for a Download entry) — there is no ffmpeg
  frame-extraction step, so Meta Ads entries and scanned/pre-existing files always fall back to a
  plain type badge.
- **Library duration is only ever what the source already reported** (yt-dlp, for Download
  entries) — nothing is probed for files found via a folder scan or a Transcript-tab export, so
  those entries show no duration.
- **A Transcript-tab export only reaches the Library once its native Save dialog is confirmed** —
  the app can't see the file (or know its final name) until Electron's own download-completion
  event fires, which only happens after that dialog is resolved. This is a consequence of
  deliberately leaving that export flow untouched from an earlier phase, not a bug.
