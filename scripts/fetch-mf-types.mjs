// Downloads the type declarations the shared_ui remote publishes next to its
// mf-manifest.json (@mf-types.zip) into ./@mf-types/shared_ui, so
// `import type * as UI from "shared_ui/ui"` type-checks. Types only: the
// components themselves are loaded at runtime through Module Federation.
//
//   npm run mf:types
//   SHARED_UI_URL=http://localhost:3001/mf-manifest.json npm run mf:types
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const manifest =
  process.env.SHARED_UI_URL ?? process.env.NEXT_PUBLIC_SHARED_UI_URL ?? "https://shared-ui.onrender.com/mf-manifest.json";
const zipUrl = new URL("@mf-types.zip", manifest).href;
const out = join(process.cwd(), "@mf-types", "shared_ui");

const res = await fetch(zipUrl);
if (!res.ok) {
  console.error(`Could not download ${zipUrl}: HTTP ${res.status}`);
  process.exit(1);
}

const dir = mkdtempSync(join(tmpdir(), "mf-types-"));
const zip = join(dir, "types.zip");
writeFileSync(zip, Buffer.from(await res.arrayBuffer()));

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
execFileSync("unzip", ["-q", "-o", zip, "-d", out], { stdio: "inherit" });
rmSync(dir, { recursive: true, force: true });

console.log(`shared_ui types from ${zipUrl} -> ${out}`);
