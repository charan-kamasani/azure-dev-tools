# Canvas release process

Canvas packages in this repository are published only after the candidate has
been reviewed and approved. A release must preserve both reproducible package
bytes and a stable customer installation path.

## Release tags

Each product uses two tag forms:

- `PRODUCT-latest` is movable. Update it only after the approved candidate PR
  merges. It must point to the same merge commit as the new immutable tag.
- `PRODUCT-v<semver>-<source-sha>` is immutable. The repository's current tag
  convention writes semantic-version separators as hyphens, for example
  `PRODUCT-v1-2-3-abcdef0`. Never move, delete, or recreate an immutable tag.

A package version identifies one exact set of protected bytes. Once a version
has been used for a public candidate or release, changed runtime, skills,
manifests, or legal notices require a new version, even when called a rebuild
or correction. The source SHA in an immutable tag records the reviewed source
revision; it does not permit the same version to be reused for different
protected output.

### Documentation-only updates

The immutable tag records the entire reviewed candidate, including the
original customer README and documentation. After release, inert `README*`
files (including nested package READMEs outside runtime extensions) and files
in package-root `doc/` or `docs/` may change on the default branch without
moving tags or changing receipts. Runtime-reachable READMEs stay protected.
The tag retains the historical documentation snapshot; newer
default-branch documentation is not version-pinned. Disclose its revision
separately when referring customers to mutable instructions.

For previous releases, their original complete `SHA256SUMS` receipts
and internal checksums remain unchanged and are verified against their
immutable **tag snapshots**, not against newer default-branch documentation.
The verifier compares all protected files on the default branch to those
tags, including additions and deletions, and pins each original tag to its
reviewed commit. Do not rewrite or move old receipts, tags, or versions.

A new candidate for any canvas uses the reviewed
`schemaVersion: 2`, `mutableDocumentation: true` contract: `release.json` and
`checksums.json` enumerate protected files only, and its `SHA256SUMS` covers
those protected files rather than documentation. The verifier selects this
contract from the release schema, not the product name. Historical schema-v1
packages keep their original complete inventories and receipts; do not
convert them in place. Pin the receipt's digest and
tag; validate both the source export's protected checksums and every protected
file at the tag and on the default branch. Legal and third-party notices must
be in protected paths, not under `doc/` or `docs/`. Verify and review the
complete customer candidate, including its documentation, before the first
release.

The installed marketplace image `assets/preview.png` and all images/icons
inside `com.github.copilot/extensions/<product>/` remain protected, even when
the README also displays them. Only separate inert documentation screenshots
under package-root `doc/` or `docs/` are mutable. Runtime, skills, manifests,
release metadata, and legal notices remain protected for every canvas.

Mutable documentation is restricted to plain README/Markdown/text and
Markdown/text or PNG, JPEG, WebP, GIF, and AVIF files under package-root `doc/` or
`docs/`. The verifier rejects symlinks, executable files, required notices
or licenses, and runtime or skill dependencies in excluded paths. Active HTML
and SVG are not eligible without a separately reviewed inert-document policy.

When one approved production PR contains multiple independently reviewed products,
their distinct source-qualified immutable version tags may all point to that
same PR's merge commit. Verify each product's source revision, version, and
package bytes separately; do not create the tags before the PR merges.
For a separately reviewed skill-only product stacked on that PR, its immutable
tag instead points to its own later approved merge commit. A marketplace
verifier must check that the earlier product release is an ancestor, that
the skill-only package tree and full checksum inventory match its tag, and
that it has no extension or canvas. Its package root may be `plugins/<product>`
with `plugin.json` directly in that directory rather than the canvas layout.
For a subsequent combined canvas and skill-only patch release, all new
source-qualified tags point to one later approved merge commit descending
from the previous builder release. Verify the prior canvas and builder
immutable tags still identify their original commits. Never move the old
tags; update marketplace versions, package receipts and source-qualified
checks for each new package tree.

Release order:

1. Start with content cleared for public distribution in this repository.
2. Run the package's required tests and release checks.
3. Produce an inventory of the package files and record their SHA-256 digests
   in `SHA256SUMS`.
4. Obtain explicit approval for the candidate and its customer-facing
   materials in this repository.
5. Merge the approved candidate PR.
6. Create the immutable `PRODUCT-v<semver>-<source-sha>` tag at the merge
   commit.
7. Verify the immutable install URL and README, then move `PRODUCT-latest` to
   that same merge commit.
8. Verify the latest install URL and README before sending the announcement.
9. Pin the released package in the Awesome Copilot catalog, when applicable.

Never move `PRODUCT-latest` to an unmerged branch, candidate commit, or
unapproved rebuild.

For the 0.5.3 Hosted Skills and 0.1.3 Azure Resources Query candidates, the
Agent Plugins v1 manifests, protected previews, namespaced extensions, and
complete new in-package `SHA256SUMS` receipts are verified with
`node scripts/verify-plugin-marketplace.mjs --candidate` on the candidate
commit. Hosted preserves the full customer guide as a disclosed
documentation-only README overlay, with its updated checksum and receipt;
the runtime, skills, manifest and release metadata remain source-identical.
Strict verification without `--candidate` still requires real new
immutable tags after an approved merge. The 0.5.2/0.1.2 tags and their original
receipts remain unchanged; do not replace those tags with synthetic candidates.

The original canvas version tags retain the reviewed public distribution bytes,
including historical README links to the public source. Do not edit those
immutable versions or move their tags. A later production patch may correct
customer installation destinations inside a package through a separately
reviewed, version-bumped source export, complete new receipts, and new immutable
tags. A private customer-guide overlay retaining previously released
instructions must be disclosed and separately reviewed; checksum its final
bytes and preserve source-identical runtime and skills. Production installation
links and tag verification must point to
`microsoft/azure-dev-tools`. Disclose and checksum any separately reviewed
skill-only product documentation overlays in its release PR.

## Customer README verification

Release verification must fail closed if a package export replaces a
customer-facing README with internal packaging, build, or provider prose.
For an extension-bearing canvas, before approval and again after tagging,
verify that the README:

- starts with the customer value statement;
- includes an `## Install` section with the
  `PRODUCT-latest/canvases/PRODUCT/<extension directory>` nested-folder URL
  (for Agent Plugins, `com.github.copilot/extensions/PRODUCT`);
- links to the README through `PRODUCT-latest`;
- includes the exact prompt needed to open the canvas;
- includes a numbered quickstart using actual UI labels; and
- retains applicable prerequisites, troubleshooting, and safety guidance.

An export may update the README only when the release PR explicitly presents
the customer-facing change for review. Missing sections, a wrapper-directory
install URL, a branch URL, or packaging-only prose blocks the release.
For a skill-only companion, use its approved skill-only install instructions,
native host-skill prerequisite, and runnable toolkit compatibility gate
instead of inventing an extension URL.

## Production release PR communication

Write the title for a customer, not a release ledger: start with the specific
problem and name the fix, for example
`Fix <specific customer blocker> with <Product> <version>`, rather than
`Release <Product>`. Put these two parts in the PR body, in this order:

1. **Customer change:** State the concrete problem, how this release fixes it,
   what a user can now do, and what remains unavailable or not yet enabled.
   Lead with the outcome, not build provenance or approval boilerplate.
2. **Release facts and handoff:** Keep a short, labeled list of the source
   revision (full SHA and a commit link if public), the *separate reviewed
   source package* commit and artifact link, version, and a link to `SHA256SUMS` with
   the relevant file's SHA-256 digest. Link the nested-folder install URL and
   customer README at the production candidate commit; label them **candidate**,
   not **latest**. After promotion, add the verified immutable-version and
   `PRODUCT-latest` URLs. Record commands/checks actually run and their results;
   mark unrun checks as **not run** with a reason and owner. Name only specific
   remaining risks or blockers, plus the next owner and action.

If the candidate changes, refresh its links, digests, and check results. Do not
claim approvals, latest availability, signing, or installer verification that
have not happened, or list unrelated risks and repeated generic gate language.
This PR-writing guidance does not replace the release order, verification, or
two-bullet announcement requirements.

## Copy/paste team announcement

Every release PR must include a ready-to-send announcement with exactly two
bullets. Replace every placeholder; do not hard-code this template to a future
version.

- **`<Product> <version>`:** `<short customer value and rollout statement>`.
  **Rollout owner:** `<person or team>`. **Dark-deployed:** `<status and scope,
  when applicable>`.
- **Install:** latest
  `<https://github.com/microsoft/azure-dev-tools/tree/<product>-latest/canvases/<product>/<extension-directory>>`;
  README
  `<https://github.com/microsoft/azure-dev-tools/blob/<product>-latest/canvases/<product>/README.md>`;
  exact version
  `<https://github.com/microsoft/azure-dev-tools/tree/<product>-v<major>-<minor>-<patch>-<source-sha>/canvases/<product>/<extension-directory>>`.

The first bullet must name the product and version, explain the value or rollout
in one short statement, and use the literal wording **Rollout owner:**. Include
the **Dark-deployed:** field when the release is available before broad
announcement or enablement. The second bullet must contain paste-ready latest,
README, and immutable source-qualified URLs.

## Governance

`SHA256SUMS` records file integrity digests. It is not a signature, does not
imply a signing mechanism, and does not claim installer verification.

Each release must also complete applicable security, legal, licensing,
third-party-notice, and open-source readiness reviews. The package exports
include their reviewed third-party notices; do not replace them without a new
release review.
