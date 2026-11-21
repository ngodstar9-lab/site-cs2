import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];
const checks = [];

function check(label, condition, detail = "") {
  checks.push({ label, passed: Boolean(condition) });
  if (!condition) errors.push(detail ? `${label}: ${detail}` : label);
}

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  check(`Required file exists: ${relativePath}`, fs.existsSync(absolutePath));
  return fs.readFileSync(absolutePath, "utf8");
}

function idsIn(html) {
  return [...html.matchAll(/\\bid=["']([^"']+)["']/gi)].map((match) => match[1]);
}

function validateHtml(relativePath, html) {
  const ids = idsIn(html);
  const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  check(`${relativePath}: no duplicate IDs`, duplicates.length === 0, duplicates.join(", "));

  const idSet = new Set(ids);
  const localAnchors = [...html.matchAll(/\\bhref=["']#([^"']+)["']/gi)]
    .map((match) => match[1])
    .filter((id) => id.length > 0);
  const missingAnchors = [...new Set(localAnchors.filter((id) => !idSet.has(id)))];
  check(`${relativePath}: local anchors resolve`, missingAnchors.length === 0, missingAnchors.join(", "));

  const inlineScripts = [...html.matchAll(/<script\\b([^>]*)>([\\s\\S]*?)<\\/script>/gi)]
    .filter((match) => !/\\bsrc\\s*=/.test(match[1]) && match[2].trim());
  let scriptsParse = true;
  for (let index = 0; index < inlineScripts.length; index += 1) {
    try {
      new Function(inlineScripts[index][2]);
    } catch (error) {
      scriptsParse = false;
      errors.push(`${relativePath}: inline script ${index + 1}: ${error.message}`);
    }
  }
  check(`${relativePath}: inline JavaScript parses`, scriptsParse);

  const scripts = inlineScripts.map((match) => match[2]).join("\\n");
  const referencedIds = [
    ...scripts.matchAll(/\\$\\(["']([^"']+)["']\\)/g),
    ...scripts.matchAll(/getElementById\\(["']([^"']+)["']\\)/g)
  ].map((match) => match[1]);
  const missingReferences = [...new Set(referencedIds.filter((id) => !idSet.has(id)))];
  check(`${relativePath}: literal script DOM IDs exist`, missingReferences.length === 0, missingReferences.join(", "));

  const externalBlankLinks = [...html.matchAll(/<a\\b([^>]*target=["']_blank["'][^>]*)>/gi)];
  const unsafeBlankLinks = externalBlankLinks.filter((match) => !/\\brel=["'][^"']*noopener[^"']*["']/i.test(match[1]));
  check(`${relativePath}: new-tab links use noopener`, unsafeBlankLinks.length === 0);

  const localResources = [...html.matchAll(/\\b(?:href|src)=["']([^"']+)["']/gi)]
    .map((match) => match[1])
    .filter((value) => value && !/^(?:#|https?:|mailto:|tel:|data:|blob:|javascript:)/i.test(value));
  const missingResources = [];
  for (const target of localResources) {
    const pathname = target.split(/[?#]/, 1)[0];
    if (!pathname || pathname.startsWith("/")) continue;
    const resolved = path.resolve(path.dirname(path.join(root, relativePath)), pathname);
    if (!resolved.startsWith(root + path.sep) && resolved !== root) {
      missingResources.push(target);
      continue;
    }
    if (!fs.existsSync(resolved)) missingResources.push(target);
  }
  check(`${relativePath}: local href/src targets exist`, missingResources.length === 0, missingResources.join(", "));

  const buttonTags = [...html.matchAll(/<button\\b([^>]*)>/gi)];
  const buttonsWithoutType = buttonTags.filter((match) => !/\\btype=["'](?:button|submit|reset)["']/i.test(match[1]));
  check(`${relativePath}: buttons declare a type`, buttonsWithoutType.length === 0);

  return { ids: ids.length, inlineScripts: inlineScripts.length };
}

const publicPages = ["index.html", "admin.html", "privacy.html", "download.html", "offline.html"];
const pageStats = {};
for (const page of publicPages) {
  const html = read(page);
  pageStats[page] = validateHtml(page, html);
}

const home = fs.readFileSync(path.join(root, "index.html"), "utf8");
const admin = fs.readFileSync(path.join(root, "admin.html"), "utf8");
const serviceWorker = read("sw.js");
const prepareScript = read("apps/scripts/prepare-site.mjs");
const electronMain = read("apps/desktop/main.cjs");
const buildWorkflow = read(".github/workflows/build-apps.yml");

const css = home.match(/<style>([\\s\\S]*?)<\\/style>/i)?.[1] || "";
check("Homepage CSS braces are balanced", (css.match(/{/g) || []).length === (css.match(/}/g) || []).length);

const coreFilesBlock = serviceWorker.match(/const CORE_FILES = \\[([\\s\\S]*?)\\];/)?.[1] || "";
for (const required of ["./index.html", "./admin.html", "./privacy.html", "./download.html", "./offline.html"]) {
  check(`Service worker precaches ${required}`, coreFilesBlock.includes(`"${required}"`));
}

const packagedFilesBlock = prepareScript.match(/const requiredFiles = \\[([\\s\\S]*?)\\];/)?.[1] || "";
for (const required of ["index.html", "admin.html", "privacy.html", "download.html", "sw.js", "offline.html"]) {
  check(`Native app bundles ${required}`, packagedFilesBlock.includes(`"${required}"`));
}

check("Desktop app binds to the same IPv4 loopback address it serves", electronMain.includes("127.0.0.1") && electronMain.includes("new URL(url).origin === localOrigin"));
check("Desktop app disables Node integration", /nodeIntegration:\\s*false/.test(electronMain));
check("Desktop app enables context isolation", /contextIsolation:\\s*true/.test(electronMain));
check("Desktop app enables sandbox", /sandbox:\\s*true/.test(electronMain));
check("Public admin code does not contain a service-role secret", !/(?:service_role|sb_secret_)/i.test(admin + home));

const expectedPaths = ["privacy.html", "download.html", "apps/desktop/main.cjs"];
for (const required of expectedPaths) {
  check(`Native build workflow watches ${required}`, buildWorkflow.includes(`"${required}"`));
}

if (errors.length) {
  console.error("Site quality checks failed:");
  for (const error of errors) console.error(` - ${error}`);
  process.exitCode = 1;
} else {
  console.log(`All ${checks.length} site quality checks passed.`);
  console.log(JSON.stringify(pageStats, null, 2));
}
