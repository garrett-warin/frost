import { execFileSync } from "node:child_process";
import { readFile, writeFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { zipSync } from "fflate";
const root = fileURLToPath(new URL("../", import.meta.url));
const entries = {};
const tracked = execFileSync("git", ["ls-files", "-z"], {
  cwd: join(root, "upstream"),
  encoding: "utf8",
})
  .split("\0")
  .filter(Boolean);
for (const file of tracked)
  entries["frost/upstream/" + file] = new Uint8Array(
    await readFile(join(root, "upstream", file)),
  );

async function add(directory, prefix) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (
      [
        "node_modules",
        "vendor", "engine",
        "upstream",
        ".git",
        ".project-memory",
        "source.zip",
      ].includes(entry.name) ||
      entry.name.startsWith(".env")
    )
      continue;
    const file = join(directory, entry.name),
      name = prefix + "/" + entry.name;
    if (entry.isDirectory()) await add(file, name);
    else if (entry.isFile())
      entries[name] = new Uint8Array(await readFile(file));
  }
}
await add(root, "frost");
await writeFile(
  join(root, "public/source.zip"),
  zipSync(entries, { level: 6 }),
);
console.log(`Packaged ${Object.keys(entries).length} source files.`);

