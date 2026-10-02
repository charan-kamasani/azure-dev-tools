import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  verifyCurrentVersion,
  verifyMarketplace,
  verifyPlugin,
  verifyTagSource,
} from "../scripts/verify-plugin-marketplace.mjs";

const name = "azure-storage-canvas";
const source = `canvases/${name}`;
const catalog = JSON.parse(readFileSync(
  new URL("../.github/plugin/marketplace.json", import.meta.url)));
const root = fileURLToPath(new URL("../", import.meta.url));

test("Storage accepts reviewed semantic versions without a fixed version gate", () => {
  for (const version of ["0.1.0", "0.1.1", "0.2.0"]) {
    assert.doesNotThrow(() => verifyCurrentVersion(name, version));
    assert.doesNotThrow(() => verifyTagSource(
      name, version, `${name}-v${version.replaceAll(".", "-")}-1234567`,
    ));
  }
  for (const version of ["0.1", "0.1.1-preview.1", "latest"]) {
    assert.throws(() => verifyCurrentVersion(name, version), /semantic version/);
  }
});

test("Storage rejects obsolete identities and noncanonical package sources", () => {
  for (const obsolete of ["azure-storage", "azure-storage-explorer"]) {
    assert.throws(() => verifyCurrentVersion(obsolete, "0.1.1"),
      /expected a reviewed product/);
  }
  for (const wrongSource of [
    "plugins/azure-storage-canvas",
    "canvases/azure-storage-canvas/src",
    `${source}/com.github.copilot/extensions/${name}`,
    "canvases/azure-resources-query",
    { source: "github", repo: "microsoft/azure-dev-tools", path: source, ref: "main" },
  ]) {
    assert.throws(() => verifyPlugin({
      name, version: "0.1.1", source: wrongSource,
    }, { candidate: true }), /own repo-relative path/);
  }
});

test("Storage requires an ASCII source-qualified immutable version tag", () => {
  for (const tag of [
    `${name}-latest`,
    `${name}-v0.1.1-1234567`,
    `${name}-v0-1-0-1234567`,
    `${name}-v0-1-1-main`,
    `${name}-v0-1-1-123456`,
    `${name}-v0-1-1-1234567\u2014`,
  ]) {
    assert.throws(() => verifyTagSource(name, "0.1.1", tag),
      /does not identify a source commit/);
  }
});

test("the production marketplace cannot omit or duplicate Storage", () => {
  const missing = structuredClone(catalog);
  missing.plugins = missing.plugins.filter((plugin) => plugin.name !== name);
  assert.throws(() => verifyMarketplace(missing, { candidate: true }),
    /exactly the reviewed production products/);

  const duplicate = structuredClone(missing);
  duplicate.plugins.push(
    { name, version: "0.1.1", source },
    { name, version: "0.1.1", source },
  );
  assert.throws(() => verifyMarketplace(duplicate, { candidate: true }),
    /exactly the reviewed production products/);
});

test("the Storage candidate verifies its canonical plugin and protected receipt", () => {
  const plugin = catalog.plugins.find((entry) => entry.name === name);
  assert.ok(plugin, "Storage must have a production marketplace entry");
  assert.match(verifyPlugin(plugin, { candidate: true }),
    /^azure-storage-canvas@\d+\.\d+\.\d+ /);
});

test("Storage rejects changes to its protected runtime, launcher, notices, icon and receipt", () => {
  const checkout = mkdtempSync(join(tmpdir(), "storage-release-integrity-"));
  const clone = join(checkout, "repo");
  const git = (...args) => execFileSync("git", ["-C", clone, ...args], {
    encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  const verify = () => {
    try {
      return execFileSync("node", [realpathSync(join(clone, "scripts/verify-plugin-marketplace.mjs")), "--candidate"], {
        cwd: clone, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      throw new Error(error.stderr);
    }
  };
  try {
    execFileSync("git", ["clone", "--quiet", "--local", "--no-hardlinks", root, clone]);
    git("config", "user.name", "Storage release policy test");
    git("config", "user.email", "release-policy@example.invalid");
    assert.doesNotThrow(verify);

    for (const file of [
      `com.github.copilot/extensions/${name}/extension.mjs`,
      `skills/${name}/SKILL.md`,
      "THIRD_PARTY_NOTICES.txt",
      "assets/preview.png",
    ]) {
      const target = join(clone, source, file);
      const original = readFileSync(target);
      writeFileSync(target, Buffer.concat([original, Buffer.from("\nTampered protected file\n")]));
      git("add", "--", source);
      git("commit", "--quiet", "-m", `Test protected Storage file ${file}`,
        "-m", "Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>");
      assert.throws(verify,
        /immutable package files differ|protected release checksum differs|plugin file differs from checksum receipt/);
      writeFileSync(target, original);
    }

    const receipt = join(clone, source, "SHA256SUMS");
    writeFileSync(receipt, readFileSync(receipt, "utf8").split("\n").slice(1).join("\n"));
    git("add", "--", source);
    git("commit", "--quiet", "-m", "Test incomplete Storage checksum receipt",
      "-m", "Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>");
    assert.throws(verify,
      /current checksum receipt differs|checksum receipt must cover every protected plugin file exactly once/);
  } finally {
    rmSync(checkout, { recursive: true, force: true });
  }
});
