#!/usr/bin/env bash
# Freezes scripts/transcribe.py and scripts/hinglish.py into standalone
# binaries (via PyInstaller) so the desktop build needs no system Python.
# Requires the same interpreter/packages as requirements.txt, plus pyinstaller
# (not itself a runtime dependency -- installed on demand here).
#
# PyInstaller freezes for whatever OS it runs ON -- it cannot cross-compile.
# Output is namespaced by platform (matching Node's process.platform values,
# since that's what app/lib/pythonRuntime.ts and electron/main.js key their
# resolution on) so running this on macOS and on Windows can both populate
# build-python/dist/ without one overwriting the other.
set -euo pipefail

cd "$(dirname "$0")/.."

case "$(uname -s)" in
  Darwin) NODE_PLATFORM="darwin" ;;
  Linux) NODE_PLATFORM="linux" ;;
  MINGW*|MSYS*|CYGWIN*) NODE_PLATFORM="win32" ;;
  *)
    echo "Unsupported platform for this script: $(uname -s)" >&2
    exit 1
    ;;
esac

# actions/setup-python (and some Windows installs) only puts "python" on
# PATH, not "python3" -- prefer python3 where it exists (matches every other
# script/doc in this project) and fall back to python otherwise.
PYTHON_BIN="python3"
command -v python3 >/dev/null 2>&1 || PYTHON_BIN="python"

"$PYTHON_BIN" -m pip show pyinstaller >/dev/null 2>&1 || "$PYTHON_BIN" -m pip install --user pyinstaller

DIST_DIR="build-python/dist/$NODE_PLATFORM"
rm -rf "$DIST_DIR" build-python/work
mkdir -p build-python

# Invoked as a module (python -m PyInstaller) rather than the bare
# "pyinstaller" console-script -- that script lands in pip's user-scripts
# directory, which is "Scripts/" on Windows vs "bin/" everywhere else, so
# relying on it being importable avoids needing to detect and PATH that
# platform-specific directory at all.
"$PYTHON_BIN" -m PyInstaller --name transcribe --onedir \
  --distpath "$DIST_DIR" --workpath build-python/work --specpath build-python \
  --noconfirm --clean \
  scripts/transcribe.py

"$PYTHON_BIN" -m PyInstaller --name hinglish --onedir \
  --distpath "$DIST_DIR" --workpath build-python/work --specpath build-python \
  --noconfirm --clean --collect-data aksharamukha \
  scripts/hinglish.py

"$PYTHON_BIN" -m PyInstaller --name ensure_models --onedir \
  --distpath "$DIST_DIR" --workpath build-python/work --specpath build-python \
  --noconfirm --clean --collect-data certifi \
  scripts/ensure_models.py

echo "Frozen binaries ready at $DIST_DIR/{transcribe,hinglish,ensure_models}/"
