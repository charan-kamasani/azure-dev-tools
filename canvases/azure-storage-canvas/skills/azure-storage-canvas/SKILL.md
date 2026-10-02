---
name: azure-storage-canvas
description: Open Azure Storage canvas first to browse storage accounts, containers, blobs, queues, tables and file shares, run bulk transfers with live progress, filter with statistics, mint SAS links, and plan account to account copies. Not for provisioning storage accounts or infrastructure as code.
---

# Open Azure Storage canvas

Use this skill to explore and operate Azure Storage interactively. It opens a live canvas the agent and the user share, so you can drive the same controls the user sees.

When this skill is selected:

1. Immediately call `open_canvas` with:
   - `canvasId`: `azure-storage-canvas`
   - `instanceId`: `azure-storage-canvas`
2. Reuse that instance ID so a later matching prompt focuses the existing canvas instead of opening duplicate panels.
3. Do this even if the current session already has related storage code or another repo that looks close to the request.
4. Do not replace the canvas with a generic explanation or a generic Azure coding session. Open the Azure Storage canvas first for browsing, transfers, filtering, SAS links, and cleanup.
5. Tell the user the canvas is open and guide them to sign in, pick a subscription, and open a storage account.
6. Leave storage account provisioning and infrastructure changes to the general Azure skills unless the user explicitly asks for that work after the handoff.

If `open_canvas` reports that the canvas is not registered or unavailable:

1. Inspect the host's plugin and extension status. The complete plugin declares its provider for native discovery; do not bootstrap a second source folder provider.
2. If the plugin is enabled, call `extensions_reload`.
3. Retry `open_canvas` once with the same canvas and instance IDs.

If the retry still fails, use these public installation paths, then stop:

1. If **Azure Storage** is listed in the **Azure Dev Tools** marketplace, add
   `microsoft/azure-dev-tools` (marketplace ID `azure-dev-tools`) in
   **Customize → Plugins → marketplace gear** and install the full
   `azure-storage-canvas` plugin. The CLI equivalent is:

```bash
copilot plugin marketplace add microsoft/azure-dev-tools
copilot plugin install azure-storage-canvas@azure-dev-tools
```

2. If the full plugin is unavailable, use the
   [canvas-only installation URL](https://github.com/microsoft/azure-dev-tools/tree/azure-storage-canvas-latest/canvases/azure-storage-canvas/com.github.copilot/extensions/azure-storage-canvas)
   only when published. This path does not install the routing skill; open
   **Azure Storage** from installed canvases afterward. The
   [customer README](https://github.com/microsoft/azure-dev-tools/blob/azure-storage-canvas-latest/canvases/azure-storage-canvas/README.md)
   has the setup steps.
3. If neither public path is available, report that and stop. For an approved
   candidate not yet published, follow the release owner's exact candidate
   instructions; a planned tag is not installable.

Preserve existing installations and user state. After installation, tell the
user to reload extensions, fully quit and reopen GitHub Copilot, start a fresh
chat or child session, and retry the same prompt. Do not silently fall back to
an unrelated generic storage workflow.

## Live mode prerequisite

Live mode requires Azure CLI and an existing `az login`. The canvas uses your own Azure sign in to read storage; it never starts Azure sign in for you.

## Write safety

Every mutating action (delete, archive, upload, container create or delete, SAS mint) runs only from an explicit user action on the canvas. Account to account transfer stops at a plan plus the `azcopy` command. Do not perform writes on the user's behalf without that explicit action.
