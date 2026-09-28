import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import {
  verifyMutableDocumentationTrees,
  verifyMutableReleaseMetadata,
  verifyRuntimeInventory,
} from "../scripts/verify-plugin-marketplace.mjs";

const image = Buffer.from("89504e470d0a1a0a0000", "hex");
const files = new Map(Object.entries({
  ".github/plugin/plugin.json": '{"name":"azure-cost-health-check-v3"}',
  "extensions/azure-cost-health-check-v3/extension.mjs": "export const canvasId = 'azure-cost-health-check-v3';",
  "com.github.copilot/extensions/azure-sre-agent/extension.mjs": "export const canvasId = 'azure-sre-agent';",
  "com.github.copilot/extensions/azure-sre-agent/assets/icon.png": image,
  "assets/preview.png": image,
  "skills/azure-cost-health-check-v3/SKILL.md": "# Cost Health\n",
  "notices/chart-LICENSE.txt": "Reviewed vendor license\n",
  "release.json": '{"schemaVersion":2}',
  "checksums.json": "{}",
  "README.md": "# Cost Health\n",
  "docs/screenshot.png": image,
  "SHA256SUMS": "reviewed receipt\n",
}));

function snapshot(contents, modes = {}) {
  return {
    tree: [...contents].map(([file, data]) => ({
      file,
      mode: modes[file] ?? "100644",
      oid: createHash("sha1").update(data).digest("hex"),
    })),
    read: (file) => Buffer.from(contents.get(file)),
  };
}

function verify(current, tagged) {
  return verifyMutableDocumentationTrees(
    current.tree, tagged.tree, current.read, tagged.read);
}

test("README and documentation image bytes can change without changing a protected tag", () => {
  const tagged = snapshot(files);
  const changed = new Map(files);
  changed.set("README.md", "# Updated Cost Health instructions\n");
  changed.set("docs/screenshot.png", Buffer.concat([image, Buffer.from("new image")]));
  changed.set("docs/quickstart.txt", "New supplemental documentation\n");
  const current = snapshot(changed);
  const pinned = verify(current, tagged);
  assert.ok(!pinned.includes("README.md") && !pinned.includes("docs/screenshot.png"));
  assert.ok(pinned.includes("notices/chart-LICENSE.txt"));
  assert.equal(tagged.read("README.md").toString(), "# Cost Health\n");
  assert.equal(tagged.read("docs/screenshot.png").equals(image), true);
});

test("supported mutable text and raster images stay outside the protected receipt", () => {
  const changed = new Map(files);
  for (const [name, data] of [
    ["README", "Instructions\n"],
    ["README-advanced.txt", "More instructions\n"],
    ["skills/azure-cost-health-check-v3/README.markdown", "Companion guide\n"],
    ["doc/notes.rst", "Overview\n"],
    ["doc/notes.adoc", "= Overview\n"],
    ["doc/diagram.jpg", Buffer.from("ffd8ffe000", "hex")],
    ["docs/diagram.jpeg", Buffer.from("ffd8ffe000", "hex")],
    ["docs/diagram.gif", Buffer.from("GIF89a", "ascii")],
    ["docs/diagram.webp", Buffer.from("RIFFxxxxWEBP", "ascii")],
    ["docs/diagram.avif", Buffer.from("0000000c6674797061766966", "hex")],
  ]) changed.set(name, data);
  assert.doesNotThrow(() => verify(snapshot(changed), snapshot(files)));
});

test("runtime, skill, legal notice, and plugin metadata remain fixed to their historical tag", () => {
  const tagged = snapshot(files);
  for (const file of [
    "extensions/azure-cost-health-check-v3/extension.mjs",
    "com.github.copilot/extensions/azure-sre-agent/assets/icon.png",
    "assets/preview.png",
    "skills/azure-cost-health-check-v3/SKILL.md",
    "notices/chart-LICENSE.txt",
    ".github/plugin/plugin.json",
  ]) {
    const changed = new Map(files);
    changed.set(file, Buffer.concat([Buffer.from(files.get(file)), Buffer.from("modified")]));
    assert.throws(() => verify(snapshot(changed), tagged), /immutable package files differ/, file);
  }
  const missing = new Map(files);
  missing.delete("notices/chart-LICENSE.txt");
  assert.throws(() => verify(snapshot(missing), tagged), /immutable package files differ/);
  const added = new Map(files);
  added.set("extensions/azure-cost-health-check-v3/new-helper.mjs", "export const extra = true;");
  assert.throws(() => verify(snapshot(added), tagged), /immutable package files differ/);
  const alteredTag = new Map(files);
  alteredTag.set("extensions/azure-cost-health-check-v3/extension.mjs", "different historical runtime");
  assert.throws(() => verify(tagged, snapshot(alteredTag)), /immutable package files differ/);
  const withExtensionGuide = new Map(files);
  withExtensionGuide.set("extensions/azure-cost-health-check-v3/README.md", "Packaged runtime guide\n");
  const changedExtensionGuide = new Map(withExtensionGuide);
  changedExtensionGuide.set("extensions/azure-cost-health-check-v3/README.md", "Different runtime guide\n");
  assert.throws(() => verify(snapshot(changedExtensionGuide), snapshot(withExtensionGuide)),
    /immutable package files differ/);
});

test("documentation cannot carry executable assets, notices, links, or runtime dependencies", () => {
  const tagged = snapshot(files);
  for (const [file, content] of [
    ["docs/worker.mjs", "export const run = true;"],
    ["doc/tool.py", "print('run')"],
    ["docs/chart-NOTICE.txt", "License terms"],
    ["docs/COPYRIGHT.txt", "Copyright terms"],
    ["docs/AUTHORS.md", "Attribution"],
    ["docs/page.html", "<script>alert(1)</script>"],
    ["docs/icon.svg", "<svg><script>alert(1)</script></svg>"],
    ["docs/fake.png", "not an image"],
    ["README.html", "<script>alert(1)</script>"],
    ["README.js", "export const run = true;"],
    ["docs/binary.txt", Buffer.from([0, 255])],
  ]) {
    const changed = new Map(files);
    changed.set(file, content);
    assert.throws(() => verify(snapshot(changed), tagged),
      /executable or legal content|unsafe mutable documentation|not a valid|not inert UTF-8/, file);
  }
  assert.throws(() => verify(snapshot(files, { "README.md": "120000" }), tagged),
    /unsafe package file or mode/);
  assert.throws(() => verify(snapshot(files, { "docs/screenshot.png": "100755" }), tagged),
    /unsafe mutable documentation file/);
  const tabPath = new Map(files);
  tabPath.set("docs/README.md\t.js", "malformed path");
  assert.throws(() => verify(snapshot(tabPath), tagged), /unsafe package file or mode/);

  const imported = new Map(files);
  imported.set("extensions/azure-cost-health-check-v3/extension.mjs",
    "import screenshot from '../../docs/screenshot.png';");
  assert.throws(() => verify(snapshot(imported), snapshot(imported)),
    /runtime or skill references mutable documentation/);
  const nestedImport = new Map(files);
  nestedImport.set("com.github.copilot/extensions/azure-sre-agent/extension.mjs",
    "const image = new URL('../../../docs/screenshot.png', import.meta.url);");
  assert.throws(() => verify(snapshot(nestedImport), snapshot(nestedImport)),
    /runtime or skill references mutable documentation/);
  imported.set("extensions/azure-cost-health-check-v3/extension.mjs", files.get(
    "extensions/azure-cost-health-check-v3/extension.mjs"));
  imported.set("skills/azure-cost-health-check-v3/SKILL.md",
    "Before running, load [the image](../../docs/screenshot.png)");
  assert.throws(() => verify(snapshot(imported), snapshot(imported)),
    /runtime or skill references mutable documentation/);
});

test("schema 2 metadata and checksums enumerate only protected files and notices", () => {
  const tagged = snapshot(files);
  const protectedFiles = verify(tagged, tagged);
  const payload = protectedFiles.filter((file) =>
    file !== "release.json" && file !== "checksums.json");
  const release = {
    schemaVersion: 2,
    mutableDocumentation: true,
    files: payload,
    modules: [{ file: "extensions/azure-cost-health-check-v3/extension.mjs" }],
  };
  const checksums = Object.fromEntries([...payload, "release.json"].map((file) =>
    [file, createHash("sha256").update(tagged.read(file)).digest("hex")]));
  assert.doesNotThrow(() => verifyMutableReleaseMetadata(
    release, checksums, protectedFiles, tagged.read));
  assert.throws(() => verifyMutableReleaseMetadata(
    { ...release, files: [...payload, "README.md"] }, checksums, protectedFiles, tagged.read),
  /only protected payload/);
  assert.throws(() => verifyMutableReleaseMetadata(
    release, { ...checksums, "docs/screenshot.png": "a".repeat(64) },
    protectedFiles, tagged.read), /only protected payload/);
  assert.throws(() => verifyMutableReleaseMetadata(
    { ...release, assets: [{ file: "docs/screenshot.png" }] },
    checksums, protectedFiles, tagged.read), /runtime assets cannot depend/);
  assert.throws(() => verifyMutableReleaseMetadata(
    release, { ...checksums, "release.json": "b".repeat(64) },
    protectedFiles, tagged.read), /protected release checksum differs/);
});

test("runtime inventories never declare mutable documentation as modules or assets", () => {
  assert.doesNotThrow(() => verifyRuntimeInventory({
    modules: [{ file: "extensions/azure-cost-health-check-v3/extension.mjs" }],
  }));
  for (const field of ["modules", "assets"]) {
    assert.throws(() => verifyRuntimeInventory({ [field]: [{ file: "docs/screenshot.png" }] }),
      new RegExp(`runtime ${field} cannot depend`));
    assert.throws(() => verifyRuntimeInventory({ [field]: [{ file: "README.md" }] }),
      new RegExp(`runtime ${field} cannot depend`));
  }
});
