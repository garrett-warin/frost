import { mkdir, copyFile, readFile, writeFile, readdir, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
const source = new URL("../upstream/app/vendor/", import.meta.url);
const destination = new URL("../public/vendor/", import.meta.url);
await mkdir(destination, { recursive: true });
const provenance = JSON.parse(await readFile(new URL("../engine-source.json", import.meta.url), "utf8"));
const manifest = { ...provenance, files: {} };
for (const name of await readdir(source)) {
  await copyFile(new URL(name, source), new URL(name, destination));
  manifest.files[name] = createHash("sha256").update(await readFile(new URL(name, destination))).digest("hex");
}
for (const obsolete of ["transport.js", "controller.sw.js"]) await rm(new URL(obsolete, destination), { force: true });
await writeFile(new URL("manifest.json", destination), JSON.stringify(manifest, null, 2));
console.log("Copied matching pinned engine bundle and recorded SHA-256 hashes.");
await import('./build-frosty.mjs');
