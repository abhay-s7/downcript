# Auto-Update — Implementation Handoff

> **Status: implemented for Windows (2026-09-04) and macOS packaging/CI (2026-09-10).** Everything
> this document originally described as "missing" for Windows now exists — see `RELEASE.md` for
> the actual release process, `electron/autoUpdater.js` for the implementation, and README §19 for
> the user-facing summary. As of 2026-09-10, macOS also has a real CI build/release pipeline
> (`mac-build.yml`, the `release-mac` job in `release.yml`) and the `zip` target this document
> flagged as missing (step 7 below is done — `package.json`'s mac target is now `dmg` + `zip`).
> **The one item from this document that remains genuinely open is real Apple Developer ID signing
> + notarization** (step 7's certificate/notarization half). This was verified as a hard blocker,
> not a theoretical one: a real `v1.0.1 → v1.0.2` update was driven end-to-end on macOS CI —
> `checkNow` correctly found the new version, `downloadUpdate` completed successfully, and
> `quitAndInstall` never actually applied it even after several minutes' wait; the installed
> bundle stayed on the old version the whole time. Squirrel.Mac's refusal to trust an ad-hoc
> signature is real, exactly as predicted below, not something later config changes worked around.
> Kept as historical context for *why* the Windows implementation was built the way it was; body
> not re-written after the fact except where superseded above.

Written from a read-only audit of the codebase (2026-08-27). Nothing described as "missing" below
has been implemented — this document exists so whoever picks up auto-update next doesn't have to
re-derive the current state from scratch.

## Current state, in one line

Auto-update is **not implemented at all** — not disabled, not partial, not dev-only. Users must
manually download and re-run a new installer for every version.

## What's actually there today

| Piece | Status |
|---|---|
| `electron-updater` dependency | Absent — not in `package.json`, not in `node_modules` |
| Update-check code | Absent — `electron/main.js` never imports/calls `autoUpdater` |
| Update IPC / preload surface | Absent — `electron/preload.js` exposes no update methods |
| Update UI (version, check button, progress, restart) | Absent |
| `publish` config in `package.json`'s `build` block | Absent — no provider, no owner/repo |
| GitHub Releases | None exist (`gh release list` returns empty); no git tags |
| Windows CI (`​.github/workflows/windows-build.yml`) | Builds + packages the NSIS `.exe`, but runs `electron-builder --win --x64 --publish never` and uploads it as a transient Actions artifact, not a Release |
| macOS CI | Does not exist — `dist:mac` only runs manually, locally |
| Windows code signing | Not configured |
| macOS code signing | `identity: null` in the `mac` build block (no paid Developer ID); `scripts/after-pack.js` re-signs **ad-hoc** afterward, only so Gatekeeper allows a local launch — not a real signature |
| macOS notarization | Not configured |
| `latest.yml` / `latest-mac.yml` (the metadata `electron-updater` polls for) | Never generated, since publishing never runs |

So the chain `build → publish → release → update metadata → installed app → check → download →
install` is broken at essentially every link, not just one.

## Why this matters for macOS specifically

Even after everything else below is wired up, Squirrel.Mac (which `electron-updater` uses on
macOS) **refuses to apply an update payload that isn't signed with a real Apple Developer ID and
notarized**. The current ad-hoc signature exists only to satisfy Gatekeeper for a fresh local
install — it will not satisfy the updater's own validation. A paid Apple Developer Program
membership + notarization is a hard prerequisite for macOS auto-update, not an optional polish
step.

Windows has no equivalent hard blocker — `electron-updater` works with an unsigned NSIS installer,
though every release will trigger a SmartScreen warning without a code-signing certificate.

## Recommended implementation, in order

1. **Add `electron-updater`** to `dependencies` (must ship inside the packaged app, not just be a
   dev tool).
2. **Add a `publish` block** to `package.json`'s `build` config:
   ```json
   "publish": { "provider": "github", "owner": "abhay-s7", "repo": "downcript" }
   ```
3. **Call the updater from `electron/main.js`** on app launch (after the window is ready), e.g.
   `autoUpdater.checkForUpdatesAndNotify()`, or `checkForUpdates()` plus custom IPC-driven UI if
   you want more control over the prompt/timing than the built-in notification gives you.
4. **Wire update lifecycle events to IPC** (`update-available`, `download-progress`,
   `update-downloaded`, `error`) so the renderer can show real state instead of nothing — an
   obvious place for this is next to the existing `notification:taskComplete` IPC handler and the
   existing Settings panel.
5. **Call `autoUpdater.quitAndInstall()`** once a download completes — decide up front whether
   that happens automatically or waits for the user to click a "Restart to update" affordance
   (this is a product decision, not a technical one — see "Open decisions" below).
6. **Make CI actually publish**: for Windows, drop `--publish never` from
   `.github/workflows/windows-build.yml` (or add a separate release job) and provide a `GH_TOKEN`
   with `contents: write`, so electron-builder creates a GitHub Release and uploads both the
   installer and `latest.yml`.
7. **Get a macOS Developer ID + set up notarization** — replace `identity: null` with the real
   certificate reference, add a notarization step (electron-builder's built-in `afterSign` hook, or
   `@electron/notarize` directly), and only then is `scripts/after-pack.js`'s manual ad-hoc
   `codesign` call no longer needed for the *release* build (it may still be useful for
   unsigned local dev builds).
8. **Add a macOS release CI workflow** mirroring `windows-build.yml` (there isn't one today —
   DMGs are currently a manual, local-only artifact), including the signing/notarization
   credentials as repo secrets.
9. **(Optional) Windows code signing** — not required for the updater to function, but removes
   the SmartScreen warning on every future release.
10. **(Optional) Delta updates on Windows** — `electron-builder`/`electron-updater` can generate
    and consume `.blockmap` files so returning users download only the changed bytes instead of
    the full installer. macOS updates are always a full app replacement regardless (Squirrel.Mac
    doesn't diff).

## Open decisions for whoever implements this

- **Silent vs. prompted install**: auto-download + auto-restart on quit, vs. notify-and-let-the-
  user-choose-when. Affects step 3/5 above.
- **Update channel**: single stable channel is simplest and matches the app's current lack of any
  beta/pre-release process; only worth revisiting if a beta channel becomes a real need.
- **Release cadence / tagging convention**: nothing today ties a git tag to a version or a CI run
  to a release — decide this before step 6, since the release workflow needs a trigger (tag push,
  manual dispatch, etc.).
- **Budget/timeline for an Apple Developer Program membership** — this blocks macOS auto-update
  entirely (see above) and is an external, non-technical dependency the rest of the team needs to
  plan for separately from the engineering work.

## Where to look when starting this work

```text
package.json                  — add the dependency + "publish" block here
electron/main.js               — add autoUpdater import, init, event wiring here
electron/preload.js            — expose update-related IPC methods here (pattern: notifyTaskComplete)
app/components/SettingsPanel.tsx — natural home for a "Check for Updates" affordance / version display
.github/workflows/windows-build.yml — remove --publish never, add GH_TOKEN, once ready to publish
.github/workflows/                — add a new macOS release workflow here (none exists yet)
scripts/after-pack.js          — mac ad-hoc signing lives here; revisit once real signing exists
```

See `README.md` §17 (Known limitations) for the user-facing summary this handoff expands on.
