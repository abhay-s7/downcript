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
- A persistent, searchable **Media Library** (§10) collecting everything downloaded or generated,
  independent of any one tab's own queue.
- Paste (or import a TXT/CSV of) many Meta Ad Library URLs at once and queue them all in a batch
  (§9), instead of adding them one at a time.
- **Smart file naming** (§11) — `Creator - Title.ext`, `Title.ext`, or `Creator - Title -
  Platform.ext`, per a Settings preference; a video and its transcript/subtitle share the same
  base name. Collision-safe — nothing gets silently overwritten.
- **Automatic updates on Windows** (§19) via GitHub Releases — a banner offers to download and
  install a newer version, never without an explicit click, and never mid-way through active
  downloads/transcriptions without asking first.
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
   §21, Known limitations, for why).
2. Detects whether it's a single video, a single image, or multiple creatives.
3. Lets you download any creative, or all of them, into a `MetaAd_<id>/` folder.
4. For any video creative, offers **Download Video**, **Download Transcript**, and **Download
   Video + Transcript**. A **Transcript Format** checkbox group (TXT/DOCX/SRT, plus a Select All
   convenience checkbox — defaults to DOCX only) applies to every video creative in the panel,
   including each video in a carousel; only the formats you have checked get written. Whisper
   still runs once regardless of how many formats are selected — only the export step is
   selective.

### 6. Video ads
Downloaded into a `MetaAd_<id>/` folder, named per the smart-naming rules in §11 (e.g. `Advertiser
- Ad <id> - Meta Ads.mp4`, or `- Creative 01.mp4` etc. if there's more than one creative).
Transcript files, if generated, share that exact same base name — only for the format(s) you
selected, e.g. just a matching `.docx` if that's all you checked.

### 7. Static image ads
Downloaded at the best quality Meta's page exposes (the original creative, not a resized
preview), named the same way as video ads above but with the extension matching the actual image
format (JPG/PNG/WebP/etc.), detected from the response if Meta's URL doesn't spell it out. A
thumbnail preview shows in the queue before you download. Images are never sent through
transcription, and video-only actions (Download Video / Transcript Only / Download Video +
Transcript) never appear for an image creative.

### 8. Carousel ads
Each creative downloads and (for videos) transcribes independently — one failing doesn't stop
the rest. Note: Meta also uses multiple `cards` for **Dynamic Creative Optimization (DCO)** ads
(several auto-tested variants of one ad), which Downcript also surfaces as separate downloadable
creatives, distinguished from a true carousel using Meta's own `display_format` field where
available.

### 9. Batch ad downloading

Expand **"Batch add multiple ads"** under the Meta Ads input to paste many Ad Library URLs at
once — one per line, or separated by spaces/commas — or import a `.txt`/`.csv` list (read directly
in the browser, no extra dialog needed). Click **Preview** first: every line is classified as
Valid, Duplicate, Invalid, or Unsupported *before* anything is queued, with counts and a reason
for each non-valid line — an "Invalid" URL (not a URL at all, or missing `?id=`) is called out
separately from an "Unsupported" one (a real URL, just not a Meta Ad Library link, e.g. a
YouTube link pasted by mistake). Duplicates are detected both within the pasted batch and against
ad IDs already in the queue, so re-pasting a list you already added doesn't create dozens of
repeat downloads. Only **Add N to queue** actually enqueues anything, and every ad it adds goes
through the exact same per-ad resolve → download pipeline as the single-URL input, processed
independently — one ad failing or being cancelled never stops or affects the others. A **Clear
completed** button removes any ad whose every creative (all of a carousel's, not just one) has
finished downloading.

## 10. Media Library

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
  Download entry) — the Library does not generate thumbnails itself (see §21).

## 11. Smart file naming

New files are named from real metadata instead of a raw title — Download and Meta Ads both build
names as `Creator - Title.ext`, `Title.ext`, or `Creator - Title - Platform.ext`, per a naming
preference in Settings (**File naming**: Title only / Creator + Title (default) / Creator +
Title + Platform). "Creator" is the uploader/channel yt-dlp reports for Download, or the
advertiser's page name for Meta Ads; "Title" falls back to `Ad <id>` for a Meta ad that has no
title of its own. When no creator is available for a given download, the name falls back to
title only regardless of the setting — there's nothing to combine. A video and its
transcript/subtitle share the exact same base name (no `_Transcript` suffix), so a same-named
`.srt` is auto-picked-up by most video players next to its `.mp4`.

Only affects **new** files — nothing already on disk gets renamed, and older Meta Ads output
using the previous `MetaAd_<id>_Video.mp4` pattern still works exactly as before; only the
*folder* name (`MetaAd_<id>/`) is unchanged going forward too, for carousel grouping and
traceability.

Sanitization (shared by every module, `app/lib/services/filesystem/naming.ts`) handles: invalid
filesystem characters, Windows' reserved device names (`CON`, `PRN`, `AUX`, `NUL`, `COM1`-`9`,
`LPT1`-`9` get a trailing underscore), a trailing dot or space (Windows-invalid), a leading dot
(would silently create a hidden file on macOS/Linux), Unicode/emoji (truncated by whole grapheme
cluster via `Intl.Segmenter`, so a long emoji-heavy title never ends in a mangled half-character),
and a generous-but-bounded length cap. Duplicate filenames still get a collision-safe `" (1)"`,
`" (2)"`, ... suffix, unchanged from before this phase.

**Not covered**: the Transcript tab's own sources (YouTube captions, Instagram, Dailymotion)
don't fetch a video's title/uploader today — only transcript text — so their exports still use
whatever synthetic label they already had (e.g. "YouTube - `<video id>`"), sanitized by the same
shared function but without a real creator/title to build a smart name from. Adding that would
mean a new metadata fetch (yt-dlp or an oEmbed call) on paths deliberately kept fast and
yt-dlp-free; deliberately not done in this phase.

## 12. Windows installation

Run the installer (`Downcript Setup.exe`), choose an install location, and launch. No other
software needs to be installed first.

## 13. macOS installation

Open the `.dmg`, drag Downcript to Applications. The build is currently **ad-hoc signed, not
notarized, and Apple Silicon (arm64) only** — see §21.

## 14. Usage instructions

Launch the app → pick a starting point from Home (or use the top nav) → paste a link or choose a
file → follow the on-screen queue. Settings lets you change where files save by default.

## 15. Troubleshooting

The app shows plain-language errors ("Unable to process this URL...") and keeps the technical
detail (exit codes, stderr, stack traces) in a log file — Settings → **View logs**. If something
fails:

- **A download or transcript fails immediately** — the source may be private, deleted, or
  region-restricted. yt-dlp itself may also just be out of date relative to a site's latest
  changes (sites like YouTube change their extraction requirements often); this is expected to
  need periodic yt-dlp updates over the app's lifetime.
- **Meta Ads fails to resolve an ad** — either the ad genuinely doesn't exist/was deleted (the app
  shows this distinctly), or Meta changed their page format, which will need an app update to fix
  (see §21).
- **"Meta Ads extraction needs to run inside the desktop app"** — you're viewing this in a plain
  browser tab during development; run the actual desktop app instead.

## 16. Development setup

```bash
npm install
npm run dev              # Next.js only, in a browser — Download/Transcript work,
                          # Meta Ads shows the desktop-only message
npm run electron:dev      # Next.js + Electron together, with a real window.desktop
```

Requires Node.js ≥20 for development. A local Python 3 with `faster-whisper`, `aksharamukha`, and
`yt-dlp` (see `requirements.txt`) lets `electron:dev`/`dev` fall back to system tools instead of
the frozen binaries — only needed for development, never for a packaged install.

## 17. Build commands

| Command | What it does |
|---|---|
| `npm run build` | Next.js production build (standalone server output) |
| `npm run build:python` | Freezes `transcribe`/`hinglish`/`ensure_models` via PyInstaller, for whichever OS you run it on (no cross-compiling) |
| `npm run verify:runtime -- <platform>` | Fails loudly if a bundled binary is missing before packaging |
| `npm run dist:mac` | Full macOS pipeline: build → build:python → download yt-dlp (darwin) → verify → package `.dmg` (arm64) |
| `npm run dist:win` | Same, for Windows (x64 NSIS installer) — **must run on an actual Windows machine**, not cross-compiled from macOS/Linux |

## 18. Packaging

Electron-builder handles both targets (config lives in `package.json`'s `build` key). The actual
Next.js server, the frozen Python tools, and the yt-dlp binary are injected via
`scripts/after-pack.js` and electron-builder's `extraResources` respectively — see
`electron/main.js` for how the app locates each of them at runtime (falls back to system
Python/yt-dlp only in unpackaged dev mode; a packaged build never does).

CI: `.github/workflows/windows-build.yml` builds, packages, silent-installs, and smoke-tests a
real Windows installer on `windows-latest` (the only reliable way to verify a Windows build, since
PyInstaller/ffmpeg-static can't cross-compile from macOS). It currently covers Upload
transcription and Dailymotion's bundled `yt-dlp.exe` — it does not yet cover the Download or Meta
Ads modules; see §21.

## 19. Automatic updates (Windows)

Installed copies check GitHub Releases for a newer version ~10 seconds after launch, and every 4
hours while the app stays open. A banner appears when one is found — **Update Now** downloads it
in the background (the app stays fully usable, downloads/transcriptions keep running); once
downloaded, **Restart & Install** quits the app, NSIS reinstalls silently in place, and it
relaunches on the new version. Nothing installs or restarts without that explicit click — a
normal `git push` is never mistaken for a release (only a `v*` git tag triggers one), and a
plain app quit never silently applies a pending update. If anything is still actively downloading
or transcribing when the update finishes downloading, the banner says so and asks for confirmation
before restarting anyway rather than just doing it.

Built on `electron-updater` + electron-builder's GitHub provider — see
[`RELEASE.md`](RELEASE.md) for the actual release process (bump version → tag → CI builds and
publishes automatically) and `electron/autoUpdater.js` for the main-process implementation. Fully
disabled in development (`npm run electron:dev`/`electron:preview`) — `autoUpdater` only runs in a
packaged, `app.isPackaged` build, so a dev session never points at production releases.

Every release's installer, `.blockmap` (differential-update data), and `latest.yml` (the metadata
electron-updater polls for) are generated and published by `.github/workflows/release.yml`. Update
downloads are full for now in practice — the very first tagged release has nothing to diff
against, and differential updates only shrink later ones once there's a prior release's blockmap
to compare to; the mechanism is there but hasn't been exercised release-over-release yet.

Not covered: macOS. The `publish` config in `package.json` applies to both platforms
structurally, but macOS builds are ad-hoc signed (not a real Developer ID) and not notarized —
Squirrel.Mac refuses to apply an update payload that isn't properly signed and notarized,
regardless of this feature. There's a second, independent gap too: verified while building this
feature that electron-builder only writes the update-metadata files (`app-update.yml`,
`latest-mac.yml`) for a mac target that includes `dmg` or `zip` — this project's mac target is
`dmg` only, but Squirrel.Mac's actual update mechanism downloads a `zip` of the `.app`, not the
`dmg` — so even signing/notarizing today's config wouldn't be enough; a `zip` target would need
adding too. See §21 and `docs/AUTO_UPDATE_HANDOFF.md`.

## 20. Project architecture

```
app/
├── api/                    Next.js API routes — the "backend" (download, transcription,
│                           Meta Ads creative download/transcribe, job cancel)
├── components/             React UI
├── hooks/                  Per-section queue state (useDownloadQueue -- a small concurrent lane
│                           pool; useTranscriptionQueue, useMetaQueue -- one sequential worker
│                           each; useLibrary -- backed by the main process, not local state;
│                           useAppUpdater -- subscribes to the main process's update broadcasts)
└── lib/
    ├── services/
    │   ├── downloader/     yt-dlp invocation, format selection, progress parsing
    │   ├── meta/           Ad snapshot parsing/classification (pure, no Electron dependency)
    │   ├── library/        Shared LibraryEntry type + a thin fire-and-forget client wrapper
    │   ├── activity/       Tiny pub/sub the three queue hooks report busy-state into, so the
    │   │                   update banner can tell if it's safe to restart-and-install
    │   ├── filesystem/     THE naming service (sanitizing, Creator/Title/Platform assembly,
    │   │                   collision-safe dedup) -- every module (Download, Meta Ads) builds
    │   │                   filenames through this, not its own ad-hoc string joining
    │   └── settings/       localStorage-backed preferences (concurrency, naming template,
    │                       completion sound)
    ├── jobRegistry.ts       Cancel-token registry shared by every job type
    ├── ytdlpRuntime.ts       /
    ├── pythonRuntime.ts       > resolve bundled-vs-dev-mode binaries
    └── transcribeVideoFile.ts /
electron/
├── main.js                 Spawns the Next.js server as a child process; owns everything only
│                           Electron can do -- a hidden BrowserWindow that resolves Meta Ad
│                           Library links (see §21), the Media Library's JSON store + IPC
│                           (list/upsert/rename/delete/open/scan), and the will-download hook
│                           that passively catches Transcript-tab exports into that store
├── autoUpdater.js           electron-updater setup: schedules checks, wires its events to a
│                           renderer broadcast, and the IPC handlers behind Update Now/Restart
└── preload.js               Minimal contextBridge surface (models, folder picker, Meta resolve,
                              library, updater)
scripts/                     Build-time only: PyInstaller freeze, yt-dlp download, CI smoke tests
```

Electron's main process and the Next.js server are separate processes talking over a local HTTP
port (dynamically chosen, never hardcoded) plus a small IPC surface for what only Electron can
do. Almost everything else — including all of Download's yt-dlp work — runs as ordinary Next.js
API routes, the same pattern the app inherited from its transcription pipeline.

## 21. Known limitations

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
- **Auto-update is Windows-only.** Reinstalling the `.dmg` is still the only way to update on
  macOS — its build is ad-hoc signed rather than notarized, which would block Squirrel.Mac from
  applying an update payload even if it were otherwise wired up. See §19 and
  [`docs/AUTO_UPDATE_HANDOFF.md`](docs/AUTO_UPDATE_HANDOFF.md) (now annotated as implemented for
  Windows; the mac-specific gap it originally documented is still open).
- **The Windows installer is unsigned** (no Authenticode certificate exists for this project).
  Auto-update itself still works unsigned — electron-updater doesn't require code signing to
  detect/download/install an update — but Windows SmartScreen shows an "unknown publisher"
  warning on every fresh install, update or not. Purely a trust-prompt annoyance, not a
  functional blocker.
- **No release has been published yet as of this writing** — `v1.0.0` is the version this phase
  shipped with, but the actual first tag/release still needs to be created manually (see
  `RELEASE.md`'s "First release" section) before any update path can be tested against a real
  GitHub Release.
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
- **Batch ad downloading still processes one at a time.** Adding several ads at once queues them
  all, but Meta Ads' worker is the same sequential one it always was (unlike Download's
  concurrent lanes) — batching changes how many jobs you can add in one step, not how many run
  simultaneously.
- **"Clear completed" was observed, in one live test, to no-op on the very first click right after
  a download finished, then work correctly a couple of seconds later on a second click.** Not
  data-destructive (nothing was lost, it just didn't clear yet), and not reproduced consistently
  enough to isolate a root cause — noted here rather than silently dropped.
- **Smart file naming doesn't reach the Transcript tab's own exports** (Upload/YouTube/Instagram/
  Dailymotion/Drive) — those sources never fetch a title/uploader today, only transcript text, so
  their exports keep using whatever synthetic label they already had. See §11.
- **Windows-safety of the naming sanitizer (reserved names, trailing dots, grapheme-safe emoji
  truncation) was verified by direct unit-level testing of the function, not by an actual Windows
  filesystem run** — no Windows machine was available in this session, consistent with every
  earlier phase's disclosed Windows-testing gap.
