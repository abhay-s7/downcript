// CI-only: mirrors ci-mac-update-test.mjs for Windows -- drives a real,
// already-installed build through the actual electron-updater detect ->
// download -> quitAndInstall (NSISUpdater) cycle against a real published
// GitHub Release, then confirms the relaunched app is the new version and
// that userData (Media Library, etc.) survived.
import { _electron as electron } from "playwright";

const [, , appPath, expectedNewVersion] = process.argv;
if (!appPath || !expectedNewVersion) {
  console.error("Usage: node scripts/ci-windows-update-test.mjs <path-to-installed.exe> <expected-new-version>");
  process.exit(1);
}

function log(step, detail) {
  console.log(`[update-test] ${step}${detail !== undefined ? ": " + JSON.stringify(detail) : ""}`);
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

async function launchAndGetFooter() {
  const app = await electron.launch({ executablePath: appPath, args: ["--disable-gpu"], timeout: 60_000 });
  const window = await app.firstWindow();
  await window.waitForLoadState("domcontentloaded");
  return { app, window };
}

async function main() {
  log("launching installed app", appPath);
  const { app, window } = await launchAndGetFooter();

  try {
    const beforeFooter = await window.evaluate(() => document.querySelector("footer")?.textContent ?? "");
    log("before-update footer text", beforeFooter);

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
      throw new Error(`Expected an update to be available, got: ${JSON.stringify(availableState)}`);
    }
    if (availableState.version !== expectedNewVersion) {
      throw new Error(`Update available, but version is ${availableState.version}, expected ${expectedNewVersion}`);
    }

    log("calling updater.downloadUpdate() -- downloading real installer over the network...");
    await window.evaluate(() => window.desktop.updater.downloadUpdate());

    const downloadedState = await waitForState(window, (s) => s.status === "downloaded", 5 * 60_000, "download completion");
    log("download completed", downloadedState);

    log("calling updater.quitAndInstall() -- NSISUpdater will run the new installer silently and relaunch...");
    window.evaluate(() => window.desktop.updater.quitAndInstall()).catch(() => {});
    await sleep(3000);
    await app.close().catch(() => {});
  } catch (err) {
    await app.close().catch(() => {});
    throw err;
  }

  log("waiting for NSISUpdater to finish applying the update and relaunching...");
  await sleep(20_000);

  log("relaunching (or confirming the auto-relaunched) app to check version and userData...");
  const { app: app2, window: window2 } = await launchAndGetFooter();
  try {
    const footerText = await window2.evaluate(() => document.querySelector("footer")?.textContent ?? "");
    log("footer text after update", footerText);
    if (!footerText.includes(expectedNewVersion)) {
      throw new Error(`App's UI does not show ${expectedNewVersion} after the update cycle: "${footerText}"`);
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
    `SUCCESS: real end-to-end update cycle verified -- old version detected, downloaded, and applied ${expectedNewVersion} ` +
      "via electron-updater/NSISUpdater against the real published GitHub Release, with user data intact."
  );
}

main().catch((err) => {
  console.error("[update-test] FAILED:", err);
  process.exit(1);
});
