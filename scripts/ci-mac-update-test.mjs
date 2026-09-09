// CI-only: drives a real, already-installed macOS build through the actual
// electron-updater detect -> download -> quitAndInstall cycle against a real
// published GitHub Release, then confirms the relaunched app is the new
// version and that userData (Media Library, etc.) survived. This is the one
// part of the update system that a plain build/package verification can't
// prove -- it has to actually happen against real HTTP traffic to
// github.com's release-asset CDN, which is why this runs in CI (a sandboxed
// dev machine's network may not be able to reach that CDN at all).
import { _electron as electron } from "playwright";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const [, , appPath, expectedNewVersion] = process.argv;
if (!appPath || !expectedNewVersion) {
  console.error("Usage: node scripts/ci-mac-update-test.mjs <path-to-installed.app> <expected-new-version>");
  process.exit(1);
}

function log(step, detail) {
  console.log(`[update-test] ${step}${detail !== undefined ? ": " + JSON.stringify(detail) : ""}`);
}

function bundleVersion(bundlePath) {
  const out = execFileSync("defaults", ["read", `${bundlePath}/Contents/Info`, "CFBundleShortVersionString"], {
    encoding: "utf8",
  });
  return out.trim();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForState(window, predicate, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    last = await window.evaluate(() => window.__lastUpdaterState ?? null);
    if (last && predicate(last)) return last;
    if (last?.status === "error") throw new Error(`updater entered error state while waiting for ${label}: ${JSON.stringify(last)}`);
    await sleep(1000);
  }
  throw new Error(`Timed out waiting for ${label}. Last state: ${JSON.stringify(last)}`);
}

async function main() {
  log("before-update bundle version (Info.plist)", bundleVersion(appPath));
  const exePath = `${appPath}/Contents/MacOS/Downcript`;

  log("launching installed v1.0.1 app", exePath);
  const app = await electron.launch({ executablePath: exePath, args: ["--disable-gpu"], timeout: 60_000 });

  try {
    const window = await app.firstWindow();
    await window.waitForLoadState("domcontentloaded");

    // Capture every updater:state broadcast onto a plain global instead of
    // relying on a live IPC round-trip per poll -- window.desktop.updater.onState
    // is a one-way push from main, so this just mirrors the latest one where
    // waitForState above can read it back with window.evaluate.
    await window.evaluate(() => {
      window.__lastUpdaterState = null;
      window.desktop.updater.onState((state) => {
        window.__lastUpdaterState = state;
      });
    });

    log("seeding a Media Library entry to verify it survives the update...");
    const seeded = await window.evaluate(() =>
      window.desktop.library.upsert({
        id: "update-test-marker",
        filePath: null,
        fileName: "update-test-marker.txt",
        title: "update-cycle-test-marker",
        sourceModule: "scan",
        kind: "other",
        ext: "txt",
        status: "completed",
      })
    );
    log("seeded library entry", seeded?.id);

    log("calling updater.checkNow()...");
    await window.evaluate(() => window.desktop.updater.checkNow());

    const availableState = await waitForState(window, (s) => s.status === "available" || s.status === "not-available", 30_000, "check result");
    log("check result", availableState);
    if (availableState.status !== "available") {
      throw new Error(`Expected an update to be available (this app is 1.0.1, release should be ${expectedNewVersion}), got: ${JSON.stringify(availableState)}`);
    }
    if (availableState.version !== expectedNewVersion) {
      throw new Error(`Update available, but version is ${availableState.version}, expected ${expectedNewVersion}`);
    }

    log("calling updater.downloadUpdate() -- downloading real update.zip over the network...");
    await window.evaluate(() => window.desktop.updater.downloadUpdate());

    const downloadedState = await waitForState(window, (s) => s.status === "downloaded", 5 * 60_000, "download completion");
    log("download completed", downloadedState);

    log("calling updater.quitAndInstall() -- this will quit the app; Squirrel.Mac applies the update natively...");
    // Fire-and-forget: the app process is about to exit as a direct result
    // of this call, so awaiting the IPC round-trip's response would race the
    // quit itself.
    window.evaluate(() => window.desktop.updater.quitAndInstall()).catch(() => {});

    await sleep(3000);
    await app.close().catch(() => {});
  } catch (err) {
    await app.close().catch(() => {});
    throw err;
  }

  log("waiting for Squirrel.Mac to finish applying the update on disk...");
  const deadline = Date.now() + 90_000;
  let finalVersion = null;
  while (Date.now() < deadline) {
    await sleep(3000);
    if (!existsSync(`${appPath}/Contents/Info.plist`)) continue;
    try {
      finalVersion = bundleVersion(appPath);
    } catch {
      continue; // Bundle mid-swap -- Info.plist momentarily unreadable.
    }
    if (finalVersion === expectedNewVersion) break;
  }

  log("final bundle version on disk", finalVersion);
  if (finalVersion !== expectedNewVersion) {
    throw new Error(
      `Squirrel.Mac did not apply the update -- expected CFBundleShortVersionString ${expectedNewVersion}, ` +
        `found ${finalVersion}. This is the real, actionable signal for whether ad-hoc (unsigned) code signing ` +
        `blocks macOS auto-update in practice.`
    );
  }

  log("relaunching the updated app to confirm it actually runs and userData survived...");
  const app2 = await electron.launch({ executablePath: exePath, args: ["--disable-gpu"], timeout: 60_000 });
  try {
    const window2 = await app2.firstWindow();
    await window2.waitForLoadState("domcontentloaded");
    const footerText = await window2.evaluate(() => document.querySelector("footer")?.textContent ?? "");
    log("footer text after relaunch", footerText);
    if (!footerText.includes(expectedNewVersion)) {
      throw new Error(`Relaunched app's UI does not show ${expectedNewVersion}: "${footerText}"`);
    }
    const library = await window2.evaluate(() => window.desktop.library.list());
    const marker = library.find((e) => e.id === "update-test-marker");
    if (!marker) {
      throw new Error("Media Library marker entry seeded before the update is missing after it -- userData was lost.");
    }
    log("SUCCESS: user data (Media Library) survived the update, marker entry", marker);
  } finally {
    await app2.close().catch(() => {});
  }

  log(
    `SUCCESS: real end-to-end update cycle verified -- v1.0.1 detected, downloaded, and applied ${expectedNewVersion} ` +
      "via electron-updater/Squirrel.Mac against the real published GitHub Release, with user data intact."
  );
}

main().catch((err) => {
  console.error("[update-test] FAILED:", err);
  process.exit(1);
});
