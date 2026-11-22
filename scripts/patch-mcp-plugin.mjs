#!/usr/bin/env node
/**
 * Workaround for a bug in @lovable.dev/mcp-js on Windows.
 *
 * The plugin inlines the MCP entry into supabase/functions/mcp/index.ts and its
 * esbuild resolver only treats "./" and "/" as filesystem paths. A Windows
 * absolute path ("C:\...") matches neither, so it is externalized as
 * `npm:C:\...` and the emitted bundle loses every tool.
 *
 * This patches the guard in the installed copy so drive-letter and UNC paths are
 * treated as filesystem paths, which is what already happens on Linux/macOS.
 * Idempotent, no-op when the pattern is absent (e.g. after an upstream fix).
 * Drop this script once the dependency is bumped to a fixed release.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const FROM = 'if (p.startsWith(".") || p.startsWith("/")) return null;';
const TO =
  'if (p.startsWith(".") || p.startsWith("/") || /^[A-Za-z]:[\\\\/]/.test(p) || p.startsWith("\\\\\\\\")) return null;';

const candidates = new Set();
try {
  candidates.add(fileURLToPath(import.meta.resolve("@lovable.dev/mcp-js/stacks/supabase/vite")));
} catch {
  /* ignore */
}
try {
  candidates.add(createRequire(import.meta.url).resolve("@lovable.dev/mcp-js/stacks/supabase/vite"));
} catch {
  /* ignore */
}

let patched = 0;
for (const file of candidates) {
  let source;
  try {
    source = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  if (!source.includes(FROM)) continue;
  writeFileSync(file, source.replaceAll(FROM, TO), "utf8");
  patched += 1;
}

if (patched > 0) {
  console.log(`[@lovable.dev/mcp-js] patch de caminho Windows aplicado em ${patched} arquivo(s).`);
}