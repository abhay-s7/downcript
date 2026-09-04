# Releasing Downcript

How to ship a new Windows version so existing users get it automatically,
without needing to understand the rest of the build system.

## The short version

```
edit package.json "version"  →  commit  →  push to main  →  wait for the
Windows Desktop Build workflow to pass  →  git tag vX.Y.Z  →  git push
origin vX.Y.Z  →  Release Windows Build workflow builds + publishes  →
existing installs pick it up within ~4 hours (or on next launch)
```

That's it end to end. The rest of this document explains each step, what's
actually happening, and what to do when something goes wrong.

## 1. Bump the version

Edit **`package.json`**, field `"version"`. Use plain [semantic
versioning](https://semver.org/) — `1.0.0`, `1.0.1`, `1.1.0`, `2.0.0`:

- Bug fix only → bump the last number (`1.0.0` → `1.0.1`).
- New feature, backwards-compatible → bump the middle number (`1.0.1` →
  `1.1.0`).
- Breaking change → bump the first number.

This is the **one and only** source of truth for the app's version —
`app.getVersion()` in Electron reads it straight from here, and it's what
electron-updater compares against the newest GitHub Release to decide if an
update exists. Nothing else needs editing.

## 2. Commit and push to `main`

```bash
git add package.json
git commit -m "Bump version to 1.0.1"
git push origin main   # or via your normal PR/merge flow
```

Pushing to `main` triggers the **existing** `Windows Desktop Build`
workflow (`.github/workflows/windows-build.yml`) — it builds a real Windows
installer, installs it silently on a Windows runner, and runs the actual
transcription/yt-dlp smoke tests. **Wait for this to go green before
tagging.** It doesn't publish anything anywhere; it's just your "is this
commit actually good" check, unchanged from before this feature existed.

## 3. Tag the release

Once that workflow is green, tag the *same commit* you just pushed:

```bash
git tag v1.0.1
git push origin v1.0.1
```

The `v` prefix is required — electron-updater/electron-builder's default
convention matches release tags as `v<version>`.

## 4. GitHub Actions builds and publishes automatically

Pushing that tag triggers **`Release Windows Build`**
(`.github/workflows/release.yml`), which:

1. Checks the tag's version actually matches `package.json` (fails loudly
   if you forgot step 1).
2. Refuses to run if a Release for that tag already exists (won't ever
   silently overwrite a published version).
3. Builds the Windows installer on a real Windows runner — the same
   PyInstaller-frozen Python/Whisper/FFmpeg/yt-dlp bundling
   `windows-build.yml` already does, unchanged.
4. Publishes straight to a GitHub Release for that tag: the installer
   `.exe`, its `.blockmap` (enables differential/delta updates), and
   `latest.yml` (the metadata file electron-updater actually polls for).

You can watch it under the repo's **Actions** tab. When it finishes, check
**Releases** — you should see `v1.0.1` with three files attached: the
`.exe`, a `.blockmap`, and `latest.yml`.

## 5. Existing users receive the update

Every installed copy of Downcript checks for updates ~10 seconds after
launch, and again every 4 hours while it stays open (see
`electron/autoUpdater.js`). When it finds a newer GitHub Release:

1. A banner appears: *"New version available — v1.0.1"* with **Update
   Now** / **Later**.
2. Clicking **Update Now** downloads it in the background — the app stays
   fully usable, downloads/transcriptions keep running.
3. Once downloaded: *"Update ready"* with **Restart & Install** / **Later**.
   If anything is still actively downloading or transcribing, it says so
   and asks for confirmation before restarting anyway.
4. **Restart & Install** quits the app, NSIS silently reinstalls in place,
   and the app relaunches on the new version.

Nothing installs or restarts without the user explicitly clicking
**Restart & Install**.

## Rollback

If a published release turns out to be broken:

- **Caught quickly, before most users have updated**: delete the bad
  release (`gh release delete v1.0.1 --yes` or via the GitHub UI, including
  its tag). electron-updater will then see the previous release as
  "latest" again, and nobody still on the old version gets offered the bad
  one. Anyone who *already* installed it needs a real fix released as the
  next version — you can't un-install something that already ran.
- **Already widely distributed**: don't delete it — publish a new patch
  version (e.g. `v1.0.2`) with the fix, immediately. Deleting a release
  people already updated to just removes the record of what they're
  running; it doesn't roll their installed app back.

There is no automatic "downgrade" mechanism — electron-updater only ever
offers to move forward to a newer version.

## Troubleshooting a failed release run

- **"Tag does not match package.json version"** — you tagged before
  bumping the version, or tagged the wrong commit. Delete the tag
  (`git push origin :vX.Y.Z && git tag -d vX.Y.Z`), fix `package.json`,
  push, and re-tag.
- **"A GitHub Release for vX.Y.Z already exists"** — you're re-running a
  tag that already published. Bump to the next version and tag again;
  don't force-push over an existing release.
- **PyInstaller/native-binary steps fail** — this always runs on a real
  `windows-latest` runner (never cross-compiled from macOS/Linux), same as
  `windows-build.yml`. If it fails here but `windows-build.yml` passed on
  the same commit, compare the two workflow logs — they run near-identical
  build steps, so a difference points at something specific to the release
  workflow itself (usually the publish/token step, not the build).
- **electron-builder publish step fails with an auth error** — `GH_TOKEN`
  comes from the workflow's own `secrets.GITHUB_TOKEN`, which needs
  `permissions: contents: write` (already set in `release.yml`) to create
  Releases in this repo. If this ever fails with a permissions error, check
  the repo's Settings → Actions → General → Workflow permissions hasn't
  been locked to read-only at the org/repo level.
- **The app never shows "Update available"** — confirm you're testing a
  *packaged* build, not `npm run electron:dev` (auto-update is intentionally
  disabled entirely in dev — see `electron/autoUpdater.js`). Also confirm
  the installed version is genuinely older than the published release's
  tag.

## First release (v1.0.0)

Since no release has been published for this repository yet:

1. Confirm `package.json`'s version is `1.0.0` (already set as part of
   shipping this feature).
2. Push `main`, wait for `Windows Desktop Build` to pass.
3. `git tag v1.0.0 && git push origin v1.0.0`.
4. Confirm the Release Windows Build workflow publishes `v1.0.0` with an
   `.exe`, `.blockmap`, and `latest.yml`.
5. Install that `.exe` on a real Windows machine (a clean one, ideally, to
   also confirm the zero-setup bundling still holds) and confirm the app
   launches and its features work.
6. Later, to test the *update* path specifically: make a small, visible
   change, bump to `1.0.1`, repeat steps 2–4, then relaunch the still-
   installed `v1.0.0` app and confirm the update banner appears, downloads,
   and installs correctly.

## What this does NOT do (be aware)

- **macOS auto-update is not enabled.** The `publish` config in
  `package.json` is shared by both platforms structurally, but macOS
  builds are ad-hoc signed (not a real Developer ID) and not notarized —
  Squirrel.Mac refuses to apply an update payload that isn't properly
  signed and notarized, regardless of this feature. See
  `docs/AUTO_UPDATE_HANDOFF.md` for what a real mac auto-update would
  additionally require.
- **The Windows build is unsigned.** No Authenticode certificate exists for
  this project. The installer works and updates work, but Windows
  SmartScreen will show an "unknown publisher" warning on first install of
  every version (this is unrelated to auto-update itself — it would show
  the same way even without this feature). See the main `README.md`'s
  Known Limitations for what adding real code signing would take.
- **No portable/no-installer build exists.** Only the NSIS installer
  target is configured for Windows; auto-update specifically relies on
  NSIS's differential-update support, so a portable build (if one is added
  later) would need its own update mechanism or to be documented as
  manual-update-only.
