import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const pages = ["index.html", "admin.html", "download.html", "privacy.html", "offline.html"];

function attr(tag, name) {
  const match = tag.match(new RegExp("\\b" + name + "\\s*=\\s*(['\"])(.*?)\\1", "i"));
  return match?.[2] ?? null;
}

function localPath(value) {
  if (!value || value.startsWith("#") || value.startsWith("?")) return null;
  if (/^(?:[a-z]+:|\/\/)/i.test(value)) return null;
  const pathname = value.split(/[?#]/, 1)[0];
  if (!pathname) return null;
  return path.resolve(root, decodeURIComponent(pathname));
}

for (const file of pages) {
  const fullPath = path.join(root, file);
  assert.ok(existsSync(fullPath), `Missing page: ${file}`);
  const html = readFileSync(fullPath, "utf8");

  const ids = [...html.matchAll(/\\bid=["']([^"']+)["']/g)].map((m) => m[1]);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  assert.deepEqual([...new Set(duplicates)], [], `${file}: duplicate HTML id`);

  const idSet = new Set(ids);
  const domLookups = new Set([
    ...[...html.matchAll(/\\$\\(["']([^"']+)["']\\)/g)].map((m) => m[1]),
    ...[...html.matchAll(/getElementById\\(["']([^"']+)["']\\)/g)].map((m) => m[1])
  ]);
  const missing = [...domLookups].filter((id) => !idSet.has(id));
  assert.deepEqual(missing, [], `${file}: DOM lookup points to missing id`);

  const labels = new Set([...html.matchAll(/<label\\b[^>]*\\bfor=["']([^"']+)["'][^>]*>/gi)].map((m) => m[1]));
  const controls = [...html.matchAll(/<(input|select|textarea)\\b[^>]*>/gi)];
  for (const match of controls) {
    const tag = match[0];
    const id = attr(tag, "id");
    const accessibleName = attr(tag, "aria-label") || attr(tag, "aria-labelledby");
    const nestedLabel = /<label\\b[^>]*>[\\s\\S]*$/.test(html.slice(Math.max(0, match.index - 250), match.index));
    assert.ok(accessibleName || (id && labels.has(id)) || nestedLabel, `${file}: form control has no label: ${tag}`);
  }

  const blankLinks = [...html.matchAll(/<a\\b[^>]*\\btarget=["']_blank["'][^>]*>/gi)].map((m) => m[0]);
  for (const tag of blankLinks) {
    const rel = attr(tag, "rel") || "";
    assert.ok(/\\bnoopener\\b/i.test(rel) && /\\bnoreferrer\\b/i.test(rel), `${file}: target=_blank needs noopener noreferrer`);
  }

  for (const match of html.matchAll(/<(?:a|link|script|img|source)\\b[^>]*>/gi)) {
    const tag = match[0];
    const value = attr(tag, "href") ?? attr(tag, "src");
    const target = localPath(value);
    if (target && path.extname(target)) {
      assert.ok(existsSync(target), `${file}: missing local asset ${value}`);
    }
  }

  const inlineScripts = [...html.matchAll(/<script\\b([^>]*)>([\\s\\S]*?)<\\/script>/gi)]
    .filter((m) => !/\\bsrc\\s*=/i.test(m[1]))
    .map((m) => m[2]);
  inlineScripts.forEach((source, index) => {
    new vm.Script(source, { filename: `${file}#inline-script-${index + 1}` });
  });

  console.log(`✓ ${file}: ${ids.length} ids, ${inlineScripts.length} inline scripts`);
}

const manifestText = readFileSync(path.join(root, "manifest.webmanifest"), "utf8");
const manifest = JSON.parse(manifestText);
assert.equal(manifest.lang, "fa");
assert.equal(manifest.dir, "rtl");
assert.equal(manifest.start_url, "./");
assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0);
for (const icon of manifest.icons) {
  const target = localPath(icon.src);
  assert.ok(target && existsSync(target), `PWA icon does not exist: ${icon.src}`);
}
const indexHtml = readFileSync(path.join(root, "index.html"), "utf8");
assert.match(indexHtml, /rel=["']manifest["'][^>]*href=["']\\.\\/manifest\\.webmanifest["']/i);
assert.match(indexHtml, /beforeinstallprompt/);
assert.match(indexHtml, /id=["']installAppBtn["']/);

const sw = readFileSync(path.join(root, "sw.js"), "utf8");
new vm.Script(sw, { filename: "sw.js" });
assert.match(sw, /noor-quran-shell-v6/);
assert.match(sw, /\\.\\/manifest\\.webmanifest/);

for (const file of ["index.html", "admin.html"]) {
  const html = readFileSync(path.join(root, file), "utf8");
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /object-src ['"]none['"]/);
  assert.match(html, /base-uri ['"]self['"]/);
}

const publicClientFiles = ["index.html", "admin.html"].map((file) => readFileSync(path.join(root, file), "utf8")).join("\\n");
assert.doesNotMatch(publicClientFiles, /sb_secret_[A-Za-z0-9_-]+|service_role/i, "A server-only Supabase key must never be shipped to the browser.");

console.log("All Noor Quran website checks passed.");
