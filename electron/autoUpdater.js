// Wraps electron-updater so main.js doesn't have to grow further -- this
// module owns the entire main-process side of auto-update: scheduling
// checks, wiring autoUpdater's events to a renderer broadcast, and the IPC
// handlers the renderer calls to actually download/install. The renderer
// only ever sees the small "updater" surface exposed via preload.js -- it
// never gets autoUpdater or any other Electron internals directly.
const { app, ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");

// A first check shortly after launch (not instantly -- let the window
// finish loading first), then periodically while the app stays open.
// Not aggressive: this is a personal desktop tool, not something that
// needs to notice a new release within seconds of it going out.
const STARTUP_CHECK_DELAY_MS = 10_000;
const PERIODIC_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours

// Called once from main.js after app.whenReady(). `getMainWindow` is a
// lazy getter (not the window itself) since the window can be recreated
// later (macOS "activate" after all windows close) -- always broadcasting
// to whichever window currently exists, not a stale reference to the first
// one.
function setupAutoUpdater({ getMainWindow, appendLog }) {
  // electron-updater looks for app-update.yml, a build-time file
  // electron-builder only generates for a real packaged build (from the
  // package.json "publish" config) -- calling this in dev would either
  // throw or, worse, actually point at production GitHub releases, which a
  // dev build must never do (see README's dev-vs-production note).
  if (!app.isPackaged) {
    ipcMain.handle("updater:checkNow", () => Promise.resolve());
    ipcMain.handle("updater:downloadUpdate", () => Promise.resolve());
    ipcMain.handle("updater:quitAndInstall", () => Promise.resolve());
    return;
  }

  // Explicit, matching the exact UX flow this app's update banner expects:
  // checking is automatic/silent, but the actual download only starts when
  // the user clicks "Update Now", and installing only happens on an
  // explicit "Restart & Install" -- never a surprise on a normal quit.
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.logger = {
    info: (msg) => appendLog(`[updater] ${msg}\n`),
    warn: (msg) => appendLog(`[updater] WARN ${msg}\n`),
    error: (msg) => appendLog(`[updater] ERROR ${msg}\n`),
  };

  function broadcast(state) {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) win.webContents.send("updater:state", state);
  }

  autoUpdater.on("checking-for-update", () => broadcast({ status: "checking" }));

  autoUpdater.on("update-available", (info) =>
    broadcast({
      status: "available",
      version: info.version,
      releaseNotes: typeof info.releaseNotes === "string" ? info.releaseNotes : undefined,
    })
  );

  autoUpdater.on("update-not-available", () => broadcast({ status: "not-available" }));

  autoUpdater.on("download-progress", (progress) =>
    broadcast({
      status: "downloading",
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
    })
  );

  autoUpdater.on("update-downloaded", (info) => broadcast({ status: "downloaded", version: info.version }));

  autoUpdater.on("error", (err) => {
    const message = err && err.message ? err.message : String(err);
    appendLog(`[updater] error: ${err && err.stack ? err.stack : message}\n`);
    // Covers every failure mode listed in the brief with one path: no
    // internet, GitHub unreachable, a corrupt/interrupted download,
    // insufficient disk space, permission errors -- electron-updater
    // surfaces all of these as a plain Error here. The existing installed
    // app is never touched by a failed check/download; it only ever
    // replaces itself once quitAndInstall() is explicitly called after a
    // successful download.
    broadcast({ status: "error", error: message });
  });

  function checkForUpdatesManually() {
    return autoUpdater.checkForUpdates().catch((err) => {
      appendLog(`[updater] checkForUpdates failed: ${err && err.stack ? err.stack : err}\n`);
    });
  }

  setTimeout(checkForUpdatesManually, STARTUP_CHECK_DELAY_MS);
  setInterval(checkForUpdatesManually, PERIODIC_CHECK_INTERVAL_MS);

  ipcMain.handle("updater:checkNow", () => checkForUpdatesManually());
  ipcMain.handle("updater:downloadUpdate", () => autoUpdater.downloadUpdate());
  ipcMain.handle("updater:quitAndInstall", () => {
    // Renderer decides whether to warn the user about active jobs first
    // (it has the queue visibility to do that; this process doesn't) --
    // by the time this is called, that confirmation has already happened.
    //
    // electron-updater's quitAndInstall(isSilent, isForceRunAfter) defaults
    // BOTH args to false -- confirmed via a real end-to-end CI test, where
    // omitting them launched the Windows NSIS installer in full wizard mode
    // instead of the silent "Restart & Install" this UI promises, leaving it
    // sitting on a screen nobody is there to click through. isSilent=true
    // matches the intended UX; isForceRunAfter=true keeps the existing
    // auto-relaunch behavior.
    autoUpdater.quitAndInstall(true, true);
  });
}

module.exports = { setupAutoUpdater };
