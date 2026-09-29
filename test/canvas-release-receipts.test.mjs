import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const catalog = JSON.parse(readFileSync(new URL(".github/plugin/marketplace.json", root)));
function taggedSnapshot(name, version) {
  const tags = execFileSync("git", ["tag", "-l", `${name}-v${version.replaceAll(".", "-")}-*`], {
    cwd: root, encoding: "utf8",
  }).trim().split("\n").filter(Boolean);
  assert.equal(tags.length, 1, `${name}: expected one historical immutable tag`);
  const tag = tags[0];
  return {
    read: (path) => execFileSync("git", ["show", `${tag}:${path}`], { cwd: root }),
    files: (path) => execFileSync("git", ["ls-tree", "-r", "--name-only", tag, "--", path], {
      cwd: root, encoding: "utf8",
    }).trimEnd().split("\n"),
  };
}

const versions = {
  "azure-functions-hosted-skills": "0.5.2",
  "azure-resources-query": "0.1.2",
};

for (const name of ["azure-functions-hosted-skills", "azure-resources-query"]) {
  test(`${name} candidate pins its protected Agent Plugins package`, () => {
    const version = catalog.plugins.find((plugin) => plugin.name === name).version;
    const packagePath = `canvases/${name}/`;
    const read = (file) => readFileSync(new URL(`${packagePath}${file}`, root));
    const manifest = JSON.parse(read(".github/plugin/plugin.json"));
    const release = JSON.parse(read("release.json"));
    const metadata = JSON.parse(read("package.json"));
    const checksums = JSON.parse(read("checksums.json"));
    const receipt = read("SHA256SUMS");
    assert.equal(release.schemaVersion, 2);
    assert.equal(release.mutableDocumentation, true);
    assert.equal(manifest.$schema, "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json");
    assert.equal(manifest.version, version);
    assert.equal(release.version, version);
    assert.equal(release.publicationRepository, "microsoft/azure-dev-tools");
    assert.equal(release.plugin.extension.entry,
      `com.github.copilot/extensions/${name}/extension.mjs`);
    assert.equal(release.plugin.preview.file, "assets/preview.png");
    assert.equal(manifest.extensions["com.github.copilot"].logo, "assets/preview.png");
    assert.equal(metadata.main, release.plugin.extension.entry);
    assert.ok(read("assets/preview.png").subarray(0, 8).equals(
      Buffer.from("89504e470d0a1a0a", "hex")));
    assert.ok(read(release.plugin.extension.entry).length > 0);

    const files = execFileSync("git", ["ls-files", "--", packagePath], {
      cwd: root, encoding: "utf8",
    }).trimEnd().split("\n").map((file) => file.slice(packagePath.length));
    const entries = receipt.toString("utf8").trimEnd().split("\n").map((line) => {
      const match = /^([0-9a-f]{64})  (.+)$/.exec(line);
      assert.ok(match, `malformed receipt entry: ${line}`);
      return { hash: match[1], file: match[2] };
    });
    const protectedFiles = files.filter((file) =>
      file !== "SHA256SUMS" && file !== "README.md" && !file.startsWith("docs/"));
    assert.deepEqual(entries.map(({ file }) => file).sort(), protectedFiles.sort());
    assert.equal(entries.length, Object.keys(checksums).length + 1);
    assert.deepEqual(Object.keys(checksums).sort(), [...release.files, "release.json"].sort());
    for (const { hash, file } of entries) {
      if (!files.includes(file) || file === "README.md" || file.startsWith("docs/")) continue;
      assert.equal(createHash("sha256").update(read(file)).digest("hex"), hash, file);
      if (file !== "checksums.json") assert.equal(checksums[file], hash, file);
    }
  });
}

test("Cost Health 0.4.4 pins every protected Agent Plugins file without pinning mutable docs", () => {
  const packagePath = "canvases/azure-cost-health-check/";
  const read = (file) => readFileSync(new URL(`${packagePath}${file}`, root));
  const release = JSON.parse(read("release.json"));
  const checksums = JSON.parse(read("checksums.json"));
  const manifest = JSON.parse(read(".github/plugin/plugin.json"));
  const receipt = read("SHA256SUMS");
  assert.equal(release.schemaVersion, 2);
  assert.equal(release.mutableDocumentation, true);
  assert.equal(release.version, "0.4.4");
  assert.equal(manifest.version, "0.4.4");
  assert.equal(manifest.extensions["com.github.copilot"].logo, "assets/preview.png");
  const icon = `${release.plugin.extension.directory}/assets/plugin-icon.png`;
  assert.deepEqual(release.assets.find(({ route }) => route === "assets/plugin-icon.png"), {
    file: icon,
    route: "assets/plugin-icon.png",
    mime: "image/png",
  });
  assert.ok(read(icon).equals(read(release.plugin.preview.file)),
    "runtime and marketplace must use the same product icon");
  const runtime = read(release.plugin.extension.entry).toString("utf8");
  assert.match(runtime, /<img src="\/assets\/plugin-icon\.png" alt="" \/>/);
  assert.match(runtime, /rel==="plugin-icon\.png"/);
  assert.doesNotMatch(runtime, /azlogo-[abc]/);

  const files = execFileSync("git", ["ls-files", "--", packagePath], {
    cwd: root, encoding: "utf8",
  }).trimEnd().split("\n").map((file) => file.slice(packagePath.length));
  const protectedFiles = files.filter((file) =>
    file !== "README.md" && !file.startsWith("docs/") && file !== "SHA256SUMS");
  const entries = receipt.toString("utf8").trimEnd().split("\n").map((line) => {
    const match = /^([0-9a-f]{64})  (.+)$/.exec(line);
    assert.ok(match, `invalid protected receipt entry: ${line}`);
    return { hash: match[1], file: match[2] };
  });
  assert.deepEqual(entries.map(({ file }) => file).sort(), protectedFiles.sort());
  assert.deepEqual(Object.keys(checksums).sort(), [...release.files, "release.json"].sort());
  assert.equal(entries.length, Object.keys(checksums).length + 1);
  for (const { hash, file } of entries) {
    assert.equal(createHash("sha256").update(read(file)).digest("hex"), hash, file);
    if (file !== "checksums.json") assert.equal(checksums[file], hash, file);
  }
});

test("canvas-authoring 0.1.1 receipt covers the skill-only package and its toolkit provenance", () => {
  const packagePath = "plugins/canvas-authoring/";
  const snapshot = taggedSnapshot("canvas-authoring", "0.1.1");
  const manifest = JSON.parse(snapshot.read(`${packagePath}plugin.json`));
  assert.equal(manifest.version, "0.1.1");
  if (manifest.skills !== undefined) {
    assert.deepEqual(manifest.skills, ["./skills/create-canvas-app/"]);
  }
  assert.ok(!Object.hasOwn(manifest, "extensions") && !Object.hasOwn(manifest, "canvases"));
  const receipt = "docs/canvas-authoring/SHA256SUMS";
  const entries = snapshot.read(receipt).toString("utf8").trimEnd().split("\n").map((line) => {
    const match = /^([0-9a-f]{64})  (.+)$/.exec(line);
    assert.ok(match, `${receipt}: malformed line`);
    return { hash: match[1], path: `${packagePath}${match[2]}` };
  });
  const files = snapshot.files(packagePath);
  assert.equal(entries.length, 26);
  assert.deepEqual(entries.map(({ path }) => path).sort(), files.sort());
  assert.deepEqual(
    files.filter((path) => /\/skills\/[^/]+\/SKILL\.md$/.test(path)),
    [`${packagePath}skills/create-canvas-app/SKILL.md`],
  );
  for (const { hash, path } of entries) {
    assert.equal(createHash("sha256").update(snapshot.read(path)).digest("hex"), hash, path);
  }
  const toolkitPath = `${packagePath}skills/create-canvas-app/references/toolkit/`;
  const provenance = JSON.parse(snapshot.read(`${toolkitPath}provenance.json`));
  const checksums = provenance.files;
  assert.ok(checksums && typeof checksums === "object", "toolkit provenance checksums missing");
  for (const [name, hash] of Object.entries(checksums)) {
    assert.equal(createHash("sha256").update(snapshot.read(`${toolkitPath}${name}`)).digest("hex"), hash);
  }
});

for (const [name, version] of Object.entries(versions)) {
  test(`${name} ${version} metadata and checksum receipts cover every package file`, () => {
    const packagePath = `canvases/${name}/`;
    const snapshot = taggedSnapshot(name, version);
    const metadata = JSON.parse(snapshot.read(`${packagePath}.github/plugin/plugin.json`));
    const packageJson = JSON.parse(snapshot.read(`${packagePath}package.json`));
    const release = JSON.parse(snapshot.read(`${packagePath}release.json`));
    const checksums = JSON.parse(snapshot.read(`${packagePath}checksums.json`));
    assert.equal(metadata.version, version);
    assert.equal(packageJson.version, version);
    assert.equal(release.version, version);
    if (name === "azure-functions-hosted-skills") {
      assert.equal(
        JSON.parse(snapshot.read(`${packagePath}extensions/${name}/studio-package.json`)).version,
        version,
      );
    }

    const receipt = name === "azure-resources-query"
      ? "docs/azure-resources-query/SHA256SUMS"
      : `${packagePath}SHA256SUMS`;
    const entries = snapshot.read(receipt).toString("utf8").trimEnd().split("\n").map((line) => {
      const match = /^([0-9a-f]{64})  (.+)$/.exec(line);
      assert.ok(match, `${receipt}: malformed line`);
      return { hash: match[1], path: name === "azure-resources-query"
        ? match[2] : `${packagePath}${match[2]}` };
    });
    const files = snapshot.files(packagePath).filter((path) => path !== `${packagePath}SHA256SUMS`);
    assert.deepEqual(entries.map(({ path }) => path).sort(), files.sort());
    assert.deepEqual(
      Object.keys(checksums).sort(),
      [...release.files, "release.json"].sort(),
    );
    for (const { hash, path } of entries) {
      const actual = createHash("sha256").update(snapshot.read(path)).digest("hex");
      assert.equal(actual, hash, `${path}: receipt mismatch`);
      const local = path.slice(packagePath.length);
      if (local in checksums) assert.equal(actual, checksums[local], `${path}: checksums.json mismatch`);
    }
  });
}
