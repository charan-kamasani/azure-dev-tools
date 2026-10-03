# Azure Storage canvas

Browse Azure Storage and operate it on one live surface that you and Copilot share.

## Install

In GitHub Copilot, open **Customize → Plugins → marketplace gear**, add
`microsoft/azure-dev-tools` (marketplace ID `azure-dev-tools`), and install
`azure-storage` when listed. The full plugin includes the canvas and
its opening skill.

For canvas-only installation, add the [Azure Storage canvas URL](https://github.com/microsoft/azure-dev-tools/tree/azure-storage-latest/canvases/azure-storage/com.github.copilot/extensions/azure-storage)
under **Customize → Canvases → +**. This does not install the opening skill;
open **Azure Storage** from your installed canvases.

The [latest customer README](https://github.com/microsoft/azure-dev-tools/blob/azure-storage-latest/canvases/azure-storage/README.md)
contains the same setup instructions. Use these paths only when published;
if neither is available, report that rather than substituting a source folder.

## Quickstart

1. With the full plugin installed, ask Copilot: **"Open Azure Storage canvas."**
   For a canvas-only installation, open **Azure Storage** from installed canvases.
2. Click **Select subscriptions** in **Storage Explorer**, choose the
   subscriptions you intend to browse, and apply the selection.
3. Expand a subscription and storage account in the tree, then open a blob
   container to see its blobs.
4. Use **Filter** to inspect statistics, or type **"What is taking up the most
   space?"** in the canvas question box. Browsing and filtering do not modify data.

## What it does

- Browse storage accounts, blob containers, and blobs with sizes, tiers, and timestamps.
- Filter a container and compute aggregate statistics (totals, size histogram, by type, by tier, by extension, top largest).
- Bulk download selected or filtered blobs with a live progress bar and a per file pass or fail summary.
- Preview a blob inline and ask Copilot to explain the file or the statistics on the canvas.
- Open a container SAS link with no sign in, list its blobs, and download them read only.
- Plan an account to account copy, detect name conflicts, and get the exact `azcopy` command without moving any data.

## How it is driven

Copilot can operate the same controls you see. Ask it to open an account, open a container, filter blobs, or download a set, and it drives the canvas live while you watch and can take over at any time.

## Requirements

Live mode uses the Azure CLI and your existing `az login`. The canvas reads storage with your own sign in and never starts a sign in for you. Every mutating action runs only from an explicit action on the canvas.

## Troubleshooting

- **Canvas unavailable:** check that the plugin is enabled, reload extensions,
  fully quit and reopen GitHub Copilot, then retry in a fresh chat.
- **No accounts or access denied:** use **Refresh subscriptions**, confirm the
  intended subscription selection, and check your Azure CLI sign-in and storage
  permissions. The canvas does not sign in or grant access for you.
- **SAS link rejected:** check its expiry and read/list permissions. Anyone
  holding a valid SAS can use its granted access; do not paste it into public
  issues or logs.
- **Transfer plan only:** account-to-account copies stop at an `azcopy`
  command. Install AzCopy separately to run that command yourself.
