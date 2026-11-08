import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(scriptDir, "..");
const repoDir = path.resolve(appDir, "..");
const outputDir = path.join(appDir, "shared", "www");

const requiredFiles = [
  "index.html",
  "admin.html",
  "app-icon.svg",
  "favicon.png",
  "manifest.webmanifest",
  "sw.js",
  "offline.html"
];

await fs.rm(outputDir, { recursive: true, force: true });
await fs.mkdir(outputDir, { recursive: true });

for (const file of requiredFiles) {
  const source = path.join(repoDir, file);
  try {
    await fs.access(source);
  } catch {
    throw new Error(`Required site file is missing: ${file}`);
  }
  await fs.copyFile(source, path.join(outputDir, file));
}

console.log(`Prepared ${requiredFiles.length} site files in ${outputDir}`);
