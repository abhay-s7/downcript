const { app, BrowserWindow, shell, dialog, ipcMain } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const net = require("node:net");
const { spawn } = require("node:child_process");

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
    await win.loadURL(`https://www.facebook.com/ads/library/?id=${encodeURIComponent(adId)}`);

    let raw = null;
    for (let attempt = 0; attempt < META_RESOLVE_MAX_ATTEMPTS && !raw; attempt++) {
      try {
        raw = await win.webContents.executeJavaScript(FIND_AD_SNAPSHOT_SCRIPT);
      } catch {
        // Page mid-navigation (the challenge's own reload) -- retry.
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

  app.whenReady().then(launch);

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
}

app.on("before-quit", cleanupBeforeQuit);
app.on("will-quit", cleanupBeforeQuit);
