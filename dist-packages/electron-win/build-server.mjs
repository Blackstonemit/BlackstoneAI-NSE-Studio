/**
 * Build script — runs INSIDE this electron-win folder.
 * Copies source from the monorepo sibling and bundles everything into dist/server/.
 *
 * Usage (from inside electron-win/):
 *   node build-server.mjs
 *
 * Prerequisites:
 *   npm install        (install all devDependencies incl. esbuild)
 *   DATABASE_URL env   (optional, for DB features)
 */

import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rm, cp, mkdir, readdir, stat } from "node:fs/promises";
import { execSync } from "node:child_process";

globalThis.require = createRequire(import.meta.url);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "dist");
const serverDist = path.join(distDir, "server");
const srcDir = path.join(__dirname, "src");

// ── 1. Clean ──────────────────────────────────────────────────────────────────
console.log("Cleaning dist...");
await rm(distDir, { recursive: true, force: true });
await mkdir(serverDist, { recursive: true });

// ── 2. Build the React frontend with Vite ─────────────────────────────────────
console.log("\nBuilding React frontend...");
execSync("npm run build-frontend-only", {
  cwd: __dirname,
  stdio: "inherit",
  env: {
    ...process.env,
    BASE_PATH: "/",
    NODE_ENV: "production",
  },
});

// Copy Vite output into server/public
const frontendBuild = path.join(__dirname, "frontend-dist");
await cp(frontendBuild, path.join(serverDist, "public"), { recursive: true });
console.log("Frontend built → dist/server/public");

// ── 3. Bundle the Express server with esbuild ─────────────────────────────────
console.log("\nBundling Express server...");

const { build } = await import("esbuild");
const esbuildPluginPino = (await import("esbuild-plugin-pino")).default;

await build({
  entryPoints: [path.join(srcDir, "server", "index.ts")],
  platform: "node",
  bundle: true,
  format: "esm",
  outdir: serverDist,
  outExtension: { ".js": ".mjs" },
  logLevel: "info",
  external: [
    "*.node", "sharp", "better-sqlite3", "sqlite3", "canvas",
    "bcrypt", "argon2", "fsevents", "re2", "pg-native",
  ],
  sourcemap: "linked",
  plugins: [esbuildPluginPino({ transports: ["pino-pretty"] })],
  banner: {
    js: `import { createRequire as __cr } from 'node:module';
import __bp from 'node:path';
import __bu from 'node:url';
globalThis.require = __cr(import.meta.url);
globalThis.__filename = __bu.fileURLToPath(import.meta.url);
globalThis.__dirname = __bp.dirname(globalThis.__filename);`,
  },
});

console.log("\n✅  Build complete → dist/server/");
console.log("    Run: npm start  or  npm run dist");
