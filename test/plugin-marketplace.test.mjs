import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  verifyCombinedReleaseCommits,
  verifyCurrentVersion,
  verifyMarketplace,
  verifyPlugin,
  verifyPreviousReleaseCommits,
  verifyReceiptPath,
  verifyRuntimeInventory,
  verifySubsequentReleaseCommit,
  verifyTagSource,
} from "../scripts/verify-plugin-marketplace.mjs";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/marketplace.candidate.json", import.meta.url)));
const catalog = JSON.parse(readFileSync(new URL("../.github/plugin/marketplace.json", import.meta.url)));
const root = fileURLToPath(new URL("../", import.meta.url));
const verifier = "scripts/verify-plugin-marketplace.mjs";

function versionOf(name) {
  return catalog.plugins.find((plugin) => plugin.name === name).version;
}

function modified(update) {
  const manifest = structuredClone(fixture);
  update(manifest);
  return manifest;
}

test("requires release tags for full verification, then checks every catalog plugin", () => {
  assert.deepEqual(fixture.plugins, catalog.plugins.map(({ name, version, source }) =>
    ({ name, version, source })));
  const tags = fixture.plugins.map(({ name, version }) =>
    execFileSync("git", ["tag", "-l", `${name}-v${version.replaceAll(".", "-")}-*`], {
      encoding: "utf8",
    }).trim());
  if (tags.some((tag) => !tag)) {
    assert.throws(() => verifyMarketplace(fixture), /expected exactly one reviewed immutable release tag/);
    return;
  }
  const results = verifyMarketplace(fixture);
  assert.equal(results.length, fixture.plugins.length);
  assert.ok(results[0].startsWith(`azure-functions-hosted-skills@${versionOf("azure-functions-hosted-skills")} azure-functions-hosted-skills-v`));
  assert.ok(results[1].startsWith(`azure-resources-query@${versionOf("azure-resources-query")} azure-resources-query-v`));
  assert.match(results[2], /canvas-authoring@0\.1\.1 canvas-authoring-v0-1-1-/);
  assert.match(results[3], /azure-cost-health-check@0\.4\.4 azure-cost-health-check-v0-4-4-/);
  assert.match(results[4], /azure-sre-agent@0\.2\.7 azure-sre-agent-v0-2-7-/);
});

test("candidate validates every reviewed package and omits only missing immutable tags", () => {
  const candidate = modified((m) => { m.name = "azure-dev-tools"; });
  const results = verifyMarketplace(candidate, { candidate: true });
  assert.equal(results.length, candidate.plugins.length);
  for (const [index, { name, version }] of candidate.plugins.entries()) {
    const tags = execFileSync("git", ["tag", "-l", `${name}-v${version.replaceAll(".", "-")}-*`], {
      encoding: "utf8",
    }).trim().split("\n").filter(Boolean);
    assert.equal(results[index], `${name}@${version} ${tags[0] ?? "(candidate; immutable tag pending)"}`);
  }
  assert.match(results[2], /canvas-authoring-v0-1-1-8af10f8/);
  assert.match(results[4], /azure-sre-agent@0\.2\.7 azure-sre-agent-v0-2-7-9da2e40/);
});

test("candidate rejects corrupted protected payloads and checksum receipts", () => {
  const checkout = mkdtempSync(join(tmpdir(), "marketplace-candidate-"));
  const clone = join(checkout, "repo");
  const git = (...args) => execFileSync("git", ["-C", clone, ...args], {
    encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  const verify = () => {
    try {
      return execFileSync("node", [realpathSync(join(clone, verifier)), "--candidate"], {
        cwd: clone, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      throw new Error(error.stderr);
    }
  };
  const packagePath = "canvases/azure-cost-health-check";
  try {
    execFileSync("git", ["clone", "--quiet", "--local", "--no-hardlinks", root, clone]);
    copyFileSync(join(root, verifier), join(clone, verifier));
    git("config", "user.name", "Release policy test");
    git("config", "user.email", "release-policy@example.invalid");
    assert.doesNotThrow(verify);

    const runtime = join(clone, packagePath,
      "com.github.copilot/extensions/azure-cost-health-check/extension.mjs");
    const originalRuntime = readFileSync(runtime);
    writeFileSync(runtime, Buffer.concat([originalRuntime, Buffer.from("\n// Corrupted payload\n")]));
    git("add", "--", packagePath);
    git("commit", "--quiet", "-m", "Corrupt candidate payload");
    assert.throws(verify, /protected release checksum differs|plugin file differs from checksum receipt/);

    writeFileSync(runtime, originalRuntime);
    const receipt = join(clone, packagePath, "SHA256SUMS");
    writeFileSync(receipt, readFileSync(receipt, "utf8").split("\n").slice(1).join("\n"));
    git("add", "--", packagePath);
    git("commit", "--quiet", "-m", "Corrupt candidate receipt");
    assert.throws(verify, /checksum receipt must cover every protected plugin file exactly once/);
  } finally {
    rmSync(checkout, { recursive: true, force: true });
  }
});

test("a subsequent Cost candidate version validates without a verifier edit", () => {
  const checkout = mkdtempSync(join(tmpdir(), "marketplace-next-version-"));
  const clone = join(checkout, "repo");
  const git = (...args) => execFileSync("git", ["-C", clone, ...args], {
    encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  const read = (path) => readFileSync(join(clone, path));
  const writeJson = (path, value) =>
    writeFileSync(join(clone, path), `${JSON.stringify(value, null, 2)}\n`);
  const digest = (path) => createHash("sha256").update(read(path)).digest("hex");
  const verify = () => execFileSync(
    "node", [realpathSync(join(clone, verifier)), "--candidate"],
    { cwd: clone, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  const packagePath = "canvases/azure-cost-health-check";
  try {
    execFileSync("git", ["clone", "--quiet", "--local", "--no-hardlinks", root, clone]);
    copyFileSync(join(root, verifier), join(clone, verifier));
    git("config", "user.name", "Release policy test");
    git("config", "user.email", "release-policy@example.invalid");

    for (const path of [
      ".github/plugin/marketplace.json",
      `${packagePath}/.github/plugin/plugin.json`,
      `${packagePath}/package.json`,
      `${packagePath}/release.json`,
    ]) {
      const value = JSON.parse(read(path));
      if (path === ".github/plugin/marketplace.json") {
        value.plugins.find(({ name }) => name === "azure-cost-health-check").version = "0.4.5";
      } else {
        value.version = "0.4.5";
      }
      writeJson(path, value);
    }

    const checksumsPath = `${packagePath}/checksums.json`;
    const checksums = JSON.parse(read(checksumsPath));
    for (const file of [".github/plugin/plugin.json", "package.json", "release.json"]) {
      checksums[file] = digest(`${packagePath}/${file}`);
    }
    writeJson(checksumsPath, checksums);

    const receiptPath = `${packagePath}/SHA256SUMS`;
    const receipt = read(receiptPath).toString("utf8").trimEnd().split("\n").map((line) => {
      const [hash, file] = line.split("  ");
      const fullPath = `${packagePath}/${file}`;
      return `${existsSync(join(clone, fullPath)) ? digest(fullPath) : hash}  ${file}`;
    });
    writeFileSync(join(clone, receiptPath), `${receipt.join("\n")}\n`);
    git("add", "--", ".github/plugin/marketplace.json", packagePath);
    git("commit", "--quiet", "-m", "Prepare next Cost candidate");

    assert.doesNotThrow(verify);
  } finally {
    rmSync(checkout, { recursive: true, force: true });
  }
});

test("rejects missing products and duplicate entries", () => {
  assert.throws(() => verifyMarketplace(modified((m) => m.plugins.pop())), /exactly the reviewed production products/);
  assert.throws(() => verifyMarketplace(modified((m) => {
    m.plugins[1] = structuredClone(m.plugins[0]);
  })), /exactly the reviewed production products/);
  assert.throws(() => verifyMarketplace(modified((m) => {
    m.plugins.push({ name: "unapproved-plugin", version: "1.0.0", source: "canvases/unapproved-plugin" });
  })), /exactly the reviewed production products/);
});

test("rejects the obsolete Cost Health v3 identity", () => {
  assert.throws(() => verifyMarketplace(modified((m) => {
    m.plugins[3] = {
      name: "azure-cost-health-check-v3",
      version: "0.4.3",
      source: "canvases/azure-cost-health-check-v3",
    };
  })), /exactly the reviewed production products/);
});

test("rejects remote, moving, and cross-product sources", () => {
  assert.throws(() => verifyMarketplace(modified((m) => {
    m.plugins[0].source = {
      source: "github", repo: "microsoft/azure-dev-tools",
      ref: "main", path: "canvases/azure-functions-hosted-skills",
    };
  })), /own repo-relative path/);
  assert.throws(() => verifyMarketplace(modified((m) => {
    m.plugins[0].source = {
      source: "github", repo: "example/not-azure-dev-tools",
      sha: "0".repeat(40), path: "canvases/azure-functions-hosted-skills",
    };
  })), /own repo-relative path/);
  assert.throws(() => verifyPlugin({
    name: "canvas-authoring", version: "0.1.1", source: "canvases/canvas-authoring",
  }), /own repo-relative path/);
});

test("rejects mismatched package versions and paths before checking tags", () => {
  assert.throws(() => verifyMarketplace(modified((m) => {
    m.plugins[0].version = "0.5.1";
  }), { candidate: true }), /must not precede/);
  assert.throws(() => verifyMarketplace(modified((m) => {
    m.plugins[0].source = "canvases/azure-resources-query";
  }), { candidate: true }), /own repo-relative path/);
  assert.throws(() => verifyMarketplace(modified((m) => {
    m.plugins[2].version = "0.1.0";
  }), { candidate: true }), /must not precede/);
});

test("unreviewed versions fail before a tag lookup", () => {
  assert.throws(() => verifyPlugin({
    name: "azure-resources-query",
    version: "0.1.0",
    source: "canvases/azure-resources-query",
  }), /must not precede/);
  assert.throws(() => verifyPlugin({
    name: "canvas-authoring",
    version: "0.1.0",
    source: "plugins/canvas-authoring",
  }), /must not precede/);
  assert.throws(() => verifyCurrentVersion(
    "unapproved-plugin", "1.0.0",
  ), /expected a reviewed product/);
});

test("target tags must identify the package version and a source commit", () => {
  for (const { name, version } of catalog.plugins) {
    assert.doesNotThrow(() => verifyTagSource(
      name, version, `${name}-v${version.replaceAll(".", "-")}-0123456`,
    ));
    assert.throws(() => verifyTagSource(
      name, version, `${name}-v0-0-0-deadbeef`,
    ), /does not identify a source commit/);
  }
  assert.throws(() => verifyMarketplace(modified((m) => {
    m.name = "azure-dev-tools";
    m.plugins[0].version = "0.5.1";
  })), /must not precede/);
});

test("three patch tags share one new commit and old tags retain exact historical commits", () => {
  const combinedPatchCommit = "a6d394bbaa6fb1dc0151257a85cbac0de772b138";
  assert.doesNotThrow(() => verifyCombinedReleaseCommits(Array(3).fill(combinedPatchCommit)));
  assert.throws(() => verifyCombinedReleaseCommits(["abc", "abc", "def"]), /same reviewed production merge/);
  assert.throws(() => verifyCombinedReleaseCommits(["abc", "abc", "abc"]), /moved from their reviewed commit/);
  assert.throws(() => verifyCombinedReleaseCommits(["abc"]), /same reviewed production merge/);
  assert.throws(() => verifyCombinedReleaseCommits(["abc", "abc"]), /same reviewed production merge/);
  const previous = {
    "azure-functions-hosted-skills-v0-5-1-2bb8354": "cc59516eba4d6eecda9ff7c9f0191fe2117167af",
    "azure-resources-query-v0-1-1-be9551d": "cc59516eba4d6eecda9ff7c9f0191fe2117167af",
    "canvas-authoring-v0-1-0-23aa6b1": "180136488727f011e8001321c29150a005f89fe0",
    "azure-functions-hosted-skills-v0-5-2-8af10f8": combinedPatchCommit,
    "azure-resources-query-v0-1-2-8af10f8": combinedPatchCommit,
    "canvas-authoring-v0-1-1-8af10f8": combinedPatchCommit,
    "azure-cost-health-check-v0-4-3-b355172": "59e5889e464b099344a8ba8ff13cdf73d401d433",
  };
  assert.doesNotThrow(() => verifyPreviousReleaseCommits(previous));
  assert.throws(() => verifyPreviousReleaseCommits({
    ...previous, "canvas-authoring-v0-1-0-23aa6b1": previous["azure-resources-query-v0-1-1-be9551d"],
  }), /moved or are missing/);
  assert.throws(() => verifyPreviousReleaseCommits({
    ...previous, "canvas-authoring-v0-1-0-23aa6b1": undefined,
  }), /moved or are missing/);
});

test("a later product release has a distinct merge descending from the combined patch", () => {
  const earlierCommit = execFileSync("git", [
    "rev-parse", "canvas-authoring-v0-1-0-23aa6b1^{commit}",
  ], { encoding: "utf8" }).trim();
  const patchCommit = execFileSync("git", [
    "rev-parse", "azure-resources-query-v0-1-2-8af10f8^{commit}",
  ], { encoding: "utf8" }).trim();
  assert.doesNotThrow(() => verifySubsequentReleaseCommit(earlierCommit, patchCommit));
  assert.throws(() => verifySubsequentReleaseCommit("HEAD", "HEAD"), /own reviewed merge commit/);
  assert.throws(() => verifySubsequentReleaseCommit(patchCommit, earlierCommit), /descend from the prior/);
});

test("every product must use a safe fixed receipt path", () => {
  const receipt = {
    receipt: "canvases/unreleased-canvas/SHA256SUMS",
  };
  assert.doesNotThrow(() => verifyReceiptPath(receipt));
  for (const incomplete of [
    { ...receipt, receipt: undefined },
    { ...receipt, receipt: "/tmp/SHA256SUMS" },
    { ...receipt, receipt: "../SHA256SUMS" },
    { ...receipt, receipt: "canvases\\unreleased-canvas\\SHA256SUMS" },
  ]) {
    assert.throws(() => verifyReceiptPath(incomplete), /repository-relative checksum receipt/);
  }
});

test("legacy tagged canvas runtime inventories do not load mutable documentation", () => {
  for (const [name, version] of [
    ["azure-functions-hosted-skills", "0-5-2"],
    ["azure-resources-query", "0-1-2"],
  ]) {
    const tag = `${name}-v${version}-8af10f8`;
    const release = JSON.parse(execFileSync("git", [
      "show", `${tag}:canvases/${name}/release.json`,
    ], { encoding: "utf8" }));
    assert.doesNotThrow(() => verifyRuntimeInventory(release), tag);
  }
});
