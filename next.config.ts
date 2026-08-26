import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["ffmpeg-static"],
  // The Electron desktop build spawns this server locally (electron/main.js)
  // instead of depending on a separately-running `next dev`/`next start`, so
  // it needs the self-contained standalone output.
  output: "standalone",
  // The tracer's dynamic-fs-access heuristic sweeps the whole build-python/
  // PyInstaller output (hundreds of MB of native ML libraries) into the
  // bundle because app/lib/pythonRuntime.ts checks for it at a path built
  // from a literal "build-python" segment. Those binaries are placed via
  // electron-builder's extraResources for packaging, not via this bundle.
  outputFileTracingExcludes: {
    "*": ["build-python/**", "scripts/**", "vendor/**", "dist-electron/**"],
  },
};

export default nextConfig;
