#!/usr/bin/env bash
# Fails the build loudly if the frozen Python tools or the bundled yt-dlp
# binary for the target platform weren't actually produced. Without this,
# electron-builder happily packages an installer around whatever
# extraResources files exist -- including none -- so a cross-platform build
# (or a PyInstaller run that silently failed) still produces a
# mechanically-valid installer with no working runtime inside it.
set -euo pipefail

cd "$(dirname "$0")/.."

PLATFORM="${1:?Usage: scripts/verify-runtime.sh <darwin|win32|linux>}"
EXE_SUFFIX=""
[ "$PLATFORM" = "win32" ] && EXE_SUFFIX=".exe"

missing=()

for tool in transcribe hinglish ensure_models; do
  exe="build-python/dist/$PLATFORM/$tool/$tool$EXE_SUFFIX"
  [ -s "$exe" ] || missing+=("$exe")
done

ytdlp="vendor/yt-dlp/$PLATFORM/yt-dlp$EXE_SUFFIX"
[ -s "$ytdlp" ] || missing+=("$ytdlp")

if [ "${#missing[@]}" -gt 0 ]; then
  echo "Windows/${PLATFORM} Python+yt-dlp runtime was not generated:" >&2
  printf '  missing: %s\n' "${missing[@]}" >&2
  echo "Run \`npm run build:python\` and \`./scripts/download-yt-dlp.sh $PLATFORM\` on a $PLATFORM host before packaging." >&2
  exit 1
fi

echo "Runtime verified for $PLATFORM: all expected binaries present."
