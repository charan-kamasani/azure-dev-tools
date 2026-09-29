import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { verifyMutableDocumentationTrees } from "../scripts/verify-plugin-marketplace.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const verifier = "scripts/verify-plugin-marketplace.mjs";
const products = JSON.parse(readFileSync(new URL("../.github/plugin/marketplace.json", import.meta.url)))
  .plugins.map(({ source }) => source);
const costPath = "canvases/azure-cost-health-check";
const resourcesPath = "canvases/azure-resources-query";
const pixel = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==",
  "base64",
);

test("every canvas accepts schema-v2 protected-only receipts without migrating historical tags", () => {
  const checkout = mkdtempSync(join(tmpdir(), "marketplace-all-canvas-v2-"));
  const clone = join(checkout, "repo");
  const git = (...args) => execFileSync("git", ["-C", clone, ...args], {
    encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  const read = (path) => readFileSync(join(clone, path));
  const writeJson = (path, data) =>
    writeFileSync(join(clone, path), `${JSON.stringify(data, null, 2)}\n`);
  const digest = (path) => createHash("sha256").update(read(path)).digest("hex");
  const verify = () => execFileSync("node", [realpathSync(join(clone, verifier)), "--candidate"], {
    cwd: clone, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
  });
  const commit = (message) => {
    git("add", "--", ".github/plugin/marketplace.json", "canvases");
    git("commit", "--quiet", "-m", message);
  };
  try {
    execFileSync("git", ["clone", "--quiet", "--local", "--no-hardlinks", root, clone]);
    copyFileSync(join(root, verifier), join(clone, verifier));
    git("config", "user.name", "Release policy test");
    git("config", "user.email", "release-policy@example.invalid");
    const historicalTags = git("show-ref", "--tags");
    const marketplace = JSON.parse(read(".github/plugin/marketplace.json"));
    const canvases = marketplace.plugins.filter(({ source }) => source.startsWith("canvases/"));
    for (const plugin of canvases) {
      const path = plugin.source;
      const release = JSON.parse(read(`${path}/release.json`));
      const tree = git("ls-tree", "-r", "HEAD", "--", path).split("\n").map((line) => {
        const [mode, , oid, fullPath] = line.split(/\s+/);
        return { mode, oid, file: fullPath.slice(path.length + 1) };
      });
      const protectedFiles = verifyMutableDocumentationTrees(
        tree, tree, (file) => read(`${path}/${file}`), (file) => read(`${path}/${file}`));
      const version = plugin.version.split(".").map(Number);
      version[2]++;
      plugin.version = version.join(".");
      for (const file of [".github/plugin/plugin.json", "package.json"]) {
        writeJson(`${path}/${file}`, {
          ...JSON.parse(read(`${path}/${file}`)), version: plugin.version,
        });
      }
      release.version = plugin.version;
      release.schemaVersion = 2;
      release.mutableDocumentation = true;
      delete release.readmeAssets;
      release.files = protectedFiles.filter((file) =>
        file !== "release.json" && file !== "checksums.json");
      writeJson(`${path}/release.json`, release);
      writeJson(`${path}/checksums.json`, Object.fromEntries(
        [...release.files, "release.json"].map((file) => [file, digest(`${path}/${file}`)])));
      writeFileSync(join(clone, path, "SHA256SUMS"), protectedFiles.map((file) =>
        `${digest(`${path}/${file}`)}  ${file}\n`).join(""));
    }
    writeJson(".github/plugin/marketplace.json", marketplace);
    commit("Test next schema-v2 candidates for every canvas");
    assert.doesNotThrow(verify, "all canvas products accept protected-only schema-v2 receipts");
    assert.equal(git("show-ref", "--tags"), historicalTags);

    const sre = canvases.find(({ name }) => name === "azure-sre-agent");
    const receiptPath = `${sre.source}/SHA256SUMS`;
    const originalReceipt = read(receiptPath);
    writeFileSync(join(clone, receiptPath), Buffer.concat([originalReceipt,
      Buffer.from(`${digest(`${sre.source}/README.md`)}  README.md\n`)]));
    commit("Test schema-v2 receipt rejects mutable README entries");
    assert.throws(verify, /schema 2 checksum receipt must contain only protected plugin files/);
    writeFileSync(join(clone, receiptPath), originalReceipt);
    commit("Restore protected-only SRE receipt");

    const tag = `${sre.name}-v${sre.version.replaceAll(".", "-")}-abcdef0`;
    git("tag", tag);
    const tagCommit = git("rev-parse", `${tag}^{commit}`);
    for (const { source: path } of canvases) {
      writeFileSync(join(clone, path, "README.md"), "# Updated customer instructions\n");
      mkdirSync(join(clone, path, "docs"), { recursive: true });
      writeFileSync(join(clone, path, "docs", "new-screenshot.png"), pixel);
    }
    commit("Update inert documentation without rewriting schema-v2 receipts");
    assert.doesNotThrow(verify, "mutable docs pass with both tagged and untagged schema-v2 releases");
    assert.equal(git("rev-parse", `${tag}^{commit}`), tagCommit);
    assert.ok(read(receiptPath).equals(originalReceipt));
    assert.ok(read(`${sre.source}/README.md`).toString().startsWith("# Updated"));
    assert.notEqual(git("show", `${tag}:${sre.source}/README.md`), "# Updated customer instructions");

    const preview = `${sre.source}/assets/preview.png`;
    writeFileSync(join(clone, preview), pixel);
    commit("Test installed marketplace image remains protected");
    assert.throws(verify, /immutable package files differ/);
  } finally {
    rmSync(checkout, { recursive: true, force: true });
  }
});

test("legacy tagged receipts stay historical while each product's docs change on main", () => {
  const checkout = mkdtempSync(join(tmpdir(), "marketplace-docs-"));
  const clone = join(checkout, "repo");
  const git = (...args) => execFileSync("git", ["-C", clone, ...args], {
    encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  const verify = () => execFileSync("node", [realpathSync(join(clone, verifier)), "--candidate"], {
    cwd: clone, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
  });
  try {
    execFileSync("git", ["clone", "--quiet", "--local", "--no-hardlinks", root, clone]);
    copyFileSync(join(root, verifier), join(clone, verifier));
    git("config", "user.name", "Release policy test");
    git("config", "user.email", "release-policy@example.invalid");
    assert.doesNotThrow(verify, "all catalog products pass candidate verification");

    for (const path of products) {
      const readme = join(clone, path, "README.md");
      writeFileSync(readme, `${readFileSync(readme, "utf8")}\nDocumentation-only update.\n`);
      const image = join(clone, path, "docs", "mutable-test.png");
      mkdirSync(join(clone, path, "docs"), { recursive: true });
      writeFileSync(image, pixel);
      git("add", "--", path);
      git("commit", "--quiet", "-m", `Test mutable documentation in ${path}`);
      assert.doesNotThrow(verify, path);

      rmSync(image);
      git("add", "--", path);
      git("commit", "--quiet", "-m", `Test documentation image removal in ${path}`);
      assert.doesNotThrow(verify, path);
    }

    const costRuntime = join(clone, costPath,
      "com.github.copilot/extensions/azure-cost-health-check/extension.mjs");
    const originalCostRuntime = readFileSync(costRuntime);
    writeFileSync(costRuntime, Buffer.concat([originalCostRuntime, Buffer.from("\n// Tampered runtime\n")]));
    git("add", "--", costPath);
    git("commit", "--quiet", "-m", "Test Cost protected runtime tampering");
    assert.throws(verify, /protected release checksum differs|plugin file differs from checksum receipt/);
    writeFileSync(costRuntime, originalCostRuntime);
    git("add", "--", costPath);
    git("commit", "--quiet", "-m", "Restore Cost runtime");
    assert.doesNotThrow(verify, "restored Cost package matches synthetic release tag");

    const runtime = join(clone, resourcesPath,
      "com.github.copilot/extensions/azure-resources-query/extension.mjs");
    const originalRuntime = readFileSync(runtime);
    writeFileSync(runtime, Buffer.concat([originalRuntime, Buffer.from("\n// Tampered runtime\n")]));
    git("add", "--", resourcesPath);
    git("commit", "--quiet", "-m", "Test protected runtime tampering");
    assert.throws(verify, /protected release checksum differs|release inventory or checksums differ|plugin file differs from checksum receipt/);

    writeFileSync(runtime, originalRuntime);
    const unreviewed = join(clone, resourcesPath,
      "com.github.copilot/extensions/azure-resources-query/unreviewed.mjs");
    writeFileSync(unreviewed, "export const unreviewed = true;\n");
    git("add", "--", resourcesPath);
    git("commit", "--quiet", "-m", "Test protected file addition");
    assert.throws(verify, /mutable-document release metadata must enumerate only protected payload and notices|release inventory or checksums differ|checksum receipt must cover/);

    rmSync(unreviewed);
    const receipt = join(clone, resourcesPath, "SHA256SUMS");
    writeFileSync(receipt, readFileSync(receipt, "utf8").split("\n").slice(1).join("\n"));
    git("add", "--", resourcesPath);
    git("commit", "--quiet", "-m", "Test current candidate receipt tampering");
    assert.throws(verify, /checksum receipt must cover every protected plugin file exactly once/);
  } finally {
    rmSync(checkout, { recursive: true, force: true });
  }
});
