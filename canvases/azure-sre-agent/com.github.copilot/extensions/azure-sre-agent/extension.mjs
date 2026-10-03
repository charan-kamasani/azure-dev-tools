import { createRequire as __canvasCreateRequire } from "node:module";
const require = __canvasCreateRequire(import.meta.url);

// canvases/azure-sre-agent/src/extension.mjs
import { execFile as execFile2 } from "node:child_process";
import { createHash as createHash2 } from "node:crypto";
import { createServer } from "node:http";
import { mkdirSync, readdirSync, readFileSync as readFileSync2, statSync, writeFileSync, renameSync, unlinkSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { dirname, join, relative } from "node:path";
import { promisify } from "node:util";
import { createCanvas, joinSession } from "@github/copilot-sdk/extension";
import { canvasUiAssets } from "./assets/toolkit/ui.mjs";

// packages/canvas-toolkit/src/ui/visual-profiles.mjs
var COREAI_AZURE_VISUAL_PROFILE = Object.freeze({
  id: "coreai-azure",
  className: "canvas-profile-coreai-azure",
  stylesheet: "canvas-ui/profiles/coreai-azure.css"
});
var canvasVisualProfiles = Object.freeze({
  [COREAI_AZURE_VISUAL_PROFILE.id]: COREAI_AZURE_VISUAL_PROFILE
});

// canvases/azure-sre-agent/src/composer-completion.mjs
function createComposerCompletion() {
  const registryVersion2 = "portal-screenshot-2026-10-01";
  const builtins2 = Object.freeze([
    ["agent", "Pick a subagent to assist you with tasks."],
    ["clear", "Start a new chat thread."],
    ["compact", "Agent responses are more concise in this mode."],
    ["incident", "List all incidents."],
    ["resource", "List all agent-managed resources."],
    ["remember", "Save information for the agent to remember."],
    ["retrieve", "Retrieve previously saved information."],
    ["incidentRetroMode", "Preview feature: filter IcM discussions to retrieve only relevant entries for the agent; useful when rerunning on past incidents."]
  ].map(([name, description]) => Object.freeze({ name, description, kind: "command", id: `command:${name}` })));
  function normalizeCompletionCatalog2(records, kind) {
    if (kind !== "skill" && kind !== "agent") throw new TypeError("Catalog kind must be skill or agent.");
    if (!Array.isArray(records) || records.length > 200) throw new TypeError("Catalog must be an array of at most 200 entries.");
    const seen = /* @__PURE__ */ new Set();
    return records.map((record2) => {
      if (!record2 || typeof record2 !== "object" || Array.isArray(record2)) throw new TypeError("Catalog entries must be objects.");
      const { name, description } = record2;
      if (typeof name !== "string" || name.length > 128 || !/^[A-Za-z0-9_][A-Za-z0-9_-]*$/.test(name)) {
        throw new TypeError("Catalog entry name must be a bounded command token.");
      }
      if (description !== void 0 && (typeof description !== "string" || description.length > 512)) {
        throw new TypeError("Catalog entry description must be a string of at most 512 characters.");
      }
      if (seen.has(name.toLowerCase())) throw new TypeError("Catalog contains duplicate names.");
      seen.add(name.toLowerCase());
      return Object.freeze({ name, description: description || "", kind, id: `${kind}:${name}` });
    });
  }
  function catalogState(catalog, kind) {
    if (!catalog) return { status: "unsupported", items: [], error: "Catalog discovery is not available." };
    if (!["ready", "loading", "error", "unsupported"].includes(catalog.status)) throw new TypeError("Invalid catalog status.");
    if (catalog.status === "ready") {
      if (catalog.notice !== void 0 && (typeof catalog.notice !== "string" || catalog.notice.length > 512)) throw new TypeError("Catalog notice must be bounded text.");
      return { status: "ready", items: normalizeCompletionCatalog2(catalog.items, kind), error: "", notice: catalog.notice || "" };
    }
    const message = catalog.error;
    if (message !== void 0 && (typeof message !== "string" || message.length > 512)) throw new TypeError("Catalog error must be bounded text.");
    return { status: catalog.status, items: [], error: message || (catalog.status === "loading" ? "" : "Catalog discovery is not available.") };
  }
  function createCompletionCatalogStore2() {
    let generation = 0;
    let scope = null;
    let catalogs = { skills: catalogState(null, "skill"), agents: catalogState(null, "agent") };
    function begin(nextScope) {
      if (typeof nextScope !== "string" || !nextScope || nextScope.length > 2048) throw new TypeError("A bounded agent scope identity is required.");
      scope = nextScope;
      generation++;
      catalogs = { skills: { status: "loading", items: [], error: "" }, agents: { status: "loading", items: [], error: "" } };
      return Object.freeze({ scope, generation });
    }
    function commit(ticket, next) {
      if (!ticket || ticket.scope !== scope || ticket.generation !== generation) return false;
      if (!next || typeof next !== "object") throw new TypeError("Catalog states are required.");
      const skills = catalogState(next.skills, "skill");
      const agents = catalogState(next.agents, "agent");
      catalogs = { skills, agents };
      return true;
    }
    return {
      begin,
      commit,
      snapshot: () => ({
        skills: { ...catalogs.skills, items: [...catalogs.skills.items] },
        agents: { ...catalogs.agents, items: [...catalogs.agents.items] }
      })
    };
  }
  function completionContext2(value, selectionStart, selectionEnd = selectionStart) {
    if (typeof value !== "string" || !Number.isInteger(selectionStart) || selectionStart < 0 || selectionStart > value.length || selectionEnd !== selectionStart) return null;
    const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
    const prefix = value.slice(lineStart, selectionStart);
    const match = /^[ \t]*\/(?:(agent)[ \t]+([A-Za-z0-9_-]*)|([A-Za-z0-9_-]*))$/i.exec(prefix);
    if (!match) return null;
    const nested = Boolean(match[1]);
    const start = nested ? selectionStart - match[2].length : lineStart + prefix.indexOf("/");
    let end = selectionStart;
    while (end < value.length && /[A-Za-z0-9_-]/.test(value[end])) end++;
    return { level: nested ? "agents" : "root", query: nested ? match[2] : match[3], start, end, value, selectionStart };
  }
  function getCompletionMenu2({ value, selectionStart, selectionEnd = selectionStart, skills, agents, composing = false }) {
    const context = composing ? null : completionContext2(value, selectionStart, selectionEnd);
    if (!context) return null;
    const filter = (items) => items.filter((item) => item.name.toLowerCase().startsWith(context.query.toLowerCase()));
    const dynamic = catalogState(context.level === "agents" ? agents : skills, context.level === "agents" ? "agent" : "skill");
    const groups = context.level === "agents" ? [
      { label: "AGENTS", status: dynamic.status, error: dynamic.error, notice: dynamic.notice, items: filter(dynamic.items) }
    ] : [
      { label: "COMMANDS", status: "ready", error: "", items: filter(builtins2) },
      { label: "SKILLS", status: dynamic.status, error: dynamic.error, notice: dynamic.notice, items: filter(dynamic.items).filter((item) => !builtins2.some((command) => command.name.toLowerCase() === item.name.toLowerCase())) }
    ];
    return { ...context, groups, items: groups.flatMap((group) => group.items), registryVersion: registryVersion2 };
  }
  function applyCompletion2({ value, selectionStart, selectionEnd = selectionStart }, menu, item) {
    if (!menu || value !== menu.value || selectionStart !== menu.selectionStart || selectionEnd !== selectionStart || !menu.items.some((candidate) => candidate.id === item?.id && candidate.name === item.name)) return null;
    const token = item.kind === "agent" ? item.name : `/${item.name}`;
    const suffix = value.slice(menu.end);
    const separator = /^\s/.test(suffix) ? "" : " ";
    const nextValue = value.slice(0, menu.start) + token + separator + suffix;
    const caret = menu.start + token.length + (separator.length || (/^[ \t]/.test(suffix) ? 1 : 0));
    return { value: nextValue, selectionStart: caret, selectionEnd: caret, openAgents: item.kind === "command" && item.name === "agent" };
  }
  function completionKey2(event, menu, activeIndex = 0, composing = false) {
    const none = { action: "none", preventDefault: false, index: activeIndex };
    if (!menu || composing || event.isComposing || event.keyCode === 229 || event.ctrlKey || event.metaKey || event.altKey) return none;
    const count = menu.items.length;
    if (event.key === "Escape") return { action: "dismiss", preventDefault: true, index: activeIndex };
    if (event.key === "ArrowLeft" && menu.level === "agents" && !menu.query) return { action: "back", preventDefault: true, index: 0 };
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      return { action: "navigate", preventDefault: true, index: count ? (activeIndex + (event.key === "ArrowDown" ? 1 : -1) + count) % count : -1 };
    }
    if ((event.key === "Enter" || event.key === "Tab") && !event.shiftKey) {
      return { action: count ? "complete" : "none", preventDefault: count > 0 || event.key === "Enter", index: count ? Math.max(0, Math.min(activeIndex, count - 1)) : -1 };
    }
    return none;
  }
  function completionAria2(menu, activeIndex = 0, listboxId = "sre-completion-menu") {
    if (typeof listboxId !== "string" || !/^[A-Za-z][A-Za-z0-9_-]{0,127}$/.test(listboxId)) throw new TypeError("Listbox id must be a bounded HTML identifier.");
    const options = (menu?.items || []).map((item, index) => ({
      id: `${listboxId}-${index}`,
      role: "option",
      "aria-selected": String(index === activeIndex),
      item
    }));
    return {
      input: {
        role: "combobox",
        "aria-autocomplete": "list",
        "aria-haspopup": "listbox",
        "aria-expanded": String(Boolean(menu)),
        "aria-controls": listboxId,
        "aria-activedescendant": options[activeIndex]?.id || ""
      },
      listbox: { id: listboxId, role: "listbox", "aria-label": menu?.level === "agents" ? "SRE custom agents" : "Commands and skills" },
      options
    };
  }
  function bindComposerCompletion2({ input, getCatalogs = () => ({}), render, onChange = () => {
  } }) {
    let menu = null;
    let activeIndex = 0;
    let composing = false;
    let dismissed = false;
    let rootOverride = false;
    function refresh(reset = false) {
      if (reset) {
        activeIndex = 0;
        dismissed = false;
        rootOverride = false;
      }
      menu = dismissed || input.readOnly || input.disabled ? null : getCompletionMenu2({
        value: input.value,
        selectionStart: input.selectionStart,
        selectionEnd: input.selectionEnd,
        ...getCatalogs(),
        composing
      });
      if (rootOverride && menu?.level === "agents") {
        const slash = input.value.lastIndexOf("/", menu.start);
        menu = getCompletionMenu2({ value: input.value.slice(0, slash + 1), selectionStart: slash + 1, ...getCatalogs() });
        if (menu) menu = { ...menu, value: input.value, selectionStart: input.selectionStart, start: slash, end: completionContext2(input.value, input.selectionStart)?.end ?? input.selectionStart };
      }
      if (menu) activeIndex = Math.max(0, Math.min(activeIndex, menu.items.length - 1));
      render(menu, activeIndex);
      return menu;
    }
    function choose(index) {
      const item = menu?.items[index];
      if (!item || composing || input.readOnly || input.disabled) return false;
      const completion = applyCompletion2(input, menu, item);
      if (!completion) {
        refresh(true);
        return false;
      }
      input.value = completion.value;
      input.focus();
      input.setSelectionRange(completion.selectionStart, completion.selectionEnd);
      dismissed = !completion.openAgents;
      rootOverride = false;
      activeIndex = 0;
      onChange(completion);
      refresh();
      return true;
    }
    function back() {
      rootOverride = true;
      activeIndex = 0;
      refresh();
    }
    function keydown(event) {
      const decision = completionKey2(event, menu, activeIndex, composing);
      if (!decision.preventDefault) return false;
      event.preventDefault();
      if (decision.action === "complete") choose(decision.index);
      else if (decision.action === "navigate") {
        activeIndex = decision.index;
        render(menu, activeIndex);
      } else if (decision.action === "dismiss") {
        dismissed = true;
        refresh();
      } else if (decision.action === "back") back();
      return true;
    }
    const handlers = {
      input: () => refresh(true),
      click: () => refresh(true),
      select: () => refresh(),
      compositionstart: () => {
        composing = true;
        refresh();
      },
      compositionend: () => {
        composing = false;
        refresh(true);
      }
    };
    for (const [name, handler] of Object.entries(handlers)) input.addEventListener(name, handler);
    refresh();
    return {
      keydown,
      choose,
      back,
      refresh,
      dismiss: () => {
        dismissed = true;
        refresh();
      },
      dispose: () => {
        for (const [name, handler] of Object.entries(handlers)) input.removeEventListener(name, handler);
        render(null, 0);
      }
    };
  }
  return { registryVersion: registryVersion2, builtins: builtins2, normalizeCompletionCatalog: normalizeCompletionCatalog2, createCompletionCatalogStore: createCompletionCatalogStore2, completionContext: completionContext2, getCompletionMenu: getCompletionMenu2, applyCompletion: applyCompletion2, completionKey: completionKey2, completionAria: completionAria2, bindComposerCompletion: bindComposerCompletion2 };
}
var {
  registryVersion,
  builtins,
  normalizeCompletionCatalog,
  createCompletionCatalogStore,
  completionContext,
  getCompletionMenu,
  applyCompletion,
  completionKey,
  completionAria,
  bindComposerCompletion
} = createComposerCompletion();
function composerCompletionBrowserSource() {
  return `(${createComposerCompletion.toString()})()`;
}

// canvases/azure-sre-agent/src/completion-catalog.mjs
var ENABLED_SKILL_CATALOG_ROUTE = "/api/v2/agent/skills";
var CUSTOM_AGENT_CATALOG_ROUTE = "/api/v1/extendedAgent/agents?page=1&limit=200";
var SKILL_CATALOG_LIMIT = 200;
var SKILL_CATALOG_BUDGET = 16e3;
function projectSkillCatalog(payload) {
  const records = Array.isArray(payload) ? payload : [payload?.value, payload?.data, payload?.skills, payload?.data?.skills?.data].find(Array.isArray);
  if (!records) throw new Error("The skill catalog returned an unsupported response shape.");
  if (payload?.nextLink != null && typeof payload.nextLink !== "string") {
    throw new Error("The skill catalog returned unsupported continuation metadata.");
  }
  const continuationAvailable = Boolean(payload?.nextLink);
  const items = [];
  const seen = /* @__PURE__ */ new Set();
  let excluded = 0;
  let omitted = 0;
  for (const record2 of records) {
    const name = record2?.name;
    const description = record2?.properties?.description;
    if (!record2 || typeof record2 !== "object" || Array.isArray(record2) || typeof name !== "string" || name.length > 128 || !/^[A-Za-z0-9_][A-Za-z0-9_-]*$/.test(name) || description != null && typeof description !== "string" || seen.has(name.toLowerCase())) {
      excluded++;
      continue;
    }
    seen.add(name.toLowerCase());
    const item = { name, description: (description || "").slice(0, 256) };
    if (items.length >= SKILL_CATALOG_LIMIT || JSON.stringify([...items, item]).length > SKILL_CATALOG_BUDGET - 1024) {
      omitted++;
      continue;
    }
    items.push(item);
  }
  if (records.length && !items.length && excluded === records.length) {
    throw new Error("The skill catalog contained no readable slash-token names.");
  }
  const notice = [
    "Configured custom skills only. Built-in skill discovery is not verified.",
    omitted ? `${omitted} additional skills are not shown in this bounded menu.` : "",
    excluded ? `${excluded} records with unsupported names, descriptions, or duplicate names are not shown.` : "",
    continuationAvailable ? "The service reports another page; only this page is shown." : ""
  ].filter(Boolean).join(" ");
  return {
    status: "ready",
    items,
    error: "",
    totalReceived: records.length,
    omitted,
    excluded,
    continuationAvailable,
    partial: Boolean(omitted || excluded || continuationAvailable),
    notice
  };
}
function projectEnabledSkillCatalog(payload) {
  if (!Array.isArray(payload?.data)) throw new Error("The enabled skill catalog returned an unsupported response shape.");
  if (payload.data.some((record2) => typeof record2?.enabled !== "boolean")) {
    throw new Error("The enabled skill catalog returned unsupported enabled-state metadata.");
  }
  const enabled = payload.data.filter((record2) => record2.enabled === true);
  const result = projectSkillCatalog(enabled.map((record2) => ({
    name: record2.skillId,
    properties: { description: record2.description }
  })));
  const disabled = payload.data.length - enabled.length;
  result.notice = result.notice.replace(
    "Configured custom skills only. Built-in skill discovery is not verified.",
    "Enabled built-in and custom skills for the connected agent. Selecting a skill only fills the draft."
  ) + (disabled ? ` ${disabled} disabled skills are not suggested.` : "");
  return { ...result, disabled };
}
function projectCustomAgentCatalog(payload) {
  if (!Array.isArray(payload?.data) || typeof payload.has_next_page !== "boolean") {
    throw new Error("The custom-agent catalog returned an unsupported response shape or pagination metadata.");
  }
  const result = projectSkillCatalog({
    value: payload.data.map((record2) => ({ name: record2?.name, properties: { description: record2?.handoffDescription } })),
    nextLink: payload.has_next_page ? "more" : ""
  });
  result.notice = result.notice.replace(
    "Configured custom skills only. Built-in skill discovery is not verified.",
    "Configured custom agents for this connection. Selection only fills the draft; invocation modes are not verified."
  ).replace("additional skills", "additional agents");
  return result;
}
async function readCompletionCatalog(entry, fetchImpl) {
  const agent = entry.agent;
  if (!agent) throw new Error("Select an SRE Agent before loading suggestions.");
  if (agent.external) {
    const unavailable = { status: "unsupported", items: [], error: "Catalog discovery is unavailable for external agents." };
    return { skills: unavailable, agents: unavailable };
  }
  const subscription = entry.subscription;
  const generation = entry.selectionGeneration;
  const results = await Promise.allSettled([
    [ENABLED_SKILL_CATALOG_ROUTE, projectEnabledSkillCatalog, "skill"],
    [CUSTOM_AGENT_CATALOG_ROUTE, projectCustomAgentCatalog, "custom-agent"]
  ].map(async ([route, project, kind]) => project(await fetchImpl(
    agent,
    subscription,
    "GET",
    route,
    void 0,
    entry,
    { title: `list ${kind} suggestions`, timeoutMs: 15e3 }
  ))));
  if (entry.agent !== agent || entry.subscription !== subscription || entry.selectionGeneration !== generation) {
    throw new Error("The connected agent changed while suggestions were loading. Retry for the current agent.");
  }
  const state = (result) => result.status === "fulfilled" ? result.value : { status: "error", items: [], error: `Catalog discovery failed: ${result.reason?.message || "Read failed."}`.slice(0, 512) };
  return { skills: state(results[0]), agents: state(results[1]) };
}

// packages/canvas-toolkit/src/subscriptions.mjs
var GUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
var clouds = {
  AzureCloud: "https://management.azure.com",
  AzureUSGovernment: "https://management.usgovcloudapi.net",
  AzureChinaCloud: "https://management.chinacloudapi.cn"
};
var SubscriptionError = class extends Error {
  constructor(code, message) {
    super(message);
    this.name = "SubscriptionError";
    this.code = code;
  }
};
function fail(code, message) {
  throw new SubscriptionError(code, message);
}
function normalizeSubscriptionScope(scope) {
  if (!scope || typeof scope !== "object" || Array.isArray(scope) || typeof scope.tenantId !== "string" || !GUID.test(scope.tenantId) || !Array.isArray(scope.subscriptionIds) || !scope.subscriptionIds.length || scope.subscriptionIds.length > 1e3 || scope.subscriptionIds.some((id) => typeof id !== "string" || !GUID.test(id)) || new Set(scope.subscriptionIds.map((id) => id.toLowerCase())).size !== scope.subscriptionIds.length || typeof scope.cloud !== "string" || !Object.hasOwn(clouds, scope.cloud)) {
    fail("invalid-scope", "Choose an explicit tenant, one or more unique subscription IDs, and a supported Azure cloud.");
  }
  return { tenantId: scope.tenantId.toLowerCase(), subscriptionIds: scope.subscriptionIds.map((id) => id.toLowerCase()), cloud: scope.cloud };
}

// canvases/azure-sre-agent/src/subscription-scope.mjs
var lower = (value) => String(value || "").toLowerCase();
var guid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function createSreSubscriptionInventory(load) {
  let snapshot2 = { accounts: [], revision: 0 };
  let pending = null;
  let loaded = false;
  let refreshFailed = false;
  async function refresh(force = false) {
    if (pending) return pending;
    if (loaded && !force && !refreshFailed) return structuredClone(snapshot2);
    pending = Promise.resolve().then(() => load(force || refreshFailed)).then((rows) => {
      if (!Array.isArray(rows)) throw new Error("Azure CLI returned an invalid subscription inventory.");
      const accounts = rows.map((row) => {
        if (!row || typeof row !== "object") throw new Error("Azure CLI returned invalid subscription metadata.");
        const cloud = row.cloudName || row.environmentName || row.cloud;
        const accountName = row.user?.name || row.accountName;
        if (!guid.test(row.id || "") || !guid.test(row.tenantId || "") || typeof cloud !== "string" || !cloud.trim() || typeof accountName !== "string" || !accountName.trim()) {
          throw new Error("Azure CLI subscription metadata is missing its tenant, cloud, or account identity. Reload your Azure CLI profile and retry.");
        }
        return {
          key: JSON.stringify([cloud, lower(row.tenantId), lower(row.id), lower(accountName)]),
          id: row.id,
          name: row.name || row.id,
          tenantId: row.tenantId,
          tenantName: row.tenantDisplayName || row.tenantName || row.tenantId,
          cloud,
          accountName,
          state: row.state,
          isDefault: Boolean(row.isDefault),
          disabled: cloud !== "AzureCloud",
          disabledReason: cloud !== "AzureCloud" ? "SRE Agent discovery currently supports AzureCloud only." : ""
        };
      });
      snapshot2 = { accounts, revision: snapshot2.revision + 1 };
      loaded = true;
      refreshFailed = false;
      return structuredClone(snapshot2);
    }).catch((error) => {
      refreshFailed = true;
      throw error;
    }).finally(() => {
      pending = null;
    });
    return pending;
  }
  function resolve(request) {
    if (!loaded || pending || refreshFailed || request?.revision !== snapshot2.revision || !Array.isArray(request.selectedKeys) || !request.selectedKeys.length || new Set(request.selectedKeys).size !== request.selectedKeys.length) {
      throw new Error("Refresh subscriptions and choose the scope again.");
    }
    const normalized = normalizeSubscriptionScope(request);
    const accounts = request.selectedKeys.map((key) => {
      const matches = snapshot2.accounts.filter((account) => account.key === key);
      if (matches.length !== 1) throw new Error("The selected subscription identity is unavailable or ambiguous. Refresh subscriptions.");
      return matches[0];
    });
    if (normalized.cloud !== "AzureCloud" || accounts.length !== normalized.subscriptionIds.length || accounts.some((account) => account.disabled || lower(account.state) !== "enabled" || lower(account.tenantId) !== normalized.tenantId || account.cloud !== normalized.cloud || !normalized.subscriptionIds.includes(lower(account.id)))) {
      throw new Error("Choose available subscriptions from one AzureCloud tenant.");
    }
    const principals = new Set(accounts.map((account) => lower(account.accountName)));
    if (principals.size !== 1 || accounts.some((account) => new Set(snapshot2.accounts.filter((candidate) => lower(candidate.id) === lower(account.id) && lower(candidate.tenantId) === lower(account.tenantId) && candidate.cloud === account.cloud).map((candidate) => lower(candidate.accountName))).size !== 1)) {
      throw new Error("Choose subscriptions from one unambiguous Azure account.");
    }
    return {
      ...normalized,
      tenantName: accounts[0].tenantName,
      selectedKeys: [...request.selectedKeys],
      revision: snapshot2.revision,
      subscriptions: accounts.map(({ id, name }) => ({ id, name }))
    };
  }
  return { refresh, resolve, getSnapshot: () => structuredClone(snapshot2) };
}
function createSreAgentDiscovery() {
  let active = 0;
  const waiting = [];
  async function acquire() {
    if (active < 2) active++;
    else await new Promise((resolve) => waiting.push(resolve));
    return () => {
      if (waiting.length) waiting.shift()();
      else active--;
    };
  }
  return async function discover(subscriptionIds, load, isCurrent = () => true) {
    const agents = [];
    const errors = [];
    let index = 0;
    async function worker() {
      while (index < subscriptionIds.length && isCurrent()) {
        const subscription = subscriptionIds[index++];
        const release = await acquire();
        try {
          if (!isCurrent()) continue;
          const rows = await load(subscription);
          if (!Array.isArray(rows)) throw new Error("The agent service returned an invalid list.");
          if (rows.some((agent) => lower(agent?.id?.match(/^\/subscriptions\/([^/]+)\//i)?.[1]) !== lower(subscription))) {
            throw new Error("Agent discovery returned a resource outside the requested subscription.");
          }
          if (new Set(rows.map((agent) => lower(agent.id))).size !== rows.length) {
            throw new Error("Agent discovery returned duplicate resource identities.");
          }
          if (isCurrent()) agents.push(...rows.map((agent) => ({ ...agent, subscriptionId: subscription })));
        } catch (error) {
          if (isCurrent()) errors.push({ subscription, error });
        } finally {
          release();
        }
      }
    }
    await Promise.all([worker(), worker()]);
    return { agents, errors };
  };
}
var discoverSreAgents = createSreAgentDiscovery();
function projectSreAgentDiscovery(agents, subscription, error = "", loading = false) {
  if (!Array.isArray(agents)) throw new Error("Agent discovery has no valid resource list.");
  let result = {
    ok: true,
    agents: [],
    subscription,
    total: agents.length,
    omitted: agents.length,
    partial: Boolean(error),
    discoveryError: String(error).slice(0, 1600),
    discoveryLoading: Boolean(loading)
  };
  for (const agent of agents) {
    if (result.agents.length >= 25) break;
    const projected = {
      id: agent.id,
      name: agent.name,
      resourceGroup: agent.resourceGroup,
      subscriptionId: agent.subscriptionId,
      location: agent.location,
      provisioningState: agent.provisioningState
    };
    const candidate = { ...result, agents: [...result.agents, projected], omitted: result.omitted - 1 };
    if (JSON.stringify(candidate).length <= 16e3) result = candidate;
  }
  return result;
}

// canvases/azure-sre-agent/src/automation-model.mjs
function createAutomationModel() {
  const AUTOMATION_LIMIT2 = 100;
  const AUTOMATION_HISTORY_LIMIT2 = 50;
  const AUTOMATION_TEXT_LIMIT2 = 400;
  const AUTOMATION_MODEL_LIMIT2 = 25;
  const AUTOMATION_MODEL_BUDGET2 = 16e3;
  const AUTOMATION_API_REFERENCE2 = "https://learn.microsoft.com/en-us/azure/sre-agent/api-reference";
  const readStates = ["available", "unavailable", "failed", "stale", "unsupported"];
  const record2 = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
  const identity = (value) => typeof value === "string" && value.trim() && value.length <= 1024 ? value : null;
  const scopedIdentity = (value) => typeof value === "string" && value.length <= 8192 ? value : null;
  const itemIdentity = (value) => identity(value) && !/https?:\/\//i.test(value) ? value : null;
  const boundedLimit = (value, maximum) => Number.isInteger(value) && value >= 0 ? Math.min(value, maximum) : maximum;
  const text2 = (value) => typeof value === "string" ? value.slice(0, AUTOMATION_TEXT_LIMIT2).replace(/https?:\/\/[^\s<>"']+/gi, "[URL omitted]").slice(0, AUTOMATION_TEXT_LIMIT2) : null;
  const count = (value) => Number.isSafeInteger(value) && value >= 0 ? value : null;
  function automationAgentKey2(agent, subscription = "") {
    if (!record2(agent)) return null;
    if (agent.external) {
      try {
        if (!identity(agent.endpoint)) return null;
        const endpoint = new URL(agent.endpoint);
        if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) return null;
        return JSON.stringify(["external", endpoint.href.replace(/\/$/, "")]);
      } catch {
        return null;
      }
    }
    const id = identity(agent.id);
    const scope = identity(subscription || id?.match(/^\/subscriptions\/([^/]+)/i)?.[1]);
    const resource = id || (identity(agent.resourceGroup) && identity(agent.name) ? `${agent.resourceGroup}/${agent.name}` : null);
    return scope && resource ? JSON.stringify(["native", scope.toLowerCase(), resource.toLowerCase()]) : null;
  }
  function statusOf(raw) {
    const rawStatus = text2(raw.status);
    const status = rawStatus?.toLowerCase();
    let enabled = typeof raw.enabled === "boolean" ? raw.enabled : typeof raw.triggerEnabled === "boolean" ? raw.triggerEnabled : null;
    const statusEnabled = ["on", "enabled", "active"].includes(status) ? true : ["off", "disabled", "paused"].includes(status) ? false : null;
    if (status && statusEnabled === null) return { status: "unknown", rawStatus, enabled: null };
    if (enabled !== null && statusEnabled !== null && enabled !== statusEnabled) {
      return { status: "unknown", rawStatus, enabled: null };
    }
    enabled ??= statusEnabled;
    return { status: enabled === true ? "on" : enabled === false ? "off" : "unknown", rawStatus, enabled };
  }
  function normalizeItem(raw, type, agentKey) {
    if (!record2(raw)) return null;
    if (type === "scheduled" && raw.triggerType && raw.triggerType !== "ScheduledTask") return null;
    const id = itemIdentity(raw.id) || (type === "scheduled" ? itemIdentity(raw.name) : null);
    return {
      key: id ? JSON.stringify([agentKey, type, id]) : null,
      agentKey,
      id,
      type,
      name: text2(raw.name) || "Unnamed automation",
      description: text2(raw.description),
      ...statusOf(raw),
      cron: type === "scheduled" ? text2(raw.cron ?? raw.cronExpression ?? raw.schedule) : null,
      createdBy: text2(raw.createdBy),
      lastRun: text2(raw.lastRun ?? raw.lastRunTime ?? raw.lastExecutionTime),
      nextRun: text2(raw.nextRun ?? raw.nextRunTime ?? raw.nextExecutionTime),
      completedRuns: count(raw.completedRuns ?? raw.executionCount),
      schema: type === "scheduled" ? "existing-canvas" : "portal-http-collection"
    };
  }
  function normalizeSource(payload, type, agentKey, error, limit) {
    if (error) return { status: "failed", reason: "Automation discovery failed.", items: [], received: null, truncated: false };
    if (payload === void 0 || payload === null) {
      return { status: "unavailable", reason: "Automation discovery has not completed.", items: [], received: null, truncated: false };
    }
    const rows = Array.isArray(payload) ? payload : record2(payload) && Array.isArray(payload.value) ? payload.value : null;
    if (!rows) return { status: "failed", reason: "Unsupported automation list response shape.", items: [], received: null, truncated: false };
    const items = [];
    const keys = /* @__PURE__ */ new Set();
    let invalid = 0;
    for (const raw of rows.slice(0, limit)) {
      const item = normalizeItem(raw, type, agentKey);
      if (!item || item.key && keys.has(item.key)) {
        invalid++;
        continue;
      }
      if (item.key) keys.add(item.key);
      items.push(item);
    }
    return {
      status: "available",
      reason: null,
      items,
      received: rows.length,
      invalid,
      truncated: rows.length > limit || Boolean(payload?.nextLink || payload?.["@odata.nextLink"])
    };
  }
  function normalizeAutomationCatalog2({
    agent,
    subscription,
    scheduledTasks,
    httpTriggers,
    scheduledTasksError,
    httpTriggersError,
    generation = 0,
    limit = AUTOMATION_LIMIT2
  } = {}) {
    const agentKey = automationAgentKey2(agent, subscription);
    const blocked = !agentKey;
    const unsupported = {
      status: "unsupported",
      reason: "A stable selected-agent identity is required.",
      items: [],
      received: null,
      truncated: false
    };
    const maximum = boundedLimit(limit, AUTOMATION_LIMIT2);
    const scheduled = blocked ? { ...unsupported } : normalizeSource(scheduledTasks, "scheduled", agentKey, scheduledTasksError, maximum);
    const http = blocked ? { ...unsupported } : normalizeSource(httpTriggers, "http", agentKey, httpTriggersError, maximum);
    return {
      agentKey,
      generation,
      sources: { scheduled, http },
      items: [...scheduled.items, ...http.items],
      truncated: scheduled.truncated || http.truncated
    };
  }
  function isAutomationSnapshotCurrent2(catalog, agentKey, generation = catalog?.generation) {
    return Boolean(agentKey && catalog?.agentKey === agentKey && catalog.generation === generation);
  }
  function filterAutomations2(catalog, { query = "", status = "all", type = "all" } = {}) {
    const rows = (catalog?.items || []).slice(0, AUTOMATION_LIMIT2 * 2);
    const needle = typeof query === "string" ? query.slice(0, AUTOMATION_TEXT_LIMIT2).trim().toLowerCase() : "";
    const searched = rows.filter((item) => item.name.toLowerCase().includes(needle));
    const statuses = { all: searched.length, on: 0, off: 0, unknown: 0 };
    const types = { all: searched.length, scheduled: 0, http: 0 };
    for (const item of searched) {
      statuses[item.status]++;
      types[item.type]++;
    }
    const items = searched.filter((item) => (status === "all" || item.status === status) && (type === "all" || item.type === type));
    return { items, counts: { statuses, types, matching: items.length, loaded: rows.length, scope: "bounded-loaded-rows" }, truncated: Boolean(catalog?.truncated) };
  }
  function selectAutomation2(catalog, selection, { agentKey, generation = catalog?.generation } = {}) {
    if (!isAutomationSnapshotCurrent2(catalog, agentKey, generation) || selection?.agentKey !== agentKey) {
      return { status: "stale", item: null };
    }
    const item = catalog.items.find((row) => row.key && row.key === selection.key);
    return item ? { status: "available", item } : { status: "missing", item: null };
  }
  function action(supported, available, reason, route = null, mutates = false) {
    return { supported, available, reason: available ? null : reason, route, mutates };
  }
  function automationActionMetadata2(item, { agentKey, writesAllowed = false, external = false } = {}) {
    const native = Boolean(agentKey?.startsWith('["native",'));
    const current = Boolean(item?.agentKey && item.agentKey === agentKey && (!native || !external));
    const selected = current && Boolean(item?.id && item.key);
    const scheduled = item?.type === "scheduled";
    const readable = current;
    const writable = selected && writesAllowed === true;
    const safetyReason = !current ? "Selected agent changed or is unsupported." : !selected ? "A stable automation identity is required." : !writesAllowed ? "Writes are disabled." : "Automation state does not allow this action.";
    const taskPath = selected && scheduled ? `/api/v1/scheduledtasks/${encodeURIComponent(item.id)}` : null;
    const unsupported = (reason) => action(false, false, reason, null, true);
    return {
      refresh: action(true, readable, safetyReason, {
        method: "GET",
        path: scheduled ? "/api/v1/scheduledtasks" : "/api/v1/httptriggers"
      }),
      pause: scheduled ? action(true, writable && item.status === "on", safetyReason, taskPath ? { method: "POST", path: `${taskPath}/pause` } : null, true) : unsupported("HTTP enable/disable contract is not verified."),
      resume: scheduled ? action(true, writable && item.status === "off", safetyReason, taskPath ? { method: "POST", path: `${taskPath}/resume` } : null, true) : unsupported("HTTP enable/disable contract is not verified."),
      runNow: scheduled ? action(true, writable, safetyReason, taskPath ? { method: "POST", path: `${taskPath}/execute` } : null, true) : unsupported("HTTP execute route is documented, but response identity/body and the canvas handler are not verified."),
      edit: unsupported("Configured-resource APIs are documented, but no verified edit adapter is connected."),
      delete: scheduled ? action(true, writable, safetyReason, taskPath ? { method: "DELETE", path: taskPath } : null, true) : unsupported("No verified HTTP delete adapter is connected."),
      configure: unsupported("Trigger configuration contract is not verified."),
      history: scheduled ? action(true, selected, safetyReason, taskPath ? { method: "GET", path: `${taskPath}/executions` } : null) : action(false, false, "HTTP-trigger execution history is not connected.")
    };
  }
  function automationCatalogActionMetadata2(catalog, { agentKey, generation = catalog?.generation, writesAllowed = false } = {}) {
    const current = isAutomationSnapshotCurrent2(catalog, agentKey, generation);
    const native = Boolean(agentKey?.startsWith('["native",'));
    const reason = !current ? "Selected agent changed or is unsupported." : "Writes are disabled.";
    return {
      refreshScheduled: action(true, current, reason, { method: "GET", path: "/api/v1/scheduledtasks" }),
      refreshHttp: action(true, current, reason, { method: "GET", path: "/api/v1/httptriggers" }),
      createScheduled: action(true, current && native && writesAllowed === true, reason, { method: "POST", path: "/api/v1/scheduledtasks" }, true),
      createHttp: action(false, false, "HTTP create route is documented, but its request body and canvas handler are not verified.", null, true)
    };
  }
  function normalizeAutomationHistory2(item, observation, { contract, limit = AUTOMATION_HISTORY_LIMIT2 } = {}) {
    const result = { status: "unavailable", reason: "No verified run-history read contract is connected.", agentKey: item?.agentKey ?? null, automationKey: item?.key ?? null, runs: [], truncated: false };
    if (!item?.key) return result;
    if (observation && (observation.agentKey !== item.agentKey || observation.automationKey !== item.key)) {
      return { ...result, status: "stale", reason: "Run history belongs to another agent or automation." };
    }
    if (observation?.status === "failed") return { ...result, status: "failed", reason: "Run-history discovery failed." };
    if (contract?.verified !== true || !identity(contract.source) || !identity(contract.idField) || !Array.isArray(observation?.runs) || observation.status !== "available") return result;
    const maximum = boundedLimit(limit, AUTOMATION_HISTORY_LIMIT2);
    const runs = [];
    const keys = /* @__PURE__ */ new Set();
    for (const raw of observation.runs.slice(0, maximum)) {
      if (!record2(raw)) continue;
      const id = itemIdentity(raw[contract.idField]);
      if (!id || keys.has(id)) continue;
      keys.add(id);
      const threadId2 = identity(contract.threadIdField) ? itemIdentity(raw[contract.threadIdField]) : null;
      runs.push({
        key: JSON.stringify([item.key, id]),
        id,
        agentKey: item.agentKey,
        automationKey: item.key,
        startTime: text2(raw[contract.startTimeField]),
        status: text2(raw[contract.statusField]) || "Unknown",
        threadId: threadId2,
        threadName: text2(raw[contract.threadNameField]),
        association: threadId2 ? "verified-id" : "unavailable"
      });
    }
    return { ...result, status: "available", reason: null, runs, truncated: observation.runs.length > maximum || observation.hasMore === true };
  }
  function resolveAutomationRunThread2(history, runKey, { agentKey, automationKey } = {}) {
    if (!agentKey || history?.agentKey !== agentKey || history.automationKey !== automationKey) return { status: "stale", threadId: null };
    if (history.status !== "available") return { status: "unavailable", threadId: null };
    const run = history.runs.find((row) => row.key === runKey);
    if (!run) return { status: "missing", threadId: null };
    return run.association === "verified-id" && run.threadId ? { status: "available", threadId: run.threadId } : { status: "unsupported", threadId: null };
  }
  function projectAutomation2(item) {
    if (!record2(item)) return null;
    return {
      key: scopedIdentity(item.key),
      agentKey: scopedIdentity(item.agentKey),
      id: itemIdentity(item.id),
      type: item.type === "http" ? "http" : item.type === "scheduled" ? "scheduled" : "unknown",
      name: text2(item.name),
      description: text2(item.description),
      status: ["on", "off"].includes(item.status) ? item.status : "unknown",
      rawStatus: text2(item.rawStatus),
      cron: text2(item.cron),
      createdBy: text2(item.createdBy),
      lastRun: text2(item.lastRun),
      nextRun: text2(item.nextRun),
      completedRuns: count(item.completedRuns)
    };
  }
  function projectAutomationCatalog2(catalog) {
    const rows = (catalog?.items || []).slice(0, AUTOMATION_LIMIT2 * 2);
    const result = {
      agentKey: scopedIdentity(catalog?.agentKey),
      generation: count(catalog?.generation),
      items: [],
      totalLoaded: rows.length,
      omitted: rows.length,
      sources: Object.fromEntries(["scheduled", "http"].map((type) => {
        const source = catalog?.sources?.[type];
        return [type, { status: readStates.includes(source?.status) ? source.status : "unavailable", received: count(source?.received), truncated: source?.truncated === true }];
      })),
      truncated: catalog?.truncated === true
    };
    if (JSON.stringify(result).length > AUTOMATION_MODEL_BUDGET2) result.agentKey = null;
    for (const row of rows.slice(0, AUTOMATION_MODEL_LIMIT2)) {
      const projected = projectAutomation2(row);
      if (!projected) continue;
      result.items.push(projected);
      result.omitted = rows.length - result.items.length;
      if (JSON.stringify(result).length > AUTOMATION_MODEL_BUDGET2) {
        result.items.pop();
        result.omitted = rows.length - result.items.length;
        break;
      }
    }
    result.truncated ||= result.omitted > 0;
    return result;
  }
  function projectAutomationHistory2(history) {
    const rows = (history?.runs || []).slice(0, AUTOMATION_HISTORY_LIMIT2);
    const result = {
      status: readStates.includes(history?.status) ? history.status : "unavailable",
      reason: text2(history?.reason),
      agentKey: scopedIdentity(history?.agentKey),
      automationKey: scopedIdentity(history?.automationKey),
      runs: [],
      totalLoaded: rows.length,
      omitted: rows.length,
      truncated: history?.truncated === true
    };
    if (JSON.stringify(result).length > AUTOMATION_MODEL_BUDGET2) {
      result.agentKey = null;
      result.automationKey = null;
    }
    for (const row of rows.slice(0, AUTOMATION_MODEL_LIMIT2)) {
      if (!record2(row)) continue;
      const threadId2 = itemIdentity(row.threadId);
      result.runs.push({
        key: scopedIdentity(row.key),
        id: itemIdentity(row.id),
        startTime: text2(row.startTime),
        status: text2(row.status) || "Unknown",
        threadId: row.association === "verified-id" ? threadId2 : null,
        threadName: text2(row.threadName),
        association: row.association === "verified-id" && threadId2 ? "verified-id" : "unavailable"
      });
      result.omitted = rows.length - result.runs.length;
      if (JSON.stringify(result).length > AUTOMATION_MODEL_BUDGET2) {
        result.runs.pop();
        result.omitted = rows.length - result.runs.length;
        break;
      }
    }
    result.truncated ||= result.omitted > 0;
    return result;
  }
  function automationUiDetails2(item, { triggerUrl } = {}) {
    const details = projectAutomation2(item);
    if (!details) return null;
    if (item.type === "http" && typeof triggerUrl === "string" && triggerUrl.length <= 4096) {
      try {
        const parsed = new URL(triggerUrl);
        if (parsed.protocol === "https:" && !parsed.username && !parsed.password) details.triggerUrl = triggerUrl;
      } catch {
      }
    }
    return details;
  }
  return {
    AUTOMATION_LIMIT: AUTOMATION_LIMIT2,
    AUTOMATION_HISTORY_LIMIT: AUTOMATION_HISTORY_LIMIT2,
    AUTOMATION_TEXT_LIMIT: AUTOMATION_TEXT_LIMIT2,
    AUTOMATION_MODEL_LIMIT: AUTOMATION_MODEL_LIMIT2,
    AUTOMATION_MODEL_BUDGET: AUTOMATION_MODEL_BUDGET2,
    AUTOMATION_API_REFERENCE: AUTOMATION_API_REFERENCE2,
    automationAgentKey: automationAgentKey2,
    normalizeAutomationCatalog: normalizeAutomationCatalog2,
    isAutomationSnapshotCurrent: isAutomationSnapshotCurrent2,
    filterAutomations: filterAutomations2,
    selectAutomation: selectAutomation2,
    automationActionMetadata: automationActionMetadata2,
    automationCatalogActionMetadata: automationCatalogActionMetadata2,
    normalizeAutomationHistory: normalizeAutomationHistory2,
    resolveAutomationRunThread: resolveAutomationRunThread2,
    projectAutomation: projectAutomation2,
    projectAutomationCatalog: projectAutomationCatalog2,
    projectAutomationHistory: projectAutomationHistory2,
    automationUiDetails: automationUiDetails2
  };
}
var {
  AUTOMATION_LIMIT,
  AUTOMATION_HISTORY_LIMIT,
  AUTOMATION_TEXT_LIMIT,
  AUTOMATION_MODEL_LIMIT,
  AUTOMATION_MODEL_BUDGET,
  AUTOMATION_API_REFERENCE,
  automationAgentKey,
  normalizeAutomationCatalog,
  isAutomationSnapshotCurrent,
  filterAutomations,
  selectAutomation,
  automationActionMetadata,
  automationCatalogActionMetadata,
  normalizeAutomationHistory,
  resolveAutomationRunThread,
  projectAutomation,
  projectAutomationCatalog,
  projectAutomationHistory,
  automationUiDetails
} = createAutomationModel();
function automationBrowserSource() {
  return `(${createAutomationModel.toString()})()`;
}

// canvases/azure-sre-agent/src/automation-schedule.mjs
function formatAutomationSchedule(item, { timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone } = {}) {
  const cron = typeof item?.cron === "string" ? item.cron : "";
  const fallback = { label: cron || "Not provided", title: cron ? `Cron: ${cron}` : "Schedule not provided", local: false };
  const fields = cron.trim().split(/\s+/);
  if (fields.length !== 5 || fields[2] !== "*" || fields[3] !== "*") return fallback;
  const [minute, hour, , , weekday] = fields;
  const fixed = (value, maximum) => /^\d{1,2}$/.test(value) && Number(value) <= maximum;
  const interval = minute.match(/^\*\/(\d{1,2})$/);
  if (hour === "*" && weekday === "*") {
    if (minute === "*") return { ...fallback, label: "Every minute" };
    if (interval && Number(interval[1]) > 0 && 60 % Number(interval[1]) === 0) {
      const minutes = Number(interval[1]);
      return { ...fallback, label: minutes === 1 ? "Every minute" : minutes === 60 ? "Hourly" : `Every ${minutes} minutes` };
    }
    if (fixed(minute, 59)) return { ...fallback, label: "Hourly" };
  }
  if (!fixed(minute, 59) || !fixed(hour, 23) || !(weekday === "*" || /^[0-7]$/.test(weekday) || /^(SUN|MON|TUE|WED|THU|FRI|SAT)$/i.test(weekday))) return fallback;
  if (typeof item?.nextRun !== "string" || !/(?:Z|[+-]\d{2}:\d{2})$/i.test(item.nextRun)) {
    return { ...fallback, title: `${fallback.title}
Local time unavailable: no timestamped next run was provided.` };
  }
  const nextRun = new Date(item.nextRun);
  if (!Number.isFinite(nextRun.getTime())) {
    return { ...fallback, title: `${fallback.title}
Local time unavailable: the next-run timestamp is invalid.` };
  }
  const time = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit", hour12: true }).format(nextRun).replace(/\s/g, "").toLowerCase();
  const day = weekday === "*" ? null : new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long" }).format(nextRun);
  return {
    label: day ? `Weekly on ${day} at ${time}` : `Daily at ${time}`,
    title: `Cron: ${cron}
Next run in ${timeZone}: ${time}. Local clock time may change with daylight saving.`,
    local: true
  };
}
function automationScheduleBrowserSource() {
  return `(${formatAutomationSchedule.toString()})`;
}

// canvases/azure-sre-agent/src/automation-runs.mjs
var SCHEDULED_RUN_CONTRACT = Object.freeze({
  verified: true,
  source: "portal QueryTriggers-DUx32csV.js getScheduledTaskExecutions",
  idField: "id",
  startTimeField: "executionTime",
  statusField: "status",
  threadIdField: "threadId"
});
var SCHEDULED_TASK_COMMANDS = Object.freeze({
  run: { method: "POST", suffix: "/execute", mutates: true },
  pause: { method: "POST", suffix: "/pause", mutates: true },
  resume: { method: "POST", suffix: "/resume", mutates: true },
  delete: { method: "DELETE", suffix: "", mutates: true }
});
function automationTaskRevision(item) {
  return JSON.stringify([item.key, item.name, item.status, item.cron, item.description]);
}
function automationTaskRevisionBrowserSource() {
  return `(${automationTaskRevision.toString()})`;
}
function selectedAutomation(entry, selection) {
  const agentKey = automationAgentKey(entry.agent, entry.subscription);
  if (!agentKey || selection?.agentKey !== agentKey) throw new Error("Selected agent changed. Reopen the task.");
  const catalog = normalizeAutomationCatalog({
    agent: entry.agent,
    subscription: entry.subscription,
    scheduledTasks: entry.scheduledTasks,
    scheduledTasksError: entry.scheduledTasksError,
    httpTriggers: entry.httpTriggers,
    httpTriggersError: entry.httpTriggersError
  });
  const item = catalog.items.find((row) => row.key && row.key === selection?.taskKey);
  if (!item || item.type !== "scheduled" || !item.id || [".", ".."].includes(item.id)) throw new Error("The selected scheduled task is unavailable. Update the list and reopen it.");
  return item;
}
function assertAutomationScope(entry, agent, subscription, item) {
  if (entry.agent !== agent || entry.subscription !== subscription || automationAgentKey(entry.agent, entry.subscription) !== item.agentKey) {
    throw new Error("Selected agent changed; the old task response was discarded.");
  }
  selectedAutomation(entry, { agentKey: item.agentKey, taskKey: item.key });
}
function scheduledRunHistory(item, payload) {
  if (!Array.isArray(payload)) throw new Error("The service returned an unsupported scheduled-task execution response.");
  let excluded = 0;
  const seen = /* @__PURE__ */ new Set();
  const runs = payload.flatMap((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row) || typeof row.executionTime !== "string" || row.executionTime.length > 80 || !/(?:Z|[+-]\d{2}:\d{2})$/i.test(row.executionTime) || !Number.isFinite(Date.parse(row.executionTime))) {
      excluded++;
      return [];
    }
    const threadId2 = typeof row.threadId === "string" && row.threadId.trim() && row.threadId.length <= 800 && ![".", ".."].includes(row.threadId) && !/https?:\/\//i.test(row.threadId) ? row.threadId : null;
    const id = JSON.stringify([row.executionTime, threadId2]);
    if (seen.has(id)) {
      excluded++;
      return [];
    }
    seen.add(id);
    return [{
      id,
      executionTime: row.executionTime,
      status: row.success === true ? "Success" : row.success === false ? "Failed" : "Unknown",
      threadId: threadId2
    }];
  }).sort((a, b) => Date.parse(b.executionTime) - Date.parse(a.executionTime) || a.id.localeCompare(b.id));
  if (payload.length && !runs.length) throw new Error("The execution response contained no readable runs.");
  const history = normalizeAutomationHistory(item, {
    status: "available",
    agentKey: item.agentKey,
    automationKey: item.key,
    runs
  }, { contract: SCHEDULED_RUN_CONTRACT });
  return { ...history, received: payload.length, excluded };
}
async function readAutomationHistory(entry, selection, { fetchImpl } = {}) {
  const item = selectedAutomation(entry, selection);
  const agent = entry.agent;
  const subscription = entry.subscription;
  const payload = await fetchImpl(
    agent,
    subscription,
    "GET",
    `/api/v1/scheduledtasks/${encodeURIComponent(item.id)}/executions`,
    void 0,
    entry,
    { title: "read scheduled task runs" }
  );
  assertAutomationScope(entry, agent, subscription, item);
  return scheduledRunHistory(item, payload);
}
async function readAutomationRun(entry, selection, { fetchImpl, getThreadImpl } = {}) {
  const item = selectedAutomation(entry, selection);
  const agent = entry.agent;
  const subscription = entry.subscription;
  const history = await readAutomationHistory(entry, selection, { fetchImpl });
  const link = resolveAutomationRunThread(history, selection.runKey, {
    agentKey: item.agentKey,
    automationKey: item.key
  });
  if (link.status !== "available") throw new Error("This run no longer has a verified conversation link. Update the run list.");
  const thread = await getThreadImpl(agent, subscription, link.threadId, entry);
  assertAutomationScope(entry, agent, subscription, item);
  return thread;
}
async function performAutomationCommand(entry, selection, { writesAllowed = false, fetchImpl, loadTasksImpl } = {}) {
  if (writesAllowed !== true) throw new Error("Task actions are disabled in read-only mode.");
  if (!Object.hasOwn(SCHEDULED_TASK_COMMANDS, selection?.command)) throw new Error("Unsupported scheduled-task command.");
  const command = SCHEDULED_TASK_COMMANDS[selection.command];
  const item = selectedAutomation(entry, selection);
  const agent = entry.agent;
  const subscription = entry.subscription;
  const tasks = await loadTasksImpl(agent, subscription, entry);
  assertAutomationScope(entry, agent, subscription, item);
  const current = selectedAutomation({ ...entry, scheduledTasks: tasks, scheduledTasksError: "" }, selection);
  if (selection.revision !== automationTaskRevision(current)) throw new Error("The task changed. Update the list before acting.");
  if (selection.command === "pause" && current.status !== "on" || selection.command === "resume" && current.status !== "off") {
    throw new Error("The task status changed. Update the list before acting.");
  }
  await fetchImpl(
    agent,
    subscription,
    command.method,
    `/api/v1/scheduledtasks/${encodeURIComponent(current.id)}${command.suffix}`,
    void 0,
    entry,
    { title: `${selection.command} scheduled task` }
  );
  assertAutomationScope(entry, agent, subscription, item);
  try {
    const refreshed = await loadTasksImpl(agent, subscription, entry);
    assertAutomationScope(entry, agent, subscription, item);
    entry.scheduledTasks = refreshed;
    entry.scheduledTasksError = "";
  } catch (error) {
    if (entry.agent === agent && entry.subscription === subscription && automationAgentKey(entry.agent, entry.subscription) === item.agentKey) {
      entry.scheduledTasksError = `The task action succeeded, but updating the list failed: ${error.message}`;
    }
    throw new Error(`The task action succeeded, but updating the list failed: ${error.message}`);
  }
  return { command: selection.command, taskId: item.id };
}

// packages/sre-agent-core/src/domain/execution-gates.mjs
var EXECUTION_KINDS = Object.freeze([
  "azCliExecution",
  "kubectlExecution",
  "psqlExecution"
]);
function normalizedStatus(value) {
  return String(value || "").toLowerCase();
}
function threadIdOf(thread) {
  return thread?.id || thread?.threadId || "";
}
var EXECUTION_ACTIVITY_KINDS = [
  ...EXECUTION_KINDS,
  "genevaActionExecution",
  "terminalResult",
  "mcpToolExecution",
  "approval"
];
var THREAD_ACTIVITY_LABELS = {
  running: "Running",
  "waiting-approval": "Waiting for approval",
  "waiting-permission": "Waiting for permission",
  "waiting-input": "Waiting for user input",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
  unknown: "Status unknown",
  idle: ""
};
function activity(state) {
  return { state, label: THREAD_ACTIVITY_LABELS[state] };
}
function executionActivity(execution, kind) {
  const status = normalizedStatus(execution?.status).replace(/[\s_-]+/g, "");
  if (status === "pendingauthorization") return activity("waiting-permission");
  if (kind === "approval" && status === "pending") return activity("waiting-approval");
  if (["running", "pending", "queued", "inprogress"].includes(status)) {
    return kind === "approval" ? activity("unknown") : activity("running");
  }
  if (["completed", "succeeded"].includes(status)) return activity("completed");
  if (status === "failed") return activity("failed");
  if (["cancelled", "canceled"].includes(status)) return activity("cancelled");
  return activity("unknown");
}
function currentExecutionObservations(thread, kinds = EXECUTION_ACTIVITY_KINDS) {
  const messages = Array.isArray(thread?.messages) ? thread.messages : [];
  const seen = /* @__PURE__ */ new Set();
  const found = [];
  for (let index = messages.length - 1; index >= 0; index--) {
    for (const kind of kinds) {
      const execution = messages[index]?.[kind];
      if (!execution || typeof execution !== "object" || Array.isArray(execution)) continue;
      const key = `${kind}:${execution.id || `message-${index}`}`;
      if (seen.has(key)) continue;
      seen.add(key);
      found.push({ kind, execution, messageIndex: index });
    }
  }
  return found;
}
function deriveThreadActivity(thread) {
  if (!thread || thread.draft) return activity("idle");
  const rawStatus = typeof thread.status === "string" ? thread.status : thread.status?.investigationStatus?.status || thread.status?.investigationStatus;
  const status = typeof rawStatus === "string" ? normalizedStatus(rawStatus).replace(/[\s_-]+/g, "") : "";
  const threadState = executionActivity({ status });
  if (["completed", "failed", "cancelled"].includes(threadState.state)) return threadState;
  const observations = currentExecutionObservations(thread);
  if (!observations.length && Object.hasOwn(THREAD_ACTIVITY_LABELS, thread.activity?.state)) {
    return activity(thread.activity.state);
  }
  const states = observations.map(({ execution, kind }) => executionActivity(execution, kind));
  const approval = states.find((item) => item.state === "waiting-approval");
  if (approval) return approval;
  const permission = states.find((item) => item.state === "waiting-permission");
  if (permission) return permission;
  if (["pendinguserinput", "waitingforuser"].includes(status)) return activity("waiting-input");
  if (states.some((item) => item.state === "running")) return activity("running");
  if (states.some((item) => item.state === "unknown")) return activity("unknown");
  if (status) return threadState;
  const messages = Array.isArray(thread.messages) ? thread.messages : [];
  const last = messages.at(-1) || thread.lastMessage || thread.startMessage;
  if (normalizedStatus(last?.author?.role || last?.role) === "user" || last?.isComplete === false) {
    return activity("running");
  }
  if (observations[0]?.messageIndex === messages.length - 1) return states[0];
  return activity("idle");
}
var THREAD_ACTIVITY_BROWSER_SOURCE = [
  `var EXECUTION_KINDS = ${JSON.stringify(EXECUTION_KINDS)};`,
  `var EXECUTION_ACTIVITY_KINDS = ${JSON.stringify(EXECUTION_ACTIVITY_KINDS)};`,
  `var THREAD_ACTIVITY_LABELS = ${JSON.stringify(THREAD_ACTIVITY_LABELS)};`,
  normalizedStatus,
  activity,
  executionActivity,
  currentExecutionObservations,
  deriveThreadActivity
].map((value) => typeof value === "function" ? value.toString() : value).join("\n");
function findExecutionInThread(thread, { executionType, executionId, status } = {}) {
  const kinds = executionType ? [executionType] : EXECUTION_KINDS;
  const wantedStatus = status ? normalizedStatus(status) : "";
  for (const found of currentExecutionObservations(thread, kinds)) {
    if (executionId && found.execution.id !== executionId) continue;
    if (wantedStatus && normalizedStatus(found.execution.status) !== wantedStatus) continue;
    return found;
  }
  return null;
}
function findCurrentExecutionGate(thread, attention = {}, observedAt = (/* @__PURE__ */ new Date()).toISOString()) {
  const threadId2 = attention.threadId || threadIdOf(thread);
  if (!threadId2) return null;
  const found = findExecutionInThread(thread, {
    executionType: attention.executionType,
    executionId: attention.executionId,
    status: "PendingAuthorization"
  }) || (!attention.executionId ? findExecutionInThread(thread, {
    executionType: attention.executionType,
    status: "PendingAuthorization"
  }) : null);
  if (!found) return null;
  const executionId = found.execution.id || "";
  return {
    key: `${threadId2}:${found.kind}:${executionId}`,
    threadId: threadId2,
    kind: found.kind,
    executionId,
    status: found.execution.status || "",
    command: found.execution.command || "",
    requiredScopes: Array.isArray(found.execution.requiredScopes) ? found.execution.requiredScopes : [],
    ...found.execution.resourceId ? { resourceId: found.execution.resourceId } : {},
    observedAt
  };
}
function deriveExecutionGateSnapshot({
  needsAttention = [],
  threads = [],
  previousObservedKeys = [],
  observedAt = (/* @__PURE__ */ new Date()).toISOString(),
  omittedThreadCount = 0,
  totalThreadCount = needsAttention.length + omittedThreadCount,
  detailErrors = []
} = {}) {
  const threadById = new Map(
    threads.filter((thread) => threadIdOf(thread)).map((thread) => [threadIdOf(thread), thread])
  );
  const observedGateKeys = [];
  const seenKeys = /* @__PURE__ */ new Set();
  for (const key of previousObservedKeys) {
    if (typeof key !== "string" || !key || seenKeys.has(key)) continue;
    seenKeys.add(key);
    observedGateKeys.push(key);
  }
  let missingDetailCount = 0;
  const rows = needsAttention.map((attention) => {
    const thread = threadById.get(attention?.threadId);
    const currentGate = thread ? findCurrentExecutionGate(thread, attention, observedAt) : null;
    if (!thread || !currentGate) missingDetailCount++;
    if (currentGate && !seenKeys.has(currentGate.key)) {
      seenKeys.add(currentGate.key);
      observedGateKeys.push(currentGate.key);
    }
    return {
      threadId: attention?.threadId || "",
      title: attention?.title || thread?.title || "",
      pendingOn: attention?.pendingOn,
      pendingSince: attention?.pendingSince,
      currentGate,
      observedGateCount: currentGate ? observedGateKeys.filter((key) => key.startsWith(`${currentGate.threadId}:`)).length : 0,
      moreGatesUnknown: Boolean(currentGate)
    };
  });
  return {
    observedAt,
    threads: rows,
    threadCount: totalThreadCount,
    currentGateCount: rows.filter((row) => row.currentGate).length,
    observedGateCount: observedGateKeys.length,
    observedGateKeys,
    partial: missingDetailCount > 0 || omittedThreadCount > 0,
    missingDetailCount,
    omittedThreadCount,
    detailErrors
  };
}

// packages/sre-agent-core/src/domain/thread-projection.mjs
var MESSAGE_LIMIT = 40;
var THREAD_TEXT_BUDGET = 14e3;
var TEXT_LIMIT = 2e3;
var PREVIEW_LIMIT = 240;
function threadRecency(thread) {
  const candidates = [
    thread?.modifiedTimestamp,
    thread?.updatedTimestamp,
    thread?.updatedAt,
    thread?.lastMessage?.timeStamp,
    thread?.lastMessage?.timestamp,
    thread?.createdTimestamp,
    thread?.createdAt
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const parsed = Date.parse(candidate);
    if (Number.isFinite(parsed)) return parsed;
  }
  return Number.NEGATIVE_INFINITY;
}
function sortThreadsByRecency(threads) {
  const list = Array.isArray(threads) ? threads : [];
  return [...list].sort((a, b) => threadRecency(b) - threadRecency(a));
}
function clip(value, limit) {
  if (typeof value !== "string") return value;
  return value.length > limit ? `${value.slice(0, limit)}\u2026 [${value.length - limit} more chars]` : value;
}
function compact(obj) {
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === void 0 || value === "") continue;
    out[key] = value;
  }
  return out;
}
function attachedExecutions(message) {
  return Object.keys(message || {}).filter((key) => /Execution|ExecutionGroup|SearchResult|Result$/.test(key) && message[key]);
}
function projectMessage(message, { textLimit = TEXT_LIMIT } = {}) {
  if (!message || typeof message !== "object") return null;
  const executions = attachedExecutions(message);
  return compact({
    id: message.id,
    timeStamp: message.timeStamp,
    role: message.author?.role || message.role,
    author: message.author?.displayName,
    text: clip(message.text, textLimit),
    isComplete: message.isComplete === false ? false : void 0,
    executions: executions.length ? executions : void 0
  });
}
function projectThread(thread) {
  if (!thread || typeof thread !== "object") return null;
  return compact({
    id: thread.id,
    activity: deriveThreadActivity(thread),
    title: thread.title,
    type: thread.type,
    source: thread.source,
    threadOrigin: thread.threadOrigin,
    createdTimestamp: thread.createdTimestamp,
    modifiedTimestamp: thread.modifiedTimestamp,
    favorite: thread.favorite || void 0,
    incidentStatus: thread.status?.incidentStatus?.status || void 0,
    hasCriticalActions: thread.status?.actionsStatus?.hasCriticalActions || void 0,
    hasWarningActions: thread.status?.actionsStatus?.hasWarningActions || void 0,
    lastMessage: thread.lastMessage ? compact({
      role: thread.lastMessage.author?.role,
      timeStamp: thread.lastMessage.timeStamp,
      preview: clip(thread.lastMessage.text, PREVIEW_LIMIT)
    }) : void 0
  });
}
function projectThreadDetail(thread, { limit = MESSAGE_LIMIT, textBudget = THREAD_TEXT_BUDGET } = {}) {
  if (!thread || typeof thread !== "object") return null;
  const messages = Array.isArray(thread.messages) ? thread.messages : [];
  const kept = [];
  let spent = 0;
  for (let index = messages.length - 1; index >= 0 && kept.length < limit; index--) {
    const projected = projectMessage(messages[index]);
    if (!projected) continue;
    const cost = (projected.text || "").length;
    if (kept.length && spent + cost > textBudget) break;
    kept.push(projected);
    spent += cost;
  }
  kept.reverse();
  return {
    ...projectThread(thread),
    messages: kept,
    totalMessages: messages.length,
    messagesTruncated: messages.length > kept.length
  };
}

// canvases/azure-sre-agent/src/automation-run-view.mjs
var clip2 = (value, limit) => typeof value === "string" ? value.slice(0, limit) : null;
var record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
var TASK_EXECUTION_PREFIX = "[SCHEDULED_TASK_EXECUTION]";
var TASK_EXECUTION_SUFFIX = "[/SCHEDULED_TASK_EXECUTION]";
function scheduledExecution(message) {
  if (typeof message?.text !== "string" || !message.text.startsWith(TASK_EXECUTION_PREFIX)) return null;
  if (message.text.length > 1e5) return { error: "Task details are too large to preview. Open the task in Portal." };
  let task;
  try {
    const envelope = message.text.slice(TASK_EXECUTION_PREFIX.length).trimEnd();
    task = JSON.parse(envelope.endsWith(TASK_EXECUTION_SUFFIX) ? envelope.slice(0, -TASK_EXECUTION_SUFFIX.length) : envelope);
  } catch {
    return { error: "The scheduled-task instruction preview could not be decoded. Open the task in Portal for its instructions." };
  }
  if (!record(task)) return { error: "The service returned an unsupported scheduled-task details format." };
  return {
    name: clip2(task.taskName, 160) || "Scheduled task",
    description: clip2(task.description, 1e3),
    cron: clip2(task.cronExpression, 160),
    prompt: clip2(task.agentPrompt, 1e4),
    promptTruncated: typeof task.agentPrompt === "string" && task.agentPrompt.length > 1e4
  };
}
function projectCanvasThread(detail, external = false) {
  const messages = Array.isArray(detail?.messages) ? detail.messages : [];
  if (!messages.some((message) => typeof message?.text === "string" && message.text.startsWith(TASK_EXECUTION_PREFIX))) {
    return external ? projectThreadDetail(detail) : detail;
  }
  if (external) return projectAutomationRunThread(detail);
  return { ...detail, messages: messages.map((message) => {
    const task = scheduledExecution(message);
    return task ? { ...message, text: task.error ? "Scheduled-task details unavailable." : `Scheduled task: ${task.name}`, scheduledTaskContext: task } : message;
  }) };
}
function resultPreview(value, kusto = false) {
  if (typeof value !== "string") return { unavailable: true };
  if (value.length > 1e5) return { truncated: true, unavailable: true };
  let result;
  try {
    result = JSON.parse(value);
  } catch {
    return { text: clip2(value, 4e3), truncated: value.length > 4e3 };
  }
  const items = result?.results?.items;
  if (!Array.isArray(items)) return { unavailable: true };
  const schemaOnly = kusto && items.length === 1 && record(items[0]) && Object.values(items[0]).every((type) => ["long", "int", "real", "decimal", "string", "bool", "datetime", "timespan", "guid", "dynamic"].includes(type));
  const tabular = record(items[0]) && (schemaOnly || Array.isArray(items[1]));
  const sourceRows = tabular ? items.slice(1) : items;
  const keys = tabular ? Object.keys(items[0]) : [...new Set(sourceRows.slice(0, 20).flatMap((row) => record(row) ? Object.keys(row) : []))];
  if (!sourceRows.every((row) => tabular ? Array.isArray(row) && row.length === keys.length : record(row))) {
    return { unavailable: true };
  }
  const columns = keys.slice(0, 12);
  let clippedCells = false;
  const rows = sourceRows.slice(0, 20).map((row) => columns.map((key, index) => {
    const cell = tabular ? row[index] : row[key];
    clippedCells ||= typeof cell === "string" && cell.length > 256;
    return cell === null || cell === void 0 ? "" : typeof cell === "string" ? cell.slice(0, 256) : typeof cell === "number" || typeof cell === "boolean" ? String(cell) : "[nested value]";
  }));
  return {
    status: typeof result.status === "number" ? result.status : null,
    duration: typeof result.duration === "number" ? result.duration : clip2(result.duration, 80),
    columns,
    rows,
    totalRows: sourceRows.length,
    truncated: sourceRows.length > 20 || keys.length > 12 || clippedCells
  };
}
function projectAutomationRunThread(detail) {
  const messages = (detail?.messages || []).map((message) => {
    const task = scheduledExecution(message);
    return task ? { ...message, text: task.error ? "Scheduled-task details unavailable." : `Scheduled task: ${task.name}` } : message;
  });
  const view = projectThreadDetail({ ...detail, messages });
  if (!view) return view;
  const originals = new Map((detail.messages || []).map((message) => [message.id, message]));
  let budget = JSON.stringify(view).length;
  for (const message of view.messages) {
    const original = originals.get(message.id);
    const task = scheduledExecution(original);
    if (task) {
      const size2 = JSON.stringify(task).length;
      message.scheduledTaskContext = budget + size2 <= 64e3 ? task : { error: "Task instructions omitted to keep this conversation bounded." };
      budget += JSON.stringify(message.scheduledTaskContext).length;
    }
    const raw = original?.mcpToolExecution;
    if (!record(raw)) continue;
    const execution = {
      id: clip2(raw.id, 1024),
      displayName: clip2(raw.displayName, 160),
      mcpServerName: clip2(raw.mcpServerName, 160),
      toolName: clip2(raw.toolName, 160),
      status: clip2(raw.status, 80),
      parameters: {
        clusterUrl: clip2(raw.parameters?.clusterUrl, 400),
        database: clip2(raw.parameters?.database, 200),
        query: clip2(raw.parameters?.query, 6e3)
      },
      preview: resultPreview(raw.result, raw.mcpServerName === "system-mcp-kusto"),
      error: clip2(raw.error, 1e3)
    };
    const size = JSON.stringify(execution).length;
    if (budget + size > 64e3) {
      message.executionPreviewOmitted = true;
      continue;
    }
    message.mcpToolExecution = execution;
    budget += size;
  }
  return view;
}

// canvases/azure-sre-agent/src/external-connectors.mjs
var text = (value) => typeof value === "string" ? value.slice(0, 200) : "";
async function readExternalConnectors(agent, subscription, entry, fetchImpl) {
  const payload = await fetchImpl(agent, subscription, "GET", "/api/v1/extendedAgent/dataconnectors", void 0, entry, { title: "list external data connectors" });
  const rows = Array.isArray(payload) ? payload : payload?.value;
  if (!Array.isArray(rows)) throw new Error("The agent returned an unsupported data connector list.");
  const connectors = /* @__PURE__ */ new Map();
  for (const row of rows) {
    if (!row || typeof row !== "object") throw new Error("The agent returned an invalid connector.");
    const name = text(row.name);
    if (!name) throw new Error("The agent returned a connector without a name.");
    const properties = row.properties || row;
    if (!connectors.has(name)) connectors.set(name, {
      name,
      kind: text(properties.dataConnectorType || properties.kind || row.type) || "Connector",
      status: text(properties.status || row.status) || "Not checked",
      source: "Agent",
      isRemoteMcp: true
    });
  }
  return Promise.all([...connectors.values()].map(async (connector) => {
    try {
      const result = await fetchImpl(
        agent,
        subscription,
        "GET",
        `/api/v2/extendedAgent/connectors/${encodeURIComponent(connector.name)}/status`,
        void 0,
        entry,
        { title: "read connector status" }
      );
      if (typeof result?.status !== "string") throw new Error("The service returned an unsupported connector status.");
      return { ...connector, status: text(result.status) };
    } catch (error) {
      return { ...connector, status: "Status unavailable", statusError: text(error.message) };
    }
  }));
}

// packages/sre-agent-core/src/actions/execution-gates.mjs
function isApprovalCandidate(item) {
  return Boolean(
    item?.executionId || item?.executionType || String(item?.pendingOn || "").toLowerCase().includes("approval")
  );
}
async function listExecutionGates({
  listNeedsAttention: listNeedsAttention2,
  getThread: getThread2,
  previousObservedKeys = [],
  limit = 25,
  concurrency = 5,
  observedAt = (/* @__PURE__ */ new Date()).toISOString()
} = {}) {
  if (typeof listNeedsAttention2 !== "function" || typeof getThread2 !== "function") {
    throw new Error("listExecutionGates requires listNeedsAttention and getThread functions.");
  }
  const boundedLimit = Math.max(1, Math.min(100, Number.isInteger(limit) ? limit : 25));
  const boundedConcurrency = Math.max(1, Math.min(10, Number.isInteger(concurrency) ? concurrency : 5));
  const needsAttention = await listNeedsAttention2();
  const approvalCandidates = needsAttention.filter(isApprovalCandidate);
  const selected = approvalCandidates.slice(0, boundedLimit);
  const threads = [];
  const detailErrors = [];
  for (let index = 0; index < selected.length; index += boundedConcurrency) {
    const batch = selected.slice(index, index + boundedConcurrency);
    const results = await Promise.all(batch.map(async (item) => {
      try {
        return await getThread2(item.threadId);
      } catch (error) {
        detailErrors.push({
          threadId: item.threadId,
          error: error?.message || String(error)
        });
        return null;
      }
    }));
    threads.push(...results.filter(Boolean));
  }
  const snapshot2 = deriveExecutionGateSnapshot({
    needsAttention: selected,
    threads,
    previousObservedKeys,
    observedAt,
    omittedThreadCount: Math.max(0, approvalCandidates.length - selected.length),
    totalThreadCount: approvalCandidates.length,
    detailErrors
  });
  return {
    ...snapshot2,
    needsAttentionThreadCount: needsAttention.length,
    nonApprovalThreadCount: needsAttention.length - approvalCandidates.length
  };
}

// packages/sre-agent-core/src/contracts/execution-gates.mjs
var LIST_NEEDS_ATTENTION_CONTRACT = Object.freeze({
  name: "list_needs_attention",
  description: "List threads the selected SRE Agent has parked waiting on a human. This reports a thread count, not an execution backlog count, and does not by itself prove an Azure RBAC denial.",
  inputSchema: Object.freeze({ type: "object", properties: Object.freeze({}) })
});
var LIST_EXECUTION_GATES_CONTRACT = Object.freeze({
  name: "list_execution_gates",
  description: "List each waiting thread's current PendingAuthorization execution gate. Reports a lower-bound history observed across refreshes and never claims to know hidden later gates or diagnose an RBAC failure.",
  inputSchema: Object.freeze({
    type: "object",
    properties: Object.freeze({
      limit: Object.freeze({
        type: "integer",
        minimum: 1,
        maximum: 100,
        description: "Maximum thread details to inspect. Defaults to 25."
      })
    })
  })
});

// packages/sre-agent-core/src/contracts/thread-focus.mjs
var FOCUS_CONTRACT = "Focus mode is ON. Route the user's operational questions and instructions about this system to the SRE Agent with ask_agent (threadId defaults to the focused thread). Answer questions about data this studio already holds - threads, the needs-attention queue, scheduled tasks, memory - from that data instead, without relaying. Say which of the two you did. Leave with unfocus_thread.";
var GET_THREAD_CONTRACT = {
  name: "get_thread",
  description: "Load one SRE Agent thread and its messages by threadId.",
  inputSchema: {
    type: "object",
    properties: { threadId: { type: "string" } },
    required: ["threadId"]
  }
};
var FOCUS_THREAD_CONTRACT = {
  name: "focus_thread",
  description: "Pair the conversation with one SRE Agent thread. While focused, ask_agent needs no threadId, and every tool result restates the routing contract: relay the user's operational questions to the agent, answer questions about data this studio already holds from that data, and say which you did. Read-only itself - it changes nothing in Azure - but ask_agent posts a real message. Leave with unfocus_thread.",
  inputSchema: {
    type: "object",
    properties: { threadId: { type: "string" } },
    required: ["threadId"]
  }
};
var UNFOCUS_THREAD_CONTRACT = {
  name: "unfocus_thread",
  description: "Leave focus mode. Messages stop being routed to the SRE Agent thread by default.",
  inputSchema: { type: "object", properties: {} }
};
var ASK_AGENT_CONTRACT = {
  name: "ask_agent",
  description: "Ask the SRE Agent a follow-up question inside an existing thread and wait briefly for its newest reply to complete. Mutating: posts a real message to the agent, which may make it act. While focused, threadId defaults to the focused thread.",
  inputSchema: {
    type: "object",
    properties: {
      threadId: { type: "string", description: "Optional thread to continue. Defaults to the focused thread." },
      message: { type: "string", description: "The question or instruction to send to the agent." },
      waitSeconds: { type: "number", description: "How long to wait for the newest reply message to complete before returning (default 20, max 120)." }
    },
    required: ["message"]
  }
};

// packages/studio-runtime/src/studio-commands.mjs
import { execFile, spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { accessSync, constants, readFileSync } from "node:fs";
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
function resolveStudioRoot(moduleUrl) {
  const directory = path.dirname(fileURLToPath(moduleUrl));
  const candidates = path.basename(directory) === "src" ? [directory, path.dirname(directory)] : [directory];
  for (const candidate of candidates) {
    for (const metadata of ["studio-package.json", "package.json"]) {
      try {
        accessSync(path.join(candidate, metadata));
        return candidate;
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
  }
  throw new Error(`Missing canvas package metadata for ${moduleUrl}`);
}
function resolveStudioBuildInfo(moduleUrl, fallbackVersion = "unknown") {
  let version = fallbackVersion;
  let revision = "unknown";
  try {
    let manifest;
    try {
      manifest = readFileSync(new URL("./studio-package.json", moduleUrl), "utf8");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      manifest = readFileSync(path.join(resolveStudioRoot(moduleUrl), "package.json"), "utf8");
    }
    version = JSON.parse(manifest).version || fallbackVersion;
  } catch {
  }
  try {
    revision = createHash("sha256").update(readFileSync(new URL(moduleUrl))).digest("hex").slice(0, 10);
  } catch {
  }
  return { version, revision };
}
var ICONS = {
  vscode: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23.15 2.587 18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352zm-5.146 14.861L10.826 12l7.178-5.448v10.896z"/></svg>',
  github: '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>',
  azure: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.05 2 4 20.01h5.86l1.45-3.73 5.63 5.72H24L13.05 2Zm.8 6.42 4.37 10.36-5.25-4.79 2.91-5.01-2.03-.56ZM10.1 17.73H6.78l5.45-10.85 1.43 3.38-3.56 7.47Z"/></svg>'
};
var COMMAND_BUTTONS = `<button class="btn ghost" id="open-vscode">${ICONS.vscode}<span class="label">Open in VS Code</span></button>
      <button class="btn ghost" id="save-github">${ICONS.github}<span class="label">Save to GitHub</span></button>
      <button class="btn ghost" id="deploy-azure">${ICONS.azure}<span class="label">Deploy to Azure</span></button>`;
var COMMAND_CSS = `.btn {
    border: none; cursor: pointer; border-radius: 10px; padding: 10px 16px;
    font-size: .86rem; font-weight: 600; color: #0b1120;
    background: linear-gradient(135deg, var(--accent), #ffcf6b);
    display: inline-flex; align-items: center; gap: .45rem;
  }
  .btn svg { width: 15px; height: 15px; flex: 0 0 auto; }
  .btn:hover { filter: brightness(1.05); }
  .btn.ghost { background: transparent; color: var(--muted); border: 1px solid var(--line); }
  .btn.ghost:hover { color: var(--ink); }
  .mode-badge {
    display: inline-block; font-size: .72rem; color: var(--muted); border: 1px solid var(--line);
    border-radius: 999px; padding: 3px 10px; background: var(--panel);
  }
  .deploy-status {
    display: none; color: var(--muted); font-size: .78rem; line-height: 1.45;
    margin: -.35rem 0 1rem; padding: .65rem .75rem; border: 1px solid var(--line);
    border-radius: 10px; background: rgba(255,255,255,.03); overflow-wrap: anywhere;
  }
  .deploy-status.show { display: block; }
  .deploy-status strong { color: var(--ink); }
  .deploy-status a { color: var(--accent2); text-decoration: none; }
  .deploy-status a:hover { text-decoration: underline; }`;
function responseJson(res, data) {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}
function shortError(error) {
  return redactDeploymentOutput(error?.stderr || error?.stdout || error?.message || error || "Command failed").replace(/\s+/g, " ").trim().slice(0, 300);
}
function canExecuteCommand(file, osName = os.platform()) {
  try {
    accessSync(file, osName === "win32" ? constants.F_OK : constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
var WINDOWS_COMMAND_META_CHARACTERS = /([()\][%!^"`<>&|;, *?])/g;
function escapeWindowsCommandMetaCharacters(value) {
  return value.replace(WINDOWS_COMMAND_META_CHARACTERS, "^$1");
}
function assertWindowsCommandValue(value) {
  const text2 = String(value);
  if (/[\r\n]/.test(text2)) {
    throw new Error("Command arguments contain unsupported Windows command characters.");
  }
  return text2;
}
function escapeWindowsCommand(value) {
  return escapeWindowsCommandMetaCharacters(assertWindowsCommandValue(value));
}
function quoteWindowsCommandArgument(value) {
  let text2 = assertWindowsCommandValue(value);
  text2 = text2.replace(/(?=(\\+?)?)\1"/g, '$1$1\\"');
  text2 = text2.replace(/(?=(\\+?)?)\1$/, "$1$1");
  return escapeWindowsCommandMetaCharacters(`"${text2}"`);
}
function windowsCommandShellLine(command, args = []) {
  const shellCommand = [escapeWindowsCommand(command), ...args.map(quoteWindowsCommandArgument)].join(" ");
  return `"${shellCommand}"`;
}
function spawnSpecForLocated(located, args, env, osName) {
  if (osName === "win32" && /\.(?:cmd|bat)$/i.test(located.path)) {
    const comSpec = env.ComSpec || env.COMSPEC || path.win32.join(env.SystemRoot || env.SYSTEMROOT || "C:\\Windows", "System32", "cmd.exe");
    return {
      file: comSpec,
      args: [
        "/d",
        "/s",
        "/c",
        windowsCommandShellLine(located.path, args)
      ],
      env,
      located,
      windowsVerbatimArguments: true
    };
  }
  return { file: located.path, args: [...args], env, located, windowsVerbatimArguments: false };
}
var AZURE_CLI_ENV_KEYS = [
  "HOME",
  "USER",
  "LOGNAME",
  "TMPDIR",
  "LANG",
  "LC_ALL",
  "SHELL",
  "USERPROFILE",
  "HOMEDRIVE",
  "HOMEPATH",
  "SystemRoot",
  "SYSTEMROOT",
  "TEMP",
  "TMP",
  "ComSpec",
  "COMSPEC",
  "PATHEXT",
  "AZURE_CONFIG_DIR",
  "XDG_CONFIG_HOME",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "ALL_PROXY",
  "NO_PROXY",
  "http_proxy",
  "https_proxy",
  "all_proxy",
  "no_proxy",
  "REQUESTS_CA_BUNDLE",
  "CURL_CA_BUNDLE",
  "SSL_CERT_FILE",
  "SSL_CERT_DIR",
  "AZURE_CLI_DISABLE_CONNECTION_VERIFICATION"
];
function sourcePath(source) {
  return source.PATH || source.Path || source.path || "";
}
function locateAzureCli(source = process.env, osName = os.platform(), exists = (candidate) => canExecuteCommand(candidate, osName)) {
  const paths = osName === "win32" ? path.win32 : path.posix;
  const inherited = sourcePath(source).split(paths.delimiter).filter(Boolean);
  const home = source.HOME || source.USERPROFILE || os.homedir();
  const known = osName === "win32" ? [
    paths.join(source.ProgramFiles || "C:\\Program Files", "Microsoft SDKs", "Azure", "CLI2", "wbin"),
    paths.join(
      source["ProgramFiles(x86)"] || "C:\\Program Files (x86)",
      "Microsoft SDKs",
      "Azure",
      "CLI2",
      "wbin"
    )
  ] : [
    "/opt/homebrew/bin",
    "/usr/local/bin",
    "/opt/local/bin",
    paths.join(home, ".local", "bin"),
    paths.join(home, "bin"),
    "/usr/bin",
    "/bin",
    "/snap/bin"
  ];
  const directories = [.../* @__PURE__ */ new Set([...inherited, ...known])];
  const searched = [];
  if (source.AZURE_CLI_PATH) {
    searched.push(source.AZURE_CLI_PATH);
    if (exists(source.AZURE_CLI_PATH)) {
      return {
        found: true,
        path: source.AZURE_CLI_PATH,
        directory: paths.dirname(source.AZURE_CLI_PATH),
        searched
      };
    }
  }
  for (const directory of directories) {
    for (const name of osName === "win32" ? ["az.cmd", "az.exe", "az"] : ["az"]) {
      const candidate = paths.join(directory, name);
      searched.push(candidate);
      if (exists(candidate)) return { found: true, path: candidate, directory, searched };
    }
  }
  return { found: false, path: "", directory: "", searched };
}
var AzureCliNotFoundError = class extends Error {
  constructor(searched = []) {
    super(
      "Azure CLI executable was not found. Install Azure CLI or set AZURE_CLI_PATH to its absolute path, then retry."
    );
    this.name = "AzureCliNotFoundError";
    this.code = "AZURE_CLI_NOT_FOUND";
    this.searched = searched;
  }
};
function isAzureCliLoginRequiredError(error) {
  return /(?:please run ['"`]?az login|run ['"`]?az login|not logged in|login required|no subscriptions found)/i.test(
    shortError(error)
  );
}
function azureCliChildEnv(source = process.env, located = locateAzureCli(source), osName = os.platform()) {
  const paths = osName === "win32" ? path.win32 : path.posix;
  const env = {};
  const copied = /* @__PURE__ */ new Set();
  for (const key of AZURE_CLI_ENV_KEYS) {
    const identity = osName === "win32" ? key.toLowerCase() : key;
    if (source[key] != null && !copied.has(identity)) {
      env[key] = source[key];
      copied.add(identity);
    }
  }
  const inherited = sourcePath(source).split(paths.delimiter).filter(Boolean);
  const fallbacks = osName === "win32" ? [
    paths.join(source.SystemRoot || source.SYSTEMROOT || "C:\\Windows", "System32"),
    source.SystemRoot || source.SYSTEMROOT || "C:\\Windows"
  ] : ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"];
  env.PATH = [.../* @__PURE__ */ new Set([...located.found ? [located.directory] : [], ...inherited, ...fallbacks])].join(
    paths.delimiter
  );
  if (osName === "win32" && !env.ComSpec && !env.COMSPEC) {
    env.ComSpec = paths.join(source.SystemRoot || source.SYSTEMROOT || "C:\\Windows", "System32", "cmd.exe");
  }
  return env;
}
function azureCliSpawnSpec(args, {
  env = process.env,
  osName = os.platform(),
  locate = locateAzureCli
} = {}) {
  assertFixtureAuthenticationDenied("az");
  const located = locate(env, osName);
  if (!located.found) throw new AzureCliNotFoundError(located.searched);
  const childEnv = azureCliChildEnv(env, located, osName);
  return spawnSpecForLocated(located, args, childEnv, osName);
}
function tokenExpiryMs(token) {
  const epochSeconds = Number(token?.expires_on || token?.expiresOnTimestamp || 0);
  if (Number.isFinite(epochSeconds) && epochSeconds > 0) return epochSeconds * 1e3;
  const parsed = Date.parse(String(token?.expiresOn || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}
function createAzureCliSession(runJson, { metadataTtlMs = 5 * 60 * 1e3, now = () => Date.now() } = {}) {
  const values = /* @__PURE__ */ new Map();
  const pending = /* @__PURE__ */ new Map();
  const generations = /* @__PURE__ */ new Map();
  async function cached(key, validUntil, loader, force = false) {
    const existing = values.get(key);
    if (!force && existing && existing.validUntil > now()) return existing.value;
    if (!force && pending.has(key)) return pending.get(key);
    const generation = (generations.get(key) || 0) + 1;
    generations.set(key, generation);
    const promise = Promise.resolve().then(loader).then((value) => {
      if (generations.get(key) === generation) {
        values.set(key, { value, validUntil: validUntil(value) });
      }
      return value;
    }).finally(() => {
      if (pending.get(key) === promise) pending.delete(key);
    });
    pending.set(key, promise);
    return promise;
  }
  return {
    account(force = false) {
      return cached("account", () => now() + metadataTtlMs, () => runJson(["account", "show", "-o", "json"]), force);
    },
    subscriptions(force = false) {
      return cached(
        "subscriptions",
        () => now() + metadataTtlMs,
        () => runJson(["account", "list", "--query", "[?state=='Enabled']", "-o", "json"]),
        force
      );
    },
    accessToken(subscription, resource, force = false, options = {}) {
      const key = `token:${subscription || "default"}:${resource}`;
      return cached(
        key,
        (token) => Math.max(now(), tokenExpiryMs(token) - 5 * 60 * 1e3),
        () => runJson(["account", "get-access-token", "--resource", resource, "-o", "json"], subscription, options),
        force
      );
    },
    clear() {
      values.clear();
      generations.clear();
    }
  };
}
async function runAzureCliJson(args, subscription, {
  timeout = 3e4,
  maxBuffer = 1024 * 1024,
  env = process.env,
  execute = execFileText,
  locate = locateAzureCli,
  osName = os.platform()
} = {}) {
  const full = subscription ? [...args, "--subscription", subscription] : [...args];
  const withFlag = full.includes("--only-show-errors") ? full : [...full, "--only-show-errors"];
  const { stdout } = await runAzureCliText(withFlag, { env, maxBuffer, timeout, execute, locate, osName });
  const text2 = stdout.trim();
  return text2 ? JSON.parse(text2) : null;
}
async function runAzureCliText(args, {
  env = process.env,
  execute = execFileText,
  locate = locateAzureCli,
  osName = os.platform(),
  ...options
} = {}) {
  const command = azureCliSpawnSpec(args, { env, locate, osName });
  return execute(command.file, command.args, {
    maxBuffer: 1024 * 1024,
    ...options,
    env: command.env,
    windowsVerbatimArguments: command.windowsVerbatimArguments
  });
}
var fixtureAuthCommands = [];
function assertFixtureAuthenticationDenied(command, args = []) {
  if (process.env.FUNCTION_STUDIO_TEST_MODE !== "1") return;
  const name = path.win32.basename(String(command)).replace(/\.(?:cmd|bat|exe)$/i, "").toLowerCase();
  const gitRemote = name === "git" && args.some((arg) => ["clone", "fetch", "pull", "push", "ls-remote", "credential"].includes(arg));
  const packageInstall = ["npm", "npx", "pip", "pip3", "uv"].includes(name) && args.some((arg) => ["install", "exec", "add", "run"].includes(arg)) || /^python(?:\d+(?:\.\d+)?)?$/.test(name) && args.includes("pip") && args.includes("install");
  if (!gitRemote && !packageInstall && !["az", "azd", "gh", "azureauth", "security", "codesign", "npx"].includes(name)) return;
  fixtureAuthCommands.push(name);
  throw new Error(`Live authentication command '${name}' is disabled in Hosted Skills fixture mode. Inject a fake service instead.`);
}
function execFileText(file, args, options = {}) {
  return new Promise((resolve, reject) => {
    assertFixtureAuthenticationDenied(file, args);
    execFile(file, args, { maxBuffer: 1024 * 1024, ...options }, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}
function redactDeploymentOutput(value, sensitiveValues = []) {
  let output = String(value || "");
  for (const sensitiveValue of sensitiveValues) {
    const secret = String(sensitiveValue || "");
    if (secret) output = output.split(secret).join("[REDACTED]");
  }
  return output.replace(/(https?:\/\/)[^/\s@]+@/gi, "$1[REDACTED]@").replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "").replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]").replace(
    /((?:^|[\s,{])["']?[A-Za-z0-9_-]*(?:token|secret|password|key|connection[_-]?string)["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,
    "$1[REDACTED]"
  ).replace(/([?&](?:code|key|sig|token|secret)=)[^&\s]+/gi, "$1[REDACTED]");
}

// canvases/azure-sre-agent/src/thread-ux.mjs
var MAX_EMBEDDED_MESSAGES = 50;
var MAX_COMMAND_CHARS = 2e3;
var MAX_TOOL_OUTPUT_CHARS = 4e3;
var MAX_ERROR_CHARS = 2e3;
function dataPlaneEndpoint(agent) {
  if (!agent) throw new Error("Select an SRE Agent first.");
  const endpoint = String(agent.endpoint || "").trim();
  if (!endpoint) {
    throw new Error("The selected SRE Agent does not expose a data-plane endpoint yet. Wait for provisioning to complete, then refresh agents.");
  }
  return endpoint.replace(/\/$/, "");
}
function threadId(thread) {
  return thread && (thread.id || thread.threadId) || "";
}
function displayedActiveThread(state, draftThread) {
  return draftThread && draftThread.active ? draftThread : state && state.activeThread || null;
}
function shouldCreateThread(state, draftThread, forceNewThread) {
  const displayed = displayedActiveThread(state, draftThread);
  return Boolean(forceNewThread || draftThread || !threadId(displayed) || displayed.draft);
}
function threadTimestamp(thread) {
  const value = thread && (thread.modifiedTimestamp || thread.createdTimestamp);
  const timestamp = value ? Date.parse(value) : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
}
function sortThreads(threads) {
  return [...threads || []].sort((left, right) => threadTimestamp(right) - threadTimestamp(left));
}
function upsertThread(threads, thread) {
  const id = threadId(thread);
  if (!id) return sortThreads(threads);
  const existing = (threads || []).find((item) => threadId(item) === id) || {};
  const definedUpdates = Object.fromEntries(Object.entries(thread).filter(([, value]) => value !== void 0));
  const merged = { ...existing, ...definedUpdates };
  return sortThreads([merged, ...(threads || []).filter((item) => threadId(item) !== id)]);
}
function boundedTranscriptMessages(thread) {
  const messages = thread && (thread.messages || thread.value) || [];
  return messages.slice(-MAX_EMBEDDED_MESSAGES);
}
function truncateTranscriptText(value, limit) {
  const text2 = String(value == null ? "" : value);
  if (text2.length <= limit) return text2;
  return `${text2.slice(0, limit)}

[Truncated in Azure SRE Agent. Open the full transcript in Portal.]`;
}
function transcriptRenderKey(thread) {
  if (!thread) return "none";
  if (thread.draft) return `draft:${threadId(thread)}`;
  return JSON.stringify({
    id: threadId(thread),
    messages: boundedTranscriptMessages(thread),
    startMessage: thread && thread.startMessage,
    awaiting: thread && thread.awaitingResponse,
    activity: thread && thread.activity,
    status: thread && thread.status
  });
}
var THREAD_CLIENT_HELPERS = [
  THREAD_ACTIVITY_BROWSER_SOURCE,
  `var MAX_EMBEDDED_MESSAGES = ${MAX_EMBEDDED_MESSAGES};`,
  `var MAX_COMMAND_CHARS = ${MAX_COMMAND_CHARS};`,
  `var MAX_TOOL_OUTPUT_CHARS = ${MAX_TOOL_OUTPUT_CHARS};`,
  `var MAX_ERROR_CHARS = ${MAX_ERROR_CHARS};`,
  dataPlaneEndpoint,
  threadId,
  displayedActiveThread,
  shouldCreateThread,
  threadTimestamp,
  sortThreads,
  upsertThread,
  boundedTranscriptMessages,
  truncateTranscriptText,
  transcriptRenderKey
].map((value) => typeof value === "function" ? value.toString() : value).join("\n");

// canvases/azure-sre-agent/src/extension.mjs
var execFileAsync = promisify(execFile2);
var { version: STUDIO_VERSION, revision: STUDIO_REVISION } = resolveStudioBuildInfo(import.meta.url);
var azureSreAgentAssets = new Map([
  ...canvasUiAssets,
  ["assets/azure-sre-agent-color.svg", [new URL("./assets/azure-sre-agent-color.svg", import.meta.url), "image/svg+xml"]]
]);
var EXTERNAL_AGENT_ROUTES = /* @__PURE__ */ new Set([
  "/init",
  "/select-subscription",
  "/select-app-subscription",
  "/select-agent",
  "/refresh-agents",
  "/open-shared-agent",
  "/check-config-drift",
  "/create-thread",
  "/open-thread",
  "/focus-thread",
  "/unfocus-thread",
  "/send-message",
  "/investigate",
  "/search-threads",
  "/diagnose-app",
  "/query-incidents",
  "/refresh-incidents",
  "/load-more-incidents",
  "/add-favorite",
  "/remove-favorite",
  "/select-favorite",
  "/subscriptions/refresh",
  "/subscriptions/select",
  "/list-scheduled-tasks",
  "/refresh-automation",
  "/automation-history",
  "/open-automation-run",
  "/automation-task-command",
  "/refresh-connectors"
]);
function externalAgentRouteAllowed(pathname) {
  return EXTERNAL_AGENT_ROUTES.has(pathname);
}
var EXTERNAL_AGENT_ACTIONS = /* @__PURE__ */ new Set([
  "list_agents",
  "select_agent",
  "get_thread",
  "focus_thread",
  "unfocus_thread",
  "ask_agent",
  "investigate",
  "list_scheduled_tasks"
]);
var AZURE_SRE_AGENT_CSP = [
  "default-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self'",
  "connect-src 'self'",
  "base-uri 'none'",
  "object-src 'none'",
  "font-src 'none'"
].join("; ");
var PRIVATE_CONNECTORS_ENABLED = process.env.ALLOW_PRIVATE_CONNECTORS === "true";
var PRIVATE_CONNECTOR_HTTP_ROUTES = /* @__PURE__ */ new Set([
  "/create-delegated-kusto-mcp",
  "/confirm-delegated-kusto-consent",
  "/attach-connector-namespace-mcp",
  "/detach-connector"
]);
function shortError2(error) {
  const message = shortError(error);
  const guidance = "Connection failed. Check your VPN and network connection, then retry.";
  if (!/\bfetch failed\b/i.test(message) || message.startsWith(guidance)) return message;
  return `${guidance} Details: ${message}`;
}
function connectorOwnerKey(objectId) {
  const normalized = String(objectId || "").trim().toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(normalized)) return "";
  return createHash2("sha256").update(normalized).digest("hex").slice(0, 8);
}
function connectorNameOwnedBy(name, objectId) {
  const ownerKey = connectorOwnerKey(objectId);
  return Boolean(ownerKey && String(name || "").startsWith(`private-kusto-${ownerKey}-`));
}
var cmdSeq = 0;
function cmdStart(entry, rec) {
  if (!entry.commands) entry.commands = [];
  const item = { id: ++cmdSeq, ts: Date.now(), status: "run", ms: null, note: "", ...rec };
  entry.commands.unshift(item);
  if (entry.commands.length > 40) entry.commands.length = 40;
  broadcast(entry, "state", snapshot(entry));
  return item;
}
function cmdEnd(entry, item, patch) {
  if (!item) return;
  const ms = item.ts ? Date.now() - item.ts : null;
  Object.assign(item, { ms, status: "ok" }, patch || {});
  if (patch && patch.ok === false) item.status = "err";
  broadcast(entry, "state", snapshot(entry));
}
async function azLogged(entry, args, subscription, meta) {
  if (!entry) return runAz(args, subscription);
  const shown = ["az", ...args, ...subscription ? ["--subscription", subscription] : []].join(" ");
  const item = cmdStart(entry, { kind: "az", title: meta && meta.title || args.slice(0, 3).join(" "), cmd: shown, purpose: meta && meta.purpose || "" });
  try {
    const out = await runAz(args, subscription);
    cmdEnd(entry, item, { ok: true, note: meta && meta.done || "ok" });
    return out;
  } catch (err) {
    cmdEnd(entry, item, { ok: false, note: shortError2(err) });
    throw err;
  }
}
function restLogged(entry, method, url, meta) {
  if (!entry) return null;
  return cmdStart(entry, { kind: "rest", title: meta && meta.title || `${method} ${url}`, cmd: `${method} ${url}`, purpose: meta && meta.purpose || "" });
}
var SRE_AGENT_TOKEN_RESOURCE = "https://azuresre.ai";
var ARM_API_VERSION = "2025-05-01-preview";
var CONNECTOR_GATEWAY_API_VERSION = "2026-05-01-preview";
var DOC_URL = "https://techcommunity.microsoft.com/blog/appsonazureblog/access-your-sre-agent-from-any-ide-terminal-or-ai-assistant/4523434";
async function runAz(args, subscription) {
  return runAzureCliJson(args, subscription, {
    maxBuffer: 8 * 1024 * 1024,
    timeout: 45e3
  });
}
var azureCliSession = createAzureCliSession(runAz);
var subscriptionInventory = createSreSubscriptionInventory((force) => azureCliSession.subscriptions(force));
async function listSubscriptions(force = false, entry) {
  const item = entry ? cmdStart(entry, { kind: "az", title: "list subscriptions", cmd: `az account list --query "[?state=='Enabled']" -o json`, purpose: "Discover subscriptions the signed-in account can see." }) : null;
  try {
    const inventory = await subscriptionInventory.refresh(force);
    if (entry) entry.subscriptionPicker = inventory;
    const rows = inventory.accounts;
    if (item) cmdEnd(entry, item, { ok: true, note: `${rows.length} subscription(s)` });
    const subs = rows.filter((s) => !s.disabled && String(s.state).toLowerCase() === "enabled").map((s) => ({ id: s.id, name: s.name, isDefault: Boolean(s.isDefault) }));
    subs.sort((a, b) => a.isDefault === b.isDefault ? 0 : a.isDefault ? -1 : 1);
    return subs;
  } catch (err) {
    if (item) cmdEnd(entry, item, { ok: false, note: shortError2(err) });
    throw err;
  }
}
async function armGet(pathAndQuery, subscription, entry, meta) {
  return azLogged(entry, ["rest", "--method", "get", "--url", `https://management.azure.com${pathAndQuery}`, "-o", "json"], subscription, meta);
}
async function armPut(pathAndQuery, body, subscription, entry, meta) {
  return azLogged(
    entry,
    ["rest", "--method", "put", "--url", `https://management.azure.com${pathAndQuery}`, "--body", JSON.stringify(body), "-o", "json"],
    subscription,
    meta
  );
}
async function armPost(pathAndQuery, body, subscription, entry, meta) {
  return azLogged(
    entry,
    ["rest", "--method", "post", "--url", `https://management.azure.com${pathAndQuery}`, "--body", JSON.stringify(body), "-o", "json"],
    subscription,
    meta
  );
}
async function armDelete(pathAndQuery, subscription, entry, meta) {
  return azLogged(
    entry,
    ["rest", "--method", "delete", "--url", `https://management.azure.com${pathAndQuery}`],
    subscription,
    meta
  );
}
function withApiVersion(url) {
  return url.includes("?") ? `${url}&api-version=${ARM_API_VERSION}` : `${url}?api-version=${ARM_API_VERSION}`;
}
var SHARED_AGENT_DISCOVERY_GUIDANCE = "Azure Resource Graph cannot enumerate SRE Agents for this subscription with the current access. If an agent was shared directly with you, paste its Azure resource ID or sre.azure.com URL below.";
function isNoQueryableSubscriptionsError(error) {
  const text2 = [error?.message, error?.stderr, error?.stdout].filter(Boolean).join("\n");
  return /NoValidSubscriptionsInQueryRequest|There must be at least one subscription/i.test(text2);
}
function parseSharedAgentReference(value) {
  const input = String(value || "").trim();
  if (!input) throw new Error("Enter the shared SRE Agent resource ID or sre.azure.com URL.");
  let candidate = input;
  if (/^https?:\/\//i.test(input)) {
    let url;
    try {
      url = new URL(input);
    } catch {
      throw new Error("Enter a valid SRE Agent resource ID or sre.azure.com URL.");
    }
    if (url.hostname.toLowerCase() !== "sre.azure.com") {
      throw new Error("Shared agent URLs must use sre.azure.com.");
    }
    candidate = decodeURIComponent(url.pathname);
  }
  const match = candidate.match(
    /(?:^|\/)subscriptions\/([0-9a-f-]{36})\/resourceGroups\/([^/?#]+)\/providers\/Microsoft\.App\/agents\/([^/?#]+)/i
  );
  if (!match) {
    throw new Error("The shared reference must identify a Microsoft.App/agents resource.");
  }
  const [, subscription, resourceGroup, name] = match;
  const id = `/subscriptions/${subscription}/resourceGroups/${resourceGroup}/providers/Microsoft.App/agents/${name}`;
  if (!/^https?:\/\//i.test(input) && candidate.replace(/\/+$/, "").toLowerCase() !== id.toLowerCase()) {
    throw new Error("The shared resource ID must identify exactly one Microsoft.App/agents resource.");
  }
  return { subscription, resourceGroup, name, id };
}
function parseExternalAgentReference(value) {
  const input = String(value || "").trim();
  let url;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) {
    throw new Error("External agent URLs must use HTTPS without credentials or a custom port.");
  }
  if (url.hostname.toLowerCase() === "sre.azure.com" && /^\/externalagents\//i.test(url.pathname)) {
    const match = url.pathname.match(/^\/externalagents\/([^/]+)\/?$/i);
    if (!match || url.searchParams.getAll("agentUrl").length !== 1) {
      throw new Error("The external-agent portal link must contain one agentUrl and an agent name.");
    }
    let name;
    try {
      name = decodeURIComponent(match[1]);
    } catch {
      throw new Error("The external-agent portal link has an invalid agent name.");
    }
    const endpoint = parseExternalAgentReference(url.searchParams.get("agentUrl"));
    if (!endpoint || !name.trim()) throw new Error("The external-agent portal link has an invalid agentUrl or name.");
    return { ...endpoint, name: name.trim(), portalUrl: url.href };
  }
  if (!url.hostname.toLowerCase().endsWith(".azuresre.ai")) {
    return null;
  }
  if (url.pathname !== "/" || url.search || url.hash) {
    throw new Error("Use the external agent's base HTTPS endpoint without a path, query, or fragment.");
  }
  return {
    endpoint: url.origin,
    name: url.hostname.split(".")[0].split("--")[0],
    portalUrl: ""
  };
}
async function graphQuery(query, subscription, entry, meta) {
  const args = ["graph", "query", "-q", query, "-o", "json"];
  if (subscription) args.push("--subscriptions", subscription);
  const result = await azLogged(entry, args, void 0, meta);
  if (!Array.isArray(result?.data)) throw new Error("Azure Resource Graph returned an invalid resource list.");
  return result.data;
}
async function listAgents(subscription, entry) {
  const query = "Resources | where type =~ 'microsoft.app/agents' | project name, id, location, resourceGroup, properties";
  const rows = await graphQuery(query, subscription, entry, { title: "graph query (agents)", purpose: "List Azure SRE Agent resources in this subscription." });
  return rows.map((r) => {
    const identity = parseSharedAgentReference(r.id);
    if (identity.subscription.toLowerCase() !== String(subscription).toLowerCase() || identity.name.toLowerCase() !== String(r.name).toLowerCase() || identity.resourceGroup.toLowerCase() !== String(r.resourceGroup).toLowerCase()) {
      throw new Error("Azure Resource Graph returned an agent with inconsistent resource identity.");
    }
    return {
      name: identity.name,
      id: identity.id,
      location: r.location,
      resourceGroup: identity.resourceGroup,
      subscriptionId: identity.subscription,
      provisioningState: r.properties?.provisioningState || "",
      endpoint: r.properties?.endpoint || r.properties?.agentEndpoint || ""
    };
  });
}
var APP_RESOURCE_TYPES = [
  "microsoft.web/sites",
  "microsoft.app/containerapps",
  "microsoft.containerservice/managedclusters",
  "microsoft.devtestlab/labs",
  "microsoft.labservices/labs"
];
var APP_RESOURCE_GRAPH_QUERY = `Resources | where type in~ (${APP_RESOURCE_TYPES.map((type) => `'${type}'`).join(",")}) or type contains 'sandbox' | project name, id, type, location, resourceGroup, kind | order by name asc`;
function appResourceKind(row) {
  const type = String(row.type || "").toLowerCase();
  const kind = String(row.kind || "").split(",")[0];
  if (type === "microsoft.web/sites") return kind || "webapp";
  if (type === "microsoft.app/containerapps") return "containerapp";
  if (type === "microsoft.containerservice/managedclusters") return "aks";
  if (type === "microsoft.devtestlab/labs" || type === "microsoft.labservices/labs") return "sandbox";
  return kind || type.split("/").pop() || "resource";
}
async function listAppResources(subscription, entry) {
  const rows = await graphQuery(APP_RESOURCE_GRAPH_QUERY, subscription, entry, { title: "graph query (apps)", purpose: "List App Service, Function App, Container App, AKS, and sandbox resources for the diagnose picker." });
  return rows.map((r) => ({
    name: r.name,
    id: r.id,
    type: r.type,
    kind: appResourceKind(r),
    location: r.location,
    resourceGroup: r.resourceGroup
  }));
}
async function getAgent(resourceGroup, name, subscription, entry) {
  const data = await armGet(
    withApiVersion(`/subscriptions/${subscription}/resourceGroups/${resourceGroup}/providers/Microsoft.App/agents/${name}`),
    subscription,
    entry,
    { title: `get agent ${name}`, purpose: "Fetch the SRE Agent resource (endpoint, provisioning state)." }
  );
  const actionIdentityId = data?.properties?.actionConfiguration?.identity || "";
  const uaMap = data?.identity?.userAssignedIdentities || {};
  const uaEntry = actionIdentityId ? Object.entries(uaMap).find(([key]) => key.toLowerCase() === actionIdentityId.toLowerCase())?.[1] : null;
  const executionPrincipalId = uaEntry?.principalId || data?.identity?.principalId || "";
  return {
    name: data?.name || name,
    id: data?.id || "",
    location: data?.location || "",
    resourceGroup,
    provisioningState: data?.properties?.provisioningState || "",
    endpoint: data?.properties?.endpoint || data?.properties?.agentEndpoint || "",
    executionPrincipalId,
    executionIdentityId: actionIdentityId || "",
    systemPrincipalId: data?.identity?.principalId || "",
    tenantId: data?.identity?.tenantId || "",
    raw: data
  };
}
async function listConnectors(agent, subscription, entry) {
  if (agent.external) return readExternalConnectors(agent, subscription, entry, dataPlaneFetch);
  const data = await armGet(
    withApiVersion(`/subscriptions/${subscription}/resourceGroups/${agent.resourceGroup}/providers/Microsoft.App/agents/${agent.name}/connectors`),
    subscription,
    entry,
    { title: "list connectors", purpose: "List connectors (Kusto, MCP, Azure Monitor) attached to this agent." }
  );
  const attached = (data?.value || []).map((c) => ({
    name: c.name,
    kind: c.properties?.dataConnectorType || c.properties?.kind || c.kind || "",
    id: c.id,
    dataSource: c.properties?.dataSource || "",
    identityMode: c.properties?.identity || "",
    extendedProperties: c.properties?.extendedProperties || {},
    isPrivateSession: /^private-session-/i.test(c.name || "")
  }));
  return attached;
}
async function loadExternalConnectors(read) {
  try {
    return { connectors: await read(), accessError: "" };
  } catch (error) {
    return { connectors: [], accessError: `Could not load external connectors: ${shortError2(error)}` };
  }
}
async function deleteConnector(agent, name, subscription, entry) {
  if (!name) throw new Error("Connector name is required.");
  return armDelete(
    withApiVersion(`/subscriptions/${subscription}/resourceGroups/${agent.resourceGroup}/providers/Microsoft.App/agents/${agent.name}/connectors/${encodeURIComponent(name)}`),
    subscription,
    entry,
    { title: `detach connector ${name}`, purpose: "Detach this connector from the selected SRE Agent." }
  );
}
async function listKustoResources(subscription, entry) {
  const clusters = await graphQuery(
    "Resources | where type =~ 'microsoft.kusto/clusters' | project name, id, location, resourceGroup, properties | order by name asc",
    subscription,
    entry,
    { title: "graph query (Kusto clusters)", purpose: "Discover Azure Data Explorer clusters visible to the signed-in user." }
  );
  const databases = await graphQuery(
    "Resources | where type =~ 'microsoft.kusto/clusters/databases' | project name, id, resourceGroup, properties | order by name asc",
    subscription,
    entry,
    { title: "graph query (Kusto databases)", purpose: "Discover Azure Data Explorer databases visible to the signed-in user." }
  );
  const databaseByClusterId = /* @__PURE__ */ new Map();
  for (const db of databases) {
    const clusterId = String(db.id || "").replace(/\/databases\/[^/]+$/i, "").toLowerCase();
    if (!databaseByClusterId.has(clusterId)) databaseByClusterId.set(clusterId, []);
    databaseByClusterId.get(clusterId).push({
      name: String(db.name || "").split("/").pop(),
      id: db.id,
      resourceGroup: db.resourceGroup
    });
  }
  return clusters.map((cluster) => ({
    name: cluster.name,
    id: cluster.id,
    subscriptionId: String(cluster.id || "").match(/\/subscriptions\/([^/]+)/i)?.[1] || "",
    location: cluster.location,
    resourceGroup: cluster.resourceGroup,
    clusterUrl: cluster.properties?.uri || cluster.properties?.clusterUri || "",
    databases: databaseByClusterId.get(String(cluster.id || "").toLowerCase()) || []
  }));
}
function operationList(data) {
  if (data?.paths && typeof data.paths === "object") {
    const definitions = data.definitions || {};
    const operations = [];
    for (const pathItem of Object.values(data.paths)) {
      for (const method of ["get", "post", "put", "patch", "delete"]) {
        const operation = pathItem?.[method];
        if (!operation?.operationId) continue;
        const parameters = [];
        for (const parameter of operation.parameters || []) {
          if (parameter?.["x-ms-visibility"] === "internal") continue;
          const ref = parameter?.schema?.$ref || "";
          const definitionName = ref.split("/").pop();
          const definition = definitionName ? definitions[definitionName] : null;
          if (parameter.in === "body" && definition?.properties) {
            for (const [name, schema] of Object.entries(definition.properties)) {
              parameters.push({ name, ...schema });
            }
          } else if (parameter.name) {
            parameters.push(parameter);
          }
        }
        operations.push({
          name: operation.operationId,
          displayName: operation.summary || operation.operationId,
          description: operation.description || "",
          parameters
        });
      }
    }
    return operations;
  }
  return data?.value || data?.items || data?.operations || data || [];
}
function operationName(operation) {
  return operation?.name || operation?.id || operation?.properties?.name || "";
}
function operationDisplayName(operation) {
  return operation?.displayName || operation?.properties?.displayName || operationName(operation);
}
function kustoOperationConfig(operation, clusterUrl, database) {
  const parameters = operation?.parameters || operation?.properties?.parameters || [];
  const userParameters = [];
  const agentParameters = [];
  for (const parameter of parameters) {
    const name = parameter?.name || parameter?.id || "";
    if (!name) continue;
    if (/(cluster|endpoint|server|data\s*source)/i.test(name)) {
      userParameters.push({ name, value: clusterUrl });
    } else if (/database/i.test(name) || /^db$/i.test(name)) {
      userParameters.push({ name, value: database });
    } else {
      agentParameters.push({ name });
    }
  }
  return {
    name: operationName(operation),
    displayName: operationDisplayName(operation),
    description: operation?.description || operation?.properties?.description || "",
    userParameters,
    agentParameters: agentParameters.map((parameter) => ({
      name: parameter.name,
      ...parameter.schema ? { schema: parameter.schema } : {}
    }))
  };
}
function connectorGatewayApi(path2) {
  return path2.includes("?") ? `${path2}&api-version=${CONNECTOR_GATEWAY_API_VERSION}` : `${path2}?api-version=${CONNECTOR_GATEWAY_API_VERSION}`;
}
async function listConnectorGateways(subscription, entry) {
  const gateways = await graphQuery(
    "Resources | where type =~ 'microsoft.web/connectorgateways' | project name, id, location, resourceGroup, properties | order by name asc",
    subscription,
    entry,
    { title: "graph query (Connector Namespaces)", purpose: "Find the general Connector Namespace used to create the delegated Kusto MCP." }
  );
  return gateways.map((gateway) => ({
    name: gateway.name,
    id: gateway.id,
    location: gateway.location,
    resourceGroup: gateway.resourceGroup,
    properties: gateway.properties || {}
  }));
}
async function listConnectorNamespaceMcps(gateways, subscription, attachedConnectors, entry) {
  const attachedNames = new Set((attachedConnectors || []).map((connector) => connector.name));
  const identity = await currentIdentity(entry);
  const groups = await Promise.all((gateways || []).map(async (gateway) => {
    const base = gatewayResourcePath(gateway);
    const data = await armGet(
      connectorGatewayApi(`${base}/mcpserverConfigs`),
      subscription,
      entry,
      { title: `list MCPs in ${gateway.name}`, purpose: "Discover existing Connector Namespace MCP configurations that can be attached to this SRE Agent." }
    );
    const gatewayId = gateway?.properties?.connectorGatewayId || gateway?.properties?.gatewayId || "";
    return (data?.value || []).filter((mcp) => connectorNameOwnedBy(mcp?.name, identity.objectId)).map((mcp) => {
      const name = mcp.name || "";
      const connectionName = mcp?.properties?.connectors?.[0]?.connectionName || "";
      const endpoint = mcp?.properties?.endpoint || mcp?.properties?.mcpEndpointUrl || (gatewayId && gateway.location && name ? `https://app-16.${gateway.location}.logic.azure.com/api/connectorGateways/${gatewayId}/mcpServerConfigs/${name}/mcp` : "");
      const attached = attachedNames.has(name);
      return {
        name,
        endpoint,
        mcpPath: `${base}/mcpserverConfigs/${encodeURIComponent(name)}`,
        connectionPath: connectionName ? `${base}/connections/${encodeURIComponent(connectionName)}` : "",
        gatewayName: gateway.name,
        state: mcp?.properties?.state || "",
        provisioningState: mcp?.properties?.provisioningState || "",
        attached,
        attachmentStatus: attached ? "Attached to this SRE Agent." : "Available to attach to this SRE Agent."
      };
    });
  }));
  return groups.flat();
}
function normalizedAzureLocation(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}
async function createConnectorGateway(agent, subscription, entry) {
  const provider = await azLogged(
    entry,
    ["provider", "show", "--namespace", "Microsoft.Web", "-o", "json"],
    subscription,
    { title: "read Connector Namespace regions", purpose: "Choose a supported region before creating a Connector Namespace." }
  );
  const resourceType = (provider?.resourceTypes || []).find((item) => String(item?.resourceType || "").toLowerCase() === "connectorgateways");
  const locations = resourceType?.locations || [];
  const agentLocation = normalizedAzureLocation(agent.location);
  const matchingLocation = locations.find((location2) => normalizedAzureLocation(location2) === agentLocation);
  const fallbackLocation = locations.find((location2) => normalizedAzureLocation(location2) === "westcentralus") || locations[0];
  const location = normalizedAzureLocation(matchingLocation || fallbackLocation || agent.location);
  if (!location) throw new Error("Microsoft.Web did not advertise a supported Connector Namespace region.");
  const name = await connectorGatewayName(agent, subscription);
  const path2 = `/subscriptions/${subscription}/resourceGroups/${agent.resourceGroup}/providers/Microsoft.Web/connectorGateways/${name}`;
  const created = await armPut(
    connectorGatewayApi(path2),
    {
      location,
      identity: { type: "SystemAssigned" },
      properties: {}
    },
    subscription,
    entry,
    {
      title: `create Connector Namespace ${name}`,
      purpose: "Create the shared Connector Namespace required to host delegated connections and MCP configurations."
    }
  );
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const gateway = attempt === 0 ? created : await armGet(
      connectorGatewayApi(path2),
      subscription,
      entry,
      { title: `check Connector Namespace ${name}`, purpose: "Wait until the new namespace is ready." }
    );
    const state = String(gateway?.properties?.provisioningState || "").toLowerCase();
    if (state === "succeeded") {
      entry.connectorGateways = await listConnectorGateways(subscription, entry);
      entry.status = `Created Connector Namespace ${name}; continuing delegated Kusto MCP setup.`;
      return {
        name: gateway.name || name,
        id: gateway.id || path2,
        location: gateway.location || location,
        resourceGroup: agent.resourceGroup,
        properties: gateway.properties || {}
      };
    }
    if (state === "failed" || state === "canceled") {
      throw new Error(`Connector Namespace ${name} provisioning ended in ${gateway?.properties?.provisioningState}.`);
    }
    await new Promise((resolve) => setTimeout(resolve, 2e3));
  }
  throw new Error(`Connector Namespace ${name} did not finish provisioning within the expected time.`);
}
async function connectorGatewayName(agent, subscription) {
  const suffix = (await stableGuid(`${subscription}|${agent.id}|connector-namespace`)).slice(0, 8);
  const prefix = String(agent.name || "sre-agent").toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 36);
  return `cg-${prefix || "sre-agent"}-${suffix}`;
}
async function findConnectorGateway(subscription, selectedName, agent, connectionName, database, entry) {
  const gateways = await listConnectorGateways(subscription, entry);
  if (selectedName) {
    const selected = gateways.find((gateway) => gateway.name === selectedName);
    if (!selected) throw new Error(`Connector Namespace "${selectedName}" is no longer available in the selected subscription.`);
    return { gateway: selected, connectionName };
  }
  const dedicatedName = await connectorGatewayName(agent, subscription);
  const dedicated = gateways.find((gateway) => gateway.name === dedicatedName);
  for (const gateway of gateways) {
    const data = await armGet(
      connectorGatewayApi(`${gatewayResourcePath(gateway)}/connections`),
      subscription,
      entry,
      { title: `check ${gateway.name} for existing Kusto connections`, purpose: "Resume an earlier authenticated Kusto setup without asking the user to choose infrastructure." }
    );
    const connections = data?.value || [];
    const connected = connections.find((connection) => connection?.properties?.connectorName === "kusto" && delegatedConnectionStatus(connection) === "connected" && (connection.name === connectionName || String(connection?.properties?.displayName || "").toLowerCase() === `azure data explorer - ${database}`.toLowerCase()));
    if (connected) return { gateway, connectionName: connected.name };
  }
  for (const gateway of gateways) {
    const existingConnection = await armGet(
      connectorGatewayApi(`${gatewayResourcePath(gateway)}/connections/${encodeURIComponent(connectionName)}`),
      subscription,
      entry,
      { title: `check ${gateway.name} for pending Kusto connection`, purpose: "Resume an earlier delegated Kusto sign-in." }
    );
    if (existingConnection) return { gateway, connectionName };
  }
  if (dedicated) return { gateway: dedicated, connectionName };
  return { gateway: await createConnectorGateway(agent, subscription, entry), connectionName };
}
function gatewayResourcePath(gateway) {
  return gateway.id || `/subscriptions/${gateway.subscriptionId}/resourceGroups/${gateway.resourceGroup}/providers/Microsoft.Web/connectorGateways/${gateway.name}`;
}
function delegatedConnectionStatus(connection) {
  return String(connection?.properties?.overallStatus || connection?.properties?.status || "").toLowerCase();
}
async function refreshDelegatedConnection(connectionPath, initial, subscription, entry) {
  if (delegatedConnectionStatus(initial) === "connected") return initial;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const connection = await armGet(
      connectorGatewayApi(connectionPath),
      subscription,
      entry,
      { title: "check delegated Kusto connection", purpose: "Resume an already-authenticated connection before starting another sign-in." }
    );
    if (delegatedConnectionStatus(connection) === "connected") return connection;
    if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, 750));
  }
  return initial;
}
async function grantConnectionUserAccess(resourcePath, identity, subscription, entry) {
  if (!identity?.objectId || !identity?.tenantId) throw new Error("The signed-in user must have an immutable Entra identity before delegated connection access can be granted.");
  return armPut(
    connectorGatewayApi(`${resourcePath}/accessPolicies/${encodeURIComponent(identity.objectId)}`),
    {
      properties: {
        principal: {
          type: "ActiveDirectory",
          identity: { objectId: identity.objectId, tenantId: identity.tenantId }
        }
      }
    },
    subscription,
    entry,
    { title: "grant signed-in user access to Kusto connection", purpose: "Allow the user who authorized Kusto to invoke the delegated connection." }
  );
}
async function requireConnectionUserAccess(resourcePath, identity, subscription, entry) {
  if (!resourcePath || !identity?.objectId) {
    throw new Error("This Connector Namespace MCP has no verifiable delegated connection owner.");
  }
  const policy = await armGet(
    connectorGatewayApi(`${resourcePath}/accessPolicies/${encodeURIComponent(identity.objectId)}`),
    subscription,
    entry,
    { title: "verify delegated connection owner", purpose: "Fail closed unless the signed-in user already owns access to this delegated connection." }
  );
  const principalId = policy?.properties?.principal?.identity?.objectId || "";
  if (String(principalId).toLowerCase() !== String(identity.objectId).toLowerCase()) {
    throw new Error("Only the signed-in owner of the delegated Kusto connection can attach this MCP.");
  }
}
async function grantMcpPrincipalAccess(resourcePath, objectId, tenantId, subscription, entry) {
  if (!objectId || !tenantId) throw new Error("The SRE Agent managed identity and tenant must be resolved before MCP access can be granted.");
  return armPut(
    connectorGatewayApi(`${resourcePath}/accessPolicies/${encodeURIComponent(objectId)}`),
    {
      properties: {
        principal: {
          type: "ActiveDirectory",
          identity: { objectId, tenantId }
        },
        // Connector Namespace uses User for direct object-ID matching, including
        // service principals and managed identities. Group means membership expansion.
        principalType: "User"
      }
    },
    subscription,
    entry,
    { title: "grant SRE managed identity access to Kusto MCP", purpose: "Allow the managed identity selected by the generic MCP connector to invoke the MCP endpoint." }
  );
}
function protectedResourceMetadataUrl(endpoint) {
  const url = new URL(endpoint);
  if (!/\/mcp\/?$/i.test(url.pathname)) {
    throw new Error("Connector Namespace returned an MCP endpoint with an unsupported path.");
  }
  url.pathname = `${url.pathname.replace(/\/mcp\/?$/i, "")}/.well-known/oauth-protected-resource`;
  url.search = "";
  url.hash = "";
  return url.toString();
}
async function discoverMcpTokenScope(endpoint) {
  const response = await fetch(protectedResourceMetadataUrl(endpoint), {
    headers: { Accept: "application/json" }
  });
  if (!response.ok) {
    throw new Error(`MCP protected-resource metadata failed (${response.status}).`);
  }
  const metadata = await response.json();
  const scopes = [...new Set(
    (metadata?.scopes_supported || []).map((scope) => String(scope || "").trim()).filter((scope) => /^https:\/\/.+\/\.default$/i.test(scope))
  )];
  if (scopes.length !== 1) {
    throw new Error("MCP protected-resource metadata must advertise exactly one HTTPS .default token scope.");
  }
  return scopes[0];
}
async function registerGenericMcp(agent, mcpName, endpoint, tokenScope, subscription, entry) {
  const connectorPath = withApiVersion(
    `/subscriptions/${subscription}/resourceGroups/${agent.resourceGroup}/providers/Microsoft.App/agents/${agent.name}/connectors/${encodeURIComponent(mcpName)}`
  );
  const connectorIdentity = agent.executionIdentityId || "system";
  const body = {
    properties: {
      name: mcpName,
      dataConnectorType: "Mcp",
      dataSource: "placeholder",
      identity: connectorIdentity,
      extendedProperties: {
        type: "http",
        endpoint,
        // Preview remote-MCP managed identity serializes to the runtime's
        // AzureARM wire contract; the portal labels this Managed Identity.
        authType: "AzureARM",
        armScope: tokenScope
      }
    }
  };
  const probe = await dataPlaneFetch(
    agent,
    subscription,
    "POST",
    `/api/v2/extendedAgent/connectors/${encodeURIComponent(mcpName)}/testconnection`,
    { name: mcpName, type: "AgentConnector", ...body },
    entry,
    { title: `test generic MCP ${mcpName}` }
  );
  if (!probe?.success) {
    throw new Error(
      `MCP connection test failed: ${probe?.errorMessage || "the SRE Agent runtime could not authenticate to Connector Namespace"}. Remote HTTP MCP managed identity requires SRE Agent Preview version 26.4.164.0 or later.`
    );
  }
  const selectedTools = (probe.tools || []).map((tool) => tool?.name).filter(Boolean);
  if (selectedTools.length === 0) {
    throw new Error("The MCP connection succeeded but exposed no tools to attach to the SRE Agent.");
  }
  body.properties.extendedProperties.selectedTools = selectedTools;
  body.properties.extendedProperties.toolsVisibleToMetaAgent = selectedTools;
  const registration = await armPut(
    connectorPath,
    body,
    subscription,
    entry,
    {
      title: `register generic MCP ${mcpName}`,
      purpose: "Attach the Connector Namespace endpoint as a generic managed-identity HTTP MCP connector and enable its discovered tools."
    }
  );
  return { registration, probe };
}
async function finishDelegatedKustoMcp(agent, pending, subscription, entry) {
  const { gateway, connectionName, clusterUrl, database } = pending;
  const base = gatewayResourcePath(gateway);
  const exported = await armGet(
    connectorGatewayApi(`${base}/managedApis/kusto?export=true`),
    subscription,
    entry,
    { title: "read Kusto connector operations", purpose: "Use the Connector Namespace Kusto contract as the source of truth." }
  );
  const queryOperation = operationList(exported).find(
    (operation2) => /listKustoResults|query|execute|run/i.test(`${operationName(operation2)} ${operationDisplayName(operation2)}`)
  );
  if (!queryOperation) throw new Error("PLATFORM BLOCKER: Connector Namespace exposes no Kusto query operation to wrap as MCP.");
  const operation = kustoOperationConfig(queryOperation, clusterUrl, database);
  const identity = await currentIdentity(entry);
  const ownerKey = connectorOwnerKey(identity.objectId);
  if (!ownerKey) throw new Error("An immutable signed-in Entra identity is required to create a reusable private Kusto MCP.");
  const mcpName = `private-kusto-${ownerKey}-${(await stableGuid(`${agent.id}|${clusterUrl}|${database}`)).slice(0, 8)}`;
  const mcpPath = `${base}/mcpserverConfigs/${encodeURIComponent(mcpName)}`;
  const mcpConfig = await armPut(
    connectorGatewayApi(mcpPath),
    {
      properties: {
        description: `Delegated read-only Kusto access to ${database}`,
        state: "Enabled",
        disableApiKeyAuth: true,
        settings: { TextOnlyContent: true },
        connectors: [{
          name: "kusto",
          connectionName,
          displayName: "Azure Data Explorer",
          operations: [operation]
        }]
      }
    },
    subscription,
    entry,
    { title: `create Connector Namespace MCP ${mcpName}`, purpose: "Wrap the signed-in Kusto connection as an authenticated MCP endpoint." }
  );
  await grantConnectionUserAccess(`${base}/connections/${encodeURIComponent(connectionName)}`, identity, subscription, entry);
  await grantMcpPrincipalAccess(mcpPath, agent.executionPrincipalId, agent.tenantId, subscription, entry);
  const gatewayId = gateway?.properties?.connectorGatewayId || gateway?.properties?.gatewayId || "";
  const endpoint = mcpConfig?.properties?.endpoint || mcpConfig?.properties?.mcpEndpointUrl || (gatewayId && gateway.location ? `https://app-16.${gateway.location}.logic.azure.com/api/connectorGateways/${gatewayId}/mcpServerConfigs/${mcpName}/mcp` : "");
  if (!endpoint) throw new Error("Connector Namespace created the MCP config but did not return enough information to determine its endpoint.");
  const namespaceMcp = {
    name: mcpName,
    endpoint,
    state: mcpConfig?.properties?.state || "Enabled",
    provisioningState: mcpConfig?.properties?.provisioningState || "Succeeded",
    attached: false,
    attachmentStatus: "Checking SRE Agent attachment..."
  };
  entry.connectorNamespaceMcps = [
    namespaceMcp,
    ...(entry.connectorNamespaceMcps || []).filter((item) => item.name !== mcpName)
  ];
  let registration;
  try {
    const tokenScope = await discoverMcpTokenScope(endpoint);
    registration = await registerGenericMcp(agent, mcpName, endpoint, tokenScope, subscription, entry);
  } catch (err) {
    namespaceMcp.attachmentStatus = `MCP registration failed: ${shortError2(err)}`;
    entry.connectors = await listConnectors(agent, subscription, entry).catch(() => entry.connectors);
    entry.status = `Created Connector Namespace MCP ${mcpName}, but it is not attached or usable from SRE Agent. ${namespaceMcp.attachmentStatus}`;
    broadcast(entry, "state", snapshot(entry));
    return {
      signInRequired: false,
      mcpName,
      operation: operation.name,
      endpoint,
      attached: false,
      platformBlocker: namespaceMcp.attachmentStatus,
      registrationError: shortError2(err)
    };
  }
  namespaceMcp.attached = true;
  namespaceMcp.attachmentStatus = "Attached to SRE Agent as a managed-identity HTTP MCP connector.";
  entry.connectors = await listConnectors(agent, subscription, entry).catch(() => entry.connectors);
  entry.status = `Created delegated Kusto MCP ${mcpName}, granted the SRE managed identity access, and attached the generic MCP connector. Validate a read-only query next. CRITICAL TODO: fail-closed thread-owner enforcement is not implemented.`;
  return { signInRequired: false, mcpName, operation: operation.name, endpoint, attached: true, registration };
}
async function createDelegatedKustoMcp(agent, { clusterUrl, database, gatewayName }, subscription, entry) {
  if (!clusterUrl || !database) throw new Error("Choose a Kusto cluster and database.");
  if (!agent.executionPrincipalId || !agent.tenantId) {
    throw new Error("The selected SRE Agent does not expose the managed identity used for connector execution.");
  }
  const cluster = String(clusterUrl).replace(/\/+$/, "");
  const desiredConnectionName = `private-kusto-${(await stableGuid(`${agent.id}|${cluster}|${database}`)).slice(0, 8)}`;
  const selected = await findConnectorGateway(subscription, gatewayName, agent, desiredConnectionName, database, entry);
  const { gateway, connectionName } = selected;
  const base = gatewayResourcePath(gateway);
  await armGet(
    connectorGatewayApi(`${base}/managedApis/kusto`),
    subscription,
    entry,
    { title: "verify Kusto connector", purpose: "Verify that this general Connector Namespace supports Azure Data Explorer." }
  );
  const connectionPath = `${base}/connections/${encodeURIComponent(connectionName)}`;
  let connection = await armPut(
    connectorGatewayApi(connectionPath),
    {
      location: gateway.location,
      properties: {
        displayName: `Azure Data Explorer - ${database}`,
        connectorName: "kusto"
      }
    },
    subscription,
    entry,
    { title: `create delegated Kusto connection ${connectionName}`, purpose: "Create or reuse a user-delegated Kusto connection in Connector Namespace." }
  );
  const pending = { gateway, connectionName, connectionPath, clusterUrl: cluster, database };
  connection = await refreshDelegatedConnection(connectionPath, connection, subscription, entry);
  if (delegatedConnectionStatus(connection) === "connected") {
    return finishDelegatedKustoMcp(agent, pending, subscription, entry);
  }
  const consent = await armPost(
    connectorGatewayApi(`${connectionPath}/listConsentLinks`),
    {
      parameters: [{
        parameterName: "token",
        redirectUrl: `${entry.url.replace(/\/$/, "")}/auth/callback.html`
      }]
    },
    subscription,
    entry,
    { title: "start Kusto sign-in", purpose: "Open Connector Namespace user-delegated OAuth without exposing authentication internals." }
  );
  const signInUrl = consent?.value?.[0]?.link || consent?.value?.[0]?.consentLink || consent?.link || consent?.consentLink || "";
  if (!signInUrl) throw new Error("Connector Namespace did not return a Kusto sign-in URL.");
  entry.pendingKustoConsent = pending;
  entry.status = "Complete the Azure Data Explorer sign-in. Azure SRE Agent will continue MCP creation automatically when consent returns.";
  return { signInRequired: true, signInUrl };
}
async function confirmDelegatedKustoConsent(agent, code, subscription, entry) {
  const pending = entry.pendingKustoConsent;
  if (!pending || !code) throw new Error("No pending Kusto sign-in was found. Start Sign in & create MCP again.");
  await armPost(
    connectorGatewayApi(`${pending.connectionPath}/confirmConsentCode`),
    { code },
    subscription,
    entry,
    { title: "confirm Kusto sign-in", purpose: "Complete Connector Namespace consent without logging or persisting the consent code." }
  );
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const connection = await armGet(
      connectorGatewayApi(pending.connectionPath),
      subscription,
      entry,
      { title: "check Kusto connection", purpose: "Wait until the delegated connection is ready." }
    );
    if (delegatedConnectionStatus(connection) === "connected") {
      entry.pendingKustoConsent = null;
      return finishDelegatedKustoMcp(agent, pending, subscription, entry);
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error("Kusto sign-in returned, but Connector Namespace did not report the connection as Connected.");
}
async function dataPlaneFetch(agent, subscription, method, urlPath, body, entry, meta) {
  const endpoint = dataPlaneEndpoint(agent);
  const token = await azureCliSession.accessToken(subscription, SRE_AGENT_TOKEN_RESOURCE);
  const accessToken = token?.accessToken || token?.access_token;
  if (!accessToken) throw new Error("Could not obtain an SRE Agent data-plane access token from az login.");
  const url = `${endpoint}${urlPath}`;
  const cmd = restLogged(entry, method, url, meta);
  let res;
  try {
    res = await fetch(url, {
      method,
      redirect: agent.external ? "manual" : "follow",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: body ? JSON.stringify(body) : void 0,
      signal: agent.external ? AbortSignal.timeout(2e4) : meta?.timeoutMs ? AbortSignal.timeout(meta.timeoutMs) : void 0
    });
  } catch (err) {
    cmdEnd(entry, cmd, { ok: false, note: shortError2(err) });
    if (agent.external && err?.name === "TimeoutError") {
      throw new Error("The external agent did not respond within 20 seconds. Check endpoint access or registration propagation and retry.");
    }
    throw err;
  }
  const text2 = await res.text();
  let parsed;
  try {
    parsed = text2 ? JSON.parse(text2) : null;
  } catch {
    parsed = { raw: text2 };
  }
  if (!res.ok) {
    const message = shortError2(new Error(parsed?.message || parsed?.error || text2 || `HTTP ${res.status}`));
    cmdEnd(entry, cmd, { ok: false, note: `HTTP ${res.status}: ${message}` });
    const accessHint = agent.external && (res.status === 401 || res.status === 403) ? " Verify that this Entra user can open the registered external agent in Portal; access changes may take about 15 minutes to propagate." : "";
    throw new Error(`${method} ${urlPath} failed (${res.status}): ${message}${accessHint}`);
  }
  cmdEnd(entry, cmd, { ok: true, note: `HTTP ${res.status}` });
  return parsed;
}
var cachedIdentity = null;
async function currentIdentity(entry) {
  if (cachedIdentity) return cachedIdentity;
  const item = entry ? cmdStart(entry, { kind: "az", title: "whoami", cmd: "az account show && az ad signed-in-user show", purpose: "Resolve the signed-in user's immutable Entra object ID for thread ownership and private connector authorization." }) : null;
  try {
    const account = await runAz(["account", "show", "-o", "json"]);
    let user = null;
    if (String(account?.user?.type || "").toLowerCase() === "user") {
      user = await runAz([
        "ad",
        "signed-in-user",
        "show",
        "--query",
        "{objectId:id,userPrincipalName:userPrincipalName,displayName:displayName}",
        "-o",
        "json"
      ]).catch(() => null);
    }
    const objectId = user?.objectId || "";
    const upn = user?.userPrincipalName || account?.user?.name || "";
    cachedIdentity = {
      objectId,
      userId: objectId || upn,
      userPrincipalName: upn,
      displayName: user?.displayName || upn,
      tenantId: account?.tenantId || ""
    };
    if (item) cmdEnd(entry, item, { ok: true, note: cachedIdentity.displayName });
  } catch (err) {
    if (item) cmdEnd(entry, item, { ok: false, note: shortError2(err) });
    throw err;
  }
  return cachedIdentity;
}
var EXTERNAL_THREAD_PAGE_SIZE = 25;
var INCIDENT_THREAD_PAGE_SIZE = 25;
function projectExternalThreadSummary(thread) {
  const summary = projectThread(thread);
  if (!summary?.id) throw new Error("The external agent returned a thread without an id.");
  const messagePreview = (message) => {
    const projected = projectMessage(message, { textLimit: 240 });
    return projected ? { text: projected.text, timeStamp: projected.timeStamp } : void 0;
  };
  return {
    id: summary.id,
    title: typeof summary.title === "string" ? summary.title.slice(0, 240) : "",
    createdTimestamp: summary.createdTimestamp,
    modifiedTimestamp: summary.modifiedTimestamp,
    startMessage: messagePreview(thread.startMessage),
    lastMessage: messagePreview(thread.lastMessage),
    status: typeof thread.status === "string" ? thread.status : {
      incidentStatus: {
        incidentId: incidentScalar(thread.status?.incidentStatus?.incidentId),
        status: summary.incidentStatus
      },
      investigationStatus: thread.status?.investigationStatus ? { status: incidentScalar(thread.status.investigationStatus, ["status", "label", "name", "value"]) } : void 0,
      actionsStatus: {
        hasCriticalActions: summary.hasCriticalActions,
        hasWarningActions: summary.hasWarningActions
      }
    }
  };
}
function threadTitleFilter(query) {
  const value = String(query || "").trim();
  if (!value || value.length > 120 || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error("Enter a thread title search of 1 to 120 characters without control characters.");
  }
  return `contains(tolower(title),'${value.toLowerCase().replace(/'/g, "''")}')`;
}
async function listThreads(agent, subscription, entry, { fetchImpl = dataPlaneFetch, filter } = {}) {
  if (filter && !agent.external) throw new Error("Server-side thread search requires an external agent.");
  const path2 = agent.external ? `/api/v1/threads?${filter ? "skip=0&" : ""}top=${EXTERNAL_THREAD_PAGE_SIZE}&${filter ? `filter=${encodeURIComponent(filter).replace(/'/g, "%27")}&` : ""}orderby=modifiedTimestamp%20desc` : "/api/v1/threads";
  const data = await fetchImpl(agent, subscription, "GET", path2, void 0, entry, { title: "list threads" });
  if (!Array.isArray(data?.value) && !Array.isArray(data)) {
    throw new Error("The SRE Agent did not return a valid thread list.");
  }
  const threads = data?.value || data || [];
  if (agent.external && threads.length > EXTERNAL_THREAD_PAGE_SIZE) {
    throw new Error("The external agent ignored the bounded thread-list request.");
  }
  return sortThreadsByRecency(agent.external ? threads.map(projectExternalThreadSummary) : threads);
}
async function listNeedsAttention(agent, subscription, entry) {
  const data = await dataPlaneFetch(agent, subscription, "GET", "/api/v1/threads/needsAttention", void 0, entry, { title: "list threads waiting on you" });
  return data?.value || data || [];
}
async function getThreadMessages(agent, subscription, threadId2, entry) {
  const messages = await dataPlaneFetch(
    agent,
    subscription,
    "GET",
    `/api/v1/threads/${encodeURIComponent(threadId2)}/messages?skip=0&top=100&orderby=timestamp`,
    void 0,
    entry,
    { title: "get thread messages" }
  );
  return messages?.value || messages || [];
}
async function getThread(agent, subscription, threadId2, entry, {
  fetchImpl = dataPlaneFetch,
  getMessagesImpl = getThreadMessages,
  projectDetail
} = {}) {
  const [thread, messages] = await Promise.all([
    fetchImpl(agent, subscription, "GET", `/api/v1/threads/${encodeURIComponent(threadId2)}`, void 0, entry, { title: "get thread" }),
    getMessagesImpl(agent, subscription, threadId2, entry)
  ]);
  if (!thread?.id) throw new Error(`Thread "${threadId2}" was not found.`);
  if (!Array.isArray(messages)) {
    throw new Error(`The agent did not return valid messages for thread "${threadId2}".`);
  }
  const detail = { ...thread, messages };
  return projectDetail ? projectDetail(detail) : agent.external ? projectThreadDetail(detail) : detail;
}
function findExecutionInThread2(thread, kind, executionId) {
  return findExecutionInThread(thread, {
    executionType: kind,
    executionId
  })?.execution || null;
}
async function createThread(agent, subscription, message, entry, {
  identityImpl = currentIdentity,
  fetchImpl = dataPlaneFetch
} = {}) {
  const identity = await identityImpl(entry);
  const thread = await fetchImpl(agent, subscription, "POST", "/api/v1/threads", {
    startMessage: { text: message, userId: identity.userId, displayName: identity.displayName }
  }, entry, { title: "create thread" });
  if (!threadId(thread)) throw new Error("The SRE Agent did not return a new thread id; diagnosis was not confirmed.");
  return thread.startMessage ? thread : {
    ...thread,
    startMessage: { text: message, role: "User", author: { role: "User", displayName: identity.displayName } }
  };
}
function retainInitialThreadPrompt(thread, previous) {
  if (threadId(thread) !== threadId(previous) || !previous?.startMessage || thread?.startMessage || (thread?.messages?.length ?? 0) > 0) return thread;
  return { ...thread, startMessage: previous.startMessage };
}
async function sendMessage(agent, subscription, threadId2, message, entry) {
  const identity = await currentIdentity(entry);
  return dataPlaneFetch(agent, subscription, "POST", `/api/v1/threads/${encodeURIComponent(threadId2)}/messages`, {
    text: message,
    role: "User",
    displayName: identity.displayName,
    userId: identity.userId
  }, entry, { title: "send message" });
}
async function investigate(agent, subscription, message, _options = {}, entry) {
  return createThread(agent, subscription, message, entry);
}
async function runExecutionAction(agent, subscription, kind, threadId2, executionId, action, entry) {
  const identity = await currentIdentity(entry);
  return dataPlaneFetch(
    agent,
    subscription,
    "POST",
    `/api/v1/${encodeURIComponent(kind)}/${encodeURIComponent(threadId2)}/${encodeURIComponent(executionId)}/action`,
    { action, user: identity.userId || "sreagent-client" },
    entry,
    { title: `${action} execution (grant/OBO retry)` }
  );
}
async function authorizeExecutionSafely({
  listAttention,
  readThread,
  run,
  threadId: threadId2,
  executionId,
  executionType,
  expectedCommand
}) {
  const attention = await listAttention();
  const queued = attention.find((item) => item?.threadId === threadId2 && (!item.executionId || item.executionId === executionId) && (!item.executionType || item.executionType === executionType));
  if (!queued) throw new Error("This execution is no longer waiting for authorization.");
  const thread = await readThread(threadId2);
  const execution = findExecutionInThread2(thread, executionType, executionId);
  if (!execution || execution.status !== "PendingAuthorization") {
    throw new Error("This execution is no longer pending authorization.");
  }
  if (typeof expectedCommand !== "string" || execution.command !== expectedCommand) {
    throw new Error("The pending command changed. Reopen the thread and review the current command before authorizing it.");
  }
  return run();
}
var ROLE_DEFINITION_IDS = {
  Reader: "acdd72a7-3385-48ef-bd42-f606fba81ae7",
  Contributor: "b24988ac-6180-42a0-ab88-20f7382dd24c",
  "Website Contributor": "de139f84-1756-47ae-9be6-808fbbe84772",
  "Log Analytics Reader": "73c42c96-874c-492b-b04d-ab87d138a893",
  "Monitoring Reader": "43d0d8ad-25c7-4714-9337-8ba259a9fe05"
};
function scopesText(exec) {
  const raw = exec?.requiredScopes;
  if (Array.isArray(raw)) return raw.join(", ");
  return String(raw || "");
}
function guessRoleForExecution(exec) {
  const scopes = scopesText(exec).toLowerCase();
  const command = String(exec?.command || "").toLowerCase();
  const text2 = `${scopes} ${command}`;
  if (/(config appsettings list|config connection-string list|publishing-credentials|list-publishing|function keys list|deployment list-publishing-profiles)/.test(text2)) return "Website Contributor";
  if (/log-analytics query|app-insights query|kusto|\blogs?\b/.test(text2)) return "Log Analytics Reader";
  if (/metric|monitor/.test(text2)) return "Monitoring Reader";
  if (/webapp|functionapp|site/.test(text2) && /restart|config set|deploy|scale/.test(text2)) return "Website Contributor";
  if (/write|delete|update|restart|scale|set|apply|deploy/.test(text2)) return "Contributor";
  return "Reader";
}
async function grantDurableRoleAssignment(agent, subscription, { resourceId, role, principalId }, entry) {
  if (!principalId) {
    throw new Error("Could not resolve the SRE Agent's execution identity (properties.actionConfiguration.identity). Cannot create a role assignment without a principal.");
  }
  const roleDefinitionId = ROLE_DEFINITION_IDS[role] || ROLE_DEFINITION_IDS.Reader;
  const roleDefinitionResourceId = `/subscriptions/${subscription}/providers/Microsoft.Authorization/roleDefinitions/${roleDefinitionId}`;
  const seed = `${resourceId}|${principalId}|${roleDefinitionId}`;
  const assignmentName = await stableGuid(seed);
  const body = {
    properties: {
      roleDefinitionId: roleDefinitionResourceId,
      principalId,
      principalType: "ServicePrincipal"
    }
  };
  try {
    return await armPut(
      `${resourceId}/providers/Microsoft.Authorization/roleAssignments/${assignmentName}?api-version=2022-04-01`,
      body,
      subscription,
      entry,
      { title: `grant ${role} to SRE Agent identity`, purpose: `Create a durable RBAC role assignment (${role}) so ${agent.name}'s execution identity can run this class of command without OBO fallback.` }
    );
  } catch (err) {
    if (/RoleAssignmentExists|already exists/i.test(shortError2(err))) return { alreadyExists: true };
    throw err;
  }
}
function extractResourceIdFromCommand(command) {
  const match = String(command || "").match(/\/subscriptions\/[^\s'"]+/);
  return match ? match[0].replace(/[)'"]+$/, "") : "";
}
function extractCliFlag(command, flag) {
  const match = String(command || "").match(new RegExp(`--${flag}\\s+("[^"]+"|'[^']+'|\\S+)`));
  if (!match) return "";
  return match[1].replace(/^['"]|['"]$/g, "");
}
async function resolveResourceIdFromCommand(command, subscription, entry) {
  const direct = extractResourceIdFromCommand(command);
  if (direct) return direct;
  const resourceGroup = extractCliFlag(command, "resource-group") || extractCliFlag(command, "resource-group-name");
  const name = extractCliFlag(command, "name");
  if (resourceGroup && !name) {
    return `/subscriptions/${subscription}/resourceGroups/${resourceGroup}`;
  }
  if (!name || !resourceGroup) return "";
  const cmd = String(command || "").toLowerCase();
  const typeGuess = cmd.includes("containerapp") ? "microsoft.app/containerapps" : "microsoft.web/sites";
  const query = `Resources | where resourceGroup =~ '${resourceGroup.replace(/'/g, "''")}' and name =~ '${name.replace(/'/g, "''")}' and type =~ '${typeGuess}' | project id`;
  const rows = await graphQuery(query, subscription, entry, { title: "resolve resource for durable grant", purpose: "Look up the exact resource ID for a --name/--resource-group az command so the RBAC grant can be scoped precisely." });
  if (rows?.[0]?.id) return rows[0].id;
  return `/subscriptions/${subscription}/resourceGroups/${resourceGroup}`;
}
async function stableGuid(seed) {
  const { createHash: createHash3 } = await import("node:crypto");
  const hash = createHash3("sha1").update(seed).digest("hex").slice(0, 32);
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}
function incidentScalar(value, keys = []) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).slice(0, 500);
  }
  if (typeof value !== "object" || Array.isArray(value)) return "";
  for (const key of keys) {
    const nested = incidentScalar(value[key]);
    if (nested) return nested;
  }
  return "";
}
function boundedIncidentText(value, maxLength, keys = []) {
  return incidentScalar(value, keys).slice(0, maxLength);
}
function incidentMarker(thread) {
  const marker = thread && typeof thread === "object" ? thread.status?.incidentStatus : null;
  const incidentId = incidentScalar(marker?.incidentId) || incidentScalar(thread?.incidentSource?.incidentId) || incidentScalar(thread?.incidentId);
  const status = incidentScalar(marker?.status) || incidentScalar(thread?.incidentDetails?.incidentStatus) || incidentScalar(thread?.incidentStatus);
  const source = incidentScalar(thread?.source);
  const hasIncidentDetails = Boolean(
    thread?.incidentDetails && typeof thread.incidentDetails === "object" && !Array.isArray(thread.incidentDetails)
  );
  return incidentId || status || source === "Incident" || hasIncidentDetails ? { incidentId, status } : null;
}
function terminalIncidentStatus(status) {
  return (/* @__PURE__ */ new Set([
    "resolved",
    "closed",
    "mitigated",
    "complete",
    "completed",
    "cancelled",
    "canceled",
    "inactive",
    "dismissed",
    "notanincident",
    "none"
  ])).has(String(status || "").toLowerCase().replace(/[\s_-]/g, ""));
}
function projectIncident(thread) {
  if (!thread || typeof thread !== "object" || Array.isArray(thread)) {
    throw new Error("The SRE Agent returned an invalid thread.");
  }
  const marker = incidentMarker(thread);
  if (!marker) return null;
  const threadId2 = boundedIncidentText(thread.id, 200);
  if (!threadId2) throw new Error("The SRE Agent returned an incident thread without an id.");
  const details = thread.incidentDetails && typeof thread.incidentDetails === "object" && !Array.isArray(thread.incidentDetails) ? thread.incidentDetails : {};
  const source = thread.incidentSource && typeof thread.incidentSource === "object" && !Array.isArray(thread.incidentSource) ? thread.incidentSource : {};
  return {
    id: boundedIncidentText(source.incidentId, 200) || boundedIncidentText(marker.incidentId, 200) || threadId2,
    threadId: threadId2,
    title: boundedIncidentText(details.incidentTitle, 240) || boundedIncidentText(thread.title, 240),
    severity: boundedIncidentText(details.incidentPriority, 80),
    status: boundedIncidentText(details.incidentStatus, 80) || boundedIncidentText(marker.status, 80) || "Unknown",
    agentStatus: boundedIncidentText(details.investigationStatus, 80),
    date: boundedIncidentText(
      details.incidentCreatedTime ?? thread.createdTimestamp ?? thread.createdAt ?? thread.modifiedTimestamp,
      80,
      ["value"]
    ),
    owningService: boundedIncidentText(details.impactedService, 160),
    owningTeam: boundedIncidentText(details.ownerGroup?.name, 160),
    responsePlan: boundedIncidentText(details.filterId, 160),
    active: !terminalIncidentStatus(marker.status)
  };
}
function deriveIncidents(threads) {
  if (!Array.isArray(threads)) throw new Error("Incidents require a valid thread list.");
  const projected = threads.map((thread) => ({
    incident: projectIncident(thread),
    modified: incidentScalar(thread?.modifiedTimestamp) || incidentScalar(thread?.lastUpdatedTimestamp)
  })).filter((item) => item.incident).sort((a, b) => String(b.modified || b.incident.date || "").localeCompare(String(a.modified || a.incident.date || ""))).map((item) => item.incident);
  return dedupeIncidents(projected);
}
function dedupeIncidents(incidents) {
  const unique = /* @__PURE__ */ new Map();
  for (const incident of Array.isArray(incidents) ? incidents : []) {
    const key = incident.id || incident.threadId;
    if (key && !unique.has(key)) unique.set(key, incident);
  }
  return [...unique.values()];
}
function objectKeys(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? Object.keys(value).sort().slice(0, 40) : [];
}
function incidentContractMetadata(threads) {
  const keys = {
    incidentStatus: /* @__PURE__ */ new Set(),
    investigationStatus: /* @__PURE__ */ new Set(),
    incidentDetails: /* @__PURE__ */ new Set(),
    incidentSource: /* @__PURE__ */ new Set()
  };
  for (const thread of Array.isArray(threads) ? threads : []) {
    for (const key of objectKeys(thread?.status?.incidentStatus)) keys.incidentStatus.add(key);
    for (const key of objectKeys(thread?.status?.investigationStatus)) keys.investigationStatus.add(key);
    for (const key of objectKeys(thread?.incidentDetails)) keys.incidentDetails.add(key);
    for (const key of objectKeys(thread?.incidentSource)) keys.incidentSource.add(key);
  }
  return Object.fromEntries(Object.entries(keys).map(([name, values]) => [name, [...values].sort()]));
}
async function listIncidentThreadPage(agent, subscription, entry, {
  skip = 0,
  top = INCIDENT_THREAD_PAGE_SIZE,
  query = "",
  status = "",
  fetchImpl = dataPlaneFetch
} = {}) {
  const offset = Number.isInteger(skip) && skip >= 0 ? skip : 0;
  const limit = Number.isInteger(top) && top > 0 && top <= 100 ? top : INCIDENT_THREAD_PAGE_SIZE;
  const filter = incidentThreadFilter({ query, status });
  const search = new URLSearchParams({
    skip: String(offset),
    top: String(limit),
    filter,
    orderby: "modifiedTimestamp desc"
  });
  const data = await fetchImpl(
    agent,
    subscription,
    "GET",
    `/api/v1/threads?${search.toString()}`,
    void 0,
    entry,
    { title: "list incident threads" }
  );
  const rows = Array.isArray(data?.value) ? data.value : Array.isArray(data) ? data : null;
  if (!rows) throw new Error("The SRE Agent did not return a valid thread list for incidents.");
  return {
    threads: rows,
    incidents: deriveIncidents(rows),
    contract: incidentContractMetadata(rows),
    skip: offset,
    top: limit,
    hasMore: rows.length === limit
  };
}
function odataLiteral(value) {
  return String(value || "").trim().toLowerCase().replaceAll("'", "''");
}
function incidentThreadFilter({ query = "", status = "" } = {}) {
  const clauses = ["source eq 'Incident'"];
  const term = odataLiteral(query);
  if (term) {
    clauses.push(
      `((incidentDetails ne null and contains(tolower(incidentDetails/incidentTitle),'${term}')) or (incidentDetails eq null and contains(tolower(title),'${term}')) or contains(tolower(incidentId),'${term}') or contains(tolower(incidentDetails/filterId),'${term}'))`
    );
  }
  const selected = odataLiteral(status);
  if (selected) {
    const statusClause = `tolower(incidentStatus) eq '${selected}'`;
    clauses.push(["active", "triggered", "new"].includes(selected) ? `(${statusClause} or incidentStatus eq '')` : statusClause);
  }
  return clauses.join(" and ");
}
function countEntries(value) {
  return value.map((item) => [incidentScalar(item.status), Number(item.count)]);
}
function projectIncidentCounts(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload) || !Array.isArray(payload.incidentStatusCounts) || !Array.isArray(payload.investigationStatusCounts)) {
    throw new Error("The SRE Agent did not return valid incident counters.");
  }
  const validEntry = (item) => item && typeof item === "object" && !Array.isArray(item) && incidentScalar(item.status) && Number.isFinite(Number(item.count));
  if (!payload.incidentStatusCounts.every(validEntry) || !payload.investigationStatusCounts.every(validEntry)) {
    throw new Error("The SRE Agent returned malformed incident counters.");
  }
  const incident = Object.fromEntries(countEntries(payload.incidentStatusCounts).filter(([key, count]) => key && Number.isFinite(count)));
  const investigation = Object.fromEntries(countEntries(payload.investigationStatusCounts).filter(([key, count]) => key && Number.isFinite(count)));
  const find = (counts, wanted) => Object.entries(counts).find(([key]) => String(key).toLowerCase() === wanted)?.[1] || 0;
  return {
    active: find(incident, "active"),
    mitigated: find(incident, "mitigated") + find(incident, "resolved"),
    completed: find(investigation, "complete") + find(investigation, "completed"),
    inProgress: find(investigation, "inprogress") + find(investigation, "in progress"),
    pendingUserInput: Object.keys(investigation).some((key) => /^pending[\s_-]*user[\s_-]*input$/i.test(key)) ? Object.entries(investigation).filter(([key]) => /^pending[\s_-]*user[\s_-]*input$/i.test(key)).reduce((sum, [, count]) => sum + count, 0) : null,
    total: Object.values(incident).reduce((sum, count) => sum + count, 0)
  };
}
function incidentResponsePlanUrl(agent, plan) {
  if (!agent || typeof plan !== "string" || !plan.trim()) return null;
  let base = agent.portalUrl;
  if (!base && !agent.external && /^\/subscriptions\/[^/]+\/resourceGroups\/[^/]+\/providers\/Microsoft\.App\/agents\/[^/]+$/i.test(agent.id || "")) {
    base = `https://sre.azure.com/agents${agent.id}`;
  }
  if (!base || !URL.canParse(base)) return null;
  const url = new URL(base);
  if (url.origin !== "https://sre.azure.com") return null;
  url.hash = `/views/builder/responsePlans?editHandler=${encodeURIComponent(plan)}`;
  return url.href;
}
async function getIncidentCounts(agent, subscription, entry, {
  query = "",
  status = "",
  fetchImpl = dataPlaneFetch
} = {}) {
  const search = new URLSearchParams({ filter: incidentThreadFilter({ query, status }) });
  const payload = await fetchImpl(
    agent,
    subscription,
    "GET",
    `/api/v1/threads/threadsCountByStatus?${search.toString()}`,
    void 0,
    entry,
    { title: "load incident counters" }
  );
  return projectIncidentCounts(payload);
}
function incidentsPortalUrl(agent, subscription) {
  if (!agent) throw new Error("Select an SRE Agent first.");
  if (agent.external) {
    const parsed = parseExternalAgentReference(agent.portalUrl);
    if (!parsed?.portalUrl || parsed.endpoint !== agent.endpoint) {
      throw new Error("Paste the registered external-agent portal link to open incidents in Portal.");
    }
    const portal = new URL(parsed.portalUrl);
    portal.hash = "/views/incidents";
    return portal.href;
  }
  const resourceGroup = String(agent.resourceGroup || "").trim();
  const name = String(agent.name || "").trim();
  const scope = String(subscription || "").trim();
  if (!scope || !resourceGroup || !name) throw new Error("The connected agent does not have a complete Azure resource scope.");
  return "https://sre.azure.com/agents/subscriptions/" + encodeURIComponent(scope) + "/resourceGroups/" + encodeURIComponent(resourceGroup) + "/providers/Microsoft.App/agents/" + encodeURIComponent(name) + "/views/incidents";
}
async function listActiveIncidents(agent, subscription, entry, {
  skip = 0,
  query = "",
  status = "",
  listPageImpl = listIncidentThreadPage,
  listCountsImpl = getIncidentCounts,
  fetchImpl = dataPlaneFetch
} = {}) {
  const [page, counts] = await Promise.all([
    listPageImpl(agent, subscription, entry, {
      skip,
      top: INCIDENT_THREAD_PAGE_SIZE,
      query,
      status,
      fetchImpl
    }),
    listCountsImpl(agent, subscription, entry, { fetchImpl })
  ]);
  return {
    incidents: page.incidents,
    contract: page.contract,
    counts,
    derivedFrom: "threads",
    threadCount: page.threads.length,
    nextSkip: page.skip + page.threads.length,
    hasMore: page.hasMore,
    partial: page.hasMore
  };
}
async function loadOptionalIncidents(load) {
  try {
    return { result: await load(), accessError: "" };
  } catch (error) {
    return {
      result: {
        incidents: [],
        contract: null,
        counts: { active: 0, mitigated: 0, completed: 0, inProgress: 0, total: 0 },
        nextSkip: 0,
        hasMore: false,
        partial: false
      },
      accessError: `Incidents unavailable: ${shortError2(error)}`
    };
  }
}
async function createIncident(agent, subscription, { title, description, severity, services }, entry) {
  const text2 = `Incident: ${title}
Severity: ${severity || "unspecified"}
Services: ${(services || []).join(", ") || "unspecified"}

${description || ""}`.trim();
  return createThread(agent, subscription, text2, entry);
}
async function listScheduledTasks(agent, subscription, entry, { fetchImpl = dataPlaneFetch } = {}) {
  const data = await fetchImpl(agent, subscription, "GET", "/api/v1/scheduledtasks", void 0, entry, { title: "list scheduled tasks" });
  const tasks = Array.isArray(data) ? data : Array.isArray(data?.value) ? data.value : null;
  if (!tasks) throw new Error("Scheduled tasks returned an unsupported list response.");
  return tasks;
}
async function listHttpTriggers(agent, subscription, entry, { fetchImpl = dataPlaneFetch } = {}) {
  const data = await fetchImpl(agent, subscription, "GET", "/api/v1/httptriggers", void 0, entry, { title: "list HTTP triggers" });
  const triggers = Array.isArray(data) ? data : Array.isArray(data?.value) ? data.value : null;
  if (!triggers) throw new Error("HTTP triggers returned an unsupported list response.");
  return triggers;
}
async function refreshAutomationCollection(entry, { load, field, errorField, label, staleLabel }) {
  const agent = entry.agent;
  const subscription = entry.subscription;
  const key = automationAgentKey(agent, subscription);
  if (!key) throw new Error("Select an SRE Agent to read Automation.");
  const generationField = `${field}Generation`;
  const generation = entry[generationField] = (entry[generationField] || 0) + 1;
  const current = () => entry.agent === agent && entry.subscription === subscription && automationAgentKey(entry.agent, entry.subscription) === key && entry[generationField] === generation;
  let items;
  try {
    items = await load(agent, subscription, entry);
  } catch (error) {
    if (current()) entry[errorField] = `${label} unavailable: ${shortError2(error)}`;
    throw error;
  }
  if (!current()) throw new Error(`Selected agent changed; the old ${staleLabel} response was discarded.`);
  entry[field] = items;
  entry[errorField] = "";
  return items;
}
async function refreshScheduledTasks(entry, { load = listScheduledTasks } = {}) {
  return refreshAutomationCollection(entry, {
    load,
    field: "scheduledTasks",
    errorField: "scheduledTasksError",
    label: "Scheduled tasks",
    staleLabel: "scheduled-task"
  });
}
async function refreshHttpTriggers(entry, { load = listHttpTriggers } = {}) {
  return refreshAutomationCollection(entry, {
    load,
    field: "httpTriggers",
    errorField: "httpTriggersError",
    label: "HTTP triggers",
    staleLabel: "HTTP-trigger"
  });
}
async function refreshAutomationCollections(entry, { scheduledLoad = listScheduledTasks, httpLoad = listHttpTriggers } = {}) {
  const agent = entry.agent;
  const subscription = entry.subscription;
  const key = automationAgentKey(agent, subscription);
  const generation = entry.automationRefreshGeneration = (entry.automationRefreshGeneration || 0) + 1;
  const results = await Promise.allSettled([
    refreshScheduledTasks(entry, { load: scheduledLoad }),
    refreshHttpTriggers(entry, { load: httpLoad })
  ]);
  if (entry.agent !== agent || entry.subscription !== subscription || automationAgentKey(entry.agent, entry.subscription) !== key || entry.automationRefreshGeneration !== generation) throw new Error("Selected agent changed or refreshed; the old Automation response was discarded.");
  const outcome = (result) => result.status === "fulfilled" ? { ok: true } : { ok: false, message: shortError2(result.reason) };
  return { scheduled: outcome(results[0]), http: outcome(results[1]) };
}
function scheduledTasksModelResult(entry) {
  const catalog = normalizeAutomationCatalog({
    agent: entry.agent,
    subscription: entry.subscription,
    scheduledTasks: entry.scheduledTasks,
    scheduledTasksError: entry.scheduledTasksError
  });
  if (catalog.sources.scheduled.status !== "available") throw new Error("Scheduled tasks are unavailable.");
  if (!catalog.items.length && catalog.sources.scheduled.invalid) throw new Error("The scheduled-task response contained no readable records.");
  const projected = projectAutomationCatalog(catalog);
  return {
    ok: true,
    scheduledTasks: projected.items,
    totalLoaded: projected.totalLoaded,
    omitted: projected.omitted,
    truncated: projected.truncated,
    totalReceived: catalog.sources.scheduled.received,
    excludedRecords: catalog.sources.scheduled.invalid || 0,
    partial: Boolean(projected.truncated || catalog.sources.scheduled.invalid)
  };
}
async function getAutomationHistory(entry, selection, { fetchImpl = dataPlaneFetch } = {}) {
  return readAutomationHistory(entry, selection, { fetchImpl });
}
async function loadOptionalScheduledTasks(load, { allowReadFailure = false } = {}) {
  try {
    return { tasks: await load(), accessError: "" };
  } catch (error) {
    if (allowReadFailure) return { tasks: void 0, accessError: `Scheduled tasks unavailable: ${shortError2(error)}` };
    if (!/^GET \/api\/v1\/scheduledtasks failed \(403\):.*Access denied by PDP/i.test(shortError2(error))) throw error;
    return { tasks: [], accessError: "Scheduled tasks unavailable: access denied by PDP (403)." };
  }
}
async function loadOptionalHttpTriggers(load) {
  try {
    return { triggers: await load(), accessError: "" };
  } catch (error) {
    return { triggers: void 0, accessError: `HTTP triggers unavailable: ${shortError2(error)}` };
  }
}
async function createScheduledTask(agent, subscription, { name, cronExpression, message, description }, entry) {
  return dataPlaneFetch(agent, subscription, "POST", "/api/v1/scheduledtasks", {
    name,
    description,
    cron: cronExpression,
    startMessage: message,
    triggerType: "ScheduledTask",
    maxExecutions: null,
    notificationChannel: null,
    executionContext: {}
  }, entry, { title: "create scheduled task" });
}
async function pauseScheduledTask(agent, subscription, taskId, entry) {
  return dataPlaneFetch(agent, subscription, "POST", `/api/v1/scheduledtasks/${encodeURIComponent(taskId)}/pause`, void 0, entry, { title: "pause scheduled task" });
}
async function resumeScheduledTask(agent, subscription, taskId, entry) {
  return dataPlaneFetch(agent, subscription, "POST", `/api/v1/scheduledtasks/${encodeURIComponent(taskId)}/resume`, void 0, entry, { title: "resume scheduled task" });
}
async function searchMemories(agent, subscription, query, entry) {
  const data = await dataPlaneFetch(agent, subscription, "GET", `/api/v1/agentmemory/documents?q=${encodeURIComponent(query)}`, void 0, entry, { title: "search memories" });
  return data?.value || data || [];
}
async function addMemory(agent, subscription, { name, content }, entry) {
  return dataPlaneFetch(agent, subscription, "POST", "/api/v1/agentmemory/documents", { name, content }, entry, { title: "add memory" });
}
async function generateWorkflow(agent, subscription, { kind, name, description, modelOrType, tools, handoffs, connector }, entry) {
  return dataPlaneFetch(agent, subscription, "POST", "/api/v1/workflows", {
    kind,
    name,
    description,
    modelOrType,
    tools,
    handoffs,
    connector
  }, entry, { title: "generate workflow" });
}
async function resolveAppResource(subscription, resourceIdOrName, entry) {
  if (!resourceIdOrName) return null;
  const isId = resourceIdOrName.startsWith("/subscriptions/");
  const types = APP_RESOURCE_TYPES.map((t) => `'${t}'`).join(",");
  const query = isId ? `Resources | where id =~ '${resourceIdOrName.replace(/'/g, "''")}'` : `Resources | where (type in~ (${types}) or type contains 'sandbox') and name =~ '${resourceIdOrName.replace(/'/g, "''")}'`;
  const rows = await graphQuery(query, isId ? void 0 : subscription, entry, { title: "graph query (resolve app)", purpose: "Resolve the target app resource by id or name." });
  return rows[0] || null;
}
async function resourceHealthSummary(resourceId, subscription, entry) {
  const path2 = `${resourceId}/providers/Microsoft.ResourceHealth/availabilityStatuses/current`;
  const data = await armGet(withApiVersion(path2), subscription, entry, { title: "resource health", purpose: "Pull the current Resource Health status for the target app." }).catch((err) => ({ error: shortError2(err) }));
  if (data?.error) return { availabilityState: "unknown", summary: data.error };
  return {
    availabilityState: data?.properties?.availabilityState || "unknown",
    summary: data?.properties?.title || data?.properties?.summary || "",
    reasonType: data?.properties?.reasonType || "",
    occurredTime: data?.properties?.occurredTime || ""
  };
}
var WORKSPACE_SCAN_FILE_CAP = 500;
var WORKSPACE_SCAN_FILE_SIZE_CAP = 200 * 1024;
var WORKSPACE_SCAN_SKIP_DIRS = /* @__PURE__ */ new Set(["node_modules", ".git", "bin", "obj", "dist", "build", ".venv", "__pycache__", ".next", "out"]);
var WORKSPACE_SCAN_EXTENSIONS = /* @__PURE__ */ new Set([".js", ".ts", ".jsx", ".tsx", ".cs", ".py", ".json", ".bicep", ".tf"]);
function workspaceRoot() {
  return process.cwd();
}
function collectWorkspaceFiles(root) {
  const files = [];
  const stack = [root];
  while (stack.length && files.length < WORKSPACE_SCAN_FILE_CAP) {
    const dir = stack.pop();
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const dirent of entries) {
      if (files.length >= WORKSPACE_SCAN_FILE_CAP) break;
      if (dirent.name.startsWith(".") && dirent.name !== ".env" && !dirent.name.startsWith(".env")) continue;
      const full = join(dir, dirent.name);
      if (dirent.isDirectory()) {
        if (!WORKSPACE_SCAN_SKIP_DIRS.has(dirent.name)) stack.push(full);
        continue;
      }
      const isDotEnv = dirent.name === ".env" || dirent.name.startsWith(".env.");
      const isSpecial = dirent.name === "local.settings.json" || dirent.name === "host.json";
      const ext = dirent.name.slice(dirent.name.lastIndexOf("."));
      if (isDotEnv || isSpecial || WORKSPACE_SCAN_EXTENSIONS.has(ext)) files.push(full);
    }
  }
  return files;
}
function scanFileForSettings(fileName, text2) {
  const hits = [];
  const push = (settingName, line, kind) => {
    if (settingName) hits.push({ settingName, line, kind });
  };
  const lines = text2.split("\n");
  if (fileName === "local.settings.json") {
    try {
      const parsed = JSON.parse(text2);
      const values = parsed?.Values || {};
      for (const key of Object.keys(values)) {
        const lineIdx = lines.findIndex((l) => l.includes(`"${key}"`));
        push(key, lineIdx >= 0 ? lineIdx + 1 : 1, "local.settings.json");
      }
    } catch {
    }
    return hits;
  }
  if (fileName === ".env" || fileName.startsWith(".env.")) {
    lines.forEach((line, idx) => {
      const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
      if (m) push(m[1], idx + 1, ".env");
    });
    return hits;
  }
  if (fileName === "host.json") {
    lines.forEach((line, idx) => {
      const m = line.match(/"(?:connection|ConnectionString|[A-Za-z]*[Cc]onnection)"\s*:\s*"([A-Za-z_][A-Za-z0-9_]*)"/);
      if (m) push(m[1], idx + 1, "host.json");
    });
    return hits;
  }
  if (fileName.endsWith(".bicep") || fileName.endsWith(".tf")) {
    const appSettingsBlockRe = /appSettings\s*[:=]?\s*\[([\s\S]*?)\]/g;
    let blockMatch;
    while (blockMatch = appSettingsBlockRe.exec(text2)) {
      const block = blockMatch[1];
      const nameRe = /name\s*[:=]\s*'([A-Za-z_][A-Za-z0-9_]*)'|name\s*[:=]\s*"([A-Za-z_][A-Za-z0-9_]*)"/g;
      let nameMatch;
      while (nameMatch = nameRe.exec(block)) {
        const settingName = nameMatch[1] || nameMatch[2];
        const offset = blockMatch.index + block.indexOf(nameMatch[0]);
        const lineIdx = text2.slice(0, offset).split("\n").length;
        push(settingName, lineIdx, fileName.endsWith(".bicep") ? "bicep appSettings" : "terraform app_settings");
      }
    }
    return hits;
  }
  const patterns = [
    { re: /process\.env\.([A-Za-z_][A-Za-z0-9_]*)/g, kind: "process.env" },
    { re: /process\.env\[\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]\s*\]/g, kind: "process.env" },
    { re: /Configuration\[\s*"([A-Za-z_][A-Za-z0-9_]*)"\s*\]/g, kind: "Configuration[]" },
    { re: /Environment\.GetEnvironmentVariable\(\s*"([A-Za-z_][A-Za-z0-9_]*)"\s*\)/g, kind: "GetEnvironmentVariable" },
    { re: /os\.environ\[\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]\s*\]/g, kind: "os.environ" },
    { re: /os\.getenv\(\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]/g, kind: "os.getenv" }
  ];
  lines.forEach((line, idx) => {
    for (const { re, kind } of patterns) {
      re.lastIndex = 0;
      let m;
      while (m = re.exec(line)) push(m[1], idx + 1, kind);
    }
  });
  return hits;
}
function scanWorkspaceForAppSettings(root) {
  const files = collectWorkspaceFiles(root);
  const bySettingName = /* @__PURE__ */ new Map();
  for (const full of files) {
    let stat2;
    try {
      stat2 = statSync(full);
    } catch {
      continue;
    }
    if (!stat2.isFile() || stat2.size > WORKSPACE_SCAN_FILE_SIZE_CAP) continue;
    let text2;
    try {
      text2 = readFileSync2(full, "utf8");
    } catch {
      continue;
    }
    const fileName = full.slice(full.lastIndexOf("/") + 1);
    const hits = scanFileForSettings(fileName, text2);
    for (const hit of hits) {
      const key = hit.settingName.toLowerCase();
      if (!bySettingName.has(key)) bySettingName.set(key, { settingName: hit.settingName, sources: [] });
      bySettingName.get(key).sources.push({ file: relative(root, full), line: hit.line, kind: hit.kind });
    }
  }
  return [...bySettingName.values()];
}
async function fetchAzureAppSettings(resource, subscription, entry) {
  if (resource.type?.toLowerCase() === "microsoft.app/containerapps") {
    const data2 = await armGet(withApiVersion(resource.id), subscription, entry, {
      title: "get container app (env)",
      purpose: "Read container env vars from the Container App's revision template for the config drift check."
    }).catch((err) => ({ error: shortError2(err) }));
    if (data2?.error) return { error: data2.error, names: [] };
    const containers = data2?.properties?.template?.containers || [];
    const names = /* @__PURE__ */ new Set();
    for (const c of containers) {
      for (const e of c.env || []) if (e?.name) names.add(e.name);
    }
    return { names: [...names] };
  }
  if (resource.type?.toLowerCase() !== "microsoft.web/sites") {
    return { error: `Workspace config drift check is not implemented for ${resource.type}.`, names: [] };
  }
  const isFunctionApp = /functionapp|kind":"functionapp/i.test(JSON.stringify(resource.kind || ""));
  const cliVerb = isFunctionApp ? "functionapp" : "webapp";
  const data = await azLogged(
    entry,
    [cliVerb, "config", "appsettings", "list", "--name", resource.name, "--resource-group", resource.resourceGroup, "-o", "json"],
    subscription,
    { title: "list app settings", purpose: "Read the live App Settings configured on this Web App / Function App for the config drift check." }
  ).catch((err) => ({ error: shortError2(err) }));
  if (data?.error) return { error: data.error, names: [] };
  const list = Array.isArray(data) ? data : [];
  return { names: list.map((entryItem) => entryItem?.name).filter(Boolean) };
}
function diffAppSettings(workspaceSettings, azureNames) {
  const azureByLower = new Map(azureNames.map((n) => [n.toLowerCase(), n]));
  const workspaceByLower = new Map(workspaceSettings.map((s) => [s.settingName.toLowerCase(), s]));
  const missingInAzure = [];
  const matched = [];
  for (const [lower2, ws] of workspaceByLower) {
    if (azureByLower.has(lower2)) matched.push(ws.settingName);
    else missingInAzure.push(ws);
  }
  const unusedInWorkspace = azureNames.filter((n) => !workspaceByLower.has(n.toLowerCase()));
  return { missingInAzure, unusedInWorkspace, matchedCount: matched.length };
}
async function checkWorkspaceConfigDrift(resource, subscription, entry) {
  const workspaceSettings = scanWorkspaceForAppSettings(workspaceRoot());
  const azureResult = await fetchAzureAppSettings(resource, subscription, entry);
  if (azureResult.error) return { error: azureResult.error, workspaceSettings, missingInAzure: [], unusedInWorkspace: [], matchedCount: 0 };
  const diff = diffAppSettings(workspaceSettings, azureResult.names);
  return { workspaceSettings, ...diff };
}
var instances = /* @__PURE__ */ new Map();
var session;
var STICKY_STATE_DIR = join(homedir(), ".copilot", "azure-sre-agent");
var LEGACY_STICKY_STATE_FILE = join(homedir(), ".copilot", "sre-agent-studio", "last-selection.json");
var STICKY_STATE_FILE = join(STICKY_STATE_DIR, "last-selection.json");
var FAVORITES_FILE = join(STICKY_STATE_DIR, "favorites.json");
var MAX_FAVORITES = 20;
var MAX_FAVORITES_BYTES = 16384;
function favoriteOf(agent, subscription) {
  if (!agent || typeof agent.name !== "string" || !agent.name.trim() || agent.name.length > 128) {
    throw new Error("A connected agent with a valid name is required to save a Favorite.");
  }
  if (agent.external) {
    const parsed2 = parseExternalAgentReference(agent.endpoint);
    if (!parsed2 || parsed2.endpoint !== agent.endpoint) throw new Error("This external agent has no valid base endpoint.");
    let portalUrl = "";
    if (agent.portalUrl) {
      const portal = parseExternalAgentReference(agent.portalUrl);
      if (!portal || portal.endpoint !== agent.endpoint || !portal.portalUrl) {
        throw new Error("This external agent's Portal link does not match its endpoint.");
      }
      portalUrl = `https://sre.azure.com/externalagents/${encodeURIComponent(agent.name)}?agentUrl=${encodeURIComponent(agent.endpoint)}`;
    }
    return { kind: "external", endpoint: agent.endpoint, name: agent.name, portalUrl };
  }
  const parsed = parseSharedAgentReference(agent.id);
  if (parsed.id.toLowerCase() !== agent.id.toLowerCase() || parsed.subscription.toLowerCase() !== String(subscription).toLowerCase() || parsed.name.toLowerCase() !== agent.name.toLowerCase() || parsed.resourceGroup.toLowerCase() !== String(agent.resourceGroup).toLowerCase()) {
    throw new Error("The connected SRE Agent's resource identity does not match its subscription.");
  }
  return { kind: "native", id: parsed.id, name: parsed.name, resourceGroup: parsed.resourceGroup, subscription: parsed.subscription };
}
function favoriteKey(favorite) {
  return favorite.kind === "external" ? `external:${favorite.endpoint.toLowerCase()}` : `native:${favorite.id.toLowerCase()}`;
}
function readFavorites(file = FAVORITES_FILE) {
  let data;
  try {
    if (statSync(file).size > MAX_FAVORITES_BYTES) throw new Error("Saved Favorites exceed the size limit.");
    data = JSON.parse(readFileSync2(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw new Error(`Could not load saved Favorites: ${error.message}`);
  }
  if (data?.version !== 1 || !Array.isArray(data.favorites) || data.favorites.length > MAX_FAVORITES) {
    throw new Error("Saved Favorites have an unsupported or invalid format.");
  }
  const seen = /* @__PURE__ */ new Set();
  return data.favorites.map((favorite) => {
    if (!favorite || typeof favorite !== "object" || Array.isArray(favorite)) {
      throw new Error("Saved Favorites contain an invalid connection.");
    }
    const expected = favorite.kind === "external" ? favoriteOf({ external: true, endpoint: favorite.endpoint, name: favorite.name, portalUrl: favorite.portalUrl }, "") : favorite.kind === "native" ? favoriteOf({ id: favorite.id, name: favorite.name, resourceGroup: favorite.resourceGroup }, favorite.subscription) : null;
    if (!expected || Object.keys(expected).length !== Object.keys(favorite).length || Object.entries(expected).some(([key, value]) => favorite[key] !== value) || seen.has(favoriteKey(expected))) {
      throw new Error("Saved Favorites contain an invalid or duplicate connection.");
    }
    seen.add(favoriteKey(expected));
    return expected;
  });
}
function writeFavorites(favorites, file = FAVORITES_FILE) {
  const data = JSON.stringify({ version: 1, favorites });
  if (Buffer.byteLength(data) > MAX_FAVORITES_BYTES) throw new Error("Saved Favorites exceed the size limit.");
  mkdirSync(dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, data, { mode: 384, flag: "wx" });
    renameSync(temporary, file);
  } catch (error) {
    try {
      unlinkSync(temporary);
    } catch (cleanupError) {
      if (cleanupError.code !== "ENOENT") throw cleanupError;
    }
    throw error;
  }
}
function updateFavorite(agent, subscription, remove = false, file = FAVORITES_FILE) {
  const favorite = favoriteOf(agent, subscription);
  const favorites = readFavorites(file);
  const key = favoriteKey(favorite);
  const remaining = favorites.filter((item) => favoriteKey(item) !== key);
  if (remove && remaining.length === favorites.length) throw new Error("This connection is no longer in Favorites. Refresh and try again.");
  if (!remove && remaining.length === favorites.length && favorites.length >= MAX_FAVORITES) {
    throw new Error(`Favorites are limited to ${MAX_FAVORITES} connections. Remove one before adding another.`);
  }
  writeFavorites(remove ? remaining : [...remaining, favorite], file);
  return remove ? remaining : [...remaining, favorite];
}
async function selectSavedFavorite(entry, key, {
  readFavoritesImpl = readFavorites,
  openReferenceImpl = openSharedAgentReference
} = {}) {
  const favorite = readFavoritesImpl().find((item) => favoriteKey(item) === key);
  if (!favorite) throw new Error("Favorite not found. Refresh and try again.");
  const connected = await openReferenceImpl(
    entry,
    favorite.kind === "external" ? favorite.portalUrl || favorite.endpoint : favorite.id,
    favorite.kind === "external" ? { externalName: favorite.name } : {}
  );
  if (!connected) throw new Error(`Could not reconnect to Favorite ${favorite.name}. It may have been removed or access may have changed.`);
  return connected;
}
function loadStickyState() {
  for (const file of [STICKY_STATE_FILE, LEGACY_STICKY_STATE_FILE]) {
    try {
      const parsed = JSON.parse(readFileSync2(file, "utf8"));
      return {
        subscription: typeof parsed.subscription === "string" ? parsed.subscription : "",
        agentName: typeof parsed.agentName === "string" ? parsed.agentName : "",
        agentResourceGroup: typeof parsed.agentResourceGroup === "string" ? parsed.agentResourceGroup : "",
        externalAgentUrl: typeof parsed.externalAgentUrl === "string" ? parsed.externalAgentUrl : "",
        externalAgentName: typeof parsed.externalAgentName === "string" ? parsed.externalAgentName : "",
        externalPortalUrl: typeof parsed.externalPortalUrl === "string" ? parsed.externalPortalUrl : ""
      };
    } catch {
    }
  }
  return { subscription: "", agentName: "", agentResourceGroup: "", externalAgentUrl: "", externalAgentName: "", externalPortalUrl: "" };
}
function saveStickyState(state) {
  try {
    mkdirSync(STICKY_STATE_DIR, { recursive: true });
    writeFileSync(STICKY_STATE_FILE, JSON.stringify(state, null, 2), "utf8");
  } catch {
  }
}
function rememberSelection(entry) {
  saveStickyState({
    subscription: entry.subscription || "",
    agentName: entry.agent?.name || "",
    agentResourceGroup: entry.agent?.resourceGroup || "",
    externalAgentUrl: entry.agent?.external ? entry.agent.endpoint : "",
    externalAgentName: entry.agent?.external ? entry.agent.name : "",
    externalPortalUrl: entry.agent?.external ? entry.agent.portalUrl || "" : ""
  });
}
function ensureEntry(instanceId) {
  let entry = instances.get(instanceId);
  if (!entry) {
    const sticky = loadStickyState();
    entry = {
      instanceId,
      server: null,
      url: "",
      clients: /* @__PURE__ */ new Set(),
      subscriptions: [],
      subscriptionPicker: { accounts: [], revision: 0 },
      discoveryScope: null,
      discoveryGeneration: 0,
      discoveryLoading: false,
      discoveryError: "",
      subscription: sticky.subscription,
      appSubscription: sticky.subscription,
      connectorSubscription: "",
      agents: [],
      agent: null,
      pendingAgentName: sticky.agentName,
      pendingAgentResourceGroup: sticky.agentResourceGroup,
      pendingExternalAgentUrl: sticky.externalPortalUrl || sticky.externalAgentUrl,
      pendingExternalAgentName: sticky.externalAgentName,
      appResources: [],
      connectors: [],
      connectorGateways: [],
      connectorNamespaceMcps: [],
      kustoResources: [],
      connectorAccessInfo: {},
      threads: [],
      activeThread: null,
      threadRead: null,
      automationRunThreadId: "",
      focusedThreadId: "",
      focusedThreadTitle: "",
      incidents: [],
      incidentsError: "",
      incidentsContract: null,
      incidentsPartial: false,
      incidentCounts: { active: 0, mitigated: 0, completed: 0, inProgress: 0, total: 0 },
      incidentsNextSkip: 0,
      incidentsHasMore: false,
      incidentQuery: "",
      incidentStatusFilter: "",
      incidentQueryGeneration: 0,
      needsAttention: [],
      executionGates: null,
      scheduledTasks: [],
      scheduledTasksError: "",
      httpTriggers: void 0,
      httpTriggersError: "",
      memoryResults: [],
      commands: [],
      configDrift: null,
      status: "Not connected. Run doctor or select a subscription to discover SRE Agents.",
      error: "",
      busy: false,
      selectionGeneration: 0,
      appGeneration: 0
    };
    instances.set(instanceId, entry);
  }
  return entry;
}
function snapshot(entry) {
  const httpSource = normalizeAutomationCatalog({
    agent: entry.agent,
    subscription: entry.subscription,
    httpTriggers: entry.httpTriggers
  }).sources.http;
  let favorites = [];
  let favoritesError = "";
  try {
    favorites = readFavorites();
  } catch (error) {
    favoritesError = shortError2(error);
  }
  return {
    favorites,
    favoritesError,
    subscriptions: entry.subscriptions,
    subscriptionPicker: entry.subscriptionPicker,
    discoveryScope: entry.discoveryScope,
    discoveryLoading: entry.discoveryLoading,
    discoveryError: entry.discoveryError,
    subscription: entry.subscription,
    appSubscription: entry.appSubscription,
    connectorSubscription: entry.connectorSubscription,
    agents: entry.agents,
    agent: entry.agent,
    appResources: entry.appResources,
    connectors: entry.connectors,
    connectorGateways: entry.connectorGateways,
    connectorNamespaceMcps: entry.connectorNamespaceMcps,
    kustoResources: entry.kustoResources,
    connectorAccessInfo: entry.connectorAccessInfo || {},
    threads: entry.threads,
    activeThread: entry.activeThread,
    threadRead: entry.threadRead,
    focusedThreadId: entry.focusedThreadId,
    focusedThreadTitle: entry.focusedThreadTitle,
    incidents: (entry.incidents || []).map((incident) => ({
      ...incident,
      responsePlanUrl: incidentResponsePlanUrl(entry.agent, incident.responsePlan)
    })),
    connectorsError: entry.connectorsError || "",
    incidentsError: entry.incidentsError,
    incidentsContract: entry.incidentsContract,
    incidentsPartial: entry.incidentsPartial,
    incidentCounts: entry.incidentCounts,
    incidentsNextSkip: entry.incidentsNextSkip,
    incidentsHasMore: entry.incidentsHasMore,
    incidentQuery: entry.incidentQuery,
    incidentStatusFilter: entry.incidentStatusFilter,
    needsAttention: entry.needsAttention,
    executionGates: entry.executionGates,
    scheduledTasks: entry.scheduledTasks,
    scheduledTasksError: entry.scheduledTasksError,
    httpTriggers: entry.httpTriggers === void 0 ? void 0 : httpSource.items.map((item) => ({ ...item, status: item.rawStatus ?? void 0 })),
    httpTriggersExcluded: httpSource.invalid || 0,
    httpTriggersTruncated: httpSource.truncated,
    httpTriggersError: entry.httpTriggersError,
    memoryResults: entry.memoryResults,
    commands: entry.commands,
    configDrift: entry.configDrift,
    status: entry.status,
    error: entry.error,
    busy: entry.busy
  };
}
function broadcastFavorites() {
  for (const entry of instances.values()) broadcast(entry, "state", snapshot(entry));
}
function appendFocusContract(entry, result) {
  if (!entry.focusedThreadId || !result || typeof result !== "object" || Array.isArray(result)) return result;
  return {
    ...result,
    focus: {
      threadId: entry.focusedThreadId,
      title: entry.focusedThreadTitle,
      contract: FOCUS_CONTRACT
    }
  };
}
function clearThreadContext(entry) {
  entry.activeThread = null;
  entry.automationRunThreadId = "";
  entry.focusedThreadId = "";
  entry.focusedThreadTitle = "";
  if ("threadRead" in entry) entry.threadRead = null;
  if ("requestedThreadId" in entry) entry.requestedThreadId = "";
}
async function readSelectedThread(entry, { threadId: threadId2, poll = false, focus = false }, {
  readThread = getThread
} = {}) {
  if (!entry.agent) throw new Error("Select an SRE Agent first.");
  if (!threadId2) throw new Error("Select a thread to read.");
  if (poll && (threadId(entry.activeThread) !== threadId2 || entry.threadRead?.loading)) return null;
  const agent = entry.agent, subscription = entry.subscription, selection = entry.selectionGeneration;
  const activeAtStart = entry.activeThread;
  let appliedThread;
  const generation = (entry.threadReadGeneration || 0) + 1;
  entry.threadReadGeneration = generation;
  entry.requestedThreadId = threadId2;
  entry.threadRead = {
    threadId: threadId2,
    loading: !poll,
    error: entry.threadRead?.threadId === threadId2 ? entry.threadRead.error : ""
  };
  const current = () => entry.agent === agent && entry.subscription === subscription && entry.selectionGeneration === selection && entry.threadReadGeneration === generation && entry.requestedThreadId === threadId2 && (entry.activeThread === activeAtStart || appliedThread && entry.activeThread === appliedThread);
  const publish = () => {
    if (entry.clients) broadcast(entry, "state", snapshot(entry));
  };
  publish();
  try {
    const detail = await readThread(agent, subscription, threadId2, entry);
    if (!current()) return null;
    if (threadId(detail) !== threadId2) throw new Error("The agent returned a different thread; its status was not applied.");
    const thread = retainInitialThreadPrompt(projectCanvasThread(detail, agent.external), entry.activeThread);
    appliedThread = thread;
    entry.activeThread = thread;
    entry.threads = upsertThread(entry.threads, thread);
    entry.threadRead = { threadId: threadId2, loading: false, error: "" };
    if (focus) {
      entry.focusedThreadId = threadId(thread);
      entry.focusedThreadTitle = thread.title || threadId2;
    }
    return thread;
  } catch (error) {
    if (!current()) return null;
    entry.threadRead = { threadId: threadId2, loading: false, error: shortError2(error) };
    throw error;
  } finally {
    if (current()) publish();
  }
}
function agentContextKey(agent) {
  return String(agent?.id || `${agent?.resourceGroup || ""}/${agent?.name || ""}`).toLowerCase();
}
function isAgentContextSwitch(currentAgent, nextAgent) {
  return Boolean(currentAgent && agentContextKey(currentAgent) !== agentContextKey(nextAgent));
}
async function activateDefaultThread(entry, fetchThread) {
  entry.threads = sortThreadsByRecency(entry.threads);
  const activeId = threadId(entry.activeThread);
  if (activeId && entry.threads.some((thread2) => threadId(thread2) === activeId)) return false;
  if (activeId) entry.activeThread = null;
  if (!entry.threads.length) {
    entry.activeThread = null;
    return false;
  }
  const candidateId = threadId(entry.threads[0]);
  const agentKey = agentContextKey(entry.agent);
  const thread = await fetchThread(candidateId);
  if (entry.activeThread || agentContextKey(entry.agent) !== agentKey) return false;
  if (!entry.threads.some((candidate) => threadId(candidate) === candidateId)) return false;
  entry.activeThread = thread;
  return true;
}
async function waitForNewAgentReplies({
  getThread: fetchThread,
  seen,
  waitSeconds,
  now = () => Date.now(),
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
}) {
  const budgetMs = Math.max(0, waitSeconds * 1e3);
  const startedAt = now();
  let thread;
  let replies = [];
  let textualReplies = [];
  let completed = false;
  for (; ; ) {
    thread = await fetchThread();
    replies = (thread?.messages || []).filter((message) => {
      const role = message?.author?.role || message?.role || "";
      return message?.id && !seen.has(message.id) && String(role).toLowerCase() !== "user";
    });
    textualReplies = replies.filter((message) => typeof message?.text === "string" && message.text.trim());
    completed = textualReplies.length > 0 && textualReplies.at(-1)?.isComplete !== false;
    const elapsedMs = now() - startedAt;
    if (completed || elapsedMs >= budgetMs) break;
    await sleep(Math.min(3e3, budgetMs - elapsedMs));
  }
  return {
    thread,
    replies,
    textualReplies,
    completed,
    waitedSeconds: Math.round((now() - startedAt) / 1e3)
  };
}
function broadcast(entry, event, data) {
  const payload = `event: ${event}
data: ${JSON.stringify(data)}

`;
  for (const res of entry.clients) {
    try {
      res.write(payload);
    } catch {
    }
  }
}
async function withBusy(entry, statusMessage, fn) {
  entry.busy = true;
  entry.error = "";
  if (statusMessage) entry.status = statusMessage;
  broadcast(entry, "state", snapshot(entry));
  try {
    const result = await fn();
    return result;
  } catch (err) {
    entry.error = shortError2(err);
    throw err;
  } finally {
    entry.busy = false;
    broadcast(entry, "state", snapshot(entry));
  }
}
async function initSubscriptions(entry) {
  entry.subscriptions = await listSubscriptions(false, entry);
  const stickyValid = entry.subscription && entry.subscriptions.some((s) => s.id === entry.subscription);
  if (!entry.agent) {
    entry.subscription = stickyValid ? entry.subscription : entry.subscriptions.find((s) => s.isDefault)?.id || entry.subscriptions[0]?.id || "";
  }
  const appSubValid = entry.appSubscription && entry.subscriptions.some((s) => s.id === entry.appSubscription);
  entry.appSubscription = appSubValid ? entry.appSubscription : entry.subscription;
  entry.status = entry.subscription ? "Signed in. Select an SRE Agent to continue." : "Signed in, but no subscriptions were found.";
}
async function loadAgentsForSub(entry, { resetAgent = false, listAgentsImpl = listAgents } = {}) {
  const generation = ++entry.selectionGeneration;
  const subscription = entry.subscription;
  const discoveryScope = entry.discoveryScope;
  let agents;
  try {
    agents = await listAgentsImpl(subscription, entry);
  } catch (error) {
    if (!isNoQueryableSubscriptionsError(error)) throw error;
    if (generation !== entry.selectionGeneration || subscription !== entry.subscription || discoveryScope !== entry.discoveryScope) return false;
    entry.agents = [];
    entry.agent = null;
    clearThreadContext(entry);
    entry.status = SHARED_AGENT_DISCOVERY_GUIDANCE;
    entry.error = "";
    return true;
  }
  if (generation !== entry.selectionGeneration || subscription !== entry.subscription || discoveryScope !== entry.discoveryScope) return false;
  const currentExternal = !resetAgent && entry.agent?.external ? entry.agent : null;
  entry.agents = currentExternal ? [...agents, currentExternal] : agents;
  const wantedName = resetAgent ? "" : entry.agent?.name || entry.pendingAgentName || "";
  const stillPresent = wantedName && entry.agents.find((a) => a.name === wantedName);
  if (resetAgent || !stillPresent) {
    entry.agent = null;
    entry.connectors = [];
    entry.kustoResources = [];
    entry.connectorAccessInfo = {};
    entry.threads = [];
    clearThreadContext(entry);
    entry.incidents = [];
    entry.incidentsError = "";
    entry.incidentsContract = null;
    entry.incidentsPartial = false;
    entry.incidentCounts = { active: 0, mitigated: 0, completed: 0, inProgress: 0, total: 0 };
    entry.incidentsNextSkip = 0;
    entry.incidentsHasMore = false;
    entry.incidentQuery = "";
    entry.incidentStatusFilter = "";
    entry.needsAttention = [];
    entry.executionGates = null;
    entry.scheduledTasks = [];
    entry.scheduledTasksError = "";
    entry.httpTriggers = void 0;
    entry.httpTriggersError = "";
  }
  entry.status = currentExternal ? `Connected to external agent ${currentExternal.name}. Threads start with ${EXTERNAL_THREAD_PAGE_SIZE} recent items; read-only incidents support server-filtered paging. ARM-managed features are unavailable.` : entry.agents.length ? `Found ${entry.agents.length} SRE Agent(s). Select one to continue.` : "No SRE Agent resources found in this subscription.";
  if (stillPresent && !resetAgent && (!entry.agent || entry.agent.name !== wantedName)) {
    await selectAgent(entry, stillPresent, { generation, subscription });
  }
  entry.pendingAgentName = "";
  entry.pendingAgentResourceGroup = "";
  return true;
}
async function listAgentsForSelection(entry, requestedSubscription, {
  initSubscriptionsImpl = initSubscriptions,
  loadAgentsImpl = loadAgentsForSub,
  saveStickyStateImpl = saveStickyState
} = {}) {
  if (!requestedSubscription && entry.discoveryScope) {
    await loadAgentsForScope(entry);
    return;
  }
  if (requestedSubscription) {
    entry.discoveryScope = null;
    entry.discoveryGeneration = (entry.discoveryGeneration || 0) + 1;
    entry.discoveryLoading = false;
    entry.discoveryError = "";
  }
  const changed = Boolean(requestedSubscription && requestedSubscription !== entry.subscription);
  if (requestedSubscription) entry.subscription = requestedSubscription;
  if (!entry.subscription) await initSubscriptionsImpl(entry);
  const loaded = await loadAgentsImpl(entry, { resetAgent: changed });
  if (changed && loaded) {
    saveStickyStateImpl({ subscription: requestedSubscription, agentName: "", agentResourceGroup: "" });
  }
}
async function loadAgentsForScope(entry, {
  listAgentsImpl = listAgents
} = {}) {
  const generation = ++entry.discoveryGeneration;
  const scope = entry.discoveryScope;
  entry.discoveryLoading = true;
  entry.discoveryError = "";
  broadcast(entry, "state", snapshot(entry));
  const current = () => generation === entry.discoveryGeneration && scope === entry.discoveryScope;
  try {
    const result = await discoverSreAgents(
      scope.subscriptionIds,
      (subscription) => listAgentsImpl(subscription, entry),
      current
    );
    if (!current()) return false;
    entry.agents = [...result.agents];
    if (entry.agent && !entry.agents.some((agent) => agentContextKey(agent) === agentContextKey(entry.agent))) {
      entry.agents.unshift(entry.agent);
    }
    entry.discoveryError = result.errors.length ? `Agent discovery failed in ${result.errors.length} subscription(s): ` + result.errors.slice(0, 3).map(({ subscription, error }) => `${subscription}: ${shortError2(error)}`).join("; ") : "";
    entry.status = result.errors.length ? "Agent discovery is incomplete. Your connected agent is unchanged." : `Found ${result.agents.length} SRE Agent(s) in the selected subscriptions. Your connected agent is unchanged.`;
    return true;
  } finally {
    if (current()) {
      entry.discoveryLoading = false;
      broadcast(entry, "state", snapshot(entry));
    }
  }
}
function beginScopeDiscovery(entry) {
  const loading = loadAgentsForScope(entry);
  const generation = entry.discoveryGeneration;
  void loading.catch((error) => {
    if (generation === entry.discoveryGeneration) {
      entry.discoveryError = shortError2(error);
      broadcast(entry, "state", snapshot(entry));
    }
  });
}
function resolveAgentSelection(agents, { name, resourceId } = {}) {
  const id = resourceId || (String(name || "").startsWith("/") ? name : "");
  const matches = agents.filter((agent) => id ? agent.id?.toLowerCase() === String(id).toLowerCase() : agent.name === name);
  if (matches.length > 1) throw new Error("Several agents have this name or identity. Choose the exact agent from the picker or use its full resource ID.");
  if (!matches.length) throw new Error(`Agent not found: ${id || name || "(not provided)"}. Refresh agents and try again.`);
  return matches[0];
}
function resolveFavoriteSelection(entry, body = {}) {
  if (!body.resourceId) {
    if (body.key && body.key !== favoriteKey(favoriteOf(entry.agent, entry.subscription))) {
      throw new Error("The connected agent changed. Choose its star again.");
    }
    return entry.agent;
  }
  if (!entry.agent?.external && entry.agent?.id?.toLowerCase() === String(body.resourceId).toLowerCase()) return entry.agent;
  return resolveAgentSelection(entry.agents.filter((agent) => !agent.external), body);
}
async function loadAppsForSub(entry, subscription = entry.appSubscription || entry.subscription) {
  const generation = ++entry.appGeneration;
  entry.appSubscription = subscription;
  const resources = subscription ? await listAppResources(subscription, entry) : [];
  if (generation !== entry.appGeneration || subscription !== entry.appSubscription) return false;
  entry.appResources = resources;
  return true;
}
async function selectAgent(entry, agentRow, options = {}) {
  const generation = options.generation ?? ++entry.selectionGeneration;
  const subscriptionAtStart = entry.subscription;
  const subscription = options.subscription ?? agentRow.subscriptionId ?? entry.subscription;
  const activeThreadAtStart = entry.activeThread;
  const selectedAgent = options.resolvedAgent || await getAgent(agentRow.resourceGroup, agentRow.name, subscription, entry);
  dataPlaneEndpoint(selectedAgent);
  if (selectedAgent.external) {
    const account = options.account || await runAz(["account", "show", "-o", "json"]);
    if (String(account?.user?.type || "").toLowerCase() !== "user") {
      throw new Error("External SRE Agents require an az login with a delegated Entra user identity.");
    }
  }
  if (generation !== entry.selectionGeneration || subscriptionAtStart !== entry.subscription) return false;
  const [connectorsResult, threads, needsAttention, scheduledTasksResult, httpTriggersResult] = selectedAgent.external ? await Promise.all([
    loadExternalConnectors(() => (options.listConnectorsImpl || listConnectors)(selectedAgent, subscription, entry)),
    (options.listThreadsImpl || listThreads)(selectedAgent, subscription, entry),
    [],
    loadOptionalScheduledTasks(() => (options.listScheduledTasksImpl || listScheduledTasks)(selectedAgent, subscription, entry), { allowReadFailure: true }),
    loadOptionalHttpTriggers(() => (options.listHttpTriggersImpl || listHttpTriggers)(selectedAgent, subscription, entry))
  ]) : await Promise.all([
    (options.listConnectorsImpl || listConnectors)(selectedAgent, subscription, entry).then((connectors) => ({ connectors, accessError: "" })),
    (options.listThreadsImpl || listThreads)(selectedAgent, subscription, entry),
    (options.listNeedsAttentionImpl || listNeedsAttention)(selectedAgent, subscription, entry),
    loadOptionalScheduledTasks(() => (options.listScheduledTasksImpl || listScheduledTasks)(selectedAgent, subscription, entry)),
    { triggers: void 0, accessError: "" }
  ]);
  const incidentLoad = await loadOptionalIncidents(() => (options.listIncidentsImpl || listActiveIncidents)(
    selectedAgent,
    subscription,
    entry,
    { threads }
  ));
  const incidentsResult = incidentLoad.result;
  if (generation !== entry.selectionGeneration || subscriptionAtStart !== entry.subscription) return false;
  const changingAgent = isAgentContextSwitch(entry.agent, selectedAgent);
  const hydrated = {
    agent: selectedAgent,
    threads,
    activeThread: changingAgent ? null : activeThreadAtStart
  };
  const activeId = threadId(hydrated.activeThread);
  if (activeId && threads.some((thread) => threadId(thread) === activeId)) {
    try {
      hydrated.activeThread = await (options.getThreadImpl || getThread)(selectedAgent, subscription, activeId, entry);
    } catch (error) {
      if (generation !== entry.selectionGeneration || subscriptionAtStart !== entry.subscription || entry.activeThread !== activeThreadAtStart) return false;
      entry.threadRead = { threadId: activeId, loading: false, error: shortError2(error) };
      throw error;
    }
  } else {
    await activateDefaultThread(
      hydrated,
      (threadId2) => (options.getThreadImpl || getThread)(selectedAgent, subscription, threadId2, entry)
    );
  }
  if (generation !== entry.selectionGeneration || subscriptionAtStart !== entry.subscription) return false;
  entry.subscription = subscription;
  entry.agent = selectedAgent;
  if (changingAgent) clearThreadContext(entry);
  entry.connectors = connectorsResult.connectors;
  entry.connectorsError = connectorsResult.accessError;
  entry.threads = threads;
  if (!changingAgent && entry.activeThread !== activeThreadAtStart) {
    entry.threads = upsertThread(entry.threads, entry.activeThread);
  } else {
    entry.activeThread = hydrated.activeThread;
    entry.threadRead = null;
    entry.requestedThreadId = threadId(entry.activeThread);
  }
  entry.incidents = incidentsResult.incidents;
  entry.incidentsError = incidentLoad.accessError;
  entry.incidentsContract = incidentsResult.contract;
  entry.incidentsPartial = incidentsResult.partial;
  entry.incidentCounts = incidentsResult.counts;
  entry.incidentsNextSkip = incidentsResult.nextSkip;
  entry.incidentsHasMore = incidentsResult.hasMore;
  entry.needsAttention = needsAttention;
  entry.executionGates = null;
  entry.scheduledTasks = scheduledTasksResult.tasks;
  entry.scheduledTasksError = scheduledTasksResult.accessError;
  entry.httpTriggers = httpTriggersResult.triggers;
  entry.httpTriggersError = httpTriggersResult.accessError;
  entry.status = selectedAgent.external ? `Connected to external agent ${entry.agent.name}. Threads start with ${EXTERNAL_THREAD_PAGE_SIZE} recent items; read-only incidents support server-filtered paging. ARM-managed features are unavailable.` : `Connected to ${entry.agent.name}.`;
  (options.rememberSelectionImpl || rememberSelection)(entry);
  return true;
}
async function openSharedAgentReference(entry, value, dependencies = {}) {
  const getAgentImpl = dependencies.getAgent || getAgent;
  const selectAgentImpl = dependencies.selectAgent || selectAgent;
  const saveStickyStateImpl = dependencies.saveStickyState || saveStickyState;
  const external = parseExternalAgentReference(value);
  if (external) {
    const agent2 = {
      id: external.endpoint,
      name: dependencies.externalName || external.name,
      resourceGroup: "External agent",
      endpoint: external.endpoint,
      portalUrl: external.portalUrl,
      external: true
    };
    const connected2 = await selectAgentImpl(entry, agent2, { subscription: entry.subscription, resolvedAgent: agent2 });
    if (connected2 === false) return null;
    entry.agents = [
      ...entry.agents.filter((candidate) => candidate.id !== agent2.id),
      agent2
    ];
    entry.pendingExternalAgentUrl = "";
    entry.pendingExternalAgentName = "";
    saveStickyStateImpl({
      subscription: entry.subscription,
      agentName: agent2.name,
      agentResourceGroup: "",
      externalAgentUrl: agent2.endpoint,
      externalAgentName: agent2.name,
      externalPortalUrl: agent2.portalUrl
    });
    entry.status = `Connected to external agent ${agent2.name}. Threads start with ${EXTERNAL_THREAD_PAGE_SIZE} recent items; read-only incidents support server-filtered paging. ARM-managed features are unavailable.`;
    entry.error = "";
    return agent2;
  }
  const parsed = parseSharedAgentReference(value);
  const selectedAgent = await getAgentImpl(parsed.resourceGroup, parsed.name, parsed.subscription, entry);
  const agent = {
    ...selectedAgent,
    id: selectedAgent?.id || parsed.id,
    name: selectedAgent?.name || parsed.name,
    resourceGroup: selectedAgent?.resourceGroup || parsed.resourceGroup
  };
  if (!entry.subscriptions.some((subscription) => subscription.id === parsed.subscription)) {
    entry.subscriptions.push({
      id: parsed.subscription,
      name: `Shared subscription (${parsed.subscription.slice(0, 8)}...)`,
      isDefault: false,
      shared: true
    });
  }
  entry.subscription = parsed.subscription;
  if (!entry.appSubscription) entry.appSubscription = parsed.subscription;
  entry.agents = [...entry.agents.filter((candidate) => String(candidate.id).toLowerCase() !== parsed.id.toLowerCase()), agent];
  const connected = await selectAgentImpl(entry, agent, { subscription: parsed.subscription, resolvedAgent: agent });
  if (connected === false) return null;
  saveStickyStateImpl({
    subscription: parsed.subscription,
    agentName: agent.name,
    agentResourceGroup: agent.resourceGroup
  });
  entry.status = `Connected to shared SRE Agent ${agent.name}.`;
  entry.error = "";
  return agent;
}
async function startServer(entry) {
  const server = createServer((req, res) => {
    const asset = req.method === "GET" && azureSreAgentAssets.get(req.url?.slice(1));
    if (asset) {
      res.writeHead(200, { "Content-Type": asset[1] });
      res.end(readFileSync2(asset[0]));
      return;
    }
    handleRequest(entry, req, res).catch((err) => {
      try {
        responseJson(res, { ok: false, message: shortError2(err) });
      } catch {
      }
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  entry.server = server;
  entry.url = `http://127.0.0.1:${port}/`;
  return entry;
}
function azureDiscoveryFailure(error) {
  if (error?.code === "AZURE_CLI_NOT_FOUND") {
    return "Azure CLI executable was not found. Install Azure CLI or set AZURE_CLI_PATH to its absolute path, then reopen Azure SRE Agent.";
  }
  if (isAzureCliLoginRequiredError(error)) {
    return "Azure CLI is not signed in. Run `az login` in a terminal, then reopen Azure SRE Agent.";
  }
  if (/\bfetch failed\b/i.test(shortError(error))) {
    return shortError2(error);
  }
  return `Azure discovery failed: ${shortError2(error)} Check the reported RBAC, network, or Azure API error; do not sign in again unless Azure CLI reports that authentication is required.`;
}
async function handleRequest(entry, req, res) {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/" && req.method === "GET") {
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": AZURE_SRE_AGENT_CSP
    });
    res.end(renderHtml());
    return;
  }
  if (url.pathname === "/auth/callback.html" && req.method === "GET") {
    const code = url.searchParams.get("code") || "";
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer"
    });
    if (!code || !entry.agent || !entry.pendingKustoConsent) {
      res.end('<!doctype html><meta charset="utf-8"><title>Azure Data Explorer sign-in</title><p>Sign-in returned without a pending Azure SRE Agent operation. Close this window and select Sign in &amp; create MCP again.</p>');
      return;
    }
    try {
      await withBusy(entry, "Completing Kusto sign-in and creating MCP...", async () => confirmDelegatedKustoConsent(entry.agent, code, entry.subscription, entry));
      res.end('<!doctype html><meta charset="utf-8"><title>Azure Data Explorer sign-in</title><p>Sign-in complete. The Kusto MCP was created and attached to your SRE Agent. You can close this window.</p><script>window.close()</script>');
    } catch (err) {
      entry.error = shortError2(err);
      broadcast(entry, "state", snapshot(entry));
      res.end('<!doctype html><meta charset="utf-8"><title>Azure Data Explorer sign-in</title><p>Sign-in completed, but MCP attachment failed. Return to Azure SRE Agent for the exact error.</p>');
    }
    return;
  }
  if (url.pathname === "/events" && req.method === "GET") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive"
    });
    res.write(`event: state
data: ${JSON.stringify(snapshot(entry))}

`);
    entry.clients.add(res);
    req.on("close", () => entry.clients.delete(res));
    return;
  }
  if (req.method !== "POST") {
    res.writeHead(404).end();
    return;
  }
  const body = await readJsonBody(req);
  if (PRIVATE_CONNECTOR_HTTP_ROUTES.has(url.pathname) && !PRIVATE_CONNECTORS_ENABLED) {
    throw new Error("Private connector mutations are disabled for staging because verified per-invocation user and thread ownership is not available.");
  }
  const routes = {
    "/completion-catalog": async () => readCompletionCatalog(entry, dataPlaneFetch),
    "/subscriptions/refresh": async () => {
      entry.subscriptions = await listSubscriptions(true, entry);
      broadcast(entry, "state", snapshot(entry));
      return entry.subscriptionPicker;
    },
    "/subscriptions/select": async () => {
      const scope = subscriptionInventory.resolve(body.scope);
      entry.discoveryScope = scope;
      beginScopeDiscovery(entry);
      return { scope };
    },
    "/init": async () => {
      if (entry.discoveryScope) {
        await initSubscriptions(entry);
        beginScopeDiscovery(entry);
        return { agentConnected: Boolean(entry.agent), favoritesError: snapshot(entry).favoritesError };
      }
      return withBusy(entry, "Discovering subscriptions...", async () => {
        await initSubscriptions(entry);
        if (entry.discoveryScope) beginScopeDiscovery(entry);
        else if (entry.subscription) await loadAgentsForSub(entry);
        if (entry.appSubscription) await loadAppsForSub(entry);
        if (entry.pendingExternalAgentUrl) {
          const externalUrl = entry.pendingExternalAgentUrl;
          const externalName = entry.pendingExternalAgentName;
          await openSharedAgentReference(entry, externalUrl, { externalName });
        }
        return { agentConnected: Boolean(entry.agent), favoritesError: snapshot(entry).favoritesError };
      });
    },
    "/select-subscription": async () => withBusy(entry, "Loading SRE Agents...", async () => {
      const previousSubscription = entry.subscription;
      entry.discoveryScope = null;
      entry.discoveryGeneration++;
      entry.discoveryLoading = false;
      entry.discoveryError = "";
      const changed = entry.subscription !== body.subscription;
      entry.subscription = body.subscription;
      await loadAgentsForSub(entry, { resetAgent: changed });
      if (!entry.appSubscription || entry.appSubscription === previousSubscription) {
        await loadAppsForSub(entry, entry.subscription);
      }
      if (changed) saveStickyState({ subscription: entry.subscription, agentName: "", agentResourceGroup: "" });
    }),
    "/select-app-subscription": async () => withBusy(entry, "Loading app resources...", async () => {
      await loadAppsForSub(entry, body.subscription);
    }),
    "/refresh-agents": async () => entry.discoveryScope ? loadAgentsForScope(entry) : withBusy(entry, "Refreshing SRE Agents...", () => loadAgentsForSub(entry)),
    "/open-shared-agent": async () => withBusy(entry, "Opening shared SRE Agent...", async () => {
      await openSharedAgentReference(entry, body.reference);
    }),
    "/select-agent": async () => withBusy(entry, "Connecting to agent...", async () => {
      const row = resolveAgentSelection(entry.agents, body);
      if (!await selectAgent(entry, row)) throw new Error("Agent selection changed before the connection completed. Choose the agent again.");
    }),
    "/add-favorite": async () => {
      const agent = resolveFavoriteSelection(entry, body);
      const subscription = body.resourceId ? String(agent.id).split("/")[2] : entry.subscription;
      const favorites = updateFavorite(agent, subscription);
      entry.status = `Saved ${agent.name} to Favorites.`;
      broadcastFavorites();
      return favorites;
    },
    "/remove-favorite": async () => {
      const favorites = readFavorites();
      const favorite = favorites.find((item) => favoriteKey(item) === body.key);
      if (!favorite) throw new Error("Favorite not found. Refresh and try again.");
      const updated = updateFavorite(favorite.kind === "external" ? { ...favorite, external: true } : favorite, favorite.subscription, true);
      entry.status = `Removed ${favorite.name} from Favorites.`;
      broadcastFavorites();
      return updated;
    },
    "/select-favorite": async () => withBusy(entry, "Connecting to Favorite...", async () => {
      await selectSavedFavorite(entry, body.key);
    }),
    "/create-thread": async () => withBusy(entry, "Starting thread...", async () => {
      const result2 = await createThread(entry.agent, entry.subscription, body.message, entry);
      entry.activeThread = result2;
      entry.threads = upsertThread(entry.threads, result2);
      return result2;
    }),
    "/search-threads": async () => {
      if (!entry.agent?.external) throw new Error("Server-side thread search requires an external agent.");
      const filter = threadTitleFilter(body.query);
      return { threads: await listThreads(entry.agent, entry.subscription, entry, { filter }) };
    },
    "/open-thread": async () => withBusy(entry, body.poll ? "" : "Loading thread...", async () => {
      const thread = await readSelectedThread(entry, { threadId: body.threadId, poll: Boolean(body.poll) });
      if (thread && !body.poll) entry.status = `Loaded thread "${thread.title || body.threadId}".`;
      return thread;
    }),
    "/focus-thread": async () => withBusy(entry, "Focusing thread...", async () => {
      const thread = await readSelectedThread(entry, { threadId: body.threadId, focus: true });
      if (thread) entry.status = `Focused on "${entry.focusedThreadTitle}". Host-chat follow-ups now default to this thread.`;
      return thread;
    }),
    "/unfocus-thread": async () => {
      entry.focusedThreadId = "";
      entry.focusedThreadTitle = "";
      entry.status = "Focus mode off.";
      broadcast(entry, "state", snapshot(entry));
    },
    "/send-message": async () => withBusy(entry, "Sending message...", async () => {
      const result2 = await sendMessage(entry.agent, entry.subscription, body.threadId, body.message, entry);
      entry.activeThread = await getThread(entry.agent, entry.subscription, body.threadId, entry).catch(() => result2);
      entry.threads = upsertThread(entry.threads, entry.activeThread);
      return result2;
    }),
    "/investigate": async () => withBusy(entry, "Investigating...", async () => {
      const result2 = await investigate(entry.agent, entry.subscription, body.message, {
        yolo: Boolean(body.yolo),
        maxIterations: body.maxIterations,
        timeoutSeconds: body.timeoutSeconds
      }, entry);
      entry.activeThread = result2;
      entry.threads = await listThreads(entry.agent, entry.subscription, entry).catch(() => entry.threads);
      return result2;
    }),
    "/grant-execution": async () => withBusy(entry, "Granting permissions and re-running command...", async () => {
      const result2 = await authorizeExecutionSafely({
        listAttention: () => listNeedsAttention(entry.agent, entry.subscription, entry),
        readThread: (threadId2) => getThread(entry.agent, entry.subscription, threadId2, entry),
        run: () => runExecutionAction(entry.agent, entry.subscription, body.kind, body.threadId, body.executionId, "run", entry),
        threadId: body.threadId,
        executionId: body.executionId,
        executionType: body.kind,
        expectedCommand: body.expectedCommand
      });
      entry.activeThread = await getThread(entry.agent, entry.subscription, body.threadId, entry).catch(() => entry.activeThread);
      return result2;
    }),
    "/cancel-execution": async () => withBusy(entry, "Cancelling command...", async () => {
      const result2 = await authorizeExecutionSafely({
        listAttention: () => listNeedsAttention(entry.agent, entry.subscription, entry),
        readThread: (threadId2) => getThread(entry.agent, entry.subscription, threadId2, entry),
        run: () => runExecutionAction(entry.agent, entry.subscription, body.kind, body.threadId, body.executionId, "cancel", entry),
        threadId: body.threadId,
        executionId: body.executionId,
        executionType: body.kind,
        expectedCommand: body.expectedCommand
      });
      entry.activeThread = await getThread(entry.agent, entry.subscription, body.threadId, entry).catch(() => entry.activeThread);
      return result2;
    }),
    "/grant-durable-role": async () => withBusy(entry, "Creating durable role assignment for the agent's identity...", async () => {
      const thread = entry.activeThread && entry.activeThread.id === body.threadId ? entry.activeThread : await getThread(entry.agent, entry.subscription, body.threadId, entry);
      const exec = findExecutionInThread2(thread, body.kind, body.executionId);
      if (!exec) throw new Error("Could not find that command in the thread - try reopening it.");
      const resourceId = exec.resourceId || await resolveResourceIdFromCommand(exec.command, entry.subscription, entry);
      if (!resourceId) throw new Error("Could not determine which resource to scope the role assignment to from this command.");
      const role = body.role || guessRoleForExecution(exec);
      const result2 = await grantDurableRoleAssignment(
        entry.agent,
        entry.subscription,
        { resourceId, role, principalId: entry.agent.executionPrincipalId },
        entry
      );
      const resourceLabel = resourceId.split("/").pop();
      entry.status = result2?.alreadyExists ? `${entry.agent.name}'s identity already has ${role} on ${resourceLabel}. Retrying the pending command...` : `Granted ${role} to ${entry.agent.name}'s identity on ${resourceLabel}. Retrying the pending command...`;
      let retry = null;
      try {
        retry = await runExecutionAction(entry.agent, entry.subscription, body.kind, body.threadId, body.executionId, "run", entry);
        entry.status = `Granted ${role} to ${entry.agent.name}'s identity on ${resourceLabel} and resumed the pending command.`;
      } catch (err) {
        entry.status = `Granted ${role} to ${entry.agent.name}'s identity on ${resourceLabel}, but retrying the pending command failed: ${err?.message || err}. Try "Grant permissions (this run)" to retry manually.`;
      }
      entry.activeThread = await getThread(entry.agent, entry.subscription, body.threadId, entry).catch(() => entry.activeThread);
      return { ...result2, role, resourceId, retried: !!retry };
    }),
    "/create-incident": async () => withBusy(entry, "Creating incident...", async () => {
      const result2 = await createIncident(entry.agent, entry.subscription, body, entry);
      entry.threads = await listThreads(entry.agent, entry.subscription, entry);
      const incidents = await listActiveIncidents(entry.agent, entry.subscription, entry, { threads: entry.threads });
      entry.incidents = incidents.incidents;
      entry.incidentsContract = incidents.contract;
      entry.incidentsPartial = incidents.partial;
      entry.incidentCounts = incidents.counts;
      entry.incidentsNextSkip = incidents.nextSkip;
      entry.incidentsHasMore = incidents.hasMore;
      return result2;
    }),
    "/refresh-incidents": async () => withBusy(entry, "Refreshing incidents...", async () => {
      if (!entry.agent) throw new Error("Select an SRE Agent first.");
      try {
        const result2 = await listActiveIncidents(entry.agent, entry.subscription, entry, {
          query: entry.incidentQuery,
          status: entry.incidentStatusFilter
        });
        entry.incidents = result2.incidents;
        entry.incidentsError = "";
        entry.incidentsContract = result2.contract;
        entry.incidentsPartial = result2.partial;
        entry.incidentCounts = result2.counts;
        entry.incidentsNextSkip = result2.nextSkip;
        entry.incidentsHasMore = result2.hasMore;
        entry.status = `Loaded ${entry.incidents.length} incident thread(s) from the first ${result2.threadCount} recent threads.` + (result2.hasMore ? " Load more to scan the next bounded page." : "");
        return result2;
      } catch (error) {
        entry.incidentsError = `Incidents unavailable: ${shortError2(error)}`;
        throw error;
      }
    }),
    "/query-incidents": async () => withBusy(entry, "Filtering incidents...", async () => {
      if (!entry.agent) throw new Error("Select an SRE Agent first.");
      const generation = ++entry.incidentQueryGeneration;
      const query = String(body.query || "").slice(0, 200);
      const status = String(body.status || "").slice(0, 80);
      try {
        const result2 = await listActiveIncidents(entry.agent, entry.subscription, entry, {
          query,
          status
        });
        if (generation !== entry.incidentQueryGeneration) return { stale: true };
        entry.incidentQuery = query;
        entry.incidentStatusFilter = status;
        entry.incidents = result2.incidents;
        entry.incidentsError = "";
        entry.incidentsContract = result2.contract;
        entry.incidentsPartial = result2.partial;
        entry.incidentCounts = result2.counts;
        entry.incidentsNextSkip = result2.nextSkip;
        entry.incidentsHasMore = result2.hasMore;
        entry.status = `Loaded ${entry.incidents.length} matching incident thread(s).` + (result2.hasMore ? " More matching pages are available." : "");
        return result2;
      } catch (error) {
        if (generation === entry.incidentQueryGeneration) {
          entry.incidentsError = `Incidents unavailable: ${shortError2(error)}`;
        }
        throw error;
      }
    }),
    "/load-more-incidents": async () => withBusy(entry, "Loading more incidents...", async () => {
      if (!entry.agent) throw new Error("Select an SRE Agent first.");
      try {
        const result2 = await listActiveIncidents(entry.agent, entry.subscription, entry, {
          skip: entry.incidentsNextSkip || 0,
          query: entry.incidentQuery,
          status: entry.incidentStatusFilter
        });
        entry.incidents = dedupeIncidents([...entry.incidents, ...result2.incidents]);
        entry.incidentsError = "";
        entry.incidentsContract = result2.contract;
        entry.incidentsPartial = result2.partial;
        entry.incidentCounts = result2.counts;
        entry.incidentsNextSkip = result2.nextSkip;
        entry.incidentsHasMore = result2.hasMore;
        entry.status = `Loaded ${entry.incidents.length} incident thread(s) from ${result2.nextSkip} matching rows.` + (result2.hasMore ? " More pages are available." : " Reached the end of the matching incident list.");
        return result2;
      } catch (error) {
        entry.incidentsError = `Incidents unavailable: ${shortError2(error)}`;
        throw error;
      }
    }),
    "/diagnose-app": async () => withBusy(entry, "Resolving app resource...", async () => diagnoseApp(entry, body)),
    "/check-config-drift": async () => withBusy(entry, "Scanning workspace and comparing to Azure app settings...", async () => {
      const targetSubscription = body.appSubscription || entry.appSubscription || entry.subscription;
      const resource = await resolveAppResource(targetSubscription, body.resourceIdOrName, entry);
      if (!resource) throw new Error(`Could not resolve an app resource matching "${body.resourceIdOrName}".`);
      entry.configDrift = await checkWorkspaceConfigDrift(resource, targetSubscription, entry);
      return { resource, configDrift: entry.configDrift };
    }),
    "/correlate-ticket": async () => withBusy(entry, "Correlating ticket...", async () => correlateTicket(entry, body)),
    "/list-scheduled-tasks": async () => withBusy(entry, "Loading scheduled tasks...", async () => {
      await refreshScheduledTasks(entry);
    }),
    "/refresh-automation": async () => withBusy(entry, "Loading Automation collections...", async () => {
      const result2 = await refreshAutomationCollections(entry);
      const errors = [entry.scheduledTasksError, entry.httpTriggersError].filter(Boolean);
      entry.error = errors.join(" ");
      entry.status = errors.length ? "Automation is partially or fully unavailable. See each collection's error." : "Automation collections loaded.";
      return result2;
    }),
    "/refresh-connectors": async () => withBusy(entry, "Loading connectors...", async () => {
      const agent = entry.agent, subscription = entry.subscription, generation = entry.selectionGeneration;
      if (!agent) throw new Error("Select an SRE Agent first.");
      const connectors = await listConnectors(agent, subscription, entry);
      if (entry.agent !== agent || entry.subscription !== subscription || entry.selectionGeneration !== generation) {
        throw new Error("The selected agent changed while loading connectors.");
      }
      entry.connectors = connectors;
      entry.connectorsError = "";
      entry.status = "Connectors loaded.";
      return { connectors, readOnly: Boolean(agent.external) };
    }),
    "/automation-history": async () => getAutomationHistory(entry, body),
    "/open-automation-run": async () => withBusy(entry, "Loading task run...", async () => {
      const activeAtStart = threadId(entry.activeThread);
      const thread = await readAutomationRun(entry, body, {
        fetchImpl: dataPlaneFetch,
        getThreadImpl: (agent, subscription, id, current) => getThread(agent, subscription, id, current, { projectDetail: projectAutomationRunThread })
      });
      if (threadId(entry.activeThread) !== activeAtStart) throw new Error("The selected conversation changed; the old run response was discarded.");
      entry.activeThread = thread;
      entry.automationRunThreadId = threadId(thread);
      entry.threads = upsertThread(entry.threads, thread);
      entry.status = "Task run loaded.";
      return { threadId: threadId(thread) };
    }),
    "/automation-task-command": async () => withBusy(entry, "Updating scheduled task...", () => performAutomationCommand(entry, body, {
      writesAllowed: true,
      fetchImpl: dataPlaneFetch,
      loadTasksImpl: listScheduledTasks
    })),
    "/create-scheduled-task": async () => withBusy(entry, "Creating scheduled task...", async () => {
      const result2 = await createScheduledTask(entry.agent, entry.subscription, body, entry);
      entry.scheduledTasks = await listScheduledTasks(entry.agent, entry.subscription, entry).catch(() => entry.scheduledTasks);
      return result2;
    }),
    "/pause-scheduled-task": async () => withBusy(entry, "Pausing scheduled task...", async () => {
      await pauseScheduledTask(entry.agent, entry.subscription, body.taskId, entry);
      entry.scheduledTasks = await listScheduledTasks(entry.agent, entry.subscription, entry).catch(() => entry.scheduledTasks);
    }),
    "/resume-scheduled-task": async () => withBusy(entry, "Resuming scheduled task...", async () => {
      await resumeScheduledTask(entry.agent, entry.subscription, body.taskId, entry);
      entry.scheduledTasks = await listScheduledTasks(entry.agent, entry.subscription, entry).catch(() => entry.scheduledTasks);
    }),
    "/search-memories": async () => withBusy(entry, "Searching memories...", async () => {
      entry.memoryResults = await searchMemories(entry.agent, entry.subscription, body.query, entry);
    }),
    "/add-memory": async () => withBusy(entry, "Adding memory...", async () => addMemory(entry.agent, entry.subscription, body, entry)),
    "/discover-kusto-resources": async () => withBusy(entry, "Discovering Azure Data Explorer clusters...", async () => {
      entry.connectorSubscription = body.subscription || "";
      [entry.kustoResources, entry.connectorGateways] = await Promise.all([
        listKustoResources(entry.connectorSubscription || void 0, entry),
        listConnectorGateways(entry.connectorSubscription || entry.subscription, entry)
      ]);
      entry.connectorNamespaceMcps = await listConnectorNamespaceMcps(
        entry.connectorGateways,
        entry.connectorSubscription || entry.subscription,
        entry.connectors,
        entry
      );
      entry.status = entry.kustoResources.length ? `Found ${entry.kustoResources.length} Data Explorer cluster(s) and ${entry.connectorGateways.length} Connector Namespace(s).` : "No Data Explorer clusters found through Azure Resource Graph for that scope. Try All accessible subscriptions or enter cluster URL and database manually.";
      return entry.kustoResources;
    }),
    "/create-delegated-kusto-mcp": async () => withBusy(entry, "Creating delegated Kusto MCP...", async () => {
      if (!entry.agent) throw new Error("Select an SRE Agent first.");
      return createDelegatedKustoMcp(entry.agent, body, entry.subscription, entry);
    }),
    "/confirm-delegated-kusto-consent": async () => withBusy(entry, "Completing Kusto sign-in and creating MCP...", async () => {
      if (!entry.agent) throw new Error("Select an SRE Agent first.");
      return confirmDelegatedKustoConsent(entry.agent, body.code, entry.subscription, entry);
    }),
    "/attach-connector-namespace-mcp": async () => withBusy(entry, `Attaching Connector Namespace MCP ${body.name || ""}...`, async () => {
      if (!entry.agent) throw new Error("Select an SRE Agent first.");
      const mcp = (entry.connectorNamespaceMcps || []).find((item) => item.name === body.name);
      if (!mcp?.endpoint) throw new Error(`Connector Namespace MCP "${body.name || ""}" is unavailable or has no endpoint. Discover Data Explorer resources again.`);
      const identity = await currentIdentity(entry);
      if (!connectorNameOwnedBy(mcp.name, identity.objectId)) {
        throw new Error("Only Connector Namespace MCPs created for the signed-in owner can be attached.");
      }
      await requireConnectionUserAccess(mcp.connectionPath, identity, entry.subscription, entry);
      await grantMcpPrincipalAccess(mcp.mcpPath, entry.agent.executionPrincipalId, entry.agent.tenantId, entry.subscription, entry);
      const tokenScope = await discoverMcpTokenScope(mcp.endpoint);
      const result2 = await registerGenericMcp(entry.agent, mcp.name, mcp.endpoint, tokenScope, entry.subscription, entry);
      mcp.attached = true;
      mcp.attachmentStatus = "Attached to this SRE Agent.";
      entry.connectors = await listConnectors(entry.agent, entry.subscription, entry);
      entry.status = `Attached Connector Namespace MCP ${mcp.name}.`;
      return result2;
    }),
    "/detach-connector": async () => withBusy(entry, `Detaching connector ${body.name || ""}...`, async () => {
      if (!entry.agent) throw new Error("Select an SRE Agent first.");
      const connector = (entry.connectors || []).find((c) => c.name === body.name);
      if (!connector) throw new Error(`Connector not found: ${body.name}`);
      const result2 = await deleteConnector(entry.agent, connector.name, entry.subscription, entry);
      entry.connectors = await listConnectors(entry.agent, entry.subscription, entry).catch(() => entry.connectors.filter((c) => c.name !== connector.name));
      if (entry.connectorAccessInfo) delete entry.connectorAccessInfo[connector.name];
      const namespaceMcp = (entry.connectorNamespaceMcps || []).find((item) => item.name === connector.name);
      if (namespaceMcp) {
        namespaceMcp.attached = false;
        namespaceMcp.attachmentStatus = "Available to attach to this SRE Agent.";
      }
      entry.status = `Detached connector ${connector.name}.`;
      return result2;
    }),
    "/generate-workflow": async () => withBusy(entry, "Generating workflow...", async () => generateWorkflow(entry.agent, entry.subscription, body, entry))
  };
  const handler = routes[url.pathname];
  if (!handler) {
    res.writeHead(404).end();
    return;
  }
  if (entry.agent?.external && !externalAgentRouteAllowed(url.pathname)) {
    entry.error = "This operation requires an ARM-managed SRE Agent. External agents support threads, read-only incidents and Automation.";
    broadcast(entry, "state", snapshot(entry));
    throw new Error(entry.error);
  }
  const result = await handler();
  responseJson(res, { ok: true, result });
}
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => data += chunk);
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}
async function ensureAgentSelected(entry) {
  if (entry.agent) return;
  const sticky = loadStickyState();
  if (sticky.externalAgentUrl) {
    await openSharedAgentReference(entry, sticky.externalAgentUrl, { externalName: sticky.externalAgentName });
    return;
  }
  if (!sticky.agentName) throw new Error("Select an SRE Agent first.");
  if (sticky.subscription && sticky.subscription !== entry.subscription) {
    entry.subscription = sticky.subscription;
    await loadAgentsForSub(entry);
  } else if (!entry.agents.length) {
    await loadAgentsForSub(entry);
  }
  const row = entry.agents.find((a) => a.name === sticky.agentName);
  if (!row) throw new Error("Select an SRE Agent first.");
  await selectAgent(entry, row);
}
async function diagnoseApp(entry, { resourceIdOrName, note, appSubscription }, {
  ensureAgentImpl = ensureAgentSelected,
  resolveAppImpl = resolveAppResource,
  healthImpl = resourceHealthSummary,
  driftImpl = checkWorkspaceConfigDrift,
  investigateImpl = investigate,
  listThreadsImpl = listThreads
} = {}) {
  await ensureAgentImpl(entry);
  const targetSubscription = appSubscription || entry.appSubscription || entry.subscription;
  const resource = await resolveAppImpl(targetSubscription, resourceIdOrName, entry);
  if (!resource) throw new Error(`Could not resolve an app resource matching "${resourceIdOrName}".`);
  const health = await healthImpl(resource.id, targetSubscription, entry);
  const drift = await driftImpl(resource, targetSubscription, entry).catch((err) => ({ error: shortError2(err) }));
  entry.configDrift = drift;
  const driftLines = [];
  if (!drift.error && drift.missingInAzure?.length) {
    const names = drift.missingInAzure.map((s) => s.settingName).join(", ");
    driftLines.push(
      `Local workspace analysis found ${drift.missingInAzure.length} app setting(s) referenced in source code that are NOT configured on this Azure resource: ${names}. This may be the root cause if related errors mention missing configuration.`
    );
  }
  const message = [
    `Investigate a failing app: ${resource.name} (${resource.type}).`,
    `Resource ID: ${resource.id}`,
    `Location: ${resource.location}`,
    `Resource Health: ${health.availabilityState}${health.summary ? ` - ${health.summary}` : ""}`,
    ...driftLines,
    note ? `Additional context from the user: ${note}` : "",
    "Please check recent deployments, restarts, and errors, and propose a root cause and remediation."
  ].filter(Boolean).join("\n");
  const result = await investigateImpl(entry.agent, entry.subscription, message, { yolo: false }, entry);
  if (!threadId(result)) throw new Error("The SRE Agent did not return a new diagnosis thread id.");
  entry.activeThread = result;
  entry.threads = upsertThread(await listThreadsImpl(entry.agent, entry.subscription, entry).catch(() => entry.threads), result);
  entry.status = `Diagnosis started for ${resource.name}: thread "${result?.title || result?.id || "new investigation"}" opened below.`;
  return { resource, health, configDrift: drift, investigation: result };
}
async function correlateTicket(entry, { ticket, threadId: threadId2 }) {
  if (!entry.agent) throw new Error("Select an SRE Agent first.");
  if (!ticket) throw new Error("Provide an ICM or S360 ticket id, url, or description.");
  const memoryHits = await searchMemories(entry.agent, entry.subscription, ticket, entry);
  const message = [
    `Correlate this ticket with current and past incidents: ${ticket}`,
    memoryHits.length ? `Related knowledge base hits found: ${memoryHits.length}.` : "No related knowledge base hits found yet - search incident history directly.",
    "Report whether this matches an active incident, a known root cause, or a new issue, and recommend next steps."
  ].join("\n");
  const result = threadId2 ? await sendMessage(entry.agent, entry.subscription, threadId2, message, entry) : await investigate(entry.agent, entry.subscription, message, { yolo: false }, entry);
  entry.activeThread = threadId2 ? await getThread(entry.agent, entry.subscription, threadId2, entry).catch(() => result) : result;
  entry.threads = await listThreads(entry.agent, entry.subscription, entry).catch(() => entry.threads);
  entry.memoryResults = memoryHits;
  return { memoryHits, response: result };
}
var canvas = createCanvas({
  id: "azure-sre-agent",
  displayName: "Azure SRE Agent",
  description: "Discover Azure SRE Agents, investigate failing apps, correlate ICM/S360 tickets, and manage incidents, scheduled tasks, connectors, memories, and workflows on your SRE Agents. When a thread is focused, route operational follow-ups through ask_agent and use unfocus_thread to leave focus mode.",
  actions: [
    {
      name: "list_agents",
      description: "List Azure SRE Agent resources in the selected discovery scope, or in an explicit/default subscription.",
      inputSchema: { type: "object", properties: { subscription: { type: "string" } } },
      async handler({ input, instanceId }) {
        const entry = ensureEntry(instanceId);
        await listAgentsForSelection(entry, input?.subscription);
        broadcast(entry, "state", snapshot(entry));
        return projectSreAgentDiscovery(entry.agents, entry.subscription, entry.discoveryError, entry.discoveryLoading);
      }
    },
    {
      name: "select_agent",
      description: "Connect the canvas to an SRE Agent by unique name or full ARM resource ID, loading its connectors, threads, and active incidents.",
      inputSchema: { type: "object", properties: { name: { type: "string", description: "Unique agent name or full ARM resource ID." } }, required: ["name"] },
      async handler({ input, instanceId }) {
        const entry = ensureEntry(instanceId);
        const row = resolveAgentSelection(entry.agents, { name: input?.name });
        if (!await selectAgent(entry, row)) throw new Error("Agent selection changed before the connection completed. Choose the agent again.");
        broadcast(entry, "state", snapshot(entry));
        return { ok: true, agent: entry.agent, scheduledTasksError: entry.scheduledTasksError };
      }
    },
    {
      ...GET_THREAD_CONTRACT,
      async handler({ input, instanceId }) {
        const entry = ensureEntry(instanceId);
        if (!entry.agent) return { ok: false, message: "Select an SRE Agent first." };
        if (!input?.threadId) return { ok: false, message: "get_thread needs a threadId." };
        const thread = await readSelectedThread(entry, { threadId: input.threadId });
        if (!thread) throw new Error("Thread selection changed; the old response was discarded.");
        broadcast(entry, "state", snapshot(entry));
        return { ok: true, thread: projectThreadDetail(thread) };
      }
    },
    {
      ...FOCUS_THREAD_CONTRACT,
      async handler({ input, instanceId }) {
        const entry = ensureEntry(instanceId);
        if (!entry.agent) return { ok: false, message: "Select an SRE Agent first." };
        if (!input?.threadId) return { ok: false, message: "focus_thread needs a threadId." };
        const thread = await readSelectedThread(entry, { threadId: input.threadId, focus: true });
        if (!thread) throw new Error("Thread selection changed; the old response was discarded.");
        const focusedId = threadId(thread);
        const title = thread.title || focusedId;
        entry.status = `Focused on "${title}".`;
        broadcast(entry, "state", snapshot(entry));
        return { ok: true, focused: true, threadId: focusedId, title, thread: projectThreadDetail(thread), contract: FOCUS_CONTRACT };
      }
    },
    {
      ...UNFOCUS_THREAD_CONTRACT,
      async handler({ instanceId }) {
        const entry = ensureEntry(instanceId);
        const previous = entry.focusedThreadTitle || entry.focusedThreadId || null;
        entry.focusedThreadId = "";
        entry.focusedThreadTitle = "";
        entry.status = previous ? `Unfocused from "${previous}".` : "Not focused.";
        broadcast(entry, "state", snapshot(entry));
        return { ok: true, focused: false, previous };
      }
    },
    {
      ...ASK_AGENT_CONTRACT,
      mutates: true,
      async handler({ input, instanceId }) {
        const entry = ensureEntry(instanceId);
        if (!entry.agent) return { ok: false, message: "Select an SRE Agent first." };
        const threadId2 = input?.threadId || entry.focusedThreadId;
        const message = typeof input?.message === "string" ? input.message.trim() : "";
        if (!threadId2) return { ok: false, message: "ask_agent needs a threadId, or focus_thread must be active." };
        if (!message) return { ok: false, message: "ask_agent needs a message to send." };
        const waitSeconds = Math.min(Math.max(Number.isFinite(input.waitSeconds) ? input.waitSeconds : 20, 0), 120);
        const before = await getThread(entry.agent, entry.subscription, threadId2, entry, { strict: true });
        const seen = new Set((before.messages || []).map((item) => item?.id).filter(Boolean));
        await sendMessage(entry.agent, entry.subscription, threadId2, message, entry);
        const { thread, replies, textualReplies, completed, waitedSeconds } = await waitForNewAgentReplies({
          getThread: () => getThread(entry.agent, entry.subscription, threadId2, entry, { strict: true }),
          seen,
          waitSeconds
        });
        entry.activeThread = thread;
        entry.threads = upsertThread(entry.threads, thread);
        entry.status = completed ? `Agent replied in thread ${threadId2}.` : `Question sent to thread ${threadId2}; ${textualReplies.length ? "reply is still incomplete" : "no reply yet"}.`;
        broadcast(entry, "state", snapshot(entry));
        return {
          ok: true,
          sent: true,
          replied: textualReplies.length > 0,
          completed,
          waitedSeconds,
          newMessages: replies.map((item) => projectMessage(item)).filter(Boolean),
          thread: projectThreadDetail(thread),
          hint: completed ? void 0 : textualReplies.length ? `The message was delivered and the agent began replying, but its newest message was still incomplete after ${waitedSeconds}s. Call get_thread with threadId "${threadId2}" to retrieve the completed reply.` : `The message was delivered; the agent had not answered after ${waitedSeconds}s. Call get_thread with threadId "${threadId2}" again in a minute, or call ask_agent with a larger waitSeconds (max 120).`
        };
      }
    },
    {
      name: "diagnose_app",
      mutates: true,
      description: "Diagnose a failing Azure App Service, Function App, or Container App: resolves the resource, pulls a Resource Health snapshot, and opens an SRE Agent investigation thread pre-seeded with that context.",
      inputSchema: {
        type: "object",
        properties: {
          resourceIdOrName: { type: "string", description: "Full resource ID or app name to diagnose." },
          note: { type: "string", description: "Optional extra context (symptoms, error messages, recent changes)." }
        },
        required: ["resourceIdOrName"]
      },
      async handler({ input, instanceId }) {
        const entry = ensureEntry(instanceId);
        const result = await diagnoseApp(entry, input || {});
        broadcast(entry, "state", snapshot(entry));
        return { ok: true, ...result };
      }
    },
    {
      name: "correlate_ticket",
      mutates: true,
      description: "Correlate an ICM or S360 ticket (id, url, or free text) against the connected SRE Agent's memory and incident history, optionally continuing an existing investigation thread.",
      inputSchema: {
        type: "object",
        properties: {
          ticket: { type: "string", description: "ICM/S360 ticket id, url, or description." },
          threadId: { type: "string", description: "Optional existing thread id to continue instead of starting a new one." }
        },
        required: ["ticket"]
      },
      async handler({ input, instanceId }) {
        const entry = ensureEntry(instanceId);
        const result = await correlateTicket(entry, input || {});
        broadcast(entry, "state", snapshot(entry));
        return { ok: true, ...result };
      }
    },
    {
      name: "investigate",
      mutates: true,
      description: "Send an investigation message to the connected SRE Agent and follow up automatically until it concludes.",
      inputSchema: {
        type: "object",
        properties: {
          message: { type: "string" },
          yolo: { type: "boolean", description: "Auto-approve all pending approval requests." },
          maxIterations: { type: "number" },
          timeoutSeconds: { type: "number" }
        },
        required: ["message"]
      },
      async handler({ input, instanceId }) {
        const entry = ensureEntry(instanceId);
        if (!entry.agent) return { ok: false, message: "Select an SRE Agent first." };
        const result = await investigate(entry.agent, entry.subscription, input.message, {
          yolo: Boolean(input?.yolo),
          maxIterations: input?.maxIterations,
          timeoutSeconds: input?.timeoutSeconds
        }, entry);
        entry.activeThread = result;
        broadcast(entry, "state", snapshot(entry));
        return { ok: true, result };
      }
    },
    {
      name: "list_incidents",
      description: "List active incidents tracked on the connected SRE Agent.",
      inputSchema: { type: "object", properties: {} },
      async handler({ instanceId }) {
        const entry = ensureEntry(instanceId);
        if (!entry.agent) return { ok: false, message: "Select an SRE Agent first." };
        const result = await listActiveIncidents(entry.agent, entry.subscription, entry);
        entry.incidents = result.incidents;
        entry.incidentsError = "";
        entry.incidentsContract = result.contract;
        entry.incidentsPartial = result.partial;
        entry.incidentCounts = result.counts;
        entry.incidentsNextSkip = result.nextSkip;
        entry.incidentsHasMore = result.hasMore;
        broadcast(entry, "state", snapshot(entry));
        return { ok: true, ...result };
      }
    },
    {
      ...LIST_NEEDS_ATTENTION_CONTRACT,
      async handler({ instanceId }) {
        const entry = ensureEntry(instanceId);
        if (!entry.agent) return { ok: false, message: "Select an SRE Agent first." };
        entry.needsAttention = await listNeedsAttention(entry.agent, entry.subscription, entry);
        broadcast(entry, "state", snapshot(entry));
        return {
          ok: true,
          needsAttention: entry.needsAttention,
          threadCount: entry.needsAttention.length
        };
      }
    },
    {
      ...LIST_EXECUTION_GATES_CONTRACT,
      async handler({ input, instanceId }) {
        const entry = ensureEntry(instanceId);
        if (!entry.agent) return { ok: false, message: "Select an SRE Agent first." };
        entry.needsAttention = await listNeedsAttention(entry.agent, entry.subscription, entry);
        entry.executionGates = await listExecutionGates({
          listNeedsAttention: async () => entry.needsAttention,
          getThread: async (threadId2) => ({
            id: threadId2,
            messages: await getThreadMessages(entry.agent, entry.subscription, threadId2, entry)
          }),
          previousObservedKeys: entry.executionGates?.observedGateKeys || [],
          limit: input?.limit
        });
        broadcast(entry, "state", snapshot(entry));
        return { ok: true, ...entry.executionGates };
      }
    },
    {
      name: "create_incident",
      mutates: true,
      description: "Create an incident investigation thread on the connected SRE Agent.",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
          services: { type: "array", items: { type: "string" } }
        },
        required: ["title"]
      },
      async handler({ input, instanceId }) {
        const entry = ensureEntry(instanceId);
        if (!entry.agent) return { ok: false, message: "Select an SRE Agent first." };
        const result = await createIncident(entry.agent, entry.subscription, input || {}, entry);
        entry.threads = await listThreads(entry.agent, entry.subscription, entry);
        const incidents = await listActiveIncidents(entry.agent, entry.subscription, entry, { threads: entry.threads });
        entry.incidents = incidents.incidents;
        entry.incidentsContract = incidents.contract;
        entry.incidentsPartial = incidents.partial;
        entry.incidentCounts = incidents.counts;
        entry.incidentsNextSkip = incidents.nextSkip;
        entry.incidentsHasMore = incidents.hasMore;
        broadcast(entry, "state", snapshot(entry));
        return { ok: true, result };
      }
    },
    {
      name: "list_scheduled_tasks",
      description: "List scheduled tasks configured on the connected SRE Agent.",
      inputSchema: { type: "object", properties: {} },
      async handler({ instanceId }) {
        const entry = ensureEntry(instanceId);
        if (!entry.agent) return { ok: false, message: "Select an SRE Agent first." };
        await refreshScheduledTasks(entry);
        broadcast(entry, "state", snapshot(entry));
        return scheduledTasksModelResult(entry);
      }
    },
    {
      name: "create_scheduled_task",
      mutates: true,
      description: "Create a recurring scheduled task on the connected SRE Agent (cron expression + message).",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string" },
          cronExpression: { type: "string" },
          message: { type: "string" },
          description: { type: "string" }
        },
        required: ["name", "cronExpression", "message"]
      },
      async handler({ input, instanceId }) {
        const entry = ensureEntry(instanceId);
        if (!entry.agent) return { ok: false, message: "Select an SRE Agent first." };
        const result = await createScheduledTask(entry.agent, entry.subscription, input, entry);
        entry.scheduledTasks = await listScheduledTasks(entry.agent, entry.subscription, entry).catch(() => entry.scheduledTasks);
        broadcast(entry, "state", snapshot(entry));
        return { ok: true, result };
      }
    },
    {
      name: "search_memories",
      description: "Semantically search the connected SRE Agent's knowledge base / memories.",
      inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
      async handler({ input, instanceId }) {
        const entry = ensureEntry(instanceId);
        if (!entry.agent) return { ok: false, message: "Select an SRE Agent first." };
        entry.memoryResults = await searchMemories(entry.agent, entry.subscription, input.query, entry);
        broadcast(entry, "state", snapshot(entry));
        return { ok: true, results: entry.memoryResults };
      }
    },
    {
      name: "generate_workflow",
      mutates: true,
      description: "Generate a validated YAML workflow (ExtendedAgent, KustoTool, or LinkTool) for the connected SRE Agent.",
      inputSchema: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["agent", "tool"] },
          name: { type: "string" },
          description: { type: "string" },
          modelOrType: { type: "string" },
          tools: { type: "array", items: { type: "string" } },
          handoffs: { type: "array", items: { type: "string" } },
          connector: { type: "string" }
        },
        required: ["kind", "name"]
      },
      async handler({ input, instanceId }) {
        const entry = ensureEntry(instanceId);
        if (!entry.agent) return { ok: false, message: "Select an SRE Agent first." };
        const result = await generateWorkflow(entry.agent, entry.subscription, input, entry);
        return { ok: true, result };
      }
    }
  ].map((action) => ({
    ...action,
    async handler(args) {
      if (ensureEntry(args.instanceId).agent?.external && !EXTERNAL_AGENT_ACTIONS.has(action.name)) {
        throw new Error("This action requires an ARM-managed SRE Agent. External agents support threads, read-only incidents and Automation.");
      }
      const result = await action.handler(args);
      return appendFocusContract(ensureEntry(args.instanceId), result);
    }
  })),
  async open({ instanceId }) {
    const entry = ensureEntry(instanceId);
    if (!entry.server) {
      await initSubscriptions(entry).catch((err) => {
        entry.status = azureDiscoveryFailure(err);
        entry.error = shortError2(err);
      });
      if (entry.discoveryScope) beginScopeDiscovery(entry);
      else if (entry.subscription) await loadAgentsForSub(entry).catch((err) => {
        entry.error = shortError2(err);
      });
      await startServer(entry);
    }
    return { url: entry.url, title: "Azure SRE Agent", status: "ready" };
  },
  async onClose({ instanceId }) {
    const entry = instances.get(instanceId);
    if (!entry) return;
    entry.discoveryGeneration++;
    entry.discoveryLoading = false;
    for (const res of entry.clients) {
      try {
        res.end();
      } catch {
      }
    }
    entry.clients = /* @__PURE__ */ new Set();
    if (entry.server) {
      const server = entry.server;
      entry.server = null;
      entry.url = "";
      await new Promise((resolve) => server.close(() => resolve()));
    }
  }
});
if (process.env.AZURE_SRE_AGENT_TEST_NO_JOIN !== "true" && process.env.SRE_AGENT_STUDIO_TEST_NO_JOIN !== "true") {
  session = await joinSession({ canvases: [canvas] });
}
function renderHtml() {
  const feedbackUrl = `https://github.com/microsoft/azure-dev-tools/issues/new?title=${encodeURIComponent("Azure SRE Agent feedback")}&body=${encodeURIComponent(
    `Product: Azure SRE Agent
Canvas: azure-sre-agent
Version: ${STUDIO_VERSION}
Revision: ${STUDIO_REVISION}

## Feedback

`
  )}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Azure SRE Agent</title>
<link rel="stylesheet" href="./${COREAI_AZURE_VISUAL_PROFILE.stylesheet}" />
<link rel="stylesheet" href="./canvas-ui/styles.css" />
<link rel="stylesheet" href="./canvas-ui/subscription-picker.css" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    color-scheme: light;
    --bg: var(--background-color-default, #ffffff); --panel: var(--background-color-muted, #f6f8fa);
    --line: var(--border-color-default, #d1d9e0); --ink: var(--text-color-default, #1f2328); --muted: var(--text-color-muted, #59636e);
    --accent: var(--text-color-accent, #0969da); --accent2: var(--accent);
    --ok: var(--text-color-success, #1a7f37); --warn: var(--text-color-attention, #9a6700); --err: var(--text-color-danger, #d1242f);
    --selected-bg: color-mix(in srgb, var(--accent) 12%, var(--bg)); --selected-ink: var(--ink); --thread-surface: var(--bg);
    --user-bubble: color-mix(in srgb, var(--accent) 10%, var(--bg));
    --thread-row-bg: var(--panel);
    --btn-primary: var(--background-color-button-primary-rest, #1f883d);
    --btn-primary-ink: var(--text-color-button-primary-rest, #ffffff);
  }
  :root[data-theme-tone="dark"], :root[data-color-mode="dark"]:not([data-theme-tone="light"]) {
    color-scheme: dark;
    --bg: var(--background-color-default, #0d1117); --panel: var(--background-color-muted, #151b23);
    --line: var(--border-color-default, #3d444d); --ink: var(--text-color-default, #f0f6fc); --muted: var(--text-color-muted, #9198a1);
    --accent: var(--text-color-accent, #4493f8); --err: var(--text-color-danger, #f85149);
    --ok: var(--text-color-success, #3fb950); --warn: var(--text-color-attention, #d29922);
    --btn-primary: var(--background-color-button-primary-rest, #238636);
  }
  body {
    background: var(--bg);
    color: var(--ink); font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif); padding: 1rem;
    min-height: 100vh; min-height: 100dvh; display: flex; flex-direction: column;
  }
  #main-grid, #threads-page, .threads-layout { flex: 1; min-height: 0; }
  #threads-page.active { display: flex; flex-direction: column; }
  h1 { font-size: 1.1rem; display: flex; align-items: center; gap: .5rem; min-width: 0; }
  .product-mark { width: 32px; height: 32px; flex: 0 0 auto; object-fit: contain; }
  .product-title { min-width: 0; }
  h1 .doc { font-size: .72rem; color: var(--muted); font-weight: 400; text-decoration: none; margin-left: auto; }
  .sub { color: var(--muted); font-size: .82rem; margin: .3rem 0 1rem; }
  .hint { color: var(--muted); font-size: .78rem; margin: 0 0 .5rem; line-height: 1.35; }
  .field-label { display: block; color: var(--muted); font-size: .72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; margin: .1rem 0 .25rem; }
  .panel, .thread-master { background: var(--bg); border: 1px solid var(--line); border-radius: 6px; padding: 1rem; margin-bottom: 1rem; }
  .panel h2, .thread-master h2 { font-size: .875rem; font-weight: 600; color: var(--ink); margin-bottom: .6rem; }
  select, input, textarea, button { font: inherit; }
  select, input, textarea {
    width: 100%; background: var(--bg); color: var(--ink); border: 1px solid var(--line); border-radius: 8px;
    padding: .5rem .6rem; font-size: .84rem; margin-bottom: .5rem;
  }
  textarea { min-height: 70px; resize: vertical; }
  button.btn {
    border: 1px solid transparent; cursor: pointer; border-radius: 6px; padding: .4rem .75rem; min-height: 32px; font-size: .875rem; font-weight: 500;
    color: var(--btn-primary-ink); background: var(--btn-primary); margin-bottom: .5rem;
  }
  button.btn.ghost { background: var(--background-color-button-default-rest, var(--panel)); color: var(--ink); border: 1px solid var(--line); }
  button.btn:hover:not(:disabled) { filter: brightness(.95); }
  :where(button, input, select, textarea, summary, a, [tabindex]):focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  button.btn.danger { background: transparent; color: var(--err); border: 1px solid #f1b9b9; }
  button.btn.mini { padding: .3rem .6rem; font-size: .74rem; margin-bottom: 0; }
  button.btn:disabled { opacity: .5; cursor: default; }
  .panel-head { display: flex; align-items: center; justify-content: space-between; gap: .75rem; margin-bottom: .6rem; }
  .panel-head h2 { margin-bottom: 0; }
  .head-actions { display: flex; align-items: center; gap: .4rem; }
  .row-actions { display: flex; gap: .5rem; }
  .row-actions .btn { flex: 1; }
  .connection-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: .35rem .75rem; margin-top: .5rem; }
  .connection-item { min-width: 0; color: var(--muted); font-size: .72rem; }
  .connection-item strong { display: block; color: var(--ink); font-size: .78rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .agent-picker { position: relative; margin-bottom: .5rem; }
  #sub-select { width: 100%; margin-bottom: .5rem; }
  .agent-picker-trigger {
    display: flex; align-items: center; justify-content: space-between; gap: .375rem;
    position: relative; width: 100%; background: var(--bg); color: var(--ink);
    border: 1px solid var(--line); border-radius: 8px; padding: .5rem 1.5rem .5rem .6rem;
    font-size: .84rem; cursor: pointer; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .agent-picker-trigger:disabled { color: var(--muted); cursor: default; }
  .agent-picker-trigger:focus-visible, .agent-option:focus-visible { outline: 2px solid var(--color-focus-outline, var(--accent)); outline-offset: 2px; }
  .agent-options {
    position: absolute; z-index: 20; top: calc(100% + 2px); left: 0; right: 0; padding: .15rem;
    background: var(--bg); border: 1px solid var(--line); border-radius: 8px; box-shadow: 0 6px 16px rgba(27,26,36,.14);
    max-height: 240px; overflow-y: auto;
  }
  .agent-option { width: 100%; border: 0; border-radius: 6px; padding: .35rem .45rem; background: var(--bg); color: var(--ink); cursor: pointer; text-align: left; font-size: .84rem; }
  .agent-option:hover, .agent-option:focus { background: var(--selected-bg); outline: none; }
  .agent-option[aria-current="true"] { font-weight: 600; color: var(--accent); }
  .provider-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: .75rem; }
  .provider-card { background: var(--bg); border: 1px solid var(--line); border-radius: 10px; padding: .75rem; }
  .provider-card h3 { font-size: .86rem; margin-bottom: .35rem; }
  .provider-card.disabled { opacity: .72; }
  .row-list { display: flex; flex-direction: column; gap: .35rem; max-height: 220px; overflow-y: auto; }
  .row-item {
    border: 1px solid var(--line); border-radius: 8px; padding: .5rem .6rem; font-size: .8rem; cursor: pointer;
    display: flex; justify-content: space-between; gap: .5rem; background: var(--bg);
  }
  .row-main { min-width: 0; display: flex; align-items: center; gap: .45rem; overflow: hidden; }
  .row-main span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .row-item:hover { border-color: var(--accent2); }
  .row-item.active { border-color: var(--accent); background: var(--selected-bg); color: var(--selected-ink); }
  .thread-master .row-item { min-width: 0; min-height: 46px; padding: .65rem .7rem; border: 1px solid var(--line); border-radius: 8px; align-items: center; overflow: hidden; white-space: nowrap; }
  .thread-master .row-item:not(.active) { background: var(--thread-row-bg, var(--thread-surface)); }
  .thread-master .row-item:hover { background: var(--selected-bg); color: var(--selected-ink); }
  .thread-master .row-item.active { border-color: var(--accent); border-left: 4px solid var(--accent); padding-left: calc(.7rem - 4px); background: var(--selected-bg); color: var(--selected-ink); font-weight: 700; }
  .thread-master .thread-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .thread-master .thread-status { flex: none; max-width: 35%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: inherit; font-size: .68rem; }
  .thread-master .row-item:focus-visible, .thread-master > summary:focus-visible, .agent-picker-row button:focus-visible {
    outline: 2px solid var(--accent); outline-offset: 2px;
  }
  .favorites-error { color: var(--err); }
  .tag { font-size: .68rem; color: var(--muted); border: 1px solid var(--line); border-radius: 999px; padding: 1px 8px; }
  .incident-toolbar { display: grid; grid-template-columns: minmax(0, 1fr) minmax(150px, .35fr) auto auto; gap: .5rem; margin-bottom: .75rem; }
  .incident-counters { display: flex; flex-wrap: wrap; gap: 1.25rem; padding: .75rem; margin-bottom: .75rem; border: 1px solid var(--line); border-radius: 8px; background: var(--thread-surface); }
  .incident-counter { flex: 1 1 200px; }
  .incident-counter > span { color: var(--muted); font-size: .75rem; }
  .incident-counter strong { display: flex; flex-wrap: wrap; gap: 1rem; font-size: .85rem; font-weight: 400; margin-top: .4rem; }
  .incident-status-label { display: inline-flex; gap: .45rem; align-items: center; white-space: nowrap; }
  .incident-status-icon { display: inline-flex; align-items: center; justify-content: center; width: 1rem; height: 1rem; font-size: .72rem; flex: 0 0 auto; }
  .incident-status-icon.active { width: 3px; margin-left: 5px; margin-right: 8px; background: #d13438; border-radius: 2px; }
  .incident-status-icon.mitigated { width: 3px; margin-left: 5px; margin-right: 8px; background: #107c10; border-radius: 2px; }
  .incident-status-icon.pending { color: #ca5010; font-size: 1rem; }
  .incident-status-icon.progress { color: #0078d4; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; box-sizing: border-box; }
  .incident-status-icon.complete { color: white; background: #107c10; border-radius: 50%; }
  #connector-create-panel[hidden] { display: none; }
  .incident-scroll-tools { display: flex; align-items: center; justify-content: space-between; gap: .5rem; margin: -.25rem 0 .45rem; }
  .incident-scroll-tools .hint { margin: 0; }
  .incident-scroll-buttons { display: flex; gap: .35rem; flex: none; }
  .incident-panel { display: flex; flex-direction: column; min-height: 420px; }
  .incident-panel > :not(.incident-table-wrap) { flex-shrink: 0; }
  .incident-table-wrap { flex: 1; min-height: 120px; overflow-x: auto; overflow-y: auto; border: 1px solid var(--line); border-radius: 10px; scrollbar-gutter: stable; }
  .incident-table { width: 100%; border-collapse: collapse; min-width: 1420px; font-size: .76rem; table-layout: fixed; }
  .incident-table th, .incident-table td { padding: .55rem .6rem; text-align: left; border-bottom: 1px solid var(--line); vertical-align: top; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .incident-table th { position: sticky; top: 0; z-index: 1; background: var(--panel); color: var(--muted); font-size: .68rem; text-transform: uppercase; letter-spacing: .03em; }
  .incident-table tbody tr { cursor: pointer; background: var(--bg); }
  .incident-table tbody tr:hover, .incident-table tbody tr:focus-visible { background: var(--selected-bg); outline: none; }
  .incident-table tbody tr[aria-selected="true"] { background: var(--selected-bg); color: var(--selected-ink); }
  .incident-table th:nth-child(1), .incident-table td:nth-child(1) { width: calc(13ch + 1.2rem); }
  .incident-sort { font: inherit; letter-spacing: inherit; text-transform: inherit; color: inherit; border: 0; padding: 0; background: transparent; cursor: pointer; }
  .incident-sort:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .incident-table th:nth-child(2), .incident-table td:nth-child(2) { width: 300px; }
  .incident-table th:nth-child(3), .incident-table td:nth-child(3) { width: calc(11ch + 1.2rem); }
  .incident-table th:nth-child(4), .incident-table td:nth-child(4) { width: 130px; }
  .incident-table th:nth-child(5), .incident-table td:nth-child(5) { width: 130px; }
  .incident-table th:nth-child(6), .incident-table td:nth-child(6) { width: 190px; }
  .incident-table th:nth-child(7), .incident-table td:nth-child(7) { width: 180px; }
  .incident-table th:nth-child(8), .incident-table td:nth-child(8) { width: 170px; }
  .incident-table th:nth-child(9), .incident-table td:nth-child(9) { width: 190px; }
  .incident-table .incident-title-cell { font-weight: 600; }
  .incident-table .incident-id-cell { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  @media (max-width: 760px) {
    .incident-toolbar { grid-template-columns: 1fr; }
    .incident-scroll-tools { align-items: flex-start; }
  }
  .focus-badge { font: inherit; font-size: .68rem; color: #fff; background: var(--accent); border: 0; border-radius: 999px; padding: 2px 8px; cursor: pointer; }
  :root[data-theme-tone="dark"] .focus-badge, :root[data-color-mode="dark"]:not([data-theme-tone="light"]) .focus-badge { color: #1f1f1f; }
  .status { font-size: .78rem; color: var(--muted); min-height: 1.2em; }
  .status.err { color: var(--err); }
  .status.err:not(:empty) { border: 1px solid var(--err); border-left-width: 3px; border-radius: 6px; padding: .5rem .65rem; margin-bottom: .65rem; background: var(--panel); }
  .thread-log { background: var(--thread-surface); border: 1px solid var(--line); border-radius: 8px; padding: .7rem; max-height: 320px; overflow-y: auto; font-size: .8rem; white-space: pre-wrap; }
  .tabs { display: flex; gap: .4rem; margin-bottom: .8rem; flex-wrap: nowrap; overflow-x: auto; }
  .tab, [data-connection-mode] { flex: none; white-space: nowrap; font-size: .875rem; padding: .45rem .7rem; border-radius: 6px 6px 0 0; border: 0; border-bottom: 2px solid transparent; background: transparent; color: var(--muted); cursor: pointer; display: inline-flex; align-items: center; gap: .3rem; }
  .tab.active, [data-connection-mode][aria-selected="true"] { color: var(--ink); border-bottom-color: #fd8c73; background: var(--panel); font-weight: 600; }
  .tab .nyi-tag { font-size: .6rem; margin-left: 2px; text-transform: uppercase; letter-spacing: .3px; }
  .tabpage { display: none; }
  .tabpage.active { display: block; }
  code { background: var(--panel); border-radius: 4px; padding: 1px 5px; font-size: .78rem; }
  ${COMMAND_CSS}
  details.cmdlog { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: .8rem 1rem; margin-bottom: 1rem; }
  details.cmdlog summary { cursor: pointer; font-size: .82rem; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
  #azure-config-card .config-connection { display: inline-block; max-width: calc(100% - 190px); margin-left: .6rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: bottom; color: var(--ink); font-weight: 400; text-transform: none; letter-spacing: normal; }
  #azure-config-card[open] .config-connection { display: none; }
  .cmd-list { display: flex; flex-direction: column; gap: .4rem; max-height: 260px; overflow-y: auto; margin-top: .6rem; }
  .cmd-row { border: 1px solid var(--line); border-radius: 8px; padding: .5rem .6rem; background: var(--bg); font-size: .76rem; }
  .cmd-row .cmd-head { display: flex; align-items: center; gap: .5rem; margin-bottom: .3rem; }
  .cmd-kind { font-size: .65rem; font-weight: 700; text-transform: uppercase; letter-spacing: .03em; padding: 1px 6px; border-radius: 999px; border: 1px solid var(--line); color: var(--muted); }
  .cmd-kind.az { color: #0969da; border-color: #b6d4f5; background: #eef6ff; }
  .cmd-kind.rest { color: var(--accent); border-color: var(--line); background: var(--selected-bg); }
  .cmd-status { font-size: .68rem; font-weight: 600; padding: 1px 7px; border-radius: 999px; }
  .cmd-status.run { color: var(--warn); background: #fdf0d8; animation: cmdpulse 1.1s ease-in-out infinite; }
  .cmd-status.ok { color: var(--ok); background: #e4f7ef; }
  .cmd-status.err { color: var(--err); background: #fde6e6; }
  .cmd-time { color: var(--muted); font-size: .68rem; margin-left: auto; }
  .cmd-ms { color: var(--muted); font-size: .68rem; }
  .cmd-text { font-family: ui-monospace, "SFMono-Regular", Menlo, monospace; color: var(--ink); word-break: break-all; }
  .cmd-note { color: var(--muted); margin-top: .2rem; }
  @keyframes cmdpulse { 0%, 100% { opacity: 1; } 50% { opacity: .55; } }
  @keyframes typingBounce { 0%, 80%, 100% { transform: translateY(0); opacity: .4; } 40% { transform: translateY(-4px); opacity: 1; } }
  .typing-dots { display: inline-flex; align-items: center; gap: .22rem; padding: .1rem 0; }
  .typing-dots span { width: 6px; height: 6px; border-radius: 50%; background: var(--muted); animation: typingBounce 1.2s infinite ease-in-out; }
  .typing-dots span:nth-child(2) { animation-delay: .15s; }
  .typing-dots span:nth-child(3) { animation-delay: .3s; }
  /* Chat transcript, styled after the SRE Agent portal's own thread view. */
  .chat-log { background: var(--thread-surface); border: 1px solid var(--line); border-radius: 8px; padding: .8rem; flex: 1 1 0; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: .6rem; font-size: var(--canvas-body, 14px); line-height: var(--leading-body-medium, 20px); font-weight: 400; }
  .threads-layout { display: grid; grid-template-columns: minmax(240px, .85fr) minmax(0, 2fr); gap: .75rem; align-items: stretch; }
  .thread-master { min-width: 0; }
  .thread-master > summary { cursor: pointer; color: var(--ink); font-size: .82rem; font-weight: 400; list-style: none; display: flex; align-items: center; gap: .5rem; }
  .thread-master > summary::-webkit-details-marker { display: none; }
  .thread-rail-icon { width: 20px; height: 20px; flex: none; stroke: currentColor; fill: none; stroke-width: 1.5; }
  .thread-master > .head-actions { margin: .7rem 0; }
  .threads-layout:has(.thread-master:not([open])) { grid-template-columns: 52px minmax(0, 1fr); }
  .thread-master:not([open]) { padding: .8rem .9rem; }
  .thread-master:not([open]) .thread-rail-label { display: none; }
  .thread-master .row-list { max-height: min(62dvh, 720px); }
  .thread-detail { min-width: 0; height: clamp(420px, calc(100dvh - 355px), 950px); outline: none; display: flex; flex-direction: column; }
  .thread-detail > :not(.chat-log) { flex-shrink: 0; }
  .thread-detail > textarea { min-height: 72px; max-height: 30%; }
  .thread-detail .row-actions { flex-wrap: wrap; }
  .thread-detail .row-actions .btn { flex: 1 1 120px; min-width: 0; white-space: normal; }
  .thread-detail .row-actions .btn[hidden] { display: none; }
  .reply-feedback:empty { display: none; }
  .thread-detail:focus-visible { outline: 2px solid var(--color-focus-outline, var(--accent)); outline-offset: 4px; border-radius: 8px; }
  .thread-detail h3 { font-size: .86rem; margin-bottom: .5rem; }
  .transcript-notice { display: flex; justify-content: space-between; align-items: center; gap: .75rem; padding: .45rem .6rem; border: 1px solid var(--line); border-radius: 8px; background: var(--bg); color: var(--muted); font-size: .75rem; }
  @media (max-width: 760px) {
    body { padding: .7rem; }
    .threads-layout { grid-template-columns: minmax(0, 1fr); }
    .threads-layout:has(.thread-master:not([open])) { grid-template-columns: 52px minmax(0, 1fr); }
    .thread-master .row-list { max-height: 220px; }
    .thread-detail { height: clamp(380px, calc(100dvh - 520px), 800px); }
  }
  @media (forced-colors: active) {
    .product-mark { forced-color-adjust: none; }
    .thread-master .row-item.active, .agent-option[aria-current="true"] { border-color: Highlight; outline: 2px solid Highlight; }
  }
  .chat-msg { display: flex; flex-direction: column; gap: .3rem; min-width: 0; overflow-wrap: anywhere; }
  .chat-msg .who { font-size: var(--canvas-small, 12px); font-weight: 400; color: var(--muted); }
  .chat-bubble { border-radius: 10px; padding: .55rem .7rem; min-width: 0; }
  .chat-msg.user .chat-bubble { background: var(--user-bubble); align-self: flex-end; max-width: 85%; }
  .chat-msg.agent .chat-bubble { background: var(--bg); border: 1px solid var(--line); max-width: 92%; }
  .chat-msg.user { align-items: flex-end; }
  /* Markdown rendering inside chat bubbles (SRE Agent replies often contain GFM tables). */
  .chat-bubble p { margin: 0 0 .5rem; white-space: pre-wrap; }
  .chat-bubble p:last-child { margin-bottom: 0; }
  .chat-bubble h1, .chat-bubble h2, .chat-bubble h3 { margin: .4rem 0 .35rem; line-height: 1.3; }
  .chat-bubble h1 { font-size: 1.05rem; }
  .chat-bubble h2 { font-size: .98rem; }
  .chat-bubble h3 { font-size: .9rem; }
  .chat-bubble ul { margin: 0 0 .5rem 1.1rem; padding: 0; }
  .chat-bubble li { margin: .1rem 0; }
  .chat-bubble code { font-family: var(--font-mono, "SFMono-Regular", Consolas, "Liberation Mono", monospace); background: var(--panel); border-radius: 4px; padding: 1px 5px; font-size: var(--text-code-inline, 12px); }
  .chat-bubble table { border-collapse: collapse; width: 100%; margin: .3rem 0 .6rem; font-size: inherit; table-layout: fixed; }
  .chat-bubble table th, .chat-bubble table td { border: 1px solid var(--line); padding: .3rem .5rem; text-align: left; vertical-align: top; }
  .chat-bubble table th { background: var(--panel); color: var(--muted); font-weight: 600; }
  .chat-bubble table tr:nth-child(even) td { background: var(--thread-surface); }
  .tool-card { border: 1px solid var(--line); border-radius: 10px; padding: .55rem .7rem; background: var(--panel); min-width: 0; }
  .tool-card .tool-head { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; margin-bottom: .35rem; }
  .tool-card .tool-title { min-width: 0; font-weight: var(--font-weight-semibold, 600); }
  .tool-badge { font-size: var(--canvas-small, 12px); font-weight: 400; padding: 1px 8px; border-radius: 999px; border: 1px solid var(--line); color: var(--muted); }
  .tool-badge.safe { color: var(--ok); border-color: color-mix(in srgb, var(--ok) 30%, var(--line)); background: color-mix(in srgb, var(--ok) 5%, var(--bg)); }
  .tool-badge.risk { color: var(--warn); border-color: color-mix(in srgb, var(--warn) 30%, var(--line)); background: color-mix(in srgb, var(--warn) 5%, var(--bg)); }
  .tool-badge.done { color: var(--muted); }
  .tool-cmd { font-family: var(--font-mono, "SFMono-Regular", Consolas, "Liberation Mono", monospace); background: var(--thread-surface); border-radius: 6px; word-break: break-all; }
  .tool-cmd pre { margin: 0; font-family: inherit; white-space: pre-wrap; word-break: break-all; }
  .tool-output { margin-top: .35rem; color: var(--muted); white-space: pre-wrap; max-height: 160px; overflow-y: auto; }
  .mcp-run-card > .tool-output { max-height: none; overflow: visible; white-space: normal; }
  .mcp-run-card .automation-table { font-size: inherit; }
  .scheduled-run-context { border: 1px solid var(--line); border-radius: 8px; padding: .75rem; }
  .scheduled-run-context h3 { margin: 0 0 .4rem; font-size: inherit; line-height: inherit; font-weight: var(--font-weight-semibold, 600); overflow-wrap: anywhere; }
  .scheduled-run-context p { margin: .4rem 0; }
  .scheduled-run-instructions > summary { cursor: pointer; color: var(--accent); margin-top: .5rem; }
  .chat-msg .scheduled-run-instructions .chat-bubble { padding: .5rem 0 0; max-width: 100%; background: transparent; border: 0; }
  #status[hidden] { display: none; }
  .spinner { display: inline-block; width: 10px; height: 10px; border: 2px solid var(--line); border-top-color: var(--accent); border-radius: 50%; animation: spin .7s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .copy-cmd { font-size: .68rem; padding: 1px 6px; border-radius: 5px; border: 1px solid var(--line); background: var(--bg); color: var(--ink); cursor: pointer; }
  .tool-auth-notice { margin-top: .45rem; padding: .5rem .6rem; background: var(--thread-surface); border: 1px solid var(--line); border-radius: 8px; color: var(--muted); }
  .tool-auth-actions { margin-top: .5rem; display: flex; gap: .5rem; }
  .tool-auth-actions .btn { padding: .35rem .9rem; font-size: .78rem; }
  .footer-meta { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: .75rem; margin-top: 1rem; }
  .build-stamp { color: var(--muted); font: 10px/1.2 ui-monospace, "SFMono-Regular", Menlo, monospace; opacity: .7; }
  .feedback-link { color: var(--accent); font-size: .75rem; }
  .agent-context { position: relative; display: inline-flex; align-items: center; gap: .35rem; min-width: 0; }
  .agent-context[hidden], .agent-menu[hidden], .thread-focus-strip[hidden] { display: none; }
  .agent-switcher { display: inline-flex; align-items: center; gap: .375rem; font: inherit; font-size: .875rem; font-weight: 400; border: 0; border-radius: 6px; background: transparent; color: var(--ink); padding: .25rem .4rem; cursor: pointer; min-width: 0; max-width: min(260px, 40vw); }
  .agent-switcher-name, .agent-picker-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .agent-chevron { display: inline-flex; flex: none; color: var(--canvas-muted, var(--muted)); }
  .agent-switcher .canvas-icon, .agent-picker-trigger .canvas-icon { flex: none; width: 16px; height: 16px; }
  .agent-picker-row { display: flex; align-items: center; }
  .agent-picker-row .agent-option { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .agent-picker-row .picker-star { flex: none; width: 36px; text-align: center; font-size: 1.1rem; border: 0; background: transparent; color: var(--ink); cursor: pointer; padding: .35rem; }
  .agent-picker-row .picker-star[aria-pressed="true"] { color: var(--warn); }
  .agent-picker-row .agent-option[aria-current="true"] { background: var(--selected-bg); }
  .connection-panel[hidden] { display: none; }
  .picker-feedback { color: var(--err); font-size: .75rem; overflow-wrap: anywhere; }
  .agent-switcher:hover, .agent-switcher[aria-expanded="true"] { background: var(--panel); }
  .agent-menu { position: absolute; top: 100%; left: 0; z-index: 30; width: 280px; max-width: calc(100vw - 32px); max-height: 360px; overflow-y: auto; padding: .4rem; background: var(--bg); border: 1px solid var(--line); border-radius: 12px; box-shadow: 0 8px 24px color-mix(in srgb, var(--ink) 16%, transparent); }
  .agent-menu button { display: block; width: 100%; text-align: left; background: transparent; color: var(--ink); font-size: .8125rem; font-weight: 400; border: 0; border-radius: 6px; padding: .5rem; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .agent-menu button:hover, .agent-menu button:focus { background: var(--selected-bg); }
  .agent-menu-label { color: var(--ink); font-size: .8125rem; font-weight: 600; padding: .3rem .5rem; }
  .favorite-star { border: 1px solid var(--line); border-radius: 6px; background: var(--panel); color: var(--ink); font: inherit; cursor: pointer; padding: .2rem .5rem; }
  .favorite-star[aria-pressed="true"] { color: var(--warn); }
  .thread-focus-strip { display: flex; align-items: center; gap: .5rem; margin-bottom: .65rem; padding: .5rem .65rem; border: 1px solid var(--line); border-left: 3px solid var(--accent); border-radius: 6px; background: var(--panel); font-size: .75rem; }
  .thread-focus-copy { flex: 1; min-width: 0; }
  .thread-focus-strip .focus-badge { display: block; max-width: 100%; background: transparent; color: var(--accent); border-radius: 0; padding: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left; font-size: .8rem; font-weight: 600; }
  .thread-focus-strip .btn { flex: none; }
  .thread-filter-label { font-size: .75rem; color: var(--muted); display: block; margin-bottom: .25rem; }
  .thread-filter-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: .4rem; }
  .incident-alert-card { border: 1px solid var(--line); border-left: 3px solid var(--warn); border-radius: 6px; background: var(--panel); padding: .75rem; margin: .375rem 0; overflow-wrap: anywhere; }
  .incident-alert-head { display: flex; align-items: baseline; flex-wrap: wrap; gap: .35rem .6rem; margin-bottom: .5rem; }
  .incident-alert-severity { color: var(--warn); font-size: .75rem; font-weight: 600; }
  .incident-alert-details { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: .4rem .75rem; margin: 0 0 .65rem; }
  .incident-alert-details div { min-width: 0; }
  .incident-alert-details dt { color: var(--muted); font-size: .75rem; }
  .incident-alert-details dd { margin: 0; }
  .incident-alert-description { white-space: pre-wrap; }
  .activity-dialog { position: fixed; margin: auto; width: min(760px, calc(100vw - 32px)); max-height: min(80dvh, 800px); padding: 1rem; border: 1px solid var(--line); border-radius: 12px; background: var(--bg); color: var(--ink); box-shadow: 0 8px 24px color-mix(in srgb, var(--ink) 16%, transparent); }
  .activity-dialog::backdrop { background: rgba(0, 0, 0, .4); }
  .activity-dialog .cmd-list { max-height: 60dvh; }
  .activity-count { color: var(--err); }
  .completion-menu { position: fixed; z-index: 40; overflow-y: auto; padding: .4rem; border: 1px solid var(--line); border-radius: 8px; background: var(--bg); color: var(--ink); box-shadow: 0 8px 24px color-mix(in srgb, var(--ink) 16%, transparent); }
  .completion-menu[hidden] { display: none; }
  .completion-group-label { padding: .4rem; color: var(--muted); font-size: .7rem; font-weight: 600; }
  .completion-option { display: block; width: 100%; padding: .5rem; border: 0; border-radius: 4px; background: transparent; color: var(--ink); text-align: left; cursor: pointer; }
  .completion-option:hover, .completion-option[aria-selected="true"] { background: var(--selected-bg); }
  .completion-option strong, .completion-option span { display: block; overflow-wrap: anywhere; }
  .completion-option span { color: var(--muted); font-size: .75rem; }
  .completion-note { margin: .35rem .4rem; font-size: .75rem; color: var(--muted); overflow-wrap: anywhere; }
  .automation-panel { min-width: 0; }
  .automation-panel[hidden], .automation-panel [hidden] { display: none; }
  .automation-toolbar { display: flex; flex-wrap: wrap; align-items: end; gap: .5rem; }
  .automation-toolbar label { flex: 1 1 150px; min-width: 0; }
  .automation-table-wrap { overflow: auto; max-height: min(60dvh, 700px); margin-top: .75rem; }
  .automation-table { width: 100%; border-collapse: collapse; font-size: .8rem; }
  .automation-table th, .automation-table td { text-align: left; padding: .55rem; border-bottom: 1px solid var(--line); vertical-align: top; overflow-wrap: anywhere; }
  .automation-table th { position: sticky; top: 0; background: var(--bg); }
  .automation-table tr[aria-current="true"] { background: var(--selected-bg); }
  .automation-open { color: var(--accent); background: none; border: 0; font: inherit; text-align: left; cursor: pointer; padding: 0; overflow-wrap: anywhere; }
  .automation-task-head { display: flex; align-items: start; gap: .75rem; margin: .75rem 0; }
  .automation-task-heading { flex: 1; min-width: 0; }
  .automation-task-heading h2 { margin: .2rem 0; font-size: 1.1rem; font-weight: 600; overflow-wrap: break-word; }
  .automation-task-summary { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem 1rem; margin-top: .5rem; font-size: .8rem; color: var(--muted); }
  .automation-task-description { max-width: 80ch; line-height: 1.5; margin: .75rem 0; overflow-wrap: break-word; }
  .automation-run-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; padding: .75rem 0; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
  .automation-run-toolbar label { margin-left: auto; display: flex; align-items: center; gap: .5rem; font-size: .8rem; }
  .automation-run-toolbar select { width: auto; min-width: 130px; margin: 0; }
  .automation-runs-section h3 { margin: 1rem 0 .25rem; font-size: 1rem; }
  .automation-runs-table-wrap { overflow: auto; max-height: min(55dvh, 600px); }
  .automation-runs-table { min-width: 540px; }
  .automation-runs-table th:first-child { width: 220px; }
  .automation-runs-table tr[data-run-index] { cursor: pointer; }
  .automation-runs-table tr[data-run-index]:hover { background: var(--selected-bg); }
  .automation-run-state { white-space: nowrap; }
  .automation-run-state[data-status="Success"] { color: var(--ok); border-color: var(--ok); }
  .automation-run-state[data-status="Failed"] { color: var(--err); border-color: var(--err); }
  .automation-run-sort { border: 0; background: none; color: inherit; padding: 0; font: inherit; font-weight: 600; cursor: pointer; }
  .automation-task-settings { border-top: 1px solid var(--line); margin-top: 1rem; padding-top: .75rem; }
  .automation-task-settings summary { cursor: pointer; font-size: .8rem; color: var(--muted); }
  .automation-facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 250px), 1fr)); gap: .75rem 1.5rem; font-size: .8rem; }
  .automation-facts div { min-width: 0; overflow-wrap: anywhere; }
  .automation-facts dt { color: var(--muted); font-size: .75rem; }
  .automation-facts dd { margin: .2rem 0 0; white-space: pre-wrap; }
  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; } }
  @media (max-width: 500px) {
    h1 { flex-wrap: wrap; }
    .agent-context { order: 3; width: 100%; }
    .agent-switcher { max-width: calc(100vw - 100px); }
  }
</style>
</head>
<body class="canvas-theme-github">
  <h1 class="product-heading"><img class="product-mark" src="./assets/azure-sre-agent-color.svg" alt="" aria-hidden="true"><span class="product-title">Azure SRE Agent</span><span id="agent-context" class="agent-context" hidden><span aria-hidden="true">/</span><button type="button" id="agent-switcher" class="agent-switcher" aria-haspopup="menu" aria-controls="agent-switcher-menu" aria-expanded="false"></button><button type="button" id="agent-favorite" class="favorite-star" aria-label="Add connected agent to Favorites" aria-pressed="false">&#9734;</button><span id="agent-switcher-menu" class="agent-menu" role="menu" aria-label="Switch SRE Agent" hidden><span id="agent-menu-items"></span><button type="button" role="menuitem" id="agent-menu-config">Azure configuration &amp; shared agents</button></span></span><button type="button" id="activity-trigger" class="btn ghost mini" aria-haspopup="dialog" aria-controls="cmdlog" aria-expanded="false">Command activity <span id="activity-failed-count" class="activity-count" aria-hidden="true" hidden></span></button><a class="doc" href="${DOC_URL}" target="_blank" rel="noreferrer">docs &#8599;</a></h1>
  <p class="sub">Discover Azure SRE Agents, investigate failing apps, correlate ICM/S360 tickets, and manage incidents, scheduled tasks, connectors, and memories.</p>
  <div id="status" class="status" role="status" aria-live="polite"></div>
  <p id="favorite-write-status" class="hint picker-feedback" role="status" aria-live="polite" hidden></p>
  <div id="scheduled-tasks-access" class="status err" role="alert" hidden></div>

  <details class="cmdlog canvas-accordion-plain" id="azure-config-card" open style="margin-bottom:1rem">
    <summary>Azure Configuration <span id="config-connection" class="config-connection" role="status" aria-live="polite">No agent connected</span></summary>
    <div class="panel" style="margin-top:8px">
      <div class="connection-tabs tabs canvas-nav-tabs" role="tablist" aria-label="Agent connection method">
        <button type="button" id="connection-subscription-tab" role="tab" aria-selected="true" aria-controls="connection-subscription-panel" tabindex="0" data-connection-mode="subscription">By subscription</button>
        <button type="button" id="connection-external-tab" role="tab" aria-selected="false" aria-controls="connection-external-panel" tabindex="-1" data-connection-mode="external">External URL or Resource ID</button>
      </div>
      <div id="connection-subscription-panel" class="connection-panel" role="tabpanel" aria-labelledby="connection-subscription-tab">
      <button type="button" id="sub-select" aria-label="Azure subscriptions">Choose subscriptions</button>
      <div id="subscription-status"></div>
      <p class="hint" id="subscription-discovery-status" role="status"></p>
      <div class="agent-picker">
        <button type="button" id="agent-select" class="agent-picker-trigger" aria-haspopup="menu" aria-expanded="false" aria-controls="agent-options" aria-describedby="agent-discovery-hint"><span class="agent-picker-name">Select a subscription above</span><span class="agent-chevron"></span></button>
        <div id="agent-options" class="agent-options" role="menu" aria-label="SRE Agents" hidden></div>
      </div>
      <p class="hint" id="agent-discovery-hint" role="status" aria-live="polite" hidden></p>
      <button class="btn ghost" id="refresh-agents">Refresh agents</button>
      </div>
      <div id="connection-external-panel" class="connection-panel" role="tabpanel" aria-labelledby="connection-external-tab" hidden>
      <label class="field-label" for="shared-agent-reference">Open an agent by URL or resource ID</label>
      <p class="hint">Paste a shared agent's ARM ID, an sre.azure.com agent or external-agent link, or the external agent's https://*.azuresre.ai endpoint.</p>
      <input id="shared-agent-reference" type="text" autocomplete="off" spellcheck="false" placeholder="https://agent--id.region.azuresre.ai" />
      <button class="btn ghost" id="open-shared-agent">Connect to agent</button>
      <button class="btn ghost" id="open-external-portal">Open external link in Portal &#8599;</button>
      <p id="connection-feedback" class="hint picker-feedback" role="alert" hidden></p>
      </div>
      <p id="favorites-error" class="hint favorites-error" role="alert" hidden></p>
      <div id="agent-summary"></div>
      <div id="config-drift-result"></div>
    </div>
  </details>

  <div id="main-grid">
    <div class="tabs canvas-nav-tabs" role="tablist" aria-label="Azure SRE Agent workspace">
      <button type="button" class="tab active" role="tab" aria-selected="true" aria-controls="threads-page" tabindex="0" data-tab="threads">Threads</button>
      <button type="button" class="tab" role="tab" aria-selected="false" aria-controls="apps-page" tabindex="-1" data-tab="apps">Apps</button>
      <button type="button" class="tab" role="tab" aria-selected="false" aria-controls="connectors-page" tabindex="-1" data-tab="connectors">Connectors</button>
      <button type="button" class="tab" role="tab" aria-selected="false" aria-controls="incidents-page" tabindex="-1" data-tab="incidents">Incidents</button>
      <button type="button" class="tab" role="tab" aria-selected="false" aria-controls="automation-page" tabindex="-1" data-tab="automation">Automation</button>
      <button type="button" class="tab" role="tab" aria-selected="false" aria-disabled="true" tabindex="-1" title="Coming soon">Operations Hub<span class="nyi-tag">NYI</span></button>
      <button type="button" class="tab" role="tab" aria-selected="false" aria-disabled="true" tabindex="-1" title="Coming soon">Live Reports<span class="nyi-tag">NYI</span></button>
      <button type="button" class="tab" role="tab" aria-selected="false" aria-disabled="true" tabindex="-1" title="Coming soon">Releases<span class="nyi-tag">NYI</span></button>
      <button type="button" class="tab" role="tab" aria-selected="false" aria-disabled="true" tabindex="-1" title="Coming soon">S360<span class="nyi-tag">NYI</span></button>
    </div>

    <div class="tabpage active" id="threads-page" role="tabpanel" data-page="threads">
      <div class="threads-layout">
        <details class="thread-master" id="threads-card" aria-label="Thread navigation" open>
          <summary aria-label="Collapse Threads" title="Collapse Threads"><svg class="thread-rail-icon" viewBox="0 0 20 20" aria-hidden="true"><rect x="1.5" y="1.5" width="17" height="17" rx="2"/><path d="M7.5 1.5v17"/></svg><span class="thread-rail-label">Threads</span></summary>
          <div class="head-actions">
            <button class="btn ghost mini" id="new-thread">New Thread</button>
            <button class="btn ghost mini" id="search-threads">&#128269; Search Threads</button>
          </div>
          <div id="thread-search-panel" hidden>
            <label class="field-label" for="thread-search-query">Search thread titles</label>
            <input id="thread-search-query" type="search" maxlength="120" autocomplete="off" placeholder="Thread title" />
            <div class="row-actions">
              <button type="button" class="btn mini" id="thread-search-submit">Search</button>
              <button type="button" class="btn ghost mini" id="thread-search-clear">Clear</button>
            </div>
            <div id="thread-search-feedback" class="hint" role="status" aria-live="polite"></div>
          </div>
          <label class="thread-filter-label" for="thread-filter">Filter loaded threads</label>
          <select id="thread-filter"><option value="all">All threads</option><option value="attention">Needs attention</option><option value="focused">Focused thread</option></select>
          <div class="thread-filter-row">
            <select id="thread-type-filter" aria-label="Filter threads by type"><option value="all">All types</option><option value="incident">Incidents</option><option value="scheduled">Scheduled tasks</option><option value="thread">Investigations</option></select>
            <select id="thread-sort" aria-label="Sort threads"><option value="recent">Recently active</option><option value="oldest">Oldest active</option><option value="name">Name A-Z</option></select>
          </div>
          <div id="thread-filter-count" class="hint" role="status" aria-live="polite"></div>
          <div id="thread-list" class="row-list" role="listbox" aria-label="Threads"></div>
        </details>
        <section id="thread-detail" class="panel thread-detail" aria-label="Active thread" tabindex="-1">
          <div class="panel-head">
            <h2>Active thread</h2>
          </div>
          <div id="thread-focus-strip" class="thread-focus-strip" hidden><div class="thread-focus-copy"><button type="button" id="focus-badge" class="focus-badge" title="Open the focused thread" hidden></button><span>Host-chat follow-ups default to this thread.</span></div><button type="button" id="clear-thread-focus" class="btn ghost mini">Clear focus</button></div>
          <div id="thread-activity" class="hint" role="status" aria-live="polite" hidden></div>
          <div id="thread-log" class="chat-log" aria-live="polite">No thread selected.</div>
          <textarea id="reply-msg" aria-label="Thread message" placeholder="Ask the SRE Agent for a diagnosis or reply to the selected thread..."></textarea>
          <div id="reply-completion" class="completion-menu" hidden></div>
          <div id="reply-feedback" class="reply-feedback hint" role="status" aria-live="polite"></div>
          <div class="row-actions">
            <button type="button" class="btn ghost" id="back-to-incidents" hidden>Back to incidents</button>
            <button type="button" class="btn ghost" id="back-to-automation-run" hidden>Back to task runs</button>
            <button type="button" class="btn" id="send-reply">Send</button>
            <button type="button" class="btn ghost" id="focus-thread" hidden>Focus this thread</button>
            <button class="btn ghost" id="open-in-portal">Open in Portal &#8599;</button>
          </div>
        </section>
      </div>
    </div>

    <div class="tabpage" id="automation-page" role="tabpanel" data-page="automation" hidden>
      <div class="panel automation-panel" id="automation-master">
        <div class="panel-head"><h2>Automation</h2><button type="button" class="btn ghost mini" id="automation-refresh">Refresh Automation</button></div>
        <div class="automation-toolbar" id="automation-toolbar">
          <label class="thread-filter-label">Search by name<input id="automation-search" type="search" maxlength="400" autocomplete="off" /></label>
          <label class="thread-filter-label">Status<select id="automation-status"><option value="all">All</option><option value="on">On</option><option value="off">Off</option><option value="unknown">Unknown</option></select></label>
        </div>
        <p class="hint" id="automation-count" role="status"></p>
        <div id="automation-notice" class="hint" role="status"></div>
        <div id="automation-http-notice" class="hint" role="status"></div>
        <div class="automation-table-wrap" id="automation-table-wrap" tabindex="0" aria-label="Scheduled automations">
          <table class="automation-table"><thead><tr><th scope="col">Name</th><th scope="col">Status</th><th scope="col">Type</th><th scope="col">Details</th><th scope="col">Created by</th><th scope="col">Last run</th><th scope="col">Completed runs</th></tr></thead><tbody id="automation-rows"></tbody></table>
        </div>
        <p class="hint" id="automation-empty"></p>
        <p class="hint" id="automation-loaded-scope">Counts and filters cover successfully loaded schedules and HTTP triggers only.</p>
      </div>
      <section class="panel automation-panel" id="automation-detail" tabindex="-1" aria-labelledby="automation-name" hidden>
        <button type="button" class="btn ghost mini" id="automation-back">Back to Automation</button>
        <div class="automation-task-head">
          <div class="automation-task-heading"><span class="hint" id="automation-task-type"></span><h2 id="automation-name"></h2><div class="automation-task-summary" id="automation-task-summary"></div></div>
          <button type="button" class="btn ghost mini" id="automation-edit">Edit task (Portal) &#8599;</button>
        </div>
        <p class="automation-task-description" id="automation-description"></p>
        <div class="automation-run-toolbar">
          <button type="button" class="btn ghost mini" id="automation-run-now" disabled data-task-command="run">Run task now</button>
          <button type="button" class="btn ghost mini" id="automation-toggle" disabled>Turn off</button>
          <button type="button" class="btn ghost mini" id="automation-delete" disabled data-task-command="delete">Delete</button>
          <button type="button" class="btn ghost mini" id="automation-update-runs">Update list</button>
          <label>Run status<select id="automation-run-status"><option value="all">All</option><option value="Success">Success</option><option value="Failed">Failed</option><option value="Unknown">Unknown</option></select></label>
        </div>
        <p class="hint" id="automation-task-action-note" role="status"></p>
        <section class="automation-runs-section" aria-labelledby="automation-runs-heading">
          <h3 id="automation-runs-heading">Runs</h3>
          <p class="hint" id="automation-runs-notice" role="status"></p>
          <div class="automation-runs-table-wrap"><table class="automation-table automation-runs-table"><thead><tr>
            <th scope="col" id="automation-run-time-heading" aria-sort="descending"><button type="button" class="automation-run-sort" id="automation-run-sort">Start time &#8595;</button></th>
            <th scope="col">Run status</th><th scope="col">Conversation</th>
          </tr></thead><tbody id="automation-run-rows"></tbody></table></div>
        </section>
        <details class="automation-task-settings"><summary>Task details</summary><div id="automation-detail-body"></div></details>
      </section>
    </div>

    <div class="tabpage" id="apps-page" role="tabpanel" data-page="apps" hidden>
        <div class="panel">
          <h2>Quick diagnose a failing app</h2>
          <label class="field-label" for="app-sub-select">App subscription</label>
          <select id="app-sub-select"></select>
          <select id="app-resource-select"></select>
          <input id="app-resource" placeholder="Or enter a resource ID / name" />
          <textarea id="app-note" placeholder="Optional: symptoms, error messages, recent changes"></textarea>
          <button class="btn" id="diagnose-app">Diagnose with SRE Agent</button>
          <button class="btn ghost" id="check-config-drift">Check workspace &lt;-&gt; Azure config</button>
        </div>
      </div>

      <div class="tabpage" id="connectors-page" role="tabpanel" data-page="connectors" hidden>
        <p class="hint" id="connector-external-note" role="status" hidden>Connectors are read-only in external agent mode. To manage connectors, open this agent from the tenant in which it was created.</p>
        <div id="connector-native-content">
          <div class="panel">
            <h2>Connectors attached to this SRE Agent</h2>
            <button type="button" class="btn ghost mini" id="refresh-connectors">Refresh</button>
            <p class="status err" id="connector-access-error" role="alert" hidden></p>
            <div id="connector-list" class="row-list"></div>
          </div>
          <div class="panel" id="connector-create-panel">
            <h2>Connect Azure Data Explorer</h2>
            <p class="hint">Choose the Kusto cluster and database you can already access. Select <strong>Configure Kusto DB &amp; attach</strong>; general Connector Namespace v2 stores your delegated sign-in, wraps the Kusto query as an authenticated MCP, and registers that endpoint with SRE Agent as a normal remote MCP. If the subscription has no Connector Namespace, the canvas creates one in the SRE Agent resource group.</p>
            <label class="field-label" for="connector-sub-select">Discovery subscription</label>
            <select id="connector-sub-select"></select>
            <button class="btn ghost" id="discover-kusto">Discover Data Explorer resources</button>
            <label class="field-label" for="kusto-cluster-select">Kusto cluster</label>
            <select id="kusto-cluster-select"></select>
            <label class="field-label" for="kusto-database-select">Kusto database</label>
            <select id="kusto-database-select"></select>
            <input id="kusto-cluster-url" placeholder="Or enter cluster URL, e.g. https://help.kusto.windows.net" />
            <input id="kusto-database" placeholder="Or enter database name" />
            <button class="btn" id="create-delegated-kusto-mcp"${PRIVATE_CONNECTORS_ENABLED ? "" : " disabled"}>Configure Kusto DB &amp; attach</button>
            <p class="hint" style="margin-top:.6rem"><strong>Staging safety gate:</strong> delegated connector creation, attachment, consent completion, and detachment are disabled unless <code>ALLOW_PRIVATE_CONNECTORS=true</code>. The SRE runtime does not yet provide signed per-invocation user and thread ownership proof, so this surface is not generally available.</p>
          </div>
        </div>
      </div>

      <div class="tabpage" id="incidents-page" role="tabpanel" data-page="incidents" hidden>
        <div class="panel incident-panel">
          <div class="panel-head">
            <h2>Incidents</h2>
            <div class="head-actions">
              <button type="button" class="btn ghost mini" id="open-incidents-portal">Open incidents in Portal &#8599;</button>
              <button type="button" class="btn ghost mini" id="refresh-incidents">Refresh</button>
            </div>
          </div>
          <div id="incidents-access" class="status err" role="alert" hidden></div>
          <p id="incidents-scope-note" class="hint"></p>
          <div class="incident-counters" aria-label="Incident summary">
            <div class="incident-counter"><span>Incident status</span><strong id="incident-status-count">0 active</strong></div>
            <div class="incident-counter"><span>Agent status</span><strong id="agent-status-count">0 active</strong></div>
          </div>
          <div class="incident-toolbar">
            <input id="incident-search" type="search" aria-label="Search incidents" placeholder="Search incident ID, title, or response plan" />
            <select id="incident-status-filter" aria-label="Filter incidents by status">
              <option value="">All statuses</option>
              <option value="Active">Active</option>
              <option value="Mitigated">Mitigated</option>
              <option value="Resolved">Resolved</option>
            </select>
            <button type="button" class="btn ghost" id="search-incidents">Search</button>
            <span id="incident-result-count" class="status" role="status"></span>
          </div>
          <div class="incident-scroll-tools">
            <p class="hint">Use Shift + mouse wheel, the horizontal scrollbar, or the arrow buttons to view all columns.</p>
            <div class="incident-scroll-buttons">
              <button type="button" class="btn ghost mini" id="incident-scroll-left" aria-label="Scroll incident columns left">&#8592;</button>
              <button type="button" class="btn ghost mini" id="incident-scroll-right" aria-label="Scroll incident columns right">&#8594;</button>
            </div>
          </div>
          <div id="incident-list" class="incident-table-wrap" aria-label="Incident threads"></div>
          <div class="row-actions">
            <button type="button" class="btn ghost" id="load-more-incidents">Load more</button>
          </div>
        </div>
      </div>
  </div>

  <dialog class="activity-dialog" aria-labelledby="activity-title" id="cmdlog">
    <div class="panel-head"><h2 id="activity-title">Command activity (az CLI / REST calls)</h2><button type="button" id="activity-close" class="btn ghost mini" autofocus aria-label="Close command activity">Close</button></div>
    <div class="cmd-list" id="cmd-list" tabindex="0" aria-label="Command execution log"></div>
  </dialog>
  <dialog class="activity-dialog" aria-labelledby="automation-confirm-title" id="automation-command-dialog">
    <h2 id="automation-confirm-title">Confirm task action</h2>
    <p id="automation-confirm-message"></p>
    <p class="hint" id="automation-confirm-agent"></p>
    <div class="row-actions">
      <button type="button" class="btn ghost" id="automation-confirm-cancel" autofocus>Cancel</button>
      <button type="button" class="btn" id="automation-confirm-submit">Confirm</button>
    </div>
  </dialog>
  <div class="footer-meta">
    <div class="build-stamp">Azure SRE Agent v${STUDIO_VERSION} &middot; rev ${STUDIO_REVISION}</div>
    <a class="feedback-link" href="${feedbackUrl.replaceAll("&", "&amp;")}" target="_blank" rel="noopener noreferrer">Send feedback</a>
  </div>

<script>
(function () {
  var subscriptionPicker = null;
  var subscriptionPickerDisposed = false;
  var subscriptionRevision = 0;
  var subscriptionPickerLoad = import('./canvas-ui/azure-subscription-picker.mjs').then(function (module) {
    if (subscriptionPickerDisposed) return;
    subscriptionPicker = module.createAzureSubscriptionPicker({
      id: 'sre-subscription-picker',
      trigger: document.getElementById('sub-select'),
      triggerVariant: 'field',
      selectionMode: 'multiple',
      statusMount: document.getElementById('subscription-status'),
      transport: function () { return postJson('/subscriptions/refresh', {}, false).then(function (value) {
        subscriptionRevision = Math.max(subscriptionRevision, value.result.revision);
        return value.result;
      }); },
      onApply: function (scope) {
        return postJson('/subscriptions/select', { scope: Object.assign({}, scope, { revision: subscriptionRevision }) }, false)
          .then(function (value) {
            state.discoveryScope = value.result.scope;
            subscriptionPicker.setState({ scope: state.discoveryScope });
          });
      }
    });
    if (state) renderSubscriptionScope(state);
  }).catch(function (error) { setStatus('Could not load the subscription picker: ' + error.message, true); });
  window.addEventListener('pagehide', function () { subscriptionPickerDisposed = true; subscriptionPicker?.destroy(); }, { once: true });
  function renderSubscriptionScope(s) {
    if (subscriptionPicker && s.subscriptionPicker) {
      subscriptionRevision = Math.max(subscriptionRevision, s.subscriptionPicker.revision);
      var scope = s.discoveryScope || null;
      if (!scope && s.subscription) {
        var selected = s.subscriptionPicker.accounts.filter(function (account) { return account.id.toLowerCase() === s.subscription.toLowerCase(); });
        if (selected.length === 1) scope = {
          tenantId: selected[0].tenantId, cloud: selected[0].cloud,
          subscriptionIds: [selected[0].id], subscriptions: [{ id: selected[0].id, name: selected[0].name }]
        };
      }
      subscriptionPicker.setState({
        accounts: s.subscriptionPicker.accounts, revision: s.subscriptionPicker.revision,
        scope: scope
      });
    }
    document.getElementById('subscription-discovery-status').textContent = s.discoveryLoading
      ? 'Discovering agents in selected subscriptions. Your active thread is unchanged.'
      : s.discoveryError || '';
  }
  ${THREAD_CLIENT_HELPERS}
  var completionApi = ${composerCompletionBrowserSource()};
  var automationApi = ${automationBrowserSource()};
  var formatAutomationSchedule = ${automationScheduleBrowserSource()};
  var automationTaskRevision = ${automationTaskRevisionBrowserSource()};
  var colorMode = matchMedia('(prefers-color-scheme: dark)');
  function syncColorMode() {
    if (!document.documentElement.hasAttribute('data-theme-tone')) {
      document.documentElement.dataset.colorMode = colorMode.matches ? 'dark' : 'light';
    }
  }
  syncColorMode();
  colorMode.addEventListener('change', syncColorMode);
  var state = { agents: [], threads: [], incidents: [], scheduledTasks: [], memoryResults: [], connectors: [], connectorGateways: [], connectorNamespaceMcps: [], kustoResources: [] };
  var draftThread = null;
  var lastTranscriptKey = '';
  var favoritePending = false;
  var favoriteFeedback = '';
  var connectionMode = null;
  var connectionModeChosen = false;
  var connectionPending = false;
  function setConnectionMode(mode, chosen) {
    connectionMode = mode;
    if (chosen) connectionModeChosen = true;
    document.querySelectorAll('[data-connection-mode]').forEach(function (tab) {
      var active = tab.dataset.connectionMode === mode;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      document.getElementById(tab.getAttribute('aria-controls')).hidden = !active;
    });
  }
  document.querySelector('.connection-tabs').addEventListener('click', function (event) {
    var tab = event.target.closest('[data-connection-mode]');
    if (tab) setConnectionMode(tab.dataset.connectionMode, true);
  });
  document.querySelector('.connection-tabs').addEventListener('keydown', function (event) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    var mode = event.key === 'Home' ? 'subscription' : event.key === 'End' ? 'external'
      : connectionMode === 'external' ? 'subscription' : 'external';
    setConnectionMode(mode, true);
    document.querySelector('[data-connection-mode="' + mode + '"]').focus();
  });
  var selectedIncidentId = '';
  var incidentReturnState = null;
  var incidentQueryTimer = null;
  var incidentViewKey = '';
  var incidentSort = { key: '', direction: 'ascending' };
  var replyPending = false;
  var completionScopeKey = '';
  function createAutomationViewState(agentKey, generation) {
    return { agentKey: agentKey, generation: generation, selection: null, detailOpen: false, query: '', status: 'all',
      error: '', pending: false, scroll: 0, history: null, historyError: '', historyPending: false,
      historyRequest: 0, runStatus: 'all', runSort: 'descending', runPending: false };
  }
  var automationView = createAutomationViewState(null, 0);
  var automationRunRows = [];
  var automationSelectedTask = null;
  var automationReturnState = null;
  var automationRows = [];
  var NEW_THREAD_TEMPLATE = 'Investigate a failing app or service:\\n\\nResource / service:\\nSymptoms:\\nWhen it started:\\nRecent changes or deployments:\\nWhat I already checked:';
  var configCard = document.getElementById('azure-config-card');
  var configSummaryTouched = false;
  configCard.querySelector('summary').addEventListener('click', function () { configSummaryTouched = true; });
  var activityDialog = document.getElementById('cmdlog');
  var activityTrigger = document.getElementById('activity-trigger');
  activityTrigger.addEventListener('click', function () {
    if (!activityDialog.open) activityDialog.showModal();
    activityTrigger.setAttribute('aria-expanded', 'true');
  });
  document.getElementById('activity-close').addEventListener('click', function () { activityDialog.close(); });
  activityDialog.addEventListener('close', function () {
    activityTrigger.setAttribute('aria-expanded', 'false');
    activityTrigger.focus({ preventScroll: true });
  });
  activityDialog.addEventListener('keydown', function (event) {
    if (event.key !== 'Tab') return;
    var items = Array.from(activityDialog.querySelectorAll('button:not(:disabled), a[href], [tabindex="0"]')).filter(function (item) { return item.getClientRects().length; });
    var first = items[0], last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  activityDialog.addEventListener('click', function (event) {
    if (event.target !== activityDialog) return;
    var bounds = activityDialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) activityDialog.close();
  });

  var threadsCard = document.getElementById('threads-card');
  function syncThreadRail() {
    var summary = threadsCard.querySelector('summary');
    var label = threadsCard.open ? 'Collapse Threads' : 'Open Threads';
    summary.setAttribute('aria-label', label);
    summary.title = label;
  }
  threadsCard.addEventListener('toggle', syncThreadRail);
  syncThreadRail();

  function connectionKey(agent) {
    if (!agent) return '';
    return agent.external || agent.kind === 'external' ? 'external:' + String(agent.endpoint || '').toLowerCase()
      : 'native:' + String(agent.id || '').toLowerCase();
  }
  function renderFavorites(s) {
    var currentSaved = (s.favorites || []).some(function (item) { return connectionKey(item) === connectionKey(s.agent); });
    var star = document.getElementById('agent-favorite');
    star.hidden = !s.agent;
    star.setAttribute('aria-disabled', String(!s.agent || Boolean(s.favoritesError) || favoritePending));
    star.setAttribute('aria-busy', String(favoritePending));
    star.textContent = currentSaved ? '\\u2605' : '\\u2606';
    star.setAttribute('aria-pressed', String(currentSaved));
    star.setAttribute('aria-label', (currentSaved ? 'Remove connected agent from' : 'Add connected agent to') + ' Favorites');
    var error = document.getElementById('favorites-error');
    error.textContent = s.favoritesError || '';
    error.hidden = !s.favoritesError;
    document.getElementById('favorite-write-status').textContent = favoriteFeedback;
    document.getElementById('favorite-write-status').hidden = !favoriteFeedback;
  }
  function toggleFavorite(agent) {
    if (favoritePending || !agent || state.favoritesError) return;
    var key = connectionKey(agent);
    var saved = (state.favorites || []).some(function (item) {
      return connectionKey(item) === key;
    });
    favoritePending = true;
    favoriteFeedback = (saved ? 'Removing ' : 'Saving ') + agent.name + '\u2026';
    renderFavorites(state);
    renderAgentPickers(state);
    postJson(saved ? '/remove-favorite' : '/add-favorite', saved ? { key: key }
      : agent.external ? { key: key } : { name: agent.name, resourceId: agent.id })
      .then(function (response) {
        if (Array.isArray(response.result)) state.favorites = response.result;
        favoriteFeedback = saved ? 'Removed from Favorites.' : 'Saved to Favorites.';
      })
      .catch(function (error) { favoriteFeedback = 'Could not update Favorite: ' + error.message; setStatus(favoriteFeedback, true); })
      .finally(function () { favoritePending = false; renderFavorites(state); renderAgentPickers(state); });
  }
  document.getElementById('agent-favorite').addEventListener('click', function () { toggleFavorite(state.agent); });
  var agentSwitcher = document.getElementById('agent-switcher');
  var agentMenu = document.getElementById('agent-switcher-menu');
  function closeAgentMenu(restoreFocus) {
    agentMenu.hidden = true;
    agentSwitcher.setAttribute('aria-expanded', 'false');
    if (restoreFocus) agentSwitcher.focus();
  }
  function renderAgentHeader(s) {
    document.getElementById('agent-context').hidden = !s.agent && !(s.favorites || []).length && !(s.agents || []).length;
    var name = agentSwitcher.querySelector('.agent-switcher-name');
    if (!name) {
      agentSwitcher.innerHTML = '<span class="agent-switcher-name"></span><span class="agent-chevron"></span>';
      name = agentSwitcher.querySelector('.agent-switcher-name');
      installAgentChevrons();
    }
    name.textContent = s.agent ? s.agent.name : 'Choose an agent';
    agentSwitcher.setAttribute('aria-label', s.agent ? 'Current agent: ' + s.agent.name + '. Switch agent' : 'Choose an agent');
    agentSwitcher.disabled = Boolean(s.busy);
    if (!s.agent && !(s.favorites || []).length && !(s.agents || []).length) closeAgentMenu(false);
    renderAgentPickers(s);
  }
  var agentIconFactory;
  function installAgentChevrons() {
    if (!agentIconFactory) return;
    document.querySelectorAll('.agent-chevron').forEach(function (slot) { slot.replaceChildren(agentIconFactory('chevron-down', document)); });
  }
  import('./canvas-ui/icons.mjs').then(function (module) { agentIconFactory = module.createIcon; installAgentChevrons(); })
    .catch(function (error) { setStatus('Could not load picker icons: ' + error.message, true); });
  function pickerRows(s, nativeOnly) {
    var favorites = (s.favorites || []).filter(function (agent) { return !nativeOnly || agent.kind !== 'external'; });
    var keys = favorites.map(connectionKey);
    var discovered = (s.agents || []).filter(function (agent) { return !agent.external && !keys.includes(connectionKey(agent)); });
    function row(agent, saved) {
      var key = connectionKey(agent);
      var external = agent.external || agent.kind === 'external';
      var subId = agent.subscription || agent.subscriptionId || String(agent.id || '').split('/')[2] || '';
      var sub = (s.subscriptions || []).concat(s.discoveryScope?.subscriptions || []).find(function (item) { return String(item.id).toLowerCase() === subId.toLowerCase(); });
      var label = agent.name + ' \xB7 ' + (external ? 'External agent' : (agent.resourceGroup || 'Azure agent') + (subId ? ' \xB7 ' + (sub ? sub.name : subId) : ''));
      var attributes = ' data-menu-key="' + escapeHtml(key) + '" data-agent-id="' + escapeHtml(agent.id || '') + '" data-agent-name="' + escapeHtml(agent.name) + '"';
      return '<div class="agent-picker-row" role="none"><button type="button" class="agent-option" role="menuitem" tabindex="-1"' + attributes +
        (saved ? ' data-favorite-key="' + escapeHtml(key) + '"' : '') +
        ' aria-current="' + String(key === connectionKey(s.agent)) + '" title="' + escapeHtml(external ? agent.endpoint : agent.id) + '"' +
        (s.busy || connectionPending ? ' disabled' : '') + '>' + escapeHtml(label) + '</button>' +
        '<button type="button" class="picker-star" role="menuitemcheckbox" tabindex="-1"' + attributes +
        ' aria-checked="' + saved + '" aria-pressed="' + saved + '" aria-disabled="' + Boolean(favoritePending || s.favoritesError) +
        '" aria-busy="' + favoritePending + '" aria-label="' + escapeHtml((saved ? 'Remove ' : 'Add ') + label + (saved ? ' from' : ' to') + ' Favorites') + '">' +
        (saved ? '\\u2605' : '\\u2606') + '</button></div>';
    }
    var discoveryLabel = s.discoveryScope ? 'Agents in selected subscriptions' : 'Agents in this subscription';
    return (favorites.length ? '<div role="group" aria-label="Favorites"><div class="agent-menu-label" role="presentation">Favorites</div>' + favorites.map(function (agent) { return row(agent, true); }).join('') + '</div>' : '') +
      '<div role="group" aria-label="' + discoveryLabel + '"><div class="agent-menu-label" role="presentation">' + discoveryLabel + '</div>' +
      discovered.map(function (agent) { return row(agent, false); }).join('') + '</div>';
  }
  function renderAgentPickers(s) {
    ['agent-menu-items', 'agent-options'].forEach(function (id) {
      var container = document.getElementById(id);
      var config = id === 'agent-menu-items' ? document.getElementById('agent-menu-config') : null;
      var active = container.contains(document.activeElement) || document.activeElement === config ? document.activeElement : null;
      var key = active && active.dataset.menuKey;
      var star = active && active.classList.contains('picker-star');
      var scroll = container.scrollTop;
      container.innerHTML = pickerRows(s, id === 'agent-options');
      var items = Array.from(container.querySelectorAll('button:not(:disabled)'));
      if (config) items.push(config);
      var replacement = items.find(function (item) { return item.dataset.menuKey === key && item.classList.contains('picker-star') === star; });
      if (active === config && config) replacement = config;
      items.forEach(function (item) { item.tabIndex = item === (replacement || items[0]) ? 0 : -1; });
      if (active && replacement) replacement.focus({ preventScroll: true });
      else if (active) (id === 'agent-options' ? document.getElementById('agent-select') : agentSwitcher).focus();
      container.scrollTop = scroll;
    });
  }
  function pickerKeydown(event, close) {
    if (event.key === 'Escape') { event.preventDefault(); close(true); return; }
    if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    var items = Array.from(event.currentTarget.querySelectorAll('button:not(:disabled)'));
    var index = items.indexOf(document.activeElement);
    var next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 :
      (index + (event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : items.length - 1)) % items.length;
    items.forEach(function (item, i) { item.tabIndex = i === next ? 0 : -1; });
    items[next]?.focus();
  }
  function pickerClick(event, close) {
    var button = event.target.closest('[data-menu-key]');
    if (!button || button.disabled) return;
    var key = button.dataset.menuKey;
    var saved = (state.favorites || []).find(function (agent) { return connectionKey(agent) === key; });
    var agent = saved || (state.agents || []).find(function (agent) { return connectionKey(agent) === key; });
    if (button.classList.contains('picker-star')) { toggleFavorite(agent); return; }
    if (connectionPending) return;
    connectionPending = true;
    document.getElementById('connection-feedback').hidden = true;
    renderAgentPickers(state);
    postJson(saved ? '/select-favorite' : '/select-agent', saved ? { key: key } : { name: agent.name, resourceId: agent.id })
      .then(function () { setConnectionMode(agent.external || agent.kind === 'external' ? 'external' : 'subscription', true); close(true); configCard.open = false; })
      .catch(function (error) { setStatus('Could not switch agent: ' + error.message, true); })
      .finally(function () { connectionPending = false; renderAgentPickers(state); });
  }
  agentSwitcher.addEventListener('click', function () {
    var open = agentMenu.hidden;
    agentMenu.hidden = !open;
    agentSwitcher.setAttribute('aria-expanded', String(open));
    if (open) agentMenu.querySelector('button:not(:disabled)').focus();
  });
  agentSwitcher.addEventListener('keydown', function (event) {
    if (event.key === 'ArrowDown') { event.preventDefault(); if (agentMenu.hidden) agentSwitcher.click(); }
    if (event.key === 'Escape') closeAgentMenu(true);
  });
  agentMenu.addEventListener('keydown', function (event) { pickerKeydown(event, closeAgentMenu); });
  agentMenu.addEventListener('click', function (event) {
    var button = event.target.closest('button');
    if (!button || button.disabled) return;
    if (button.id === 'agent-menu-config') {
      closeAgentMenu(true);
      configSummaryTouched = true;
      configCard.open = true;
      document.getElementById('connection-' + connectionMode + '-tab').focus();
      return;
    }
    pickerClick(event, closeAgentMenu);
  });
  document.addEventListener('click', function (event) {
    if (!event.composedPath().some(function (node) { return node.classList?.contains('agent-context'); })) closeAgentMenu(false);
  });
  document.addEventListener('focusin', function (event) {
    if (!event.target.closest('.agent-context')) closeAgentMenu(false);
  });

  function postJson(url, payload, reportError) {
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload || {}) })
      .then(function (r) {
        return r.json().then(function (data) {
          if (!r.ok || (data && data.ok === false)) throw new Error(data && data.message || 'Request failed (' + r.status + ').');
          return data;
        });
      })
      .catch(function (err) {
        if (reportError !== false) setStatus(err && err.message || String(err), true);
        throw err;
      });
  }
  function setStatus(text, isError) {
    var el = document.getElementById('status');
    el.textContent = text || '';
    var routine = /^(Loaded thread |Task run loaded\\.|Automation collections loaded\\.|Connected to |Connected\\.)(?!.*(?:failed|unavailable))/i.test(text || '') ||
      !state.busy && /^(Loading thread|Loading task run|Connectors loaded\\.)/i.test(text || '');
    el.hidden = !text || !isError && routine;
    el.className = 'status' + (isError ? ' err' : '');
    el.setAttribute('role', isError ? 'alert' : 'status');
    el.setAttribute('aria-live', isError ? 'assertive' : 'polite');
  }

  document.querySelectorAll('.tab').forEach(function (tab) {
    if (!tab.dataset.tab) {
      tab.addEventListener('click', function () { setStatus((tab.textContent || '').trim() + ' - coming soon.'); });
      return;
    }
    tab.addEventListener('click', function () { activateTab(tab.dataset.tab); });
    tab.addEventListener('keydown', function (event) {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      var tabs = Array.from(document.querySelectorAll('.tab[data-tab]'));
      var current = tabs.indexOf(tab);
      var next = event.key === 'Home' ? 0
        : event.key === 'End' ? tabs.length - 1
        : event.key === 'ArrowRight' ? (current + 1) % tabs.length
        : (current + tabs.length - 1) % tabs.length;
      event.preventDefault();
      activateTab(tabs[next].dataset.tab);
      tabs[next].focus();
    });
  });
  var threadSearch = { open: false, query: '', results: null, busy: false, error: '', generation: 0, agentKey: '' };
  document.getElementById('search-threads').addEventListener('click', function () {
    activateTab('threads');
    if (!threadsCard.open) threadsCard.open = true;
    threadSearch.open = true;
    renderThreadSearch();
    document.getElementById('thread-search-query').focus();
  });
  function renderThreadSearch() {
    document.getElementById('thread-search-panel').hidden = !threadSearch.open;
    var feedback = document.getElementById('thread-search-feedback');
    var label = state.agent && state.agent.external ? 'Matching titles across the agent (latest 25 matches).'
      : 'Search only the threads currently loaded in this panel.';
    feedback.textContent = threadSearch.error || (threadSearch.busy ? 'Searching thread titles...' :
      threadSearch.results ? threadSearch.results.length + ' matching thread(s). ' + label : label);
    feedback.className = 'hint' + (threadSearch.error ? ' err' : '');
    var submit = document.getElementById('thread-search-submit');
    submit.disabled = threadSearch.busy;
  }
  function clearThreadSearch() {
    threadSearch.generation++;
    threadSearch.open = false;
    threadSearch.query = '';
    threadSearch.results = null;
    threadSearch.busy = false;
    threadSearch.error = '';
    document.getElementById('thread-search-query').value = '';
    renderBody(state);
  }
  document.getElementById('thread-search-clear').addEventListener('click', clearThreadSearch);
  document.getElementById('thread-search-query').addEventListener('input', function () {
    threadSearch.generation++;
    threadSearch.query = this.value;
    threadSearch.results = null;
    threadSearch.busy = false;
    threadSearch.error = '';
    renderBody(state);
  });
  document.getElementById('thread-search-query').addEventListener('keydown', function (event) {
    if (event.key === 'Enter') { event.preventDefault(); submitThreadSearch(); }
    if (event.key === 'Escape') clearThreadSearch();
  });
  document.getElementById('thread-search-submit').addEventListener('click', submitThreadSearch);
  function submitThreadSearch() {
    var query = document.getElementById('thread-search-query').value.trim();
    var generation = ++threadSearch.generation;
    threadSearch.results = null;
    threadSearch.query = query;
    threadSearch.error = '';
    if (!query || query.length > 120) {
      threadSearch.error = 'Enter a thread title search of 1 to 120 characters.';
      renderBody(state);
      return;
    }
    if (!state.agent) {
      threadSearch.error = 'Select an SRE Agent first.';
      renderBody(state);
      return;
    }
    if (!state.agent.external) {
      threadSearch.results = (state.threads || []).filter(function (thread) {
        return threadLabel(thread).toLowerCase().includes(query.toLowerCase());
      });
      renderBody(state);
      return;
    }
    threadSearch.busy = true;
    renderBody(state);
    postJson('/search-threads', { query: query }, false).then(function (response) {
      if (generation !== threadSearch.generation) return;
      threadSearch.results = response.result.threads;
      threadSearch.busy = false;
      renderBody(state);
    }).catch(function (error) {
      if (generation !== threadSearch.generation) return;
      threadSearch.error = 'Thread search failed: ' + error.message;
      threadSearch.busy = false;
      renderBody(state);
    });
  }
  function activateTab(name) {
    if (replyCompletion) replyCompletion.dismiss();
    if (document.querySelector('.tab[data-tab="' + name + '"]')?.disabled) return;
    document.querySelectorAll('.tab[data-tab]').forEach(function (t) {
      var selected = t.dataset.tab === name;
      t.classList.toggle('active', selected);
      t.setAttribute('aria-selected', String(selected));
      t.tabIndex = selected ? 0 : -1;
    });
    document.querySelectorAll('.tabpage').forEach(function (p) {
      var selected = p.dataset.page === name;
      p.classList.toggle('active', selected);
      p.hidden = !selected;
    });
    if (name === 'incidents') requestAnimationFrame(syncIncidentLayout);
  }

  // Threads returned by GET /api/v1/threads sometimes carry title/startMessage/
  // lastMessage as nested message objects (e.g. { text, author, timeStamp, ... }) rather
  // than plain strings, depending on the SRE Agent API version. Concatenating one of those
  // objects straight into a template string stringifies it as the literal text
  // "[object Object]" - extract the actual text field defensively so the thread list always
  // shows a readable label.
  function textOf(value) {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object') return value.text || value.content || value.message || '';
    return String(value);
  }
  function threadLabel(t) {
    return textOf(t.title) || textOf(t.startMessage) || textOf(t.lastMessage) || t.id || t.threadId || 'thread';
  }
  // Thread "status" isn't always a plain string - the SRE Agent data-plane API
  // can return a nested { actionsStatus: {...}, incidentStatus: { status, ... } }
  // object instead, which used to render as literal "[object Object]" next to
  // every thread. Pull a sensible string out of either shape.
  function threadStatusLabel(t) {
    var currentActivity = threadActivity(t);
    if (currentActivity.label) return currentActivity.label;
    var s = t && t.status;
    if (s == null) return '';
    if (typeof s === 'string') return s;
    if (typeof s === 'object') {
      var incident = (s.incidentStatus && s.incidentStatus.status) || '';
      if (incident) return incident;
      if (s.actionsStatus && s.actionsStatus.hasCriticalActions) return 'action needed';
      if (s.actionsStatus && s.actionsStatus.hasWarningActions) return 'warning';
      return '';
    }
    return String(s);
  }
  function threadKind(thread) {
    var source = [thread && thread.type, thread && thread.source, thread && thread.threadOrigin].map(function (value) { return typeof value === 'string' ? value : ''; }).join(' ').toLowerCase();
    if ((thread && (thread.incidentId || thread.incidentDetails || thread.incidentStatus ||
      thread.status && typeof thread.status === 'object' && thread.status.incidentStatus)) || source.includes('incident')) return 'incident';
    if ((thread && (thread.scheduledTaskId || thread.triggerType === 'ScheduledTask')) || source.includes('scheduled')) return 'scheduled';
    return 'thread';
  }
  function threadNeedsAttention(thread) {
    var actions = thread && thread.status && typeof thread.status === 'object' && thread.status.actionsStatus;
    return threadActivity(thread).state.startsWith('waiting-') ||
      Boolean(actions && (actions.hasCriticalActions || actions.hasWarningActions)) ||
      /^(action needed|warning|pendingauthorization|waitingforuser|waiting for user)$/i.test(threadStatusLabel(thread));
  }
  function threadActivity(thread) {
    var read = state && state.threadRead;
    if (read && read.threadId === threadId(thread)) {
      if (read.error) return { state: 'unavailable', label: 'Status unavailable' };
      if (read.loading) return { state: 'loading', label: 'Loading thread...' };
    }
    return deriveThreadActivity(thread);
  }
  function renderRowList(el, items, labelFn, onClick, activeId) {
    var focusedId = el.contains(document.activeElement) && document.activeElement.getAttribute('data-item-id');
    el.innerHTML = '';
    if (!items || !items.length) {
      el.innerHTML = '<div class="status">Nothing here yet.</div>';
      return;
    }
    var activeRow = null;
    items.forEach(function (item, index) {
      var row = document.createElement('div');
      var itemId = item.id || item.threadId || '';
      var isActive = Boolean(activeId && itemId === activeId);
      row.className = 'row-item' + (isActive ? ' active' : '');
      row.innerHTML = labelFn(item);
      if (onClick) {
        row.setAttribute('role', 'option');
        row.setAttribute('aria-selected', String(isActive));
        row.setAttribute('data-item-id', itemId);
        row.tabIndex = isActive || (!activeId && index === 0) ? 0 : -1;
        row.addEventListener('click', function () { onClick(item); });
        row.addEventListener('keydown', function (event) {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onClick(item);
            return;
          }
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
            event.preventDefault();
            var options = Array.from(el.querySelectorAll('[role="option"]'));
            var current = options.indexOf(row);
            var next = event.key === 'Home' ? 0
              : event.key === 'End' ? options.length - 1
              : event.key === 'ArrowDown' ? Math.min(options.length - 1, current + 1)
              : Math.max(0, current - 1);
            options.forEach(function (option, optionIndex) { option.tabIndex = optionIndex === next ? 0 : -1; });
            options[next].focus();
          }
        });
      }
      if (isActive) activeRow = row;
      el.appendChild(row);
    });
    if (focusedId) {
      var restored = Array.from(el.querySelectorAll('[role="option"]')).find(function (row) {
        return row.getAttribute('data-item-id') === focusedId;
      });
      if (restored) {
        Array.from(el.querySelectorAll('[role="option"]')).forEach(function (row) { row.tabIndex = row === restored ? 0 : -1; });
        restored.focus({ preventScroll: true });
      }
    }
    if (activeRow) activeRow.scrollIntoView({ block: 'nearest' });
  }

  function render(s) {
    state = s;
    setStatus(s.status, Boolean(s.error));
    if (s.error) setStatus(s.error, true);
    var scheduledTasksAccess = document.getElementById('scheduled-tasks-access');
    scheduledTasksAccess.textContent = s.scheduledTasksError || '';
    scheduledTasksAccess.hidden = !s.scheduledTasksError;
    // Guard the whole render body: if any one section throws on an unexpected
    // message/thread shape, we must still reach scheduleThreadPoll() below or
    // the poll loop silently dies and the active thread pane looks "stuck"
    // forever even though the agent keeps working server-side.
    try {
      renderBody(s);
    } catch (err) {
      console.error('render() failed', err);
      setStatus('UI render error: ' + (err && err.message || err), true);
    } finally {
      scheduleThreadPoll(displayedActiveThread(s, draftThread));
    }
  }
  function renderBody(s) {
    if (connectionMode === null || (!connectionModeChosen && s.agent)) setConnectionMode(s.agent && s.agent.external ? 'external' : 'subscription');
    renderFavorites(s);
    renderAgentHeader(s);
    renderAutomation(s);
    syncSkillCatalogScope(s);
    var currentAgentKey = connectionKey(s.agent) + '|' + (s.subscription || '');
    var nextCompletionScope = currentAgentKey + '|' + threadId(displayedActiveThread(s, draftThread));
    if (completionScopeKey !== nextCompletionScope) {
      completionScopeKey = nextCompletionScope;
      if (replyCompletion) replyCompletion.dismiss();
    }
    if (threadSearch.agentKey !== currentAgentKey) {
      threadSearch.agentKey = currentAgentKey;
      threadSearch.generation++;
      threadSearch.results = null;
      threadSearch.busy = false;
      threadSearch.error = '';
      document.getElementById('thread-filter').value = 'all';
      document.getElementById('thread-type-filter').value = 'all';
      document.getElementById('thread-sort').value = 'recent';
    }
    renderThreadSearch();
    var external = Boolean(s.agent && s.agent.external);
    document.querySelectorAll('.tab[data-tab]').forEach(function (tab) {
      var unsupported = external && tab.dataset.tab !== 'threads' && tab.dataset.tab !== 'apps' &&
        tab.dataset.tab !== 'connectors' && tab.dataset.tab !== 'incidents' && tab.dataset.tab !== 'automation';
      tab.disabled = unsupported;
      tab.setAttribute('aria-disabled', String(unsupported));
      tab.title = unsupported ? 'This workspace is not available for external connections in the current canvas.'
        : tab.dataset.tab === 'automation' ? 'Scheduled tasks, runs, and confirmed task actions.'
        : tab.dataset.tab === 'incidents' ? 'Read-only incident list and details' : '';
    });
    if (external && document.querySelector('.tab.active[data-tab]')?.disabled) activateTab('threads');

    renderSubscriptionScope(s);

    var agents = (s.agents || []).filter(function (agent) { return !agent.external; });
    var nativeFavorites = (s.favorites || []).filter(function (agent) { return agent.kind === 'native'; });
    var selectedAgent = s.agent && !s.agent.external && agents.concat(nativeFavorites).find(function (a) { return connectionKey(a) === connectionKey(s.agent); });
    var agentSelect = document.getElementById('agent-select');
    agentSelect.querySelector('.agent-picker-name').textContent = selectedAgent
      ? selectedAgent.name + ' (' + selectedAgent.resourceGroup + ')'
      : (agents.length ? 'Select an SRE Agent' : (s.subscription ? 'No agents in selected subscription' : 'Select a subscription above'));
    agentSelect.disabled = !agents.length && !nativeFavorites.length;
    agentSelect.dataset.value = selectedAgent ? selectedAgent.name : '';
    if (agents.length) agentSelect.removeAttribute('aria-describedby');
    else agentSelect.setAttribute('aria-describedby', 'agent-discovery-hint');
    var agentHint = document.getElementById('agent-discovery-hint');
    var selectedSub = (s.subscriptions || []).find(function (sub) { return sub.id === s.subscription; });
    agentHint.textContent = s.subscription
      ? 'No SRE Agents in ' + (selectedSub ? selectedSub.name + ' (' + s.subscription + ')' : s.subscription) +
        '. Choose another subscription above or open a shared agent.'
      : 'Select a subscription above to discover SRE Agents.';
    agentHint.hidden = agents.length > 0;
    renderAgentSummary(s);

    var appSubSelect = document.getElementById('app-sub-select');
    appSubSelect.innerHTML = (s.subscriptions || []).map(function (sub) {
      return '<option value="' + sub.id + '"' + (sub.id === (s.appSubscription || s.subscription) ? ' selected' : '') + '>' + sub.name + '</option>';
    }).join('') || '<option value="">No subscriptions</option>';

    var appSelect = document.getElementById('app-resource-select');
    var appPrevValue = appSelect.value;
    var appOptions = (s.appResources || []).map(function (r) {
      return '<option value="' + r.id + '">' + r.name + ' (' + r.kind + ', ' + r.resourceGroup + ')</option>';
    }).join('');
    appSelect.innerHTML = (appOptions
      ? '<option value="">Pick an app / cluster / sandbox in this subscription&hellip;</option>' + appOptions
      : '<option value="">No supported app resources found in this subscription</option>');
    // render() is called on every state broadcast (opening a thread, polling, sending a
    // message, etc.) - rebuilding this <select>'s options must not silently drop whatever
    // app the user already picked, or the "Diagnose a failing app" context looks like it
    // reset every time they click around Threads/Incidents/etc.
    if (appPrevValue && appSelect.querySelector('option[value="' + CSS.escape(appPrevValue) + '"]')) {
      appSelect.value = appPrevValue;
    }

    renderCmdLog(s.commands || []);

    var shownThreads = threadSearch.open && threadSearch.busy ? []
      : threadSearch.open && threadSearch.results !== null ? threadSearch.results : s.threads || [];
    shownThreads = shownThreads.map(function (thread) {
      return threadId(thread) === threadId(s.activeThread) ? Object.assign({}, thread, s.activeThread) : thread;
    });
    var filter = document.getElementById('thread-filter').value;
    var typeFilter = document.getElementById('thread-type-filter').value;
    var loadedCount = shownThreads.length;
    shownThreads = shownThreads.filter(function (thread) {
      return (typeFilter === 'all' || threadKind(thread) === typeFilter) &&
        (filter === 'focused' ? threadId(thread) === s.focusedThreadId :
        filter === 'attention' ? threadNeedsAttention(thread) : true);
    });
    document.getElementById('thread-filter-count').textContent = shownThreads.length + ' of ' + loadedCount + ' loaded threads';
    var sortedThreads = sortThreads(shownThreads);
    var sort = document.getElementById('thread-sort').value;
    if (sort === 'oldest') sortedThreads.reverse();
    if (sort === 'name') sortedThreads.sort(function (left, right) { return threadLabel(left).localeCompare(threadLabel(right)); });
    var displayedThreads = draftThread ? [draftThread].concat(sortedThreads) : sortedThreads;
    var activeThread = displayedActiveThread(s, draftThread);
    var threadList = document.getElementById('thread-list');
    renderRowList(threadList, displayedThreads, function (t) {
      var status = threadStatusLabel(t);
      var label = escapeHtml(threadLabel(t));
      return '<span class="thread-title" title="' + label + '">' + label + '</span>' +
        (status ? '<span class="thread-status" title="' + escapeHtml(status) + '">' + escapeHtml(status) + '</span>' : '');
    }, function (t) { openThread(t.id || t.threadId); }, activeThread && (activeThread.id || activeThread.threadId));
    if (threadSearch.open && threadSearch.busy && !displayedThreads.length) {
      threadList.textContent = 'Searching thread titles...';
    } else if (threadSearch.open && threadSearch.results !== null && !displayedThreads.length) {
      threadList.textContent = 'No matching thread titles. Clear search to show the loaded threads.';
    }

    var log = document.getElementById('thread-log');
    var currentActivity = threadActivity(activeThread);
    var activityNotice = document.getElementById('thread-activity');
    activityNotice.textContent = currentActivity.label;
    activityNotice.hidden = !currentActivity.label;
    activityNotice.title = s.threadRead && s.threadRead.threadId === threadId(activeThread) ? s.threadRead.error || '' : '';
    activityNotice.className = currentActivity.state === 'unavailable' || currentActivity.state === 'failed' ? 'status err' : 'hint';
    var transcriptKey = transcriptRenderKey(activeThread) + '|' + currentActivity.state;
    if (transcriptKey !== lastTranscriptKey) {
      renderChatLog(log, activeThread);
      lastTranscriptKey = transcriptKey;
    }
    var activeThreadId = threadId(activeThread);
    var focusedHere = Boolean(activeThreadId && s.focusedThreadId === activeThreadId);
    var focusButton = document.getElementById('focus-thread');
    focusButton.hidden = !activeThreadId || Boolean(activeThread && activeThread.draft);
    focusButton.textContent = focusedHere ? 'Unfocus' : 'Focus this thread';
    document.getElementById('back-to-incidents').hidden = !incidentReturnState;
    document.getElementById('back-to-automation-run').hidden = !automationReturnState ||
      automationReturnState.agentKey !== automationApi.automationAgentKey(s.agent, s.subscription);
    var focusBadge = document.getElementById('focus-badge');
    focusBadge.hidden = !s.focusedThreadId;
    var focusedThread = focusedHere ? activeThread : (s.threads || []).find(function (thread) { return threadId(thread) === s.focusedThreadId; });
    var focusActivity = focusedThread && threadActivity(focusedThread).label;
    focusBadge.textContent = s.focusedThreadId ? 'Focused: ' + (s.focusedThreadTitle || s.focusedThreadId) + (focusActivity ? ' \xB7 ' + focusActivity : '') : '';
    document.getElementById('thread-focus-strip').hidden = !s.focusedThreadId;
    document.getElementById('clear-thread-focus').disabled = Boolean(s.busy);

    renderIncidents(s);

    renderConnectors(s);
    renderConfigDrift(s.configDrift);
  }

  function renderIncidents(s) {
    var items = Array.isArray(s.incidents) ? s.incidents : [];
    var list = document.getElementById('incident-list');
    var nextViewKey = [
      s.agent && (s.agent.id || s.agent.endpoint || s.agent.name),
      s.incidentQuery || '',
      s.incidentStatusFilter || '',
    ].join('|');
    var sameView = nextViewKey === incidentViewKey;
    var priorScrollTop = sameView ? list.scrollTop : 0;
    var priorScrollLeft = sameView ? list.scrollLeft : 0;
    if (!sameView) {
      document.getElementById('incident-search').value = s.incidentQuery || '';
      document.getElementById('incident-status-filter').value = s.incidentStatusFilter || '';
    }
    incidentViewKey = nextViewKey;
    var error = document.getElementById('incidents-access');
    error.textContent = s.incidentsError || '';
    error.hidden = !s.incidentsError;
    var scope = document.getElementById('incidents-scope-note');
    scope.textContent = s.incidentsHasMore
      ? 'Server-filtered incident threads. ' + (s.incidentsNextSkip || 0) + ' matching rows scanned; load more for the next bounded page.'
      : 'Server-filtered agent-local incident threads.';
    var loadMore = document.getElementById('load-more-incidents');
    loadMore.hidden = !s.incidentsHasMore;
    loadMore.disabled = Boolean(s.busy);
    if (s.incidentsError) {
      document.getElementById('incident-status-count').textContent = 'Unavailable';
      document.getElementById('agent-status-count').textContent = 'Unavailable';
      document.getElementById('incident-result-count').textContent = 'Incident list unavailable';
      document.getElementById('incident-list').innerHTML =
        '<div class="status err">Could not load incidents. Refresh after resolving the access or service error.</div>';
      syncIncidentScrollButtons();
      return;
    }
    var counts = s.incidentCounts || {};
    document.getElementById('incident-status-count').innerHTML =
      incidentStatusLabel('Active', Number(counts.active || 0)) + incidentStatusLabel('Mitigated', Number(counts.mitigated || 0));
    document.getElementById('agent-status-count').innerHTML =
      incidentStatusLabel('Pending user input', Number.isFinite(counts.pendingUserInput) ? counts.pendingUserInput : 'Unavailable') +
      incidentStatusLabel('In progress', Number(counts.inProgress || 0)) + incidentStatusLabel('Completed', Number(counts.completed || 0));
    var filtered = sortIncidentRows(items, incidentSort);
    if (!filtered.some(function (item) { return item.id === selectedIncidentId; })) {
      selectedIncidentId = filtered[0] && filtered[0].id || '';
    }
    var isRefined = Boolean(s.incidentQuery || s.incidentStatusFilter);
    document.getElementById('search-incidents').disabled = Boolean(s.busy);
    document.getElementById('incident-result-count').textContent = s.busy && s.status === 'Filtering incidents...'
      ? 'Filtering incidents...'
      : isRefined
      ? items.length + ' matching incident' + (items.length === 1 ? '' : 's') +
        ' loaded \xB7 ' + Number(counts.total || 0) + ' total incidents'
      : items.length + ' of ' + Number(counts.total || items.length) + ' incident' +
        (Number(counts.total || items.length) === 1 ? '' : 's') + ' loaded';
    if (!filtered.length) {
      list.innerHTML = '<div class="status">' +
        (s.incidentsHasMore
          ? 'No incidents were returned in this page. More matching pages are available.'
          : 'No incident threads match this server-side search and status filter.') +
        '</div>';
      syncIncidentScrollButtons();
      return;
    }
    var value = function (item, key) { return escapeHtml(textOf(item[key]) || '\u2014'); };
    var columns = [
      ['id', 'Incident ID'], ['title', 'Title'], ['severity', 'Priority'],
      ['status', 'Incident status'], ['agentStatus', 'Agent status'],
      ['date', 'Created'], ['owningService', 'Owning service'],
      ['owningTeam', 'Owning team'], ['responsePlan', 'Response plan'],
    ];
    list.innerHTML = '<table class="incident-table"><thead><tr>' +
      columns.map(function (column) {
        var sorted = incidentSort.key === column[0];
        return '<th aria-sort="' + (sorted ? incidentSort.direction : 'none') + '">' +
          '<button type="button" class="incident-sort" data-sort-key="' + column[0] +
          '" title="Sort loaded incidents by ' + column[1] + '">' + column[1] +
          (sorted ? (incidentSort.direction === 'ascending' ? ' &#8593;' : ' &#8595;') : '') +
          '</button></th>';
      }).join('') +
      '</tr></thead><tbody>' + filtered.map(function (incident) {
        var active = incident.id === selectedIncidentId;
        return '<tr tabindex="0" data-incident-id="' + escapeHtml(incident.id) + '" aria-selected="' + active + '">' +
          '<td class="incident-id-cell" title="' + escapeHtml(incident.id) + '" aria-label="Incident ID ' +
            escapeHtml(incident.id) + '">' + escapeHtml(incident.id) + '</td>' +
          '<td class="incident-title-cell">' + value(incident, 'title') + '</td>' +
          '<td>' + value(incident, 'severity') + '</td><td>' + incidentStatusLabel(incident.status || 'Unknown') + '</td>' +
          '<td>' + incidentStatusLabel(incident.agentStatus || 'Unknown') + '</td><td>' + value(incident, 'date') + '</td>' +
          '<td>' + value(incident, 'owningService') + '</td><td>' + value(incident, 'owningTeam') + '</td>' +
          '<td>' + (incident.responsePlanUrl && /^https:\\/\\/sre\\.azure\\.com\\//.test(incident.responsePlanUrl)
            ? '<a class="incident-response-plan" href="' + escapeHtml(incident.responsePlanUrl) + '" target="_blank" rel="noopener noreferrer">' +
              value(incident, 'responsePlan') + '</a>' : value(incident, 'responsePlan')) + '</td></tr>';
      }).join('') + '</tbody></table>';
    function selectIncidentRow(row) {
      var incident = items.find(function (item) { return item.id === row.dataset.incidentId; });
      if (!incident || !incident.threadId) {
        setStatus('This incident does not expose a verified thread link.', true);
        return;
      }
      selectedIncidentId = incident.id;
      incidentReturnState = {
        query: document.getElementById('incident-search').value,
        status: document.getElementById('incident-status-filter').value,
        selectedId: incident.id,
        scrollTop: list.scrollTop,
        scrollLeft: list.scrollLeft,
      };
      activateTab('threads');
      threadsCard.open = false;
      syncThreadRail();
      document.getElementById('back-to-incidents').hidden = false;
      openThread(incident.threadId);
      document.getElementById('thread-detail').focus({ preventScroll: true });
    }
    list.querySelectorAll('.incident-sort').forEach(function (button) {
      button.addEventListener('click', function () {
        var key = button.dataset.sortKey;
        incidentSort = { key: key, direction: incidentSort.key === key && incidentSort.direction === 'ascending' ? 'descending' : 'ascending' };
        renderIncidents(state);
        list.querySelector('[data-sort-key="' + key + '"]').focus({ preventScroll: true });
      });
    });
    list.querySelectorAll('tbody tr').forEach(function (row) {
      row.addEventListener('click', function () { selectIncidentRow(row); });
      row.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        selectIncidentRow(row);
      });
    });
    list.querySelectorAll('.incident-response-plan').forEach(function (link) {
      link.addEventListener('click', function (event) { event.stopPropagation(); });
      link.addEventListener('keydown', function (event) { event.stopPropagation(); });
    });
    list.scrollTop = priorScrollTop;
    list.scrollLeft = priorScrollLeft;
    syncIncidentScrollButtons();
    syncIncidentLayout();
  }

  function sortIncidentRows(items, sort) {
    if (!sort.key) return items.slice();
    return items.map(function (item, index) { return { item: item, index: index }; }).sort(function (a, b) {
      var left = a.item[sort.key];
      var right = b.item[sort.key];
      var leftMissing = left == null || left === '';
      var rightMissing = right == null || right === '';
      if (leftMissing || rightMissing) return leftMissing === rightMissing ? a.index - b.index : leftMissing ? 1 : -1;
      var compared;
      if (sort.key === 'severity' && Number.isFinite(Number(left)) && Number.isFinite(Number(right))) {
        compared = Number(left) - Number(right);
      } else if (sort.key === 'date' && Number.isFinite(Date.parse(left)) && Number.isFinite(Date.parse(right))) {
        compared = Date.parse(left) - Date.parse(right);
      } else {
        compared = String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' });
      }

      return (sort.direction === 'descending' ? -compared : compared) || a.index - b.index;
    }).map(function (entry) { return entry.item; });
  }

  function syncIncidentLayout() {
    var page = document.getElementById('incidents-page');
    if (page.hidden) return;
    var panel = page.querySelector('.incident-panel');
    var footer = document.querySelector('.footer-meta');
    var reserved = footer.getBoundingClientRect().height + 48;
    panel.style.height = Math.max(420, window.innerHeight - panel.getBoundingClientRect().top - reserved) + 'px';
    // Narrow layouts stack the toolbar; grow so fixed controls never overflow onto the footer.
    var overflow = panel.scrollHeight - panel.clientHeight;
    if (overflow > 0) panel.style.height = (parseFloat(panel.style.height) + overflow) + 'px';
  }

  function incidentStatusLabel(label, count) {
    var normalized = String(label).toLowerCase().replace(/[\\s_-]/g, '');
    var tone = normalized === 'active' ? 'active' : normalized === 'mitigated' || normalized === 'resolved' ? 'mitigated'
      : normalized === 'pendinguserinput' ? 'pending' : normalized === 'inprogress' ? 'progress'
      : normalized === 'complete' || normalized === 'completed' ? 'complete' : '';
    var icon = tone === 'pending' ? '&#9650;' : tone === 'complete' ? '&#10003;' : '';
    return '<span class="incident-status-label">' + (tone ? '<span class="incident-status-icon ' + tone + '" aria-hidden="true">' + icon + '</span>' : '') +
      escapeHtml(label) + (count === undefined ? '' : ': ' + escapeHtml(String(count))) + '</span>';
  }

  function renderAgentSummary(s) {
    var summary = document.getElementById('agent-summary');
    if (!summary) return;
    var connection = document.getElementById('config-connection');
    var connectionText = !s.agent ? 'No agent connected'
      : s.agent.external
        ? [s.agent.name, s.agent.endpoint].filter(Boolean).join(' \xB7 ')
        : [s.agent.name, s.agent.resourceGroup].filter(Boolean).join(' \xB7 ') || s.agent.id || 'Agent details unavailable';
    if (connection.textContent !== connectionText) connection.textContent = connectionText;
    connection.title = s.agent && !s.agent.external ? s.agent.id || connectionText : connectionText;
    if (!s.agent) {
      summary.innerHTML = '<div class="hint">Select an SRE Agent to see connection details.</div>';
      return;
    }
    var items = s.agent.external
      ? [['Connection', 'External agent (threads and read-only incidents)'], ['Endpoint', s.agent.endpoint || 'unknown'],
        ['Portal', s.agent.portalUrl ? 'Registered external-agent link available' : 'Paste a portal link to open in Portal']]
      : [['Endpoint', s.agent.endpoint || 'unknown'],
        ['Resource group', s.agent.resourceGroup || 'unknown'],
        ['Provisioning', s.agent.provisioningState || 'unknown'],
        ['Connectors', String((s.connectors || []).length)],
        ['Subscription', s.subscription || 'unknown']];
    summary.innerHTML = '<div class="connection-grid">' + items.map(function (item) {
      return '<div class="connection-item"><span>' + item[0] + '</span><strong title="' + escapeHtml(item[1]) + '">' + escapeHtml(item[1]) + '</strong></div>';
    }).join('') + '</div>';
  }

  function renderConnectors(s) {
    var external = Boolean(s.agent && s.agent.external);
    document.getElementById('connector-external-note').hidden = !external;
    document.getElementById('connector-create-panel').hidden = external;
    document.getElementById('connector-access-error').textContent = s.connectorsError || '';
    document.getElementById('connector-access-error').hidden = !s.connectorsError;
    document.getElementById('refresh-connectors').disabled = !s.agent || Boolean(s.busy);
    var list = document.getElementById('connector-list');
    if (list) {
      var items = s.connectors || [];
      var namespaceMcps = external ? [] : s.connectorNamespaceMcps || [];
      if (!items.length && !namespaceMcps.length) {
        list.innerHTML = '<div class="status">' + (s.connectorsError ? 'Connector list unavailable.' : 'No connectors attached.') + '</div>';
      } else {
        var attachedHtml = items.map(function (c) {
          var policy = c.extendedProperties && c.extendedProperties.privateConnectorPolicy;
          var notice = '';
          if (policy) {
            notice = '<div class="hint" style="margin-top:.35rem">' +
              'Private-connector guardrail metadata is present. Invocation still requires verified signed user and thread claims.' +
              '</div>';
          }
          return '<div class="row-item" style="flex-direction:column;align-items:stretch;cursor:default">' +
            '<div style="display:flex;justify-content:space-between;gap:.5rem;align-items:center">' +
            '<div class="row-main"><span>' + escapeHtml(c.name || '') + '</span><span class="tag">' + escapeHtml(c.kind || 'connector') + '</span></div>' +
            '<div class="row-actions" style="flex:0 0 auto">' +
            (${PRIVATE_CONNECTORS_ENABLED ? "true" : "false"} && !external && !c.isRemoteMcp ? '<button class="btn danger mini detach-connector" data-name="' + escapeHtml(c.name || '') + '">Detach</button>' : '') +
            '</div></div>' +
            (external ? '<div class="hint">Status: ' + escapeHtml(c.status || 'Not checked') + ' \xB7 Source: ' + escapeHtml(c.source || 'Agent') + '</div>' +
              (c.statusError ? '<p class="status err">' + escapeHtml(c.statusError) + '</p>' : '') : '') +
            notice +
            '</div>';
        }).join('');
        var namespaceHtml = namespaceMcps.map(function (mcp) {
          return '<div class="row-item" style="flex-direction:column;align-items:stretch;cursor:default">' +
            '<div class="row-main"><span>' + escapeHtml(mcp.name || '') + '</span>' +
            '<span class="tag">' + (mcp.attached ? 'MCP attached' : 'MCP available') + '</span></div>' +
            '<div class="hint" style="margin-top:.35rem">' + escapeHtml(mcp.attachmentStatus || '') + '</div>' +
            (${PRIVATE_CONNECTORS_ENABLED ? "true" : "false"} && !mcp.attached && mcp.endpoint
              ? '<button class="btn mini attach-namespace-mcp" data-name="' + escapeHtml(mcp.name || '') + '">Attach</button>'
              : '') +
            '</div>';
        }).join('');
        list.innerHTML = attachedHtml + namespaceHtml;
      }
    }
    if (external) return;
    var connectorSubSelect = document.getElementById('connector-sub-select');
    if (connectorSubSelect) {
      var selectedConnectorSub = connectorSubSelect.value || s.connectorSubscription || '';
      connectorSubSelect.innerHTML = '<option value="">All accessible subscriptions</option>' + (s.subscriptions || []).map(function (sub) {
        return '<option value="' + sub.id + '"' + (sub.id === selectedConnectorSub ? ' selected' : '') + '>' + escapeHtml(sub.name) + '</option>';
      }).join('');
    }
    var clusterSelect = document.getElementById('kusto-cluster-select');
    var currentCluster = clusterSelect.value;
    clusterSelect.innerHTML = '<option value="">Pick a discovered cluster...</option>' + (s.kustoResources || []).map(function (c) {
      return '<option value="' + escapeHtml(c.id || '') + '">' + escapeHtml((c.name || c.clusterUrl || '') + ' (' + (c.resourceGroup || '') + ')') + '</option>';
    }).join('');
    if (currentCluster && clusterSelect.querySelector('option[value="' + CSS.escape(currentCluster) + '"]')) clusterSelect.value = currentCluster;
    fillKustoDatabases();
  }

  function selectedKustoCluster() {
    var clusterId = document.getElementById('kusto-cluster-select').value;
    return (state.kustoResources || []).find(function (c) { return c.id === clusterId; }) || null;
  }

  function fillKustoDatabases() {
    var cluster = selectedKustoCluster();
    var dbSelect = document.getElementById('kusto-database-select');
    var currentDb = dbSelect.value;
    var dbs = (cluster && cluster.databases) || [];
    dbSelect.innerHTML = '<option value="">Pick a discovered database...</option>' + dbs.map(function (d) {
      return '<option value="' + escapeHtml(d.name || '') + '">' + escapeHtml(d.name || '') + '</option>';
    }).join('');
    if (currentDb && dbSelect.querySelector('option[value="' + CSS.escape(currentDb) + '"]')) dbSelect.value = currentDb;
    if (cluster && cluster.clusterUrl) document.getElementById('kusto-cluster-url').value = cluster.clusterUrl;
  }

  function detachConnector(name) {
    if (!name) return;
    if (!confirm('Detach connector "' + name + '" from this SRE Agent?')) return;
    postJson('/detach-connector', { name: name });
  }

  // "Workspace <-> Azure config check": renders as soon as the diff comes
  // back (either from the standalone check button or as a side effect of
  // diagnoseApp), so this is an instant signal even before an investigation
  // thread exists - the user doesn't have to open the thread to see it.
  function renderConfigDrift(drift) {
    var el = document.getElementById('config-drift-result');
    if (!drift) { el.innerHTML = ''; return; }
    if (drift.error) {
      el.innerHTML = '<div class="tool-badge risk">Config check failed: ' + escapeHtml(drift.error) + '</div>';
      return;
    }
    var missing = drift.missingInAzure || [];
    var unused = drift.unusedInWorkspace || [];
    var html = '<div class="panel" style="margin-top:8px">';
    if (missing.length) {
      html += '<div class="tool-badge risk">' + missing.length + ' setting(s) missing in Azure</div>' +
        '<ul style="margin:6px 0 0 18px;padding:0;font-size:.8rem">' + missing.map(function (m) {
          var srcs = (m.sources || []).slice(0, 3).map(function (s) {
            return escapeHtml(s.file) + ':' + s.line;
          }).join(', ');
          return '<li><code>' + escapeHtml(m.settingName) + '</code> &mdash; referenced at ' + srcs + '</li>';
        }).join('') + '</ul>';
    } else {
      html += '<div class="tool-badge safe">No missing app settings found</div>';
    }
    if (unused.length) {
      html += '<div class="tool-badge done" style="margin-top:6px">' + unused.length + ' Azure setting(s) unused in workspace</div>';
    }
    html += '<div class="tool-badge done" style="margin-top:6px">' + (drift.matchedCount || 0) + ' matched</div>';
    html += '</div>';
    el.innerHTML = html;
  }

  function openThread(threadId) {
    if (!threadId) return;
    if (draftThread && threadId === draftThread.id) {
      draftThread.active = true;
      state.activeThread = draftThread;
      activateTab('threads');
      renderBody(state);
      return;
    }
    draftThread = null;
    postJson('/open-thread', { threadId: threadId });
  }

  // Continue observing blocked and quiet threads at a slower cadence so a gate
  // cleared elsewhere is discovered, without presenting that read as agent work.
  var threadPollTimer = null;
  var threadPollId = null;
  var threadPollLastKey = null;
  var threadPollStaleCount = 0;
  function threadHasInFlightWork(thread) {
    return threadActivity(thread).state === 'running';
  }
  function threadProgressKey(thread) {
    var msgs = (thread && thread.messages) || [];
    var last = msgs[msgs.length - 1];
    return msgs.length + '|' + (last && (last.id || last.timeStamp) || '');
  }
  function scheduleThreadPoll(thread) {
    var id = thread && (thread.id || thread.threadId);
    if (threadPollTimer) { clearTimeout(threadPollTimer); threadPollTimer = null; }
    if (thread && thread.draft) return;
    if (!id) { threadPollId = null; threadPollLastKey = null; threadPollStaleCount = 0; return; }
    var key = threadProgressKey(thread);
    if (id !== threadPollId) {
      // Switched to a different thread - reset progress tracking.
      threadPollId = id;
      threadPollLastKey = key;
      threadPollStaleCount = 0;
    } else if (key !== threadPollLastKey) {
      threadPollLastKey = key;
      threadPollStaleCount = 0;
    } else if (threadPollStaleCount < 10) {
      threadPollStaleCount++;
    }
    var inFlight = threadHasInFlightWork(thread);
    // NOTE: never fully stop polling an open thread. The real SRE Agent can go
    // quiet for a long stretch (thinking, waiting on a slow tool call, etc.)
    // with no in-flight exec visible in our snapshot in between - if we stop
    // polling here the active thread pane silently "falls behind" forever
    // even though the agent keeps advancing server-side (only a manual
    // reselect of the thread would resume updates). Instead, back off to a
    // slower cadence the longer nothing changes, but keep polling for as
    // long as this thread stays open/active.
    var delay = inFlight ? 3000
      : threadPollStaleCount >= 10 ? 15000
      : threadPollStaleCount >= 3 ? 7000
      : 3000;
    threadPollTimer = setTimeout(function () {
      if (threadPollId === id) postJson('/open-thread', { threadId: id, poll: true });
    }, delay);
  }

  function toggleTask(task) {
    var paused = (task.status || '').toLowerCase() === 'paused';
    postJson(paused ? '/resume-scheduled-task' : '/pause-scheduled-task', { taskId: task.id || task.name });
  }

  function renderAutomation(s) {
    var agentKey = automationApi.automationAgentKey(s.agent, s.subscription);
    if (automationView.agentKey !== agentKey) {
      if (document.getElementById('automation-command-dialog').open) document.getElementById('automation-command-dialog').close();
      automationView = createAutomationViewState(agentKey, automationView.generation + 1);
      automationReturnState = null;
      automationSelectedTask = null;
      document.getElementById('back-to-automation-run').hidden = true;
      document.getElementById('automation-search').value = '';
      document.getElementById('automation-status').value = 'all';
    }
    var catalog = automationApi.normalizeAutomationCatalog({
      agent: s.agent, subscription: s.subscription, scheduledTasks: s.scheduledTasks,
      scheduledTasksError: automationView.error || s.scheduledTasksError,
      httpTriggers: s.httpTriggers, httpTriggersError: automationView.error || s.httpTriggersError,
      generation: automationView.generation
    });
    var source = catalog.sources.scheduled;
    var httpSource = catalog.sources.http;
    httpSource.invalid = (httpSource.invalid || 0) + (s.httpTriggersExcluded || 0);
    if (s.httpTriggersTruncated) catalog.truncated = true;
    var view = automationApi.filterAutomations(catalog, automationView);
    automationRows = view.items;
    var notice = document.getElementById('automation-notice');
    var error = automationView.error || s.scheduledTasksError;
    notice.className = source.status === 'failed' ? 'status err' : 'hint';
    notice.textContent = error || source.reason || (s.busy || automationView.pending ? 'Updating tasks. Showing the currently loaded list.' : '');
    if (catalog.truncated) notice.textContent += ' Only the first 100 loaded tasks are shown.';
    if (source.invalid) notice.textContent += ' ' + source.invalid + ' invalid, unsupported, or duplicate records were excluded.';
    var httpNotice = document.getElementById('automation-http-notice');
    httpNotice.className = httpSource.status === 'failed' ? 'status err' : 'hint';
    httpNotice.textContent = automationView.error || s.httpTriggersError || (httpSource.status === 'available' ? '' :
      httpSource.status === 'failed' ? 'HTTP triggers unavailable: ' + httpSource.reason : 'HTTP triggers have not been loaded. Use Refresh Automation to read the collection.');
    if (httpSource.invalid) httpNotice.textContent += ' ' + httpSource.invalid + ' invalid, unsupported, or duplicate HTTP records were excluded.';
    document.getElementById('automation-refresh').disabled = !agentKey || s.busy || automationView.pending;
    document.getElementById('automation-count').textContent = view.items.length + ' matching / ' +
      (source.status === 'available' ? source.items.length + ' loaded scheduled tasks' : 'Scheduled tasks unavailable') + ' \xB7 ' +
      (httpSource.status === 'available' ? httpSource.items.length + ' loaded HTTP triggers' : 'HTTP triggers unavailable');
    document.getElementById('automation-count').hidden = source.status !== 'available' && httpSource.status !== 'available';
    var tableWrap = document.getElementById('automation-table-wrap');
    var oldScroll = tableWrap.scrollTop;
    document.getElementById('automation-rows').innerHTML = view.items.map(function (item, index) {
      var selected = automationView.selection && item.key === automationView.selection.key;
      var status = item.status === 'on' ? 'On' : item.status === 'off' ? 'Off' : 'Unknown' + (item.rawStatus ? ' (' + item.rawStatus + ')' : '');
      var name = item.key ? '<button type="button" class="automation-open" data-automation-index="' + index + '">' + escapeHtml(item.name) + '</button>' : escapeHtml(item.name);
      var schedule = formatAutomationSchedule(item);
      return '<tr aria-current="' + Boolean(selected) + '"><td>' + name + '</td><td>' + escapeHtml(status) +
        '</td><td>' + (item.type === 'http' ? 'HTTP trigger' : 'Scheduled task') + '</td><td title="' + escapeHtml(schedule.title) + '">' + escapeHtml(item.type === 'http' ? 'HTTP' : schedule.label) + '</td><td>' +
        escapeHtml(item.createdBy || 'Not provided') + '</td><td>' + escapeHtml(item.lastRun || 'Not provided') +
        '</td><td>' + (item.completedRuns === null ? 'Not provided' : item.completedRuns) + '</td></tr>';
    }).join('');
    tableWrap.scrollTop = oldScroll;
    document.getElementById('automation-empty').textContent = view.items.length ? ''
      : source.status !== 'available' || httpSource.status !== 'available' ? 'The Automation list is incomplete or unavailable. See each collection above.'
        : s.busy || automationView.pending ? 'Loading scheduled tasks...'
          : automationView.query || automationView.status !== 'all' ? 'No loaded tasks match these filters.'
            : source.invalid || httpSource.invalid ? 'No readable automations remain after unsupported records were excluded.' : 'No automations in the loaded collections.';
    document.getElementById('automation-master').hidden = automationView.detailOpen;
    document.getElementById('automation-detail').hidden = !automationView.detailOpen;
    if (automationView.detailOpen) {
      var result = automationApi.selectAutomation(catalog, automationView.selection, { agentKey: agentKey, generation: automationView.generation });
      var item = result.item;
      automationSelectedTask = item;
      document.getElementById('automation-name').textContent = item ? item.name : 'Task details unavailable';
      document.getElementById('automation-task-type').textContent = item ? item.type === 'scheduled' ? 'Scheduled task' : 'HTTP trigger' : '';
      var schedule = item && formatAutomationSchedule(item);
      document.getElementById('automation-task-summary').innerHTML = item ? '<span class="tag">' +
        escapeHtml(item.status === 'on' ? 'On' : item.status === 'off' ? 'Off' : 'Unknown') + '</span><span title="' +
        escapeHtml(schedule.title) + '">' + escapeHtml(item.type === 'scheduled' ? schedule.label : 'HTTP trigger') + '</span>' : '';
      document.getElementById('automation-description').textContent = item && item.description || '';
      document.getElementById('automation-description').hidden = !item || !item.description;
      var writable = Boolean(item && item.type === 'scheduled' && !s.busy && !automationView.runPending);
      ['automation-run-now', 'automation-toggle', 'automation-delete'].forEach(function (id) {
        var button = document.getElementById(id);
        button.disabled = !writable || id === 'automation-toggle' && !['on', 'off'].includes(item.status);
        button.title = !writable ? 'Select a task and wait for the current request to finish.' : '';
      });
      document.getElementById('automation-toggle').textContent = item && item.status === 'off' ? 'Turn on' : 'Turn off';
      document.getElementById('automation-update-runs').disabled = !item || item.type !== 'scheduled' || automationView.historyPending || automationView.runPending;
      document.getElementById('automation-edit').disabled = !item || !s.agent || !s.agent.portalUrl || item.type !== 'scheduled';
      document.getElementById('automation-task-action-note').textContent = '';
      document.getElementById('automation-detail-body').innerHTML = !item
        ? '<p class="status err">' + escapeHtml(error || (source.status !== 'available' ? 'The task list could not be read.' : 'The selected task is no longer in the loaded list.')) + '</p>'
        : '<dl class="automation-facts">' + [
          ['Status', item.status === 'on' ? 'On' : item.status === 'off' ? 'Off' : 'Unknown' + (item.rawStatus ? ' (' + item.rawStatus + ')' : '')],
          ['Type', item.type === 'http' ? 'HTTP trigger' : 'Scheduled task'],
          ['Description', item.description], ['Schedule', item.type === 'http' ? 'Not applicable' : formatAutomationSchedule(item).label],
          ['Cron expression', item.type === 'http' ? 'Not applicable' : item.cron],
          ['Displayed timezone', item.type === 'http' ? 'Not applicable' : formatAutomationSchedule(item).local ? Intl.DateTimeFormat().resolvedOptions().timeZone + ' (next run)' : 'No local-time conversion'],
          ['Created by', item.createdBy],
          ['Last run', item.lastRun], ['Next run', item.nextRun], ['Completed runs', item.completedRuns]
        ].map(function (field) { return '<div><dt>' + escapeHtml(field[0]) + '</dt><dd>' + escapeHtml(field[1] === null || field[1] === undefined || field[1] === '' ? 'Not provided' : String(field[1])) + '</dd></div>'; }).join('') + '</dl>';
      renderAutomationRuns(item);
    }
  }
  function formatAutomationRunDate(value) {
    var date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Not provided';
  }
  function renderAutomationRuns(item) {
    var history = automationView.history;
    var current = item && history && history.agentKey === item.agentKey && history.automationKey === item.key;
    var notice = document.getElementById('automation-runs-notice');
    notice.className = automationView.historyError ? 'status err' : 'hint';
    notice.textContent = automationView.historyError ? 'Could not load runs: ' + automationView.historyError
      : !item ? 'Select a task to view its runs.'
        : item.type !== 'scheduled' ? 'HTTP-trigger execution history is not connected in this view.'
          : automationView.historyPending ? 'Loading runs...'
            : !current ? 'Use Update list to load runs for this task.' : '';
    automationRunRows = current ? history.runs.filter(function (run) { return automationView.runStatus === 'all' || run.status === automationView.runStatus; }) : [];
    automationRunRows.sort(function (a, b) {
      var order = Date.parse(a.startTime) - Date.parse(b.startTime) || a.key.localeCompare(b.key);
      return automationView.runSort === 'ascending' ? order : -order;
    });
    if (current && !automationView.historyPending && !automationView.historyError) {
      notice.textContent = history.runs.length ? automationRunRows.length + ' matching / ' + history.runs.length + ' loaded runs'
        : 'No runs have been recorded for this task.';
      if (!automationRunRows.length && history.runs.length) notice.textContent = 'No runs match this status filter.';
      if (history.truncated) notice.textContent += '. Older runs are not shown in this bounded list.';
      if (history.excluded) notice.textContent += '. ' + history.excluded + ' unreadable records were excluded.';
    }
    document.getElementById('automation-run-time-heading').setAttribute('aria-sort', automationView.runSort);
    document.getElementById('automation-run-sort').innerHTML = 'Start time ' + (automationView.runSort === 'ascending' ? '&#8593;' : '&#8595;');
    document.getElementById('automation-run-status').value = automationView.runStatus;
    document.getElementById('automation-run-rows').innerHTML = automationRunRows.map(function (run, index) {
      var thread = (state.threads || []).find(function (row) { return (row.id || row.threadId) === run.threadId; });
      var label = run.threadName || thread && (thread.title || thread.name) || 'View run';
      var linked = Boolean(run.threadId && run.association === 'verified-id');
      return '<tr' + (linked ? ' data-run-index="' + index + '" tabindex="0"' : '') + '><td>' +
        escapeHtml(formatAutomationRunDate(run.startTime)) + '</td><td><span class="tag automation-run-state" data-status="' +
        escapeHtml(run.status) + '">' + escapeHtml(run.status) + '</span></td><td>' +
        (linked ? '<button type="button" class="automation-open automation-run-open" data-run-index="' + index + '"' +
          (automationView.runPending ? ' disabled' : '') + '>' + escapeHtml(label) + '</button>' : 'No conversation link provided') + '</td></tr>';
    }).join('');
  }
  function currentAutomationTask() {
    return automationSelectedTask && automationView.selection && automationSelectedTask.key === automationView.selection.key ? automationSelectedTask : null;
  }
  function loadAutomationRuns() {
    var item = currentAutomationTask();
    if (!item || item.type !== 'scheduled') return;
    var agentKey = item.agentKey, taskKey = item.key, generation = automationView.generation;
    var request = ++automationView.historyRequest;
    automationView.historyPending = true;
    automationView.historyError = '';
    automationView.history = null;
    renderAutomation(state);
    function current() {
      return automationView.generation === generation && automationView.agentKey === agentKey &&
        automationView.selection && automationView.selection.key === taskKey && automationView.historyRequest === request;
    }
    postJson('/automation-history', { agentKey: agentKey, taskKey: taskKey }, false).then(function (response) {
      if (!current()) return;
      var history = response.result;
      if (!history || history.status !== 'available' || !Array.isArray(history.runs) || history.agentKey !== agentKey || history.automationKey !== taskKey) {
        throw new Error('The run-history response did not match this task.');
      }
      automationView.history = history;
    }).catch(function (error) {
      if (current()) automationView.historyError = error.message;
    }).finally(function () {
      if (current()) { automationView.historyPending = false; renderAutomation(state); }
    });
  }
  document.getElementById('automation-search').addEventListener('input', function () {
    automationView.query = this.value;
    renderAutomation(state);
  });
  document.getElementById('automation-status').addEventListener('change', function () {
    automationView.status = this.value;
    renderAutomation(state);
  });
  document.getElementById('automation-rows').addEventListener('click', function (event) {
    var button = event.target.closest('[data-automation-index]');
    var item = button && automationRows[Number(button.dataset.automationIndex)];
    if (!item || item.agentKey !== automationView.agentKey) return;
    automationView.selection = { key: item.key, agentKey: item.agentKey };
    automationView.scroll = document.getElementById('automation-table-wrap').scrollTop;
    automationView.detailOpen = true;
    automationView.history = null;
    automationView.historyError = '';
    automationView.runStatus = 'all';
    document.querySelector('.automation-task-settings').open = false;
    renderAutomation(state);
    loadAutomationRuns();
    document.getElementById('automation-detail').focus({ preventScroll: true });
  });
  document.getElementById('automation-update-runs').addEventListener('click', loadAutomationRuns);
  document.getElementById('automation-run-status').addEventListener('change', function () {
    automationView.runStatus = this.value; renderAutomation(state);
  });
  document.getElementById('automation-run-sort').addEventListener('click', function () {
    automationView.runSort = automationView.runSort === 'descending' ? 'ascending' : 'descending';
    renderAutomation(state);
  });
  function openAutomationRun(index) {
    var run = automationRunRows[index], item = currentAutomationTask();
    if (!run || !item || !run.threadId || automationView.runPending) return;
    var agentKey = item.agentKey, taskKey = item.key, generation = automationView.generation;
    automationView.runPending = true;
    automationView.historyError = '';
    renderAutomation(state);
    postJson('/open-automation-run', { agentKey: agentKey, taskKey: taskKey, runKey: run.key }, false).then(function () {
      if (automationView.generation !== generation || automationView.agentKey !== agentKey || !automationView.detailOpen ||
        !automationView.selection || automationView.selection.key !== taskKey) return;
      automationReturnState = { agentKey: agentKey, taskKey: taskKey, runKey: run.key };
      incidentReturnState = null;
      activateTab('threads');
      threadsCard.open = false;
      syncThreadRail();
      document.getElementById('back-to-automation-run').hidden = false;
      document.getElementById('thread-detail').focus({ preventScroll: true });
    }).catch(function (error) {
      if (automationView.generation === generation && automationView.selection && automationView.selection.key === taskKey) {
        automationView.historyError = error.message;
      }
    }).finally(function () {
      if (automationView.generation === generation && automationView.selection && automationView.selection.key === taskKey) {
        automationView.runPending = false; renderAutomation(state);
      }
    });
  }
  document.getElementById('automation-run-rows').addEventListener('click', function (event) {
    var row = event.target.closest('[data-run-index]');
    if (row) openAutomationRun(Number(row.dataset.runIndex));
  });
  document.getElementById('automation-run-rows').addEventListener('keydown', function (event) {
    if (event.target.tagName !== 'TR' || event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault(); openAutomationRun(Number(event.target.dataset.runIndex));
  });
  document.getElementById('back-to-automation-run').addEventListener('click', function () {
    if (!automationReturnState || automationReturnState.agentKey !== automationView.agentKey) return;
    activateTab('automation'); renderAutomation(state);
    var index = automationRunRows.findIndex(function (run) { return run.key === automationReturnState.runKey; });
    var button = document.querySelector('.automation-run-open[data-run-index="' + index + '"]');
    (button || document.getElementById('automation-detail')).focus({ preventScroll: true });
  });
  document.getElementById('automation-edit').addEventListener('click', function () {
    var item = currentAutomationTask();
    if (!item || !state.agent || !state.agent.portalUrl) { setStatus('A registered task portal link is required.', true); return; }
    var portal;
    try { portal = new URL(state.agent.portalUrl); } catch { setStatus('The task portal link is invalid.', true); return; }
    if (portal.origin !== 'https://sre.azure.com') { setStatus('The task portal link is not trusted.', true); return; }
    portal.hash = '/views/automation/scheduled/' + encodeURIComponent(item.id);
    window.open(portal.href, '_blank', 'noopener');
  });
  var automationCommandConfirmation = null;
  var automationCommandDialog = document.getElementById('automation-command-dialog');
  automationCommandDialog.addEventListener('close', function () { automationCommandConfirmation = null; });
  document.getElementById('automation-confirm-cancel').addEventListener('click', function () { automationCommandDialog.close(); });
  function sendAutomationCommand(command) {
    var item = currentAutomationTask();
    if (!item || state.busy || automationView.runPending) return;
    var confirmation = command === 'delete' ? 'Delete task "' + item.name + '"? This cannot be undone.'
      : command === 'run' ? 'Run task "' + item.name + '" now?' : (command === 'pause' ? 'Turn off' : 'Turn on') + ' task "' + item.name + '"?';
    automationCommandConfirmation = { command: command, agentKey: item.agentKey, taskKey: item.key,
      generation: automationView.generation, revision: automationTaskRevision(item) };
    document.getElementById('automation-confirm-message').textContent = confirmation;
    document.getElementById('automation-confirm-agent').textContent = 'Agent: ' + (state.agent.name || 'Selected agent');
    document.getElementById('automation-confirm-submit').textContent = command === 'delete' ? 'Delete task'
      : command === 'run' ? 'Run task now' : command === 'pause' ? 'Turn off' : 'Turn on';
    automationCommandDialog.showModal();
  }
  document.getElementById('automation-confirm-submit').addEventListener('click', function () {
    var confirmed = automationCommandConfirmation, item = currentAutomationTask();
    automationCommandDialog.close();
    if (!confirmed || !item || state.busy || automationView.runPending || confirmed.generation !== automationView.generation ||
      confirmed.agentKey !== item.agentKey || confirmed.taskKey !== item.key || confirmed.revision !== automationTaskRevision(item)) {
      automationView.historyError = 'The selected task changed. Reopen it before confirming an action.';
      renderAutomation(state); return;
    }
    var command = confirmed.command;
    var generation = automationView.generation, taskKey = item.key;
    automationView.runPending = true; renderAutomation(state);
    postJson('/automation-task-command', { agentKey: item.agentKey, taskKey: taskKey, command: command,
      revision: automationTaskRevision(item) }, false).then(function () {
      if (automationView.generation !== generation || !automationView.selection || automationView.selection.key !== taskKey) return;
      if (command === 'delete') { automationView.detailOpen = false; automationView.selection = null; }
      else loadAutomationRuns();
    }).catch(function (error) {
      if (automationView.generation === generation) automationView.historyError = error.message;
    }).finally(function () {
      if (automationView.generation === generation) { automationView.runPending = false; renderAutomation(state); }
    });
  });
  document.getElementById('automation-run-now').addEventListener('click', function () { sendAutomationCommand('run'); });
  document.getElementById('automation-delete').addEventListener('click', function () { sendAutomationCommand('delete'); });
  document.getElementById('automation-toggle').addEventListener('click', function () {
    var item = currentAutomationTask(); if (item) sendAutomationCommand(item.status === 'off' ? 'resume' : 'pause');
  });
  document.getElementById('automation-back').addEventListener('click', function () {
    automationView.detailOpen = false;
    automationSelectedTask = null;
    renderAutomation(state);
    document.getElementById('automation-table-wrap').scrollTop = automationView.scroll;
    var selected = document.querySelector('#automation-rows tr[aria-current="true"] button');
    (selected || document.getElementById('automation-search')).focus({ preventScroll: true });
  });
  document.getElementById('automation-refresh').addEventListener('click', function () {
    if (this.disabled) return;
    var generation = automationView.generation;
    var agentKey = automationView.agentKey;
    automationView.pending = true;
    automationView.error = '';
    renderAutomation(state);
    postJson('/refresh-automation', {}, false).then(function (response) {
      if (generation !== automationView.generation || agentKey !== automationView.agentKey) return;
      var result = response.result;
      if (result && result.scheduled && !result.scheduled.ok) state.scheduledTasksError = 'Scheduled tasks unavailable: ' + result.scheduled.message;
      if (result && result.http && !result.http.ok) state.httpTriggersError = 'HTTP triggers unavailable: ' + result.http.message;
    }).catch(function (error) {
      if (generation !== automationView.generation || agentKey !== automationView.agentKey) return;
      automationView.error = 'Automation refresh unavailable: ' + error.message;
      setStatus(automationView.error, true);
    }).finally(function () {
      if (generation !== automationView.generation || agentKey !== automationView.agentKey) return;
      automationView.pending = false;
      renderAutomation(state);
    });
  });

  function renderCmdLog(commands) {
    var list = document.getElementById('cmd-list');
    var failed = commands.filter(function (command) { return command.status === 'err'; }).length;
    var badge = document.getElementById('activity-failed-count');
    badge.hidden = !failed;
    badge.textContent = failed ? '(' + failed + ')' : '';
    activityTrigger.setAttribute('aria-label', 'Command activity' + (failed ? ', ' + failed + ' failed command' + (failed === 1 ? '' : 's') : ''));
    if (!commands.length) {
      list.innerHTML = '<div class="status">No commands run yet.</div>';
      return;
    }
    list.innerHTML = commands.map(function (c) {
      var statusLabel = c.status === 'run' ? 'running' : c.status === 'err' ? 'error' : 'ok';
      var ms = c.ms != null ? Math.round(c.ms) + 'ms' : '';
      // c.ts is epoch ms (server clock) - render as simple local wall-clock time
      // (e.g. "5:14:02 PM") so Command Activity reads like a timestamped log,
      // not just relative durations.
      var time = c.ts ? new Date(c.ts).toLocaleTimeString() : '';
      return '<div class="cmd-row">' +
        '<div class="cmd-head">' +
          '<span class="cmd-kind ' + escapeHtml(c.kind || '') + '">' + escapeHtml(c.kind || '') + '</span>' +
          '<span>' + escapeHtml(c.title || '') + '</span>' +
          '<span class="cmd-status ' + escapeHtml(c.status || '') + '">' + statusLabel + '</span>' +
          '<span class="cmd-time">' + time + '</span>' +
          '<span class="cmd-ms">' + ms + '</span>' +
        '</div>' +
        '<div class="cmd-text">' + escapeHtml(c.cmd || '') + '</div>' +
        (c.note ? '<div class="cmd-note">' + escapeHtml(c.note) + '</div>' : '') +
      '</div>';
    }).join('');
  }
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  // Renders the active thread as a chat transcript, mirroring the real SRE Agent portal:
  // user/agent bubbles plus expandable tool-execution cards (az CLI / kubectl / psql).
  var TOOL_FIELDS = [
    { key: 'azCliExecution', label: 'az CLI' },
    { key: 'kubectlExecution', label: 'kubectl' },
    { key: 'psqlExecution', label: 'psql' },
    { key: 'genevaActionExecution', label: 'Geneva action' },
    { key: 'terminalResult', label: 'Terminal' },
  ];
  // requiredScopes comes back as a comma-separated string on real executions, not an array -
  // normalize defensively (mirrors scopesText() on the server side).
  function scopesText(exec) {
    var raw = exec && exec.requiredScopes;
    if (Array.isArray(raw)) return raw.join(', ');
    return String(raw || '');
  }
  function toolBadge(exec, kind) {
    var currentActivity = executionActivity(exec, kind);
    var style = ['running', 'waiting-permission', 'waiting-approval', 'failed', 'unknown'].includes(currentActivity.state) ? 'risk' : 'done';
    return '<span class="tool-badge ' + style + '">' + escapeHtml(currentActivity.label) + '</span>';
  }
  // Mirrors the real SRE Agent portal: when the agent's managed identity is denied by RBAC
  // (status === PendingAuthorization), it shows a "Grant permissions" notice/button that
  // re-runs the same command on-behalf-of the signed-in user instead of the agent identity.
  function renderToolCard(field, exec, threadId) {
    var currentActivity = executionActivity(exec, field.key);
    var needsAuth = currentActivity.state === 'waiting-permission';
    var scopes = scopesText(exec);
    var boundedCommand = truncateTranscriptText(exec.command, MAX_COMMAND_CHARS);
    return '<div class="tool-card">' +
      '<div class="tool-head">' +
        '<span class="tool-title">' + escapeHtml(exec.description || field.label) + '</span>' +
        toolBadge(exec, field.key) +
        (currentActivity.state === 'running' && threadHasInFlightWork(state.activeThread) ? '<span class="spinner" aria-hidden="true"></span>' : '') +
      '</div>' +
      (exec.command ? '<div class="tool-cmd canvas-code-block"><button class="copy-cmd canvas-code-block-copy" data-cmd="' + escapeHtml(boundedCommand).replace(/"/g, '&quot;') + '" aria-label="Copy command" aria-live="polite">Copy</button><pre>' + escapeHtml(boundedCommand) + '</pre></div>' : '') +
      (needsAuth ? (
        '<div class="tool-auth-notice">The agent tried to execute this command using its managed identity but received an authorization error.' +
        (scopes ? ' If you grant permissions, the command will be re-executed using your credentials (OBO) with scope: <b>' + escapeHtml(scopes) + '</b>.' : ' Grant permissions to re-run this command using your own credentials (OBO).') +
        '</div>' +
        '<div class="tool-auth-actions">' +
          '<button class="btn grant-exec" data-kind="' + field.key + '" data-thread="' + escapeHtml(threadId || '') + '" data-exec="' + escapeHtml(exec.id || '') + '" data-command="' + encodeURIComponent(String(exec.command || '')) + '">Grant permissions (this run)</button>' +
          '<button class="btn grant-role" data-kind="' + field.key + '" data-thread="' + escapeHtml(threadId || '') + '" data-exec="' + escapeHtml(exec.id || '') + '" title="Create a real RBAC role assignment for the agent&#39;s own identity, so it stops needing OBO for this resource.">Grant durable access &#8635;</button>' +
          '<button class="btn ghost cancel-exec" data-kind="' + field.key + '" data-thread="' + escapeHtml(threadId || '') + '" data-exec="' + escapeHtml(exec.id || '') + '" data-command="' + encodeURIComponent(String(exec.command || '')) + '">Cancel</button>' +
        '</div>'
      ) : '') +
      (exec.output ? '<div class="tool-output">' + escapeHtml(truncateTranscriptText(exec.output, MAX_TOOL_OUTPUT_CHARS)) + '</div>' : '') +
      (exec.error ? '<div class="tool-output" style="color:var(--err)">' + escapeHtml(truncateTranscriptText(exec.error, MAX_ERROR_CHARS)) + '</div>' : '') +
    '</div>';
  }
  // Small, dependency-free GFM-ish markdown renderer for SRE Agent chat/thread message
  // text. Input is escaped via escapeHtml() FIRST (so no raw HTML/script can ever reach
  // innerHTML), and markdown tokens are then matched against the escaped text - none of
  // the patterns below target the escaped entities themselves (&amp; &lt; &gt; &quot; &#39;),
  // only plain characters like |, #, *, backtick, - which escapeHtml() never touches.
  // Note: this whole file is itself one big JS template literal, so regex escapes here
  // must be doubled (\\s, \\|, \\* etc.) to survive being embedded literally.
  function renderInlineMarkdown(escaped) {
    return escaped
      .replace(/\`([^\`]+)\`/g, '<code>$1</code>')
      .replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>');
  }
  function splitTableRow(line) {
    var trimmed = line.trim().replace(/^\\|/, '').replace(/\\|$/, '');
    return trimmed.split('|').map(function (c) { return c.trim(); });
  }
  function renderMarkdownTable(lines) {
    var header = splitTableRow(lines[0]);
    var rows = lines.slice(2).map(splitTableRow);
    var html = '<table><thead><tr>' + header.map(function (c) {
      return '<th>' + renderInlineMarkdown(c) + '</th>';
    }).join('') + '</tr></thead><tbody>';
    rows.forEach(function (r) {
      html += '<tr>' + r.map(function (c) { return '<td>' + renderInlineMarkdown(c) + '</td>'; }).join('') + '</tr>';
    });
    html += '</tbody></table>';
    return html;
  }
  function isTableSeparatorLine(line) {
    return /^\\s*\\|?\\s*:?-{2,}:?\\s*(\\|\\s*:?-{2,}:?\\s*)*\\|?\\s*$/.test(line);
  }
  function renderIncidentAlert(json) {
    var alert;
    try { alert = JSON.parse(json); } catch (_) { return ''; }
    if (!alert || typeof alert !== 'object' || Array.isArray(alert) || typeof alert.alertRule !== 'string' || !alert.alertRule.trim()) return '';
    function detail(label, value) {
      return typeof value === 'string' && value.trim() ? '<div><dt>' + label + '</dt><dd>' + escapeHtml(value) + '</dd></div>' : '';
    }
    var severity = typeof alert.severity === 'string' ? '<span class="incident-alert-severity">' + escapeHtml(alert.severity) + '</span>' : '';
    var details = detail('Resource', alert.monitoredResource) + detail('Condition', alert.monitorCondition) +
      detail('Fired', alert.firedAt) + detail('Service', alert.monitorService) + detail('Resource group', alert.resourceGroup) + detail('Alert ID', alert.alertId);
    var description = typeof alert.description === 'string' ? '<p class="incident-alert-description">' + escapeHtml(alert.description) + '</p>' : '';
    var link = '';
    if (typeof alert.portalUrl === 'string') {
      try {
        var url = new URL(alert.portalUrl);
        if (url.protocol === 'https:' && !url.username && !url.password &&
          (url.hostname === 'portal.azure.com' || url.hostname.endsWith('.portal.azure.com'))) {
          link = '<a href="' + escapeHtml(url.href) + '" target="_blank" rel="noopener noreferrer">Open alert in Azure Portal &#8599;</a>';
        }
      } catch (_) { /* An invalid URL remains inert. */ }
    }
    return '<section class="incident-alert-card" aria-label="Incident alert"><div class="incident-alert-head">' + severity +
      '<strong>' + escapeHtml(alert.alertRule) + '</strong></div>' + (details ? '<dl class="incident-alert-details">' + details + '</dl>' : '') + description + link + '</section>';
  }
  function renderMarkdown(text) {
    var rawLines = String(text == null ? '' : text).split('\\n');
    var lines = rawLines.map(escapeHtml);
    var html = '';
    var i = 0;
    var listBuf = [];
    function flushList() {
      if (listBuf.length) {
        html += '<ul>' + listBuf.map(function (li) { return '<li>' + renderInlineMarkdown(li) + '</li>'; }).join('') + '</ul>';
        listBuf = [];
      }
    }
    var paraBuf = [];
    function flushPara() {
      if (paraBuf.length) {
        html += '<p>' + paraBuf.map(renderInlineMarkdown).join('<br>') + '</p>';
        paraBuf = [];
      }
    }
    while (i < lines.length) {
      var line = lines[i];
      if (/^\\s*\`\`\`incident-alert\\s*$/.test(rawLines[i])) {
        var end = i + 1;
        while (end < rawLines.length && !/^\\s*\`\`\`\\s*$/.test(rawLines[end])) end++;
        if (end < rawLines.length) {
          var card = renderIncidentAlert(rawLines.slice(i + 1, end).join('\\n'));
          if (card) { flushPara(); flushList(); html += card; i = end + 1; continue; }
        }
      }
      // GFM table: header row followed by a |---|---| separator row.
      if (line.indexOf('|') !== -1 && lines[i + 1] && isTableSeparatorLine(lines[i + 1])) {
        flushPara(); flushList();
        var tableLines = [line, lines[i + 1]];
        var j = i + 2;
        while (j < lines.length && lines[j].indexOf('|') !== -1 && lines[j].trim() !== '') {
          tableLines.push(lines[j]);
          j++;
        }
        html += renderMarkdownTable(tableLines);
        i = j;
        continue;
      }
      var headerMatch = /^(#{1,3})\\s+(.*)$/.exec(line);
      if (headerMatch) {
        flushPara(); flushList();
        var level = headerMatch[1].length;
        html += '<h' + level + '>' + renderInlineMarkdown(headerMatch[2]) + '</h' + level + '>';
        i++;
        continue;
      }
      var bulletMatch = /^\\s*[-*]\\s+(.*)$/.exec(line);
      if (bulletMatch) {
        flushPara();
        listBuf.push(bulletMatch[1]);
        i++;
        continue;
      }
      if (line.trim() === '') {
        flushList(); flushPara();
        i++;
        continue;
      }
      flushList();
      paraBuf.push(line);
      i++;
    }
    flushList(); flushPara();
    return html;
  }
  function renderChatMessage(m, threadId) {
    var role = (m.author && m.author.role) || m.role || 'Agent';
    var isUser = String(role).toLowerCase() === 'user';
    var text = m.text || m.content || m.message || '';
    if (m.mcpToolExecution && text === 'MCP Tool: ' + m.mcpToolExecution.displayName + ' (' + m.mcpToolExecution.status + ')') text = '';
    var who = isUser ? ((m.author && m.author.displayName) || 'You') : 'SRE Agent';
    var parts = [];
    if (m.scheduledTaskContext) {
      var task = m.scheduledTaskContext;
      who = 'Scheduled task';
      parts.push(task.error ? '<p class="status err">' + escapeHtml(task.error) + '</p>' :
        '<section class="scheduled-run-context" aria-label="Scheduled task execution"><h3>' + escapeHtml(task.name) + '</h3>' +
        (task.description ? '<p>' + escapeHtml(task.description) + '</p>' : '') +
        '<details class="scheduled-run-instructions"><summary>Task instructions</summary>' +
        (task.cron ? '<p class="hint">Cron: ' + escapeHtml(task.cron) + '</p>' : '') +
        (task.prompt ? '<div class="chat-bubble">' + renderMarkdown(task.prompt) + '</div>' : '<p class="hint">Instructions not provided.</p>') +
        (task.promptTruncated ? '<p class="hint">Instructions preview truncated. Open the task in Portal for the full instructions.</p>' : '') +
        '</details></section>');
    } else if (text) parts.push('<div class="chat-bubble">' + renderMarkdown(text) + '</div>');
    TOOL_FIELDS.forEach(function (field) {
      var exec = m[field.key];
      if (exec) parts.push(renderToolCard(field, exec, threadId));
    });
    if (m.approval) parts.push('<section class="tool-card approval-card" aria-label="Approval request"><div class="tool-head">' +
      '<span class="tool-title">Approval request</span>' + toolBadge(m.approval, 'approval') + '</div>' +
      (m.approval.description ? '<p>' + escapeHtml(truncateTranscriptText(m.approval.description, MAX_ERROR_CHARS)) + '</p>' : '') +
      (executionActivity(m.approval, 'approval').state === 'waiting-approval'
        ? '<p class="hint">User action required. Review this approval in the SRE Agent Portal.</p>' : '') + '</section>');
    if (m.mcpToolExecution) parts.push(renderMcpRunCard(m.mcpToolExecution));
    if (m.executionPreviewOmitted) parts.push('<p class="hint">Tool result preview omitted to keep this conversation bounded. Open the full run in Portal.</p>');
    if (!parts.length) parts.push('<div class="chat-bubble">' + escapeHtml(truncateTranscriptText(JSON.stringify(m), MAX_ERROR_CHARS)) + '</div>');
    return '<div class="chat-msg ' + (isUser ? 'user' : 'agent') + '">' +
      '<span class="who">' + escapeHtml(who) + '</span>' + parts.join('') +
    '</div>';
  }
  function renderMcpRunCard(exec) {
    var params = exec.parameters || {}, preview = exec.preview || {};
    var title = exec.displayName || exec.toolName || 'Tool execution';
    var result = preview.columns ? '<p class="hint">Result: ' + preview.rows.length +
      (preview.truncated ? ' of ' + preview.totalRows : '') + ' rows' +
      (preview.status !== null ? ' \xB7 Status ' + escapeHtml(String(preview.status)) : '') +
      (preview.duration !== null ? ' \xB7 Duration ' + escapeHtml(String(preview.duration)) : '') + '</p>' +
      '<div class="automation-runs-table-wrap"><table class="automation-table"><thead><tr>' +
      preview.columns.map(function (column) { return '<th scope="col">' + escapeHtml(column) + '</th>'; }).join('') +
      '</tr></thead><tbody>' + preview.rows.map(function (row) {
        return '<tr>' + row.map(function (cell) { return '<td>' + escapeHtml(cell) + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>'
      : preview.text ? '<div class="tool-output">' + escapeHtml(preview.text) + '</div>' : '<p class="hint">Result preview unavailable. Open the full run in Portal.</p>';
    return '<details class="tool-card mcp-run-card"><summary class="tool-head"><span class="tool-title">' +
      escapeHtml(title) + '</span>' + (exec.status ? toolBadge(exec) : '<span class="tag">Unknown status</span>') + '</summary><div class="tool-output">' +
      (exec.mcpServerName ? '<p class="hint">' + escapeHtml(exec.mcpServerName) + '</p>' : '') +
      (params.clusterUrl ? '<p>Cluster: ' + escapeHtml(params.clusterUrl) + '</p>' : '') +
      (params.database ? '<p>Database: ' + escapeHtml(params.database) + '</p>' : '') +
      (params.query ? '<div class="tool-cmd canvas-code-block"><button class="copy-cmd canvas-code-block-copy" data-cmd="' +
        escapeHtml(params.query) + '" aria-label="Copy query">Copy</button><pre>' + escapeHtml(params.query) + '</pre></div>' : '') +
      result + (exec.error ? '<p class="status err">' + escapeHtml(exec.error) + '</p>' : '') +
      (preview.truncated ? '<p class="hint">Result preview truncated. Open the full run in Portal for the complete output.</p>' : '') +
      '</div></details>';
  }
  function threadIsAwaitingAgent(thread) {
    return threadHasInFlightWork(thread);
  }
  var TYPING_INDICATOR_HTML = '<div class="chat-msg agent"><span class="who">SRE Agent</span>' +
    '<div class="chat-bubble typing-dots"><span></span><span></span><span></span></div></div>';
  function renderChatLog(el, thread) {
    if (!thread) { el.textContent = 'No thread selected.'; return; }
    if (thread.draft) {
      el.innerHTML = '<div class="status">New draft thread. Review or edit the template below, then click Send to start the SRE Agent thread.</div>';
      return;
    }
    var threadId = thread.id || thread.threadId || '';
    var allMessages = thread.messages || thread.value || [];
    var messages = boundedTranscriptMessages(thread);
    var totalMessages = thread.totalMessages || allMessages.length;
    var hiddenCount = Math.max(0, totalMessages - messages.length);
    var showTyping = threadIsAwaitingAgent(thread);
    if (!messages.length) {
      el.innerHTML = (thread.startMessage ? renderChatMessage(thread.startMessage, threadId) : '<div class="status">No messages yet.</div>') +
        (showTyping ? TYPING_INDICATOR_HTML : '');
      el.scrollTop = el.scrollHeight;
      return;
    }
    el.innerHTML = (hiddenCount ? '<div class="transcript-notice"><span>Showing the latest ' + messages.length + ' of ' + totalMessages + ' messages.</span><button class="btn ghost mini portal-full-transcript">Open full transcript in Portal &#8599;</button></div>' : '') + messages.map(function (m) {
      try {
        return renderChatMessage(m, threadId);
      } catch (err) {
        console.error('renderChatMessage failed for message', m, err);
        return '<div class="chat-msg agent"><span class="who">SRE Agent</span><div class="chat-bubble" style="color:var(--err)">(Could not render this message: ' + escapeHtml(err && err.message || String(err)) + ')</div></div>';
      }
    }).join('') + (showTyping ? TYPING_INDICATOR_HTML : '');
    el.scrollTop = el.scrollHeight;
  }

  document.getElementById('thread-log').addEventListener('click', function (e) {
    if (e.target && e.target.classList.contains('portal-full-transcript')) {
      openSelectedThreadInPortal();
      return;
    }
    if (e.target && e.target.classList.contains('copy-cmd')) {
      var cmd = e.target.getAttribute('data-cmd') || '';
      navigator.clipboard && navigator.clipboard.writeText(cmd);
      e.target.textContent = 'Copied!';
      setTimeout(function () { e.target.textContent = 'Copy'; }, 1200);
      return;
    }
    if (e.target && e.target.classList.contains('grant-exec')) {
      e.target.disabled = true;
      e.target.textContent = 'Granting...';
      postJson('/grant-execution', {
        kind: e.target.getAttribute('data-kind'),
        threadId: e.target.getAttribute('data-thread'),
        executionId: e.target.getAttribute('data-exec'),
        expectedCommand: decodeURIComponent(e.target.getAttribute('data-command') || ''),
      });
      return;
    }
    if (e.target && e.target.classList.contains('grant-role')) {
      e.target.disabled = true;
      e.target.textContent = 'Creating role assignment...';
      postJson('/grant-durable-role', {
        kind: e.target.getAttribute('data-kind'),
        threadId: e.target.getAttribute('data-thread'),
        executionId: e.target.getAttribute('data-exec'),
      }).catch(function () {
        e.target.disabled = false;
        e.target.textContent = 'Grant durable access \u21BB';
      });
      return;
    }
    if (e.target && e.target.classList.contains('cancel-exec')) {
      e.target.disabled = true;
      e.target.textContent = 'Cancelling...';
      postJson('/cancel-execution', {
        kind: e.target.getAttribute('data-kind'),
        threadId: e.target.getAttribute('data-thread'),
        executionId: e.target.getAttribute('data-exec'),
        expectedCommand: decodeURIComponent(e.target.getAttribute('data-command') || ''),
      });
    }
  });

  document.getElementById('agent-select').addEventListener('click', function (e) {
    var options = document.getElementById('agent-options');
    var open = options.hidden;
    options.hidden = !open;
    e.currentTarget.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      var first = options.querySelector('.agent-option[aria-current="true"]') || options.querySelector('.agent-option');
      if (first) first.focus();
    }
  });
  document.getElementById('agent-select').addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (document.getElementById('agent-options').hidden) e.currentTarget.click(); return; }
    if (e.key !== 'Escape') return;
    var options = document.getElementById('agent-options');
    options.hidden = true;
    e.currentTarget.setAttribute('aria-expanded', 'false');
  });
  function closeConfigAgentMenu(restoreFocus) {
    document.getElementById('agent-options').hidden = true;
    document.getElementById('agent-select').setAttribute('aria-expanded', 'false');
    if (restoreFocus) document.getElementById('agent-select').focus();
  }
  document.getElementById('agent-options').addEventListener('click', function (e) {
    pickerClick(e, closeConfigAgentMenu);
  });
  document.getElementById('agent-options').addEventListener('keydown', function (e) {
    pickerKeydown(e, closeConfigAgentMenu);
  });
  document.addEventListener('click', function (e) {
    if (e.composedPath().some(function (node) { return node.classList?.contains('agent-picker'); })) return;
    var options = document.getElementById('agent-options');
    if (!options || options.hidden) return;
    options.hidden = true;
    document.getElementById('agent-select').setAttribute('aria-expanded', 'false');
  });
  document.getElementById('refresh-agents').addEventListener('click', function () {
    postJson('/refresh-agents').catch(function (error) { setStatus('Could not refresh agents: ' + error.message, true); });
  });
  function openSharedAgent() {
    if (connectionPending) return;
    var reference = document.getElementById('shared-agent-reference').value.trim();
    if (!reference) { setStatus('Enter an SRE Agent resource ID, portal link, or external agent endpoint.', true); return; }
    connectionPending = true;
    document.getElementById('connection-feedback').hidden = true;
    document.getElementById('open-shared-agent').disabled = true;
    document.getElementById('open-shared-agent').textContent = 'Connecting\u2026';
    postJson('/open-shared-agent', { reference: reference })
      .then(function () { setConnectionMode('external', true); })
      .catch(function (error) {
        var feedback = document.getElementById('connection-feedback');
        feedback.textContent = 'Could not connect: ' + error.message;
        feedback.hidden = false;
        setStatus(feedback.textContent, true);
      })
      .finally(function () {
        connectionPending = false;
        document.getElementById('open-shared-agent').disabled = false;
        document.getElementById('open-shared-agent').textContent = 'Connect to agent';
      });
  }
  document.getElementById('open-shared-agent').addEventListener('click', openSharedAgent);
  document.getElementById('shared-agent-reference').addEventListener('keydown', function (event) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    openSharedAgent();
  });
  document.getElementById('open-external-portal').addEventListener('click', function () {
    var input = document.getElementById('shared-agent-reference').value.trim();
    try {
      var portal = new URL(input);
      var urls = portal.searchParams.getAll('agentUrl');
      if (portal.protocol !== 'https:' || portal.host !== 'sre.azure.com' ||
          !/^\\/externalagents\\/[^/]+\\/?$/i.test(portal.pathname) || urls.length !== 1) {
        throw new Error('Paste a registered sre.azure.com/externalagents/ portal link to open it in Portal.');
      }
      var endpoint = new URL(urls[0]);
      if (endpoint.protocol !== 'https:' || !endpoint.hostname.endsWith('.azuresre.ai') ||
          endpoint.username || endpoint.password || endpoint.port ||
          endpoint.pathname !== '/' || endpoint.search || endpoint.hash) {
        throw new Error('The portal link must contain a valid external agent endpoint.');
      }
      window.open(portal.href, '_blank', 'noopener');
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  document.getElementById('app-sub-select').addEventListener('change', function (e) {
    postJson('/select-app-subscription', { subscription: e.target.value });
  });

  document.getElementById('app-resource-select').addEventListener('change', function (e) {
    if (e.target.value) document.getElementById('app-resource').value = '';
  });
  document.getElementById('app-resource').addEventListener('input', function () {
    if (this.value.trim()) document.getElementById('app-resource-select').value = '';
  });

  document.getElementById('diagnose-app').addEventListener('click', function () {
    var picked = document.getElementById('app-resource-select').value;
    var typed = document.getElementById('app-resource').value.trim();
    var target = picked || typed;
    if (!target) { setStatus('Pick or enter an app resource first.', true); return; }
    var button = this;
    button.disabled = true;
    postJson('/diagnose-app', {
      resourceIdOrName: target,
      note: document.getElementById('app-note').value,
      appSubscription: document.getElementById('app-sub-select').value,
    }).then(function (response) {
      var created = response.result && response.result.investigation;
      if (!threadId(created)) throw new Error('The SRE Agent did not confirm a new diagnosis thread.');
      draftThread = null;
      if (threadId(state.activeThread) !== threadId(created) || !state.activeThread.messages?.length) {
        state.activeThread = created;
      }
      state.threads = upsertThread(state.threads, state.activeThread);
      activateTab('threads');
      renderBody(state);
      scheduleThreadPoll(state.activeThread);
      document.getElementById('thread-detail').focus({ preventScroll: true });
    }).catch(function (error) {
      setStatus('Diagnosis failed: ' + error.message, true);
    }).finally(function () {
      button.disabled = false;
    });
    var configCard = document.getElementById('azure-config-card');
    if (configCard) configCard.open = false;
  });
  document.getElementById('check-config-drift').addEventListener('click', function () {
    var picked = document.getElementById('app-resource-select').value;
    var typed = document.getElementById('app-resource').value;
    var target = typed || picked;
    if (!target) { setStatus('Pick or enter an app resource first.', true); return; }
    postJson('/check-config-drift', { resourceIdOrName: target, appSubscription: document.getElementById('app-sub-select').value });
  });
  document.getElementById('refresh-connectors').addEventListener('click', function () {
    postJson('/refresh-connectors').catch(function (error) { setStatus('Could not refresh connectors: ' + error.message, true); });
  });
  document.getElementById('discover-kusto').addEventListener('click', function () {
    postJson('/discover-kusto-resources', { subscription: document.getElementById('connector-sub-select').value });
  });
  document.getElementById('connector-list').addEventListener('click', function (e) {
    var detachBtn = e.target.closest('.detach-connector');
    if (detachBtn) {
      e.preventDefault();
      e.stopPropagation();
      detachConnector(detachBtn.dataset.name || '');
      return;
    }
    var attachBtn = e.target.closest('.attach-namespace-mcp');
    if (attachBtn) {
      e.preventDefault();
      e.stopPropagation();
      postJson('/attach-connector-namespace-mcp', { name: attachBtn.dataset.name || '' });
      return;
    }
    var copyBtn = e.target.closest('.copy-cmd');
    if (copyBtn) {
      e.preventDefault();
      e.stopPropagation();
      var cmd = copyBtn.getAttribute('data-cmd') || '';
      navigator.clipboard && navigator.clipboard.writeText(cmd);
      copyBtn.textContent = 'Copied!';
      setTimeout(function () { copyBtn.textContent = 'Copy'; }, 1200);
    }
  });
  document.getElementById('kusto-cluster-select').addEventListener('change', function () {
    var cluster = selectedKustoCluster();
    if (cluster && cluster.clusterUrl) document.getElementById('kusto-cluster-url').value = cluster.clusterUrl;
    fillKustoDatabases();
  });
  document.getElementById('kusto-database-select').addEventListener('change', function (e) {
    if (e.target.value) document.getElementById('kusto-database').value = e.target.value;
  });
  document.getElementById('create-delegated-kusto-mcp').addEventListener('click', function () {
    postJson('/create-delegated-kusto-mcp', {
      clusterUrl: document.getElementById('kusto-cluster-url').value.trim(),
      database: document.getElementById('kusto-database').value.trim() || document.getElementById('kusto-database-select').value,
    }).then(function (r) {
      var result = r && r.result;
      if (result && result.signInRequired) {
        if (result.signInUrl) window.open(result.signInUrl, 'connector-namespace-consent', 'popup,width=720,height=760');
        setStatus('Complete the Azure Data Explorer sign-in. Azure SRE Agent will continue automatically.');
      }
    });
  });
  window.addEventListener('message', function (event) {
    if (event.origin !== window.location.origin || !event.data || event.data.type !== 'connector-namespace-consent') return;
    postJson('/confirm-delegated-kusto-consent', { code: event.data.code });
  });
  function sendComposerMessage(forceNewThread) {
    if (replyPending) return;
    var activeThread = displayedActiveThread(state, draftThread);
    var activeId = threadId(activeThread);
    var input = document.getElementById('reply-msg');
    var message = input.value.trim();
    if (!message) { setStatus('Type a message for the SRE Agent first.', true); return; }
    replyCompletion.dismiss();
    var submittedValue = input.value;
    var agentKey = connectionKey(state.agent);
    var creating = shouldCreateThread(state, draftThread, forceNewThread);
    var button = document.getElementById('send-reply');
    var feedback = document.getElementById('reply-feedback');
    replyPending = true;
    button.disabled = true;
    button.textContent = 'Sending...';
    input.readOnly = true;
    feedback.className = 'reply-feedback hint';
    feedback.textContent = 'Sending your message...';
    var request = creating
      ? postJson('/create-thread', { message: message }, false)
      : postJson('/send-message', { threadId: activeId, message: message }, false);
    return request.then(function (response) {
      if (connectionKey(state.agent) !== agentKey) return;
      var currentId = threadId(displayedActiveThread(state, draftThread));
      if (creating) {
        var created = response && response.result;
        if (!threadId(created)) throw new Error('The SRE Agent did not return a new thread id.');
        if (currentId !== activeId && currentId !== threadId(created)) return;
        draftThread = null;
        state.activeThread = created;
        state.threads = upsertThread(state.threads, created);
        activateTab('threads');
        renderBody(state);
        requestAnimationFrame(function () {
          var detail = document.getElementById('thread-detail');
          detail.scrollIntoView({ block: 'nearest' });
          detail.focus({ preventScroll: true });
        });
        postJson('/open-thread', { threadId: threadId(created) }, false).catch(function (error) {
          setStatus('Message sent, but the new thread could not be loaded: ' + error.message, true);
        });
      } else if (currentId !== activeId) {
        return;
      }
      if (input.value === submittedValue) input.value = '';
      feedback.textContent = 'Message sent.';
    }).catch(function (error) {
      var text = 'Send failed: ' + error.message;
      if (connectionKey(state.agent) === agentKey && threadId(displayedActiveThread(state, draftThread)) === activeId) {
        feedback.className = 'reply-feedback status err';
        feedback.textContent = text + ' Your draft has been kept.';
      }
      setStatus(text, true);
    }).finally(function () {
      replyPending = false;
      button.disabled = false;
      button.textContent = 'Send';
      input.readOnly = false;
      if (feedback.textContent === 'Sending your message...') feedback.textContent = '';
    });
  }
  document.getElementById('new-thread').addEventListener('click', function () {
    draftThread = {
      id: '__draft_thread__',
      title: 'New thread draft',
      status: 'draft',
      draft: true,
      active: true,
      messages: [],
    };
    state.activeThread = draftThread;
    document.getElementById('reply-msg').value = NEW_THREAD_TEMPLATE;
    activateTab('threads');
    renderBody(state);
    setStatus('New draft thread ready. Edit the template, then click Send.');
  });
  document.getElementById('send-reply').addEventListener('click', function () {
    sendComposerMessage(false);
  });
  var replyInput = document.getElementById('reply-msg');
  var completionPopup = document.getElementById('reply-completion');
  var skillCatalogScope = null;
  var skillCatalogStore = completionApi.createCompletionCatalogStore();
  var skillCatalogPhase = 'idle';
  function syncSkillCatalogScope(s) {
    var scope = s.agent ? connectionKey(s.agent) + '|' + (s.subscription || '') + '|' +
      (s.subscriptionPicker && s.subscriptionPicker.revision || '') : '';
    if (scope === skillCatalogScope) return;
    skillCatalogScope = scope;
    skillCatalogPhase = 'idle';
    var ticket = skillCatalogStore.begin(scope || 'unselected');
    var unavailable = { status: 'unsupported', items: [], error: s.agent
      ? s.agent.external ? 'Catalog discovery is unavailable for external agents.' : 'Type / to load suggestions for this agent.'
      : 'Select an SRE Agent before loading suggestions.' };
    skillCatalogStore.commit(ticket, { skills: unavailable, agents: unavailable });
    if (replyCompletion) replyCompletion.dismiss();
  }
  function loadSkillSuggestions(retry) {
    syncSkillCatalogScope(state);
    if (!state.agent || state.agent.external || (!retry && skillCatalogPhase !== 'idle')) return;
    if (!retry && !completionApi.completionContext(replyInput.value, replyInput.selectionStart, replyInput.selectionEnd)) return;
    var ticket = skillCatalogStore.begin(skillCatalogScope);
    skillCatalogPhase = 'loading';
    postJson('/completion-catalog', {}).then(function (result) {
      syncSkillCatalogScope(state);
      var next = result && result.result;
      if (!next || !next.skills || !next.agents) throw new Error('The server returned unreadable suggestion catalogs.');
      if (skillCatalogStore.commit(ticket, next)) {
        skillCatalogPhase = 'done';
        replyCompletion.refresh();
      }
    }).catch(function (error) {
      syncSkillCatalogScope(state);
      if (skillCatalogStore.commit(ticket, {
        skills: { status: 'error', items: [], error: ('Skill discovery failed: ' + error.message).slice(0, 512) },
        agents: { status: 'error', items: [], error: ('Agent discovery failed: ' + error.message).slice(0, 512) }
      })) {
        skillCatalogPhase = 'done';
        replyCompletion.refresh();
      }
    });
  }
  function positionCompletionMenu() {
    if (completionPopup.hidden) return;
    var bounds = replyInput.getBoundingClientRect();
    var width = Math.min(bounds.width, Math.max(0, window.innerWidth - 16));
    completionPopup.style.width = width + 'px';
    completionPopup.style.left = Math.max(8, Math.min(bounds.left, window.innerWidth - width - 8)) + 'px';
    completionPopup.style.bottom = (window.innerHeight - bounds.top + 4) + 'px';
    completionPopup.style.maxHeight = Math.max(0, Math.min(320, bounds.top - 8, window.innerHeight * .45)) + 'px';
  }
  var replyCompletion = completionApi.bindComposerCompletion({
    input: replyInput,
    getCatalogs: function () {
      loadSkillSuggestions(false);
      return {
        skills: skillCatalogStore.snapshot().skills,
        agents: skillCatalogStore.snapshot().agents
      };
    },
    render: function (menu, activeIndex) {
      var aria = completionApi.completionAria(menu, activeIndex);
      Object.keys(aria.input).forEach(function (key) {
        if (aria.input[key]) replyInput.setAttribute(key, aria.input[key]);
        else replyInput.removeAttribute(key);
      });
      completionPopup.hidden = !menu;
      if (!menu) { completionPopup.innerHTML = ''; return; }
      var index = 0;
      var groups = menu.groups.map(function (group) {
        var items = group.items.map(function (item) {
          var option = aria.options[index];
          return '<button type="button" class="completion-option" role="option" tabindex="-1" id="' + option.id +
            '" aria-selected="' + option['aria-selected'] + '" data-completion-index="' + index++ + '"><strong>' +
            escapeHtml(item.kind === 'agent' ? item.name : '/' + item.name) + '</strong><span>' +
            escapeHtml(item.description) + '</span></button>';
        }).join('');
        var note = group.status === 'ready' ? [!group.items.length ? 'No matching suggestions.' : '', group.notice || ''].filter(Boolean).join(' ')
          : group.status === 'loading' ? 'Loading suggestions...' : group.error;
        return '<div role="group" aria-label="' + escapeHtml(group.label) + '"><div class="completion-group-label" aria-hidden="true">' +
          escapeHtml(group.label) + '</div>' + items +
          (note ? '<p class="completion-note" role="status">' + escapeHtml(note) + '</p>' : '') +
          (group.status === 'error'
            ? '<button type="button" class="btn ghost mini" tabindex="-1" data-completion-retry>Retry ' +
              (group.label === 'AGENTS' ? 'agent' : 'skill') + ' discovery</button>' : '') + '</div>';
      }).join('');
      completionPopup.innerHTML = (menu.level === 'agents' ? '<button type="button" class="btn ghost mini" tabindex="-1" data-completion-back>Back to commands</button>' : '') +
        '<div id="' + aria.listbox.id + '" role="listbox" aria-label="' + aria.listbox['aria-label'] + '">' + groups + '</div>' +
        '<p class="completion-note">Portal command suggestions; service semantics are not verified here. Selection fills the draft only. Text is sent unchanged. Escape closes the menu.</p>';
      positionCompletionMenu();
      var selected = completionPopup.querySelector('[aria-selected="true"]');
      if (selected) selected.scrollIntoView({ block: 'nearest' });
    }
  });
  completionPopup.addEventListener('mousedown', function (event) { event.preventDefault(); });
  completionPopup.addEventListener('click', function (event) {
    var option = event.target.closest('[data-completion-index]');
    if (option) replyCompletion.choose(Number(option.dataset.completionIndex));
    else if (event.target.closest('[data-completion-back]')) replyCompletion.back();
    else if (event.target.closest('[data-completion-retry]')) {
      loadSkillSuggestions(true);
      replyCompletion.refresh();
    }
  });
  replyInput.addEventListener('blur', function () { replyCompletion.dismiss(); });
  window.addEventListener('resize', positionCompletionMenu);
  window.addEventListener('scroll', positionCompletionMenu, true);
  document.getElementById('reply-msg').addEventListener('keydown', function (event) {
    if (replyPending || replyCompletion.keydown(event)) return;
    var activeThread = displayedActiveThread(state, draftThread);
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing || event.keyCode === 229 || !threadId(activeThread) || activeThread.draft) return;
    event.preventDefault();
    sendComposerMessage(false);
  });
  document.getElementById('focus-thread').addEventListener('click', function () {
    var activeId = threadId(displayedActiveThread(state, draftThread));
    if (!activeId) { setStatus('Select a thread first.', true); return; }
    postJson(state.focusedThreadId === activeId ? '/unfocus-thread' : '/focus-thread', { threadId: activeId });
  });
  document.getElementById('thread-filter').addEventListener('change', function () { renderBody(state); });
  document.getElementById('thread-type-filter').addEventListener('change', function () { renderBody(state); });
  document.getElementById('thread-sort').addEventListener('change', function () { renderBody(state); });
  document.getElementById('clear-thread-focus').addEventListener('click', function () {
    postJson('/unfocus-thread', {}).then(function () {
      var target = document.getElementById('focus-thread');
      (target.hidden ? document.getElementById('thread-detail') : target).focus();
    })
      .catch(function (error) { setStatus('Could not clear thread focus: ' + error.message, true); });
  });
  document.getElementById('focus-badge').addEventListener('click', function () {
    if (!state.focusedThreadId) return;
    openThread(state.focusedThreadId);
  });
  function openSelectedThreadInPortal() {
    if (!state.agent) { setStatus('Select an SRE Agent first.', true); return; }
    if (state.agent.external) {
      if (!state.agent.portalUrl) {
        setStatus('Paste the registered external-agent portal link to open it in Portal.', true);
        return;
      }
      window.open(state.agent.portalUrl, '_blank', 'noopener');
      return;
    }
    if (!state.subscription) { setStatus('Select a subscription first.', true); return; }
    var activeThread = displayedActiveThread(state, draftThread);
    var activeId = activeThread && !activeThread.draft ? threadId(activeThread) : '';
    var url = 'https://sre.azure.com/agents/subscriptions/' + encodeURIComponent(state.subscription) +
      '/resourceGroups/' + encodeURIComponent(state.agent.resourceGroup) +
      '/providers/Microsoft.App/agents/' + encodeURIComponent(state.agent.name);
    if (activeId) url += '/views/thread/' + encodeURIComponent(activeId);
    window.open(url, '_blank', 'noopener');
  }
  document.getElementById('open-in-portal').addEventListener('click', function () {
    openSelectedThreadInPortal();
  });

  function submitIncidentQuery() {
    clearTimeout(incidentQueryTimer);
    incidentQueryTimer = null;
    postJson('/query-incidents', {
      query: document.getElementById('incident-search').value,
      status: document.getElementById('incident-status-filter').value,
    });
  }
  function queryIncidents() {
    clearTimeout(incidentQueryTimer);
    incidentQueryTimer = setTimeout(submitIncidentQuery, 250);
  }
  document.getElementById('incident-search').addEventListener('input', queryIncidents);
  document.getElementById('incident-search').addEventListener('keydown', function (event) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    submitIncidentQuery();
  });
  document.getElementById('incident-status-filter').addEventListener('change', submitIncidentQuery);
  document.getElementById('search-incidents').addEventListener('click', submitIncidentQuery);
  document.getElementById('refresh-incidents').addEventListener('click', function () {
    postJson('/refresh-incidents');
  });
  document.getElementById('load-more-incidents').addEventListener('click', function () {
    postJson('/load-more-incidents');
  });
  function syncIncidentScrollButtons() {
    var list = document.getElementById('incident-list');
    var max = Math.max(0, list.scrollWidth - list.clientWidth);
    document.getElementById('incident-scroll-left').disabled = list.scrollLeft <= 1;
    document.getElementById('incident-scroll-right').disabled = list.scrollLeft >= max - 1;
  }
  var incidentList = document.getElementById('incident-list');
  incidentList.addEventListener('scroll', syncIncidentScrollButtons);
  window.addEventListener('resize', function () {
    syncIncidentScrollButtons();
    syncIncidentLayout();
  });
  configCard.addEventListener('toggle', syncIncidentLayout);
  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(syncIncidentScrollButtons).observe(incidentList);
  }
  document.getElementById('incident-scroll-left').addEventListener('click', function () {
    var list = document.getElementById('incident-list');
    list.scrollBy({ left: -Math.max(320, list.clientWidth * .8), behavior: 'auto' });
  });
  document.getElementById('incident-scroll-right').addEventListener('click', function () {
    var list = document.getElementById('incident-list');
    list.scrollBy({ left: Math.max(320, list.clientWidth * .8), behavior: 'auto' });
  });
  document.getElementById('back-to-incidents').addEventListener('click', function () {
    if (!incidentReturnState) return;
    var saved = incidentReturnState;
    incidentReturnState = null;
    selectedIncidentId = saved.selectedId || '';
    document.getElementById('incident-search').value = saved.query || '';
    activateTab('incidents');
    renderIncidents(state);
    document.getElementById('incident-status-filter').value = saved.status || '';
    renderIncidents(state);
    requestAnimationFrame(function () {
      document.getElementById('incident-list').scrollTop = saved.scrollTop || 0;
      document.getElementById('incident-list').scrollLeft = saved.scrollLeft || 0;
      syncIncidentScrollButtons();
      var selected = document.querySelector('#incident-list tr[aria-selected="true"]');
      if (selected) selected.focus({ preventScroll: true });
    });
  });
  document.getElementById('open-incidents-portal').addEventListener('click', function () {
    if (!state.agent) { setStatus('Select an SRE Agent first.', true); return; }
    try {
      var url;
      if (state.agent.external) {
        var portal = new URL(state.agent.portalUrl || '');
        var endpoints = portal.searchParams.getAll('agentUrl');
        var endpoint = endpoints.length === 1 ? new URL(endpoints[0]) : null;
        if (portal.protocol !== 'https:' || portal.host !== 'sre.azure.com' ||
            !/^\\/externalagents\\/[^/]+\\/?$/i.test(portal.pathname) || !endpoint ||
            endpoint.origin !== state.agent.endpoint || endpoint.protocol !== 'https:' ||
            !endpoint.hostname.endsWith('.azuresre.ai') || endpoint.username || endpoint.password ||
            endpoint.port || endpoint.pathname !== '/' || endpoint.search || endpoint.hash) {
          throw new Error('Paste the registered external-agent portal link to open incidents in Portal.');
        }
        portal.hash = '/views/incidents';
        url = portal.href;
      } else {
        if (!state.subscription || !state.agent.resourceGroup || !state.agent.name) {
          throw new Error('The connected agent does not have a complete Azure resource scope.');
        }
        url = 'https://sre.azure.com/agents/subscriptions/' + encodeURIComponent(state.subscription) +
          '/resourceGroups/' + encodeURIComponent(state.agent.resourceGroup) +
          '/providers/Microsoft.App/agents/' + encodeURIComponent(state.agent.name) +
          '/views/incidents';
      }
      window.open(url, '_blank', 'noopener');
    } catch (error) {
      setStatus(error.message, true);
    }
  });

  var es = new EventSource('/events');
  var esGotFirstMessage = false;
  es.addEventListener('state', function (e) { esGotFirstMessage = true; render(JSON.parse(e.data)); });
  // Each time this extension is reloaded, the canvas server restarts on a fresh port and
  // this panel's live connection dies for good (EventSource can't reconnect across a port
  // change). Without this, the UI just silently freezes on stale data forever - surface it
  // instead so it's obvious a reopen/reload of the canvas panel is needed.
  es.addEventListener('error', function () {
    if (es.readyState === EventSource.CLOSED) {
      setStatus('Lost connection to the canvas server (likely reloaded on a new port) - reopen this canvas panel to reconnect.', true);
    }
  });
  postJson('/init').then(function (response) {
    if (response.result?.agentConnected && !response.result.favoritesError && !configSummaryTouched) configCard.open = false;
  }, function (error) {
    setStatus('Could not initialize Azure Configuration: ' + error.message, true);
  });
})();
</script>
</body>
</html>`;
}
export {
  APP_RESOURCE_GRAPH_QUERY,
  AZURE_SRE_AGENT_CSP,
  activateDefaultThread,
  appendFocusContract,
  authorizeExecutionSafely,
  azureDiscoveryFailure,
  azureSreAgentAssets,
  canvas,
  clearThreadContext,
  connectorNameOwnedBy,
  connectorOwnerKey,
  createThread,
  dedupeIncidents,
  deriveIncidents,
  diagnoseApp,
  externalAgentRouteAllowed,
  getAutomationHistory,
  getThread,
  incidentContractMetadata,
  incidentResponsePlanUrl,
  incidentThreadFilter,
  incidentsPortalUrl,
  isAgentContextSwitch,
  isNoQueryableSubscriptionsError,
  listActiveIncidents,
  listAgentsForSelection,
  listHttpTriggers,
  listScheduledTasks,
  listThreads,
  loadAgentsForScope,
  loadAgentsForSub,
  loadOptionalIncidents,
  loadOptionalScheduledTasks,
  openSharedAgentReference,
  parseExternalAgentReference,
  parseSharedAgentReference,
  projectIncident,
  projectIncidentCounts,
  readFavorites,
  readSelectedThread,
  refreshAutomationCollections,
  refreshHttpTriggers,
  refreshScheduledTasks,
  renderHtml,
  resolveAgentSelection,
  resolveFavoriteSelection,
  retainInitialThreadPrompt,
  scheduledTasksModelResult,
  selectAgent,
  selectSavedFavorite,
  shortError2 as shortError,
  threadTitleFilter,
  updateFavorite,
  waitForNewAgentReplies
};
