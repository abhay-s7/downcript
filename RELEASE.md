# Releasing Downcript

How to ship a new Windows **and macOS** version so existing users get it
automatically, without needing to understand the rest of the build system.

**This repository must stay public.** electron-updater's default GitHub
provider makes an unauthenticated request to `/releases.atom` before
anything else, on both platforms — a private repo 404s that for every
user, permanently (confirmed for real, not theoretical). If this repo is
ever made private again, auto-update breaks entirely until either it's
made public again or the app is switched to `PrivateGitHubProvider` with a
token baked into every build (a real, ongoing maintenance burden, not a
one-line config change).

## The short version

```
edit package.json "version"  →  commit  →  push to main  →  wait for both
Windows Desktop Build AND macOS Desktop Build to pass  →  git tag vX.Y.Z
→  git push origin vX.Y.Z  →  Release Build workflow builds + publishes
both platforms  →  check for the split-release bug (see below, expect it
every time) →  existing installs pick it up within ~4 hours (or on next
launch) — Windows fully, macOS detection/download only (see "macOS
auto-update" below)
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

Pushing to `main` triggers **both** `Windows Desktop Build`
(`.github/workflows/windows-build.yml`) and `macOS Desktop Build`
(`.github/workflows/mac-build.yml`) — each builds a real installer for its
platform, installs it (silently on Windows; the packaged `.app` directly on
mac), and runs the actual transcription/yt-dlp smoke tests. **Wait for both
to go green before tagging.** Neither publishes anything anywhere; they're
your "is this commit actually good" check for each platform.

## 3. Tag the release

Once that workflow is green, tag the *same commit* you just pushed:

```bash
git tag v1.0.1
git push origin v1.0.1
```

The `v` prefix is required — electron-updater/electron-builder's default
convention matches release tags as `v<version>`.

## 4. GitHub Actions builds and publishes automatically

Pushing that tag triggers **`Release Build`** (`.github/workflows/release.yml`),
which runs two jobs, `release-windows` then `release-mac` (deliberately
sequential — see "The split-release bug" below for why), each of which:

1. Checks the tag's version actually matches `package.json` (fails loudly
   if you forgot step 1).
2. Builds the installer on a real runner for that platform — the same
   PyInstaller-frozen Python/Whisper/FFmpeg/yt-dlp bundling
   `windows-build.yml`/`mac-build.yml` already do, unchanged.
3. Publishes straight to a GitHub Release for that tag.

You can watch it under the repo's **Actions** tab. When it finishes, check
**Releases** — for `v1.0.1` you should see **eight** files attached:
`Downcript-Setup-1.0.1.exe`, its `.blockmap`, `latest.yml` (Windows), and
`Downcript-1.0.1-arm64.dmg` + its `.blockmap`, `Downcript-1.0.1-arm64-mac.zip`
+ its `.blockmap`, `latest-mac.yml` (macOS).

### The split-release bug (expect this every time)

electron-builder's GitHub publish step has a real, reproducible bug: it can
create **two separate draft Releases** for the same tag instead of one,
each holding a different, incomplete subset of that job's assets. This has
happened on every single release published so far (`v1.0.0` through
`v1.0.4`) — budget for it, don't be surprised by it. Symptoms: `gh release
view vX.Y.Z` shows nothing, or the Releases page shows the version as a
draft with files missing.

**Diagnose:**
```bash
gh api repos/<owner>/<repo>/releases --jq \
  '.[] | select(.tag_name=="vX.Y.Z") | {id, draft, assets: [.assets[].name]}'
```
If this prints two objects for the same tag, you have the bug.

**Fix** (pick whichever draft has *more* of the required assets as the
target; move the rest into it):
```bash
# 1. List the incomplete draft's assets to get their asset IDs:
gh api repos/<owner>/<repo>/releases/<BAD_ID>/assets --jq '.[] | {id, name, size}'

# 2. Download each missing asset by its own asset ID (not the public URL —
#    that only resolves once a release for the tag is actually published):
gh api -H "Accept: application/octet-stream" \
  repos/<owner>/<repo>/releases/assets/<ASSET_ID> > <filename>

# 3. Upload it to the more-complete release. Note the *upload* host is
#    uploads.github.com, not api.github.com -- api.github.com 404s here:
gh api --method POST -H "Content-Type: application/octet-stream" \
  "https://uploads.github.com/repos/<owner>/<repo>/releases/<GOOD_ID>/assets?name=<filename>" \
  --input <filename>

# 4. Verify the uploaded digest matches (gh api's upload response includes
#    a sha256 "digest" field -- compare it to `shasum -a 256 <filename>`).

# 5. Delete the now-redundant draft:
gh api --method DELETE "repos/<owner>/<repo>/releases/<BAD_ID>"

# 6. Publish (un-draft) the consolidated release:
gh api --method PATCH "repos/<owner>/<repo>/releases/<GOOD_ID>" \
  -f draft=false -f tag_name=vX.Y.Z -f target_commitish=main
```
`gh release upload vX.Y.Z ... --clobber` does **not** work while two
releases share one tag — it silently no-ops on an ambiguous target. Use the
asset-ID-based API calls above instead.

Large assets (the installer/dmg, 300-400+ MB) can hit transient connection
resets on step 2/3 — just retry; it's a network hiccup, not a sign
something's actually wrong.

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
4. **Restart & Install** quits the app; on Windows, NSIS silently
   reinstalls in place and the app relaunches on the new version
   (`quitAndInstall(true, true)` — verified end-to-end for real: detects,
   downloads, silently installs, relaunches, and keeps all user data
   intact).

Nothing installs or restarts without the user explicitly clicking
**Restart & Install**.

**macOS caveat**: the banner appears and **Update Now** downloads
correctly — detection and download are verified working. **Restart &
Install** will not actually apply the update, though: Squirrel.Mac refuses
an update it can't validate against a real signing identity, which ad-hoc
signing doesn't provide (verified for real — a downloaded update sat there
unapplied for several minutes). Until real Developer ID signing +
notarization are added, macOS users need to manually reinstall the `.dmg`
for each new version.

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
- **PyInstaller/native-binary steps fail** — `release-windows` always runs
  on a real `windows-latest` runner and `release-mac` on `macos-latest`
  (never cross-compiled), same as `windows-build.yml`/`mac-build.yml`. If a
  job fails here but its `*-build.yml` counterpart passed on the same
  commit, compare the two workflow logs — they run near-identical build
  steps, so a difference points at something specific to the release
  workflow itself (usually the publish/token step, not the build).
- **"Failed to CreateArtifact: Artifact storage quota has been hit"** — this
  is about the transient Actions-artifact upload (kept "in addition to the
  Release, for inspection"), not the actual Release publish, and every such
  upload step has `continue-on-error: true` so it can't fail the job. Safe
  to ignore. If it starts actually blocking something, `gh api
  repos/<owner>/<repo>/actions/artifacts` and delete old ones — but note
  GitHub's own quota figure lags deletions by "6-12 hours" per their own
  error message, so deleting won't necessarily unblock the very next run.
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

## Release history / precedent

`v1.0.0` (Windows only) through `v1.0.4` (Windows + macOS) have all been
published following exactly this process, including hitting and repairing
the split-release bug above on every one of them. `v1.0.1 → v1.0.2` and
`v1.0.3 → v1.0.4` were both used as real update-cycle tests (see the
`Update Cycle Test` workflow, `.github/workflows/update-cycle-test.yml`,
`workflow_dispatch` with `from_version`/`to_version` inputs) — it installs
the "from" version straight from its real GitHub Release on a real
Windows/macOS runner, drives it through `checkNow → downloadUpdate →
quitAndInstall`, and confirms the relaunched app is the new version with
user data intact. Run this after publishing any two consecutive versions
to re-verify the update path still works, especially after touching
`electron/autoUpdater.js` or the packaging config.

## What this does NOT do (be aware)

- **macOS auto-update cannot apply updates, only detect and download them.**
  Squirrel.Mac refuses to install an update it can't validate against a
  real, stable signing identity — ad-hoc signing doesn't provide one.
  Verified for real via the Update Cycle Test workflow: the download
  completes, then nothing happens. See `docs/AUTO_UPDATE_HANDOFF.md` for
  what real Developer ID signing + notarization would additionally
  require.
- **The Windows build is unsigned.** No Authenticode certificate exists for
  this project. The installer works and updates work end-to-end (verified),
  but Windows SmartScreen will show an "unknown publisher" warning on first
  install of every version. See the main `README.md`'s Known Limitations
  for what adding real code signing would take.
- **The macOS build is ad-hoc signed, unnotarized, and arm64-only.** A
  fresh install is quarantined and App-Translocated by Gatekeeper until the
  user explicitly trusts it (right-click → Open, or System Settings →
  Privacy & Security → Open Anyway) — expected behavior for any unsigned
  app, confirmed on real hardware.
- **No portable/no-installer build exists.** Only the NSIS installer
  target is configured for Windows; auto-update specifically relies on
  NSIS's differential-update support, so a portable build (if one is added
  later) would need its own update mechanism or to be documented as
  manual-update-only.
