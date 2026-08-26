#!/usr/bin/env bash
# Downloads yt-dlp's official standalone binary (no Python needed to run it)
# for the desktop build, instead of depending on a system/PATH install.
# https://github.com/yt-dlp/yt-dlp/releases -- the project's own documented
# distribution point for these self-contained builds.
set -euo pipefail

cd "$(dirname "$0")/.."

# Optional override so a Windows binary can be pre-staged from any host --
# it's just a file download, no Windows machine needed for this one asset
# (unlike the PyInstaller/ffmpeg-static pieces, which do need to run on the
# actual target OS). Defaults to the host platform.
TARGET="${1:-$(uname -s)}"
case "$TARGET" in
  Darwin|darwin)
    ASSET="yt-dlp_macos"
    DEST_DIR="vendor/yt-dlp/darwin"
    DEST="$DEST_DIR/yt-dlp"
    ;;
  Linux|linux)
    ASSET="yt-dlp_linux"
    DEST_DIR="vendor/yt-dlp/linux"
    DEST="$DEST_DIR/yt-dlp"
    ;;
  win32|Windows|windows)
    ASSET="yt-dlp.exe"
    DEST_DIR="vendor/yt-dlp/win32"
    DEST="$DEST_DIR/yt-dlp.exe"
    ;;
  *)
    echo "Unsupported target: $TARGET (expected Darwin, Linux, or win32)" >&2
    exit 1
    ;;
esac

mkdir -p "$DEST_DIR"
echo "Downloading $ASSET..."
curl -L --fail -o "$DEST" "https://github.com/yt-dlp/yt-dlp/releases/latest/download/$ASSET"
chmod +x "$DEST"
if [ "$(uname -s)" = "$TARGET" ]; then
  "$DEST" --version
else
  echo "(skipping --version check: $DEST is for a different platform than this host)"
fi
echo "yt-dlp binary ready at $DEST"
