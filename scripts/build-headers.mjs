import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
async function hashesIn(directory) {
  const hashes = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) hashes.push(...(await hashesIn(path)));
    else if (entry.name.endsWith(".html")) {
      const html = await readFile(path, "utf8");
      for (const match of html.matchAll(
        /<script\b([^>]*)>([\s\S]*?)<\/script>/g,
      )) {
        if (!/\bsrc\s*=/.test(match[1]) && match[2])
          hashes.push(
            `'sha256-${createHash("sha256").update(match[2]).digest("base64")}'`,
          );
      }
    }
  }
  return hashes;
}
const hashes = [...new Set(await hashesIn("out"))];
if (!hashes.length)
  throw new Error("Expected Next hydration scripts in static export.");
const template = await readFile("public/_headers", "utf8");
await writeFile(
  "out/_headers",
  template.replace(
    "script-src 'self'",
    `script-src 'self' ${hashes.join(" ")}`,
  ),
);
