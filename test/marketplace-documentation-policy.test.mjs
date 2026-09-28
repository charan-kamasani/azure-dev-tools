import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

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
    assert.throws(verify, /release inventory or checksums differ|plugin file differs from checksum receipt/);

    writeFileSync(runtime, originalRuntime);
    const unreviewed = join(clone, resourcesPath,
      "com.github.copilot/extensions/azure-resources-query/unreviewed.mjs");
    writeFileSync(unreviewed, "export const unreviewed = true;\n");
    git("add", "--", resourcesPath);
    git("commit", "--quiet", "-m", "Test protected file addition");
    assert.throws(verify, /release inventory or checksums differ|checksum receipt must cover/);

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
