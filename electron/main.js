const { app, BrowserWindow, shell, dialog, ipcMain, Notification, session } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const net = require("node:net");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const { setupAutoUpdater } = require("./autoUpdater");

// Two ways this app can get its UI:
//
// 1. Dev mode: ELECTRON_START_URL is set (by `npm run electron:dev`) to point
//    at a `next dev` server that's already running. Nothing to manage here.
//
// 2. Zero-setup mode (the actual desktop-app milestone): no URL is given, so
//    this process spawns the app's own local Next.js server -- the same
//    server that runs all the existing API routes (transcription, FFmpeg,
//    downloaders, queue, export) -- as a child process, on a free local
//    port, and loads that. No separate `next dev`/`next start` step, no
//    system Node.js required (the child runs under Electron's own bundled
//    Node runtime via ELECTRON_RUN_AS_NODE).
const DEV_START_URL = process.env.ELECTRON_START_URL || null;

let mainWindow = null;
let serverProcess = null;

// The Next server's console.log/console.error output -- including every
// download/transcription job's diagnostic logging (yt-dlp args, exit codes,
// stderr) -- only ever existed as an in-memory tail used for the startup-
// failure dialog below. In a packaged GUI app there is no attached console,
// so that output was otherwise unrecoverable the moment something failed
// mid-session instead of at startup, even though the dialog text already
// told users to "check the app logs". This persists it to a real file.
const LOG_DIR = path.join(app.getPath("userData"), "logs");
const LOG_FILE = path.join(LOG_DIR, "app.log");

function initLogStream() {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    // Single rotated backup instead of a logging dependency -- enough to
    // keep the file from growing unbounded across a long-running install.
    if (fs.existsSync(LOG_FILE) && fs.statSync(LOG_FILE).size > 5 * 1024 * 1024) {
      fs.renameSync(LOG_FILE, `${LOG_FILE}.old`);
    }
    return fs.createWriteStream(LOG_FILE, { flags: "a" });
  } catch (err) {
    console.error("Failed to open log file:", err);
    return null;
  }
}

const logStream = initLogStream();

function appendLog(text) {
  logStream?.write(`[${new Date().toISOString()}] ${text}`);
}

function getStandaloneServerPath() {
  // Packaged builds (Step 15+) will ship the standalone server under
  // resourcesPath via electron-builder's extraResources; until then we run
  // straight out of the project's own `next build` output.
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "app-server", "server.js");
  }
  return path.join(__dirname, "..", ".next", "standalone", "server.js");
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

async function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status < 500) return true;
    } catch {
      // Server not accepting connections yet -- keep polling.
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

async function startLocalServer() {
  const serverPath = getStandaloneServerPath();

  if (!fs.existsSync(serverPath)) {
    throw new Error(
      `Local app server not found at ${serverPath}.\n\n` +
        "Run `npm run build` first to produce the standalone server output."
    );
  }

  const port = await getFreePort();
  const env = {
    ...process.env,
    PORT: String(port),
    HOSTNAME: "127.0.0.1",
    NODE_ENV: "production",
    ELECTRON_RUN_AS_NODE: "1",
    // The server's cwd is .next/standalone (required for its own relative
    // asset lookups), which is NOT the project root -- so anything that
    // needs to find project-root-relative resources (e.g. frozen Python
    // tool binaries under build-python/, see app/lib/pythonRuntime.ts) gets
    // the real root explicitly instead of guessing from cwd.
    PROJECT_ROOT: path.join(__dirname, ".."),
    // app.isPackaged isn't available inside the server's own process (it's
    // an Electron-main-process-only API) -- app/lib/pythonRuntime.ts and
    // app/lib/ytdlpRuntime.ts need to know this to refuse falling back to a
    // system python3/yt-dlp when packaged (see spawnTool above for why).
    ELECTRON_IS_PACKAGED: app.isPackaged ? "1" : "0",
    // Default save location for the Download and Meta Ads modules (see
    // app/lib/services/downloader/destination.ts) -- Electron's own
    // per-platform Downloads folder, not guessable from inside the plain
    // Node child process the server runs as.
    DEFAULT_DOWNLOAD_DIR: path.join(app.getPath("downloads"), "Downcript"),
  };

  serverProcess = spawn(process.execPath, [serverPath], {
    cwd: path.dirname(serverPath),
    env,
    stdio: ["ignore", "pipe", "pipe"],
    // The server itself spawns further children (ffmpeg, the frozen
    // transcribe/hinglish/yt-dlp binaries) for each transcription job. A
    // plain kill() on the server only signals that one process, orphaning
    // whatever it had running -- detached makes it the leader of a new
    // process group, so killing the whole group (see stopLocalServer) takes
    // its entire descendant tree down together instead of leaking it.
    detached: process.platform !== "win32",
  });

  let serverLog = "";
  serverProcess.stdout.on("data", (d) => {
    serverLog += d;
    appendLog(d.toString());
  });
  serverProcess.stderr.on("data", (d) => {
    serverLog += d;
    appendLog(d.toString());
  });
  serverProcess.on("exit", (code) => {
    if (code !== null && code !== 0) {
      const msg = `Local app server exited with code ${code}\n${serverLog}`;
      console.error(msg);
      appendLog(`${msg}\n`);
    }
    serverProcess = null;
  });

  const url = `http://127.0.0.1:${port}`;
  const ready = await waitForServer(url, 20_000);
  if (!ready) {
    throw new Error(
      `Local app server did not become ready in time.\n\n${serverLog.slice(-2000)}`
    );
  }

  return url;
}

function stopLocalServer() {
  if (serverProcess) {
    try {
      if (process.platform === "win32") serverProcess.kill();
      else process.kill(-serverProcess.pid, "SIGTERM");
    } catch {
      // Process (or its group) already gone -- nothing to clean up.
    }
    serverProcess = null;
  }
}

// Same frozen-binary-or-python3-fallback resolution as
// app/lib/pythonRuntime.ts, duplicated here in plain CommonJS because this
// runs in the Electron main process, not inside the Next server bundle.
function resolveToolBinary(tool) {
  const exeName = process.platform === "win32" ? `${tool}.exe` : tool;
  const projectRoot = path.join(__dirname, "..");
  const candidates = [
    app.isPackaged ? path.join(process.resourcesPath, "py", tool, exeName) : null,
    path.join(projectRoot, "build-python", "dist", process.platform, tool, exeName),
  ].filter(Boolean);
  return candidates.find((p) => fs.existsSync(p)) ?? null;
}

// Tracks every process spawned directly by the main process (outside the
// local server) -- currently just the model check/download tool -- so it
// can be killed on quit instead of orphaned if the app closes mid-download.
const activeTools = new Set();

function spawnTool(tool, scriptRelPath, args) {
  const frozen = resolveToolBinary(tool);

  if (!frozen) {
    // A packaged build must never fall back to a system "python3" -- that's
    // exactly the bug this guards against. On a clean end-user machine with
    // no Python installed, Windows silently redirects "python"/"python3" to
    // its Microsoft Store App Execution Alias shim, which prints "Python was
    // not found; run without arguments to install from the Microsoft
    // Store" -- a confusing, unactionable error that looks like a user setup
    // problem but is actually a packaging defect (the frozen binary for this
    // tool/platform wasn't bundled). Failing immediately with a clear,
    // specific error is strictly better than attempting a command that was
    // never supposed to exist on the user's machine in the first place.
    if (app.isPackaged) {
      throw new Error(
        `Local transcription runtime ("${tool}") is missing from this installation. ` +
          "This is a packaging defect, not something you can fix by installing Python -- " +
          "please reinstall the app or report this to the developer."
      );
    }
    // Dev-mode-only convenience: lets a developer iterate against system
    // Python without rebuilding frozen binaries every time. Never reached
    // in a packaged build (see above).
    const pythonCmd = process.platform === "win32" ? "python" : "python3";
    const child = spawn(pythonCmd, [path.join(__dirname, "..", scriptRelPath), ...args], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    activeTools.add(child);
    child.once("exit", () => activeTools.delete(child));
    return child;
  }

  const child = spawn(frozen, args, { stdio: ["ignore", "pipe", "pipe"] });
  activeTools.add(child);
  child.once("exit", () => activeTools.delete(child));
  return child;
}

function stopActiveTools() {
  for (const child of activeTools) {
    child.kill("SIGTERM");
  }
  activeTools.clear();
}

// Reads newline-delimited JSON events off a child's stdout and forwards each
// parsed object to onMessage; partial lines are buffered across chunks.
function readJsonLines(stream, onMessage) {
  let buffer = "";
  stream.on("data", (chunk) => {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        onMessage(JSON.parse(line));
      } catch {
        // Non-JSON output (e.g. a stray print) -- ignore, not a progress event.
      }
    }
  });
}

let modelDownloadInFlight = null;

ipcMain.handle("models:check", () => {
  return new Promise((resolve, reject) => {
    const child = spawnTool("ensure_models", "scripts/ensure_models.py", ["--check"]);
    let result = null;
    let stderr = "";
    readJsonLines(child.stdout, (msg) => {
      if (msg.type === "check-result") result = msg;
    });
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", reject);
    child.on("exit", (code) => {
      if (result) resolve({ missing: result.missing });
      else reject(new Error(code === 0 ? "Model check returned no result" : stderr.slice(-500)));
    });
  });
});

ipcMain.handle("models:ensure", (event) => {
  if (modelDownloadInFlight) return modelDownloadInFlight;

  modelDownloadInFlight = new Promise((resolve, reject) => {
    const child = spawnTool("ensure_models", "scripts/ensure_models.py", []);
    let stderr = "";
    let failure = null;

    readJsonLines(child.stdout, (msg) => {
      if (!event.sender.isDestroyed()) event.sender.send("models:progress", msg);
      if (msg.type === "model-error") failure = msg.error || "Model download failed";
    });
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (err) => reject(err));
    child.on("exit", (code) => {
      if (code === 0 && !failure) resolve({ ok: true });
      else reject(new Error(failure || stderr.slice(-500) || "Model download failed"));
    });
  }).finally(() => {
    modelDownloadInFlight = null;
  });

  return modelDownloadInFlight;
});

// Renderer never gets direct filesystem access -- picking a save folder is a
// main-process-only dialog, invoked over IPC and returning just the chosen
// path (or null if the user cancelled).
ipcMain.handle("dialog:chooseFolder", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory", "createDirectory"],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("dialog:defaultDownloadDir", () => path.join(app.getPath("downloads"), "Downcript"));

// Settings' "View logs" action -- surfaces the same app.log every error
// message already points users to, without giving the renderer direct
// filesystem access.
ipcMain.handle("dialog:openLogsFolder", () => shell.showItemInFolder(LOG_FILE));

// Purely visual: the renderer already plays its own bundled completion
// chime (see app/lib/services/notifications/completionNotifier.ts), so this
// is marked `silent` to avoid layering the OS's own notification sound on
// top of it -- this notification exists only to be noticeable when the
// window is unfocused/minimized, not as a second sound source.
ipcMain.handle("notification:taskComplete", (_event, message) => {
  if (!Notification.isSupported()) return;
  new Notification({
    title: "Downcript",
    body: typeof message === "string" && message ? message : "Task completed successfully.",
    silent: true,
  }).show();
});

// --- Media Library -----------------------------------------------------
//
// A permanent, cross-session record of everything the app has downloaded or
// generated, independent of any one tab's own (session-scoped) queue state.
// Lives here rather than in renderer localStorage for two reasons: Rename/
// Delete/Open need real fs/shell access the renderer is never given
// directly, and one of the three ways an entry gets registered (the
// will-download hook below) only exists in this process to begin with.
//
// Deliberately a single flat JSON file, not a database -- this is a
// single-user desktop app; a few thousand entries is a trivial read/parse,
// and mirrors the plain-JSON-file precedent already used for the app log.
const LIBRARY_FILE = path.join(app.getPath("userData"), "library.json");

// Mirrors app/lib/services/library/types.ts's EXTENSION_KIND -- duplicated
// rather than imported because this file is plain CommonJS, not bundled
// from the renderer's TypeScript.
const EXTENSION_KIND = {
  mp4: "video", mov: "video", mkv: "video", webm: "video", avi: "video",
  mp3: "audio", m4a: "audio", wav: "audio",
  jpg: "image", jpeg: "image", png: "image", webp: "image", gif: "image", avif: "image", bmp: "image",
  txt: "transcript", docx: "transcript", srt: "transcript",
};
function kindForExtension(ext) {
  return EXTENSION_KIND[String(ext).toLowerCase().replace(/^\./, "")] || "other";
}

let libraryEntries = [];
try {
  libraryEntries = JSON.parse(fs.readFileSync(LIBRARY_FILE, "utf8"));
  if (!Array.isArray(libraryEntries)) libraryEntries = [];
} catch {
  // Missing or corrupt on first run / after a manual edit -- start empty
  // rather than failing the whole app over a non-essential feature.
  libraryEntries = [];
}

function saveLibrary() {
  try {
    fs.writeFileSync(LIBRARY_FILE, JSON.stringify(libraryEntries), "utf8");
  } catch (err) {
    console.error("Failed to persist library.json:", err);
  }
}

function broadcastLibraryChanged() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("library:changed", libraryEntries);
  }
}

// Used by both the IPC upsert handler (Download/Meta Ads completions) and
// the will-download hook (Transcript-tab exports) -- the one place that
// decides size/timestamps and persists+broadcasts, so neither caller has to
// duplicate that bookkeeping.
function upsertLibraryEntry(input) {
  const existing = libraryEntries.find((e) => e.id === input.id);
  const now = Date.now();

  let sizeBytes;
  if (input.filePath) {
    try {
      sizeBytes = fs.statSync(input.filePath).size;
    } catch {
      // File briefly not on disk yet (write in progress) or already gone --
      // leave size undefined rather than failing the whole upsert over it.
    }
  }

  const entry = {
    ...input,
    sizeBytes,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  libraryEntries = existing
    ? libraryEntries.map((e) => (e.id === input.id ? entry : e))
    : [...libraryEntries, entry];

  saveLibrary();
  broadcastLibraryChanged();
  return entry;
}

ipcMain.handle("library:list", () => libraryEntries);

ipcMain.handle("library:upsert", (_event, input) => upsertLibraryEntry(input));

ipcMain.handle("library:remove", async (_event, id, options) => {
  const entry = libraryEntries.find((e) => e.id === id);
  if (entry?.filePath && options?.deleteFile) {
    try {
      await shell.trashItem(entry.filePath);
    } catch (err) {
      // Already gone from disk, or permission issue -- still drop the
      // library record either way, but surface the real reason.
      throw new Error(`Could not delete "${entry.fileName}": ${err.message}`);
    }
  }
  libraryEntries = libraryEntries.filter((e) => e.id !== id);
  saveLibrary();
  broadcastLibraryChanged();
});

ipcMain.handle("library:rename", (_event, id, newBaseName) => {
  const entry = libraryEntries.find((e) => e.id === id);
  if (!entry || !entry.filePath) throw new Error("This item has no file to rename.");

  const dir = path.dirname(entry.filePath);
  const ext = path.extname(entry.filePath);
  const sanitized = String(newBaseName).replace(/[/\\:*?"<>|]/g, "_").trim().slice(0, 150);
  if (!sanitized) throw new Error("Please enter a valid name.");

  const newPath = path.join(dir, `${sanitized}${ext}`);
  if (newPath !== entry.filePath && fs.existsSync(newPath)) {
    throw new Error("A file with that name already exists.");
  }

  fs.renameSync(entry.filePath, newPath);
  // LibraryRow displays `title || fileName` -- a non-empty title (set at
  // creation from the video's real title, not the filename) would otherwise
  // always win and silently hide a successful rename from the user.
  return upsertLibraryEntry({ ...entry, filePath: newPath, fileName: path.basename(newPath), title: sanitized });
});

ipcMain.handle("library:openFile", (_event, filePath) => shell.openPath(filePath));
ipcMain.handle("library:openFolder", (_event, filePath) => shell.showItemInFolder(filePath));

// Non-recursive-by-default folder scan (depth 2, to also reach Meta Ads'
// MetaAd_<id>/ subfolders) for files the app produced but never registered
// -- pre-existing files from before this feature shipped, or anything a
// user moved into the output folder by hand. Idempotent: re-running never
// duplicates an entry, since it's keyed by the file's own absolute path.
function scanDir(dir, depth, results) {
  let names;
  try {
    names = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return; // Folder doesn't exist yet / not readable -- nothing to scan.
  }
  for (const entry of names) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (depth > 0) scanDir(full, depth - 1, results);
      continue;
    }
    const ext = path.extname(entry.name).slice(1);
    if (!(ext.toLowerCase() in EXTENSION_KIND)) continue;
    results.push(full);
  }
}

ipcMain.handle("library:scanFolders", (_event, folders) => {
  const found = [];
  for (const folder of Array.isArray(folders) ? folders : []) {
    scanDir(folder, 2, found);
  }

  const known = new Set(libraryEntries.map((e) => e.filePath).filter(Boolean));
  let added = 0;
  for (const filePath of found) {
    if (known.has(filePath)) continue;
    const ext = path.extname(filePath).slice(1);
    const base = path.basename(filePath, path.extname(filePath));
    upsertLibraryEntry({
      id: filePath,
      filePath,
      fileName: path.basename(filePath),
      title: base,
      sourceModule: "scan",
      kind: kindForExtension(ext),
      ext,
      status: "completed",
    });
    known.add(filePath);
    added += 1;
  }
  return { added };
});

// Every facebook.com/ads/... URL -- including the lighter "preview" endpoints
// -- sits behind a JS-executing bot-challenge page (confirmed: a plain HTTPS
// request gets a 403 challenge page, never the real content). Only a real
// browser context gets past it. Rather than bundle a second Chromium via
// Playwright (conflicts with the zero-setup goal), this reuses the Chromium
// Electron already ships, in a hidden window driven from here -- the one
// place in the app that can create a BrowserWindow at all. Everything after
// "get the raw ad JSON back" (shape search, classification, downloading)
// happens in ordinary TypeScript in the Next.js server, same as every other
// source.
const META_DESKTOP_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const META_RESOLVE_POLL_MS = 750;
const META_RESOLVE_MAX_ATTEMPTS = 20; // ~15s, covering the challenge's own reload + real page load

// Neither BrowserWindow#loadURL nor webContents#executeJavaScript have a
// built-in timeout -- each one's promise is only guaranteed to settle if the
// page genuinely finishes loading / the script genuinely finishes running.
// A page that never fires its load-finished event (a stuck redirect, a
// connection Meta never closes, an unusually large/slow render for a
// high-volume advertiser) or a script that runs long on an unusually large
// page leaves that promise pending forever, which (before this) left the
// whole meta:searchAdsSession:start/more call -- and the renderer's awaited
// IPC call along with it -- hung indefinitely, stuck on "Loading..." with no
// way to recover. Wrapping every such call bounds it, so the IPC promise the
// renderer awaits is always guaranteed to settle one way or another.
function withTimeout(promise, ms, timeoutMessage) {
  let timer;
  const timeout = new Promise((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(timeoutMessage)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

const META_LOAD_URL_TIMEOUT_MS = 25000;
const META_EXEC_JS_TIMEOUT_MS = 10000;
const META_LOAD_TIMEOUT_MESSAGE =
  "The Meta Ads Library page took too long to load. This can happen for a very broad search (e.g. All Countries) -- try again, or narrow the search.";

// The only page-format-specific logic that runs inside the hidden window --
// kept to "find the script tag" only, since this is the hardest part to
// iterate on if Meta changes something (no devtools, no error output beyond
// what executeJavaScript returns). Actual JSON shape parsing happens back in
// Node/TypeScript where it's testable.
const FIND_AD_SNAPSHOT_SCRIPT = `
  (function() {
    const scripts = Array.from(document.querySelectorAll('script[type="application/json"][data-sjs]'));
    for (const s of scripts) {
      if (s.textContent && s.textContent.includes("ad_archive_id")) {
        try { return JSON.parse(s.textContent); } catch { /* keep looking */ }
      }
    }
    return null;
  })();
`;

function extractMetaAdId(url) {
  try {
    return new URL(url.trim()).searchParams.get("id");
  } catch {
    return null;
  }
}

ipcMain.handle("meta:resolveAd", async (_event, url) => {
  const adId = extractMetaAdId(url);
  if (!adId) throw new Error("That doesn't look like a Meta Ad Library link.");

  const win = new BrowserWindow({ show: false });
  try {
    win.webContents.setUserAgent(META_DESKTOP_USER_AGENT);
    await withTimeout(
      win.loadURL(`https://www.facebook.com/ads/library/?id=${encodeURIComponent(adId)}`),
      META_LOAD_URL_TIMEOUT_MS,
      META_LOAD_TIMEOUT_MESSAGE
    );

    let raw = null;
    for (let attempt = 0; attempt < META_RESOLVE_MAX_ATTEMPTS && !raw; attempt++) {
      try {
        raw = await withTimeout(
          win.webContents.executeJavaScript(FIND_AD_SNAPSHOT_SCRIPT),
          META_EXEC_JS_TIMEOUT_MS,
          "Timed out reading the Meta Ads Library page."
        );
      } catch {
        // Page mid-navigation (the challenge's own reload), or this attempt
        // timed out -- either way, retry on the next attempt.
      }
      if (!raw) await new Promise((r) => setTimeout(r, META_RESOLVE_POLL_MS));
    }

    if (!raw) {
      throw new Error("Could not load this ad. Meta may have changed their page, or this ad is unavailable.");
    }
    return raw;
  } finally {
    win.destroy();
  }
});

// --- Competitor Ad Research: native search + bookmarks --------------------
//
// Bookmarked ads, shown in Downscript's own "Bookmarked Ads" view -- same
// plain flat-JSON-file convention as LIBRARY_FILE above, for the same
// reasons (single-user desktop app, trivial read/parse size).
const BOOKMARKS_FILE = path.join(app.getPath("userData"), "bookmarks.json");

let bookmarkEntries = [];
try {
  bookmarkEntries = JSON.parse(fs.readFileSync(BOOKMARKS_FILE, "utf8"));
  if (!Array.isArray(bookmarkEntries)) bookmarkEntries = [];
} catch {
  bookmarkEntries = [];
}

function saveBookmarks() {
  try {
    fs.writeFileSync(BOOKMARKS_FILE, JSON.stringify(bookmarkEntries), "utf8");
  } catch (err) {
    console.error("Failed to persist bookmarks.json:", err);
  }
}

function broadcastBookmarksChanged() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("bookmarks:changed", bookmarkEntries);
  }
}

ipcMain.handle("bookmarks:list", () => bookmarkEntries);

ipcMain.handle("bookmarks:remove", (_event, adArchiveId) => {
  bookmarkEntries = bookmarkEntries.filter((b) => b.adArchiveId !== adArchiveId);
  saveBookmarks();
  broadcastBookmarksChanged();
  return bookmarkEntries;
});

// Called directly from the renderer's native ad cards (bookmarks:toggle
// below) -- the card data comes straight from this process's own
// meta:searchAds results, so every field here was already produced by this
// app, not typed in by the page. `url` is still
// checked the same way regardless, same isAllowedMetaLibraryUrl gate as
// every other Meta URL in this file.
const BOOKMARK_CARD_FIELDS = [
  "pageId",
  "pageName",
  "pageProfilePictureUrl",
  "isActive",
  "bodyText",
  "headline",
  "mediaType",
  "creativeKind",
  "thumbnailUrl",
  "videoUrl",
  "platforms",
  "startDateLabel",
];

function toggleBookmark(payload) {
  if (!payload || typeof payload.adArchiveId !== "string" || !payload.adArchiveId) {
    throw new Error("Invalid bookmark payload.");
  }
  if (typeof payload.url !== "string" || !isAllowedMetaLibraryUrl(payload.url)) {
    throw new Error("Invalid bookmark URL.");
  }
  const existingIndex = bookmarkEntries.findIndex((b) => b.adArchiveId === payload.adArchiveId);
  let bookmarked;
  if (existingIndex >= 0) {
    bookmarkEntries.splice(existingIndex, 1);
    bookmarked = false;
  } else {
    const entry = { adArchiveId: payload.adArchiveId, url: payload.url, savedAt: Date.now() };
    for (const field of BOOKMARK_CARD_FIELDS) {
      if (payload[field] !== undefined && payload[field] !== null) entry[field] = payload[field];
    }
    bookmarkEntries.unshift(entry);
    bookmarked = true;
  }
  saveBookmarks();
  broadcastBookmarksChanged();
  return bookmarked;
}

ipcMain.handle("bookmarks:toggle", (_event, payload) => toggleBookmark(payload));

// Meta's Ads Library is a public, no-login transparency tool -- the hidden
// windows below (meta:resolveAd, meta:searchAds) should never need to leave
// facebook.com's /ads/ path. Anything else is rejected before it's ever
// loaded.
function isAllowedMetaLibraryUrl(urlString) {
  try {
    const u = new URL(urlString);
    const hostOk = u.hostname === "www.facebook.com" || u.hostname === "facebook.com";
    return hostOk && u.pathname.startsWith("/ads/");
  } catch {
    return false;
  }
}

// Reuses the exact same hidden-BrowserWindow + data-sjs technique as
// meta:resolveAd above (a real, already-shipped Electron browsing context,
// not a scraping library) but applied to a search RESULTS page instead of
// one known ad, collecting every ad-archive-shaped node found instead of
// just the first. Only the "find candidate JSON blocks" part runs inside
// the hidden window -- shape validation/normalization happens back in
// TypeScript (parseSearchResults.ts), same division of responsibility as
// the single-ad path.
//
// Meta's data-sjs tags are a one-time SSR hydration payload -- confirmed via
// a live diagnostic capture earlier in this project (reconfirmed again:
// flat at the same count/script-tag total across 6+ scroll rounds) that
// they do NOT update as the page scrolls/paginates client-side, so this
// alone only ever returns the first batch Meta's server rendered (observed:
// roughly 10-30 results). Pagination beyond that first batch is handled
// separately below (meta:searchSession:start/more), which doesn't rely on
// data-sjs at all -- see that section's own comment for how.
const FIND_SEARCH_RESULTS_SCRIPT = `
  (function() {
    const scripts = Array.from(document.querySelectorAll('script[type="application/json"][data-sjs]'));
    const seen = new Set();
    const results = [];
    function walk(node, depth) {
      if (depth > 30 || node === null || typeof node !== 'object') return;
      if (!Array.isArray(node) && typeof node.ad_archive_id === 'string' && node.snapshot && typeof node.snapshot === 'object') {
        if (!seen.has(node.ad_archive_id)) {
          seen.add(node.ad_archive_id);
          results.push(node);
        }
      }
      const values = Array.isArray(node) ? node : Object.values(node);
      for (const v of values) walk(v, depth + 1);
    }
    for (const s of scripts) {
      if (!s.textContent || !s.textContent.includes("ad_archive_id")) continue;
      try {
        walk(JSON.parse(s.textContent), 0);
      } catch {
        // Not valid/relevant JSON -- skip this block.
      }
    }
    return results;
  })();
`;

ipcMain.handle("meta:searchAds", async (_event, url) => {
  if (typeof url !== "string" || !isAllowedMetaLibraryUrl(url)) {
    throw new Error("Unsupported Meta Ads Library URL.");
  }

  const win = new BrowserWindow({ show: false });
  try {
    win.webContents.setUserAgent(META_DESKTOP_USER_AGENT);
    await withTimeout(win.loadURL(url), META_LOAD_URL_TIMEOUT_MS, META_LOAD_TIMEOUT_MESSAGE);

    let raw = null;
    for (let attempt = 0; attempt < META_RESOLVE_MAX_ATTEMPTS && (!raw || raw.length === 0); attempt++) {
      try {
        raw = await withTimeout(
          win.webContents.executeJavaScript(FIND_SEARCH_RESULTS_SCRIPT),
          META_EXEC_JS_TIMEOUT_MS,
          "Timed out reading the Meta Ads Library page."
        );
      } catch {
        // Page mid-navigation (the challenge's own reload), or this attempt
        // timed out -- either way, retry on the next attempt.
      }
      if (!raw || raw.length === 0) await new Promise((r) => setTimeout(r, META_RESOLVE_POLL_MS));
    }

    // Genuinely zero results (or Meta's format changed) is a valid, real
    // outcome -- return an empty array rather than throwing, so the
    // renderer can show "no results" instead of a generic error.
    return raw || [];
  } finally {
    win.destroy();
  }
});

// --- Pagination beyond the first batch -------------------------------
//
// Two earlier attempts at this both tried to capture Meta's own network
// traffic via a CDP debugger session and both failed in real testing (see
// this file's git history) -- "target closed while handling command", and
// separately a session that captured zero new ads across repeated scroll
// rounds. This does neither: a live diagnostic capture confirmed that even
// though data-sjs stays frozen (see FIND_SEARCH_RESULTS_SCRIPT above), the
// actual rendered DOM keeps growing as the page is scrolled -- new ad cards
// are genuinely added, each showing its own "Library ID: <digits>" text
// (the same id data-sjs calls ad_archive_id). This scans for that text
// directly instead, with ordinary scroll + executeJavaScript calls -- the
// same mechanism already proven reliable everywhere else in this file, no
// debugger protocol involved at all.
//
// A "session" is a hidden BrowserWindow kept alive between "more" calls (so
// repeat scrolling continues from where the page already is), destroyed on
// explicit stop, app quit, or after sitting idle for a while.
const EXTRACT_VISIBLE_CARDS_SCRIPT = `
  (function() {
    // Walks up from a "Library ID:" text node to the ad card containing it
    // -- the first ancestor with an image or video descendant and a
    // plausible amount of text, the same "walk up a bounded number of
    // parents" approach already used elsewhere in this file for the
    // (now-removed) bookmark button injection, which this reuses because it
    // already proved reliable against this exact page.
    function findCard(textNode) {
      var node = textNode.parentElement;
      for (var i = 0; i < 12 && node; i++) {
        if ((node.querySelector('img') || node.querySelector('video')) && node.innerText && node.innerText.length > 80 && node.innerText.length < 4000) {
          return node;
        }
        node = node.parentElement;
      }
      return null;
    }

    // Everything here is read defensively -- a field this can't confidently
    // find is left undefined/null rather than guessed at, same as every
    // other extraction path in this app.
    function fieldsFromCard(card, id) {
      var text = card.innerText || '';
      var isActive;
      if (/(^|\\n)Inactive(\\n|$)/.test(text)) isActive = false;
      else if (/(^|\\n)Active(\\n|$)/.test(text)) isActive = true;

      var dateMatch = text.match(/Library ID:\\s*[0-9]+\\n([^\\n]+)/);
      var startDate = dateMatch ? dateMatch[1].trim() : null;

      var lines = text.split('\\n').map(function (l) { return l.trim(); }).filter(Boolean);
      var sponsoredIdx = lines.indexOf('Sponsored');
      var pageName = sponsoredIdx > 0 ? lines[sponsoredIdx - 1] : null;
      var bodyText = sponsoredIdx >= 0 && lines[sponsoredIdx + 1] ? lines[sponsoredIdx + 1] : null;

      var video = card.querySelector('video');
      var videoSrc = null;
      var posterSrc = null;
      if (video) {
        var source = video.querySelector('source');
        videoSrc = video.currentSrc || video.src || (source && source.src) || null;
        // Meta sets this directly on the element -- confirmed via a live
        // capture to be the real poster frame, never the advertiser's
        // small profile-picture avatar (see below).
        posterSrc = video.poster || null;
      }

      // The advertiser's own profile picture is ALSO an <img> inside this
      // same card (it's part of the card header, rendered before the
      // creative in DOM order) -- confirmed via a live capture to always be
      // exactly 60x60, identical across every ad from that advertiser. An
      // earlier version of this script took the first <img> found, which
      // was that avatar, not the ad's own creative -- explaining cards that
      // showed "a generic advertiser logo" instead of their real preview.
      // The real creative image (when the ad has one) is always larger, so
      // picking the single largest <img> above that known avatar size is
      // what actually tells them apart; if nothing bigger is found, there
      // genuinely isn't a creative image available this way, which is
      // reported as such (null) rather than silently falling back to the
      // avatar.
      var AVATAR_MAX_DIMENSION = 60;
      var creativeImgSrc = null;
      var creativeArea = 0;
      var imgs = card.querySelectorAll('img');
      for (var k = 0; k < imgs.length; k++) {
        var im = imgs[k];
        var rect = im.getBoundingClientRect();
        var w = im.naturalWidth || rect.width;
        var h = im.naturalHeight || rect.height;
        if (w <= AVATAR_MAX_DIMENSION && h <= AVATAR_MAX_DIMENSION) continue;
        var area = w * h;
        if (area > creativeArea) {
          creativeArea = area;
          creativeImgSrc = im.src;
        }
      }

      return {
        ad_archive_id: id,
        is_active: typeof isActive === 'boolean' ? isActive : null,
        start_date_formatted: startDate,
        snapshot: {
          page_name: pageName,
          body: bodyText ? { text: bodyText } : null,
          display_format: videoSrc ? 'VIDEO' : (creativeImgSrc ? 'IMAGE' : null),
          video_hd_url: videoSrc,
          video_preview_image_url: videoSrc ? (posterSrc || creativeImgSrc) : null,
          original_image_url: videoSrc ? null : creativeImgSrc,
        },
      };
    }

    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    var seen = {};
    var results = [];
    var n;
    while ((n = walker.nextNode())) {
      if (!n.textContent || n.textContent.indexOf('Library ID:') === -1) continue;
      var m = n.textContent.match(/Library ID:\\s*([0-9]+)/);
      if (!m || seen[m[1]]) continue;
      seen[m[1]] = true;
      var card = findCard(n);
      if (!card) continue;
      results.push(fieldsFromCard(card, m[1]));
    }
    return results;
  })();
`;

const SEARCH_SESSION_SCROLL_WAIT_MS = 3500; // time for newly-scrolled-in cards to actually render
const SEARCH_SESSION_IDLE_TIMEOUT_MS = 10 * 60 * 1000; // destroy a session nobody's touched in 10 minutes

const activeSearchSessions = new Map(); // sessionId -> { win, seenIds, idleTimer }

function destroySessionRecord(rec) {
  clearTimeout(rec.idleTimer);
  try {
    if (!rec.win.isDestroyed()) rec.win.destroy();
  } catch {
    // Already gone.
  }
}

function destroySearchSession(sessionId) {
  const rec = activeSearchSessions.get(sessionId);
  if (!rec) return;
  activeSearchSessions.delete(sessionId);
  destroySessionRecord(rec);
}

function armIdleTimer(rec, sessionId) {
  clearTimeout(rec.idleTimer);
  rec.idleTimer = setTimeout(() => destroySearchSession(sessionId), SEARCH_SESSION_IDLE_TIMEOUT_MS);
}

ipcMain.handle("meta:searchSession:start", async (_event, url) => {
  if (typeof url !== "string" || !isAllowedMetaLibraryUrl(url)) {
    throw new Error("Unsupported Meta Ads Library URL.");
  }
  const sessionId = crypto.randomUUID();
  const win = new BrowserWindow({ show: false });
  const rec = { win, seenIds: new Set(), idleTimer: null };
  try {
    win.webContents.setUserAgent(META_DESKTOP_USER_AGENT);
    await withTimeout(win.loadURL(url), META_LOAD_URL_TIMEOUT_MS, META_LOAD_TIMEOUT_MESSAGE);
    // The first screenful needs a moment to actually paint before the first
    // "more" call scrolls past it -- otherwise the first scroll can outrun
    // Meta's own initial render.
    await new Promise((r) => setTimeout(r, 2000));
    activeSearchSessions.set(sessionId, rec);
    armIdleTimer(rec, sessionId);
    return { sessionId };
  } catch (err) {
    destroySessionRecord(rec);
    throw err;
  }
});

ipcMain.handle("meta:searchSession:more", async (_event, sessionId) => {
  const rec = activeSearchSessions.get(sessionId);
  if (!rec) throw new Error("This search session has expired. Please search again.");
  armIdleTimer(rec, sessionId);

  try {
    await withTimeout(
      rec.win.webContents.executeJavaScript(
        "window.scrollTo(0, document.body.scrollHeight); document.dispatchEvent(new Event('scroll'));"
      ),
      META_EXEC_JS_TIMEOUT_MS,
      "Timed out scrolling the Meta Ads Library page."
    );
  } catch (err) {
    appendLog(`meta searchSession scroll failed: ${err}\n`);
  }

  await new Promise((r) => setTimeout(r, SEARCH_SESSION_SCROLL_WAIT_MS));

  let found = [];
  try {
    found =
      (await withTimeout(
        rec.win.webContents.executeJavaScript(EXTRACT_VISIBLE_CARDS_SCRIPT),
        META_EXEC_JS_TIMEOUT_MS,
        "Timed out reading the Meta Ads Library page."
      )) || [];
  } catch (err) {
    appendLog(`meta searchSession extract failed: ${err}\n`);
  }

  const newAds = [];
  for (const node of found) {
    if (node && typeof node.ad_archive_id === "string" && !rec.seenIds.has(node.ad_archive_id)) {
      rec.seenIds.add(node.ad_archive_id);
      newAds.push(node);
    }
  }
  // One compact line per newly found ad -- its id and which kind of media
  // (if any) extraction found for it, never the actual media URL (those
  // carry Meta CDN auth tokens in the query string).
  for (const ad of newAds) {
    const snapshot = ad.snapshot || {};
    const mediaType = snapshot.video_hd_url ? "video" : snapshot.original_image_url ? "image" : "none";
    appendLog(`meta searchSession ad=${ad.ad_archive_id} media=${mediaType}\n`);
  }
  return { ads: newAds };
});

ipcMain.handle("meta:searchSession:stop", (_event, sessionId) => {
  destroySearchSession(sessionId);
});

// The one Library registration path that has no explicit caller: the main
// Transcript module's Export DOCX/TXT/SRT buttons trigger a plain browser-
// style Blob download (app/lib/export.ts's triggerDownload), which Electron
// resolves via a native Save dialog whose final path the renderer never
// learns -- deliberately left that way (ExportMenu.tsx is intentionally
// unchanged from an earlier phase). This passively catches the outcome
// instead, without touching that flow at all. Registered once -- `launch()`
// can run again on macOS's "activate" after all windows close, and
// session.defaultSession's listeners would otherwise stack across that.
let downloadCaptureRegistered = false;
function registerDownloadCapture() {
  if (downloadCaptureRegistered) return;
  downloadCaptureRegistered = true;

  session.defaultSession.on("will-download", (_event, item) => {
    const ext = path.extname(item.getFilename()).slice(1).toLowerCase();
    // Not a file type this app produces -- leave Electron's normal download
    // behavior alone, just don't pollute the library with unrelated saves.
    if (!(ext in EXTENSION_KIND)) return;

    item.once("done", (_e, state) => {
      if (state !== "completed") return;
      const savedPath = item.getSavePath();
      const base = path.basename(savedPath, path.extname(savedPath));
      upsertLibraryEntry({
        id: `export-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        filePath: savedPath,
        fileName: path.basename(savedPath),
        title: base,
        sourceModule: "transcript-export",
        kind: kindForExtension(ext),
        ext,
        status: "completed",
      });
    });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 720,
    minHeight: 560,
    title: "Downcript",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Keep external links (e.g. a target="_blank" from the web UI) out of the
  // app window and in the user's real browser instead.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  return mainWindow;
}

async function launch() {
  const win = createWindow();
  registerDownloadCapture();

  if (DEV_START_URL) {
    win.loadURL(DEV_START_URL);
    return;
  }

  try {
    const url = await startLocalServer();
    win.loadURL(url);
  } catch (err) {
    console.error(err);
    appendLog(`Local server failed to start: ${err.stack || err.message}\n`);
    dialog.showErrorBox(
      "Downcript couldn't start",
      "The app's local processing server failed to start, so it can't load. " +
        `Please restart the app. If this keeps happening, check the app logs at:\n${LOG_FILE}`
    );
    app.quit();
  }
}

// Two launches racing to spawn their own local server (and, for Meta/download
// jobs, write into the same output folder) is a real risk once this app
// covers more surface area than either source app did alone -- neither
// source app guarded against it. If a second instance starts, hand off to
// the first one's window instead of spawning a second server.
const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    launch();
    // Runs exactly once regardless of how many times launch() itself
    // re-runs (macOS can call it again via "activate" after all windows
    // close) -- getMainWindow is a lazy getter so a later-recreated window
    // still receives update broadcasts correctly, not a stale reference to
    // the first one.
    setupAutoUpdater({ getMainWindow: () => mainWindow, appendLog });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) launch();
  });
}

function cleanupBeforeQuit() {
  stopLocalServer();
  stopActiveTools();
  for (const sessionId of Array.from(activeSearchSessions.keys())) destroySearchSession(sessionId);
}

app.on("before-quit", cleanupBeforeQuit);
app.on("will-quit", cleanupBeforeQuit);
