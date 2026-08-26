// electron-builder's own extraResources copying runs through the same
// @electron/rebuild step it uses for the app's own dependencies, which
// strips out any node_modules/ it doesn't recognize as a declared
// dependency -- including the entire self-contained node_modules inside
// .next/standalone (this cost a full node_modules/next, react, etc. on the
// first packaged build). Copying it here, after that step has already run,
// sidesteps it entirely with a plain filesystem copy.
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

// fs.cpSync's `dereference` option only resolves src itself if src is a
// symlink -- it does NOT dereference symlinks found while recursively
// copying a directory's contents (confirmed: Next's standalone output still
// had a real symlink after cpSync(..., {dereference: true})). This walks
// the already-copied tree and replaces any surviving symlink with a real
// copy of what it points to.
function resolveSymlinksInPlace(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      const real = fs.realpathSync(full);
      const isDir = fs.statSync(real).isDirectory();
      fs.rmSync(full, { recursive: true, force: true });
      fs.cpSync(real, full, { recursive: true, dereference: true });
      if (isDir) resolveSymlinksInPlace(full);
    } else if (entry.isDirectory()) {
      resolveSymlinksInPlace(full);
    }
  }
}

exports.default = async function (context) {
  const { appOutDir, electronPlatformName } = context;
  const isMac = electronPlatformName === "darwin";

  let resourcesDir;
  let appPath = null;
  if (isMac) {
    const appBundle = fs.readdirSync(appOutDir).find((f) => f.endsWith(".app"));
    if (!appBundle) throw new Error(`after-pack: no .app bundle found in ${appOutDir}`);
    appPath = path.join(appOutDir, appBundle);
    resourcesDir = path.join(appPath, "Contents", "Resources");
  } else {
    // Windows/Linux unpacked layout: <appOutDir>/resources/, no bundle wrapper.
    resourcesDir = path.join(appOutDir, "resources");
  }

  const src = path.join(__dirname, "..", ".next", "standalone");
  const dest = path.join(resourcesDir, "app-server");

  fs.rmSync(dest, { recursive: true, force: true });
  // dereference: Next's standalone output includes internal symlinks (e.g.
  // .next/node_modules/ffmpeg-static-<hash> -> ../../node_modules/ffmpeg-static)
  // for its own module resolution. codesign refuses to seal a bundle
  // containing them ("invalid destination for symbolic link in bundle"), so
  // these are copied as real files instead of preserved as symlinks.
  fs.cpSync(src, dest, { recursive: true, dereference: true });
  resolveSymlinksInPlace(dest);
  console.log(`[after-pack] copied .next/standalone -> ${dest}`);

  if (!isMac) return;

  // electron-builder is configured with identity: null (no paid Apple
  // Developer ID available), so nothing re-seals the bundle after its
  // contents are customized (icon, Info.plist, these extra resources).
  // Electron's own prebuilt binaries still carry the ad-hoc signature they
  // shipped with, computed for stock Electron's file set -- once that no
  // longer matches what's actually on disk, Gatekeeper/LaunchServices
  // refuses to launch it at all with "code has no resources but signature
  // indicates they must be present" (a plain `open` or double-click hits
  // this; direct exec of the binary bypasses the check and misleadingly
  // still "works", which is how this stayed hidden through every earlier
  // dev-mode test). A fresh ad-hoc signature over the final, complete
  // bundle is required, even though it still won't satisfy a *stricter*
  // Gatekeeper check on another machine without notarization.
  execFileSync("codesign", ["--force", "--deep", "--sign", "-", appPath]);
  console.log(`[after-pack] re-signed (ad-hoc) ${appPath}`);
};
