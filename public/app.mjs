import { destination, searchEngines } from "./navigation.mjs";
import { checkDevice } from "./device-access.mjs";
import { mountFrosty } from "./frosty/assistant.mjs";
import {
  defaults,
  saveSession,
  loadSession,
  loadPreferences,
  savePreferences,
  normalizeSettings,
  readList,
  writeList,
  makeTab,
  recordNavigation,
  historyTarget,
} from "./state.mjs";
import { createBrowserTransport, validateEndpoint } from "./transport.mjs";
import { createTabBar, setupOmnibox } from "./browser-controls.mjs";
import { createDownloads } from "./downloads.mjs";
import { createPanels } from "./panels.mjs";
const $ = (id) => document.getElementById(id);
let storage;
try {
  storage = localStorage;
} catch {
  storage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
}
let settings = loadPreferences(storage),
  history = readList(storage, "history"),
  bookmarks = readList(storage, "bookmarks");
const tabs = [],
  closedTabs = [];
let active,
  panel,
  engineState = "Starting Frost…";
const transport = createBrowserTransport(() => settings);
const transfers = createDownloads({
  transport,
  changed: () => panel?.refresh(),
});
const getState = () => ({
  settings,
  history,
  bookmarks,
  downloads: transfers.items,
  active,
  closedTabs,
});
mountFrosty({
  onOpen(){exitSiteFullscreen();document.getElementById('browser-menu').hidden=true;},
  getPage(kind){
    if(!active?.element||active.home||active.error)throw new Error('Open a webpage first.');
    try {
      const doc=active.element.contentDocument;
      if(!doc?.body)throw new Error();
      let text;
      if(kind==='selection')text=active.element.contentWindow.getSelection()?.toString();
      else {const clone=doc.body.cloneNode(true);clone.querySelectorAll('script,style,noscript,input,textarea,select,[hidden],[aria-hidden="true"]').forEach(node=>node.remove());text=clone.textContent;}
      return {title:active.title||'Current page',text:String(text||'').trim().slice(0,16000)};
    }catch{throw new Error('This page does not allow Frosty to read its text. You can paste an excerpt instead.');}
  },
  openLink(url){if(tabs.length>=24){status('Close a tab before opening another.');return;}const tab=makeTab(crypto.randomUUID());tabs.push(tab);activate(tab);void navigateTo(url,tab);}
});
function status(message) {
  $("status").textContent = message;
}
const tabBar = createTabBar({
  container: $("tabs"),
  select: activate,
  close: closeTab,
  reorder: (from, to) => {
    const index = tabs.findIndex((tab) => tab.id === from);
    const target = tabs.findIndex((tab) => tab.id === to);
    if (index >= 0 && target >= 0) {
      tabs.splice(target, 0, tabs.splice(index, 1)[0]);
      renderTabs();
    }
  },
});
function renderTabs() {
  if (active) saveSession(storage, tabs, active.id);
  tabBar(tabs, active);
  $("tab-count").textContent =
    `${tabs.length} ${tabs.length === 1 ? "tab" : "tabs"}`;
  $("new-tab").disabled = tabs.length >= 24;
}
function applySettings() {
  document.body.dataset.theme = "light";
  document.body.dataset.compactTabs = String(settings.compactTabs);
  document.body.dataset.animations = String(settings.animations);
  document.body.style.setProperty(
    "--ice",
    `color-mix(in srgb, var(--accent) ${settings.accentIntensity}%, var(--muted))`,
  );
  document.querySelector(".wordmark").src = settings.animations
    ? "/wordmark.svg"
    : "/wordmark-still.svg";
  $("search-engine").value = settings.searchEngine;
  $("engine-caption").textContent =
    `Search with ${searchEngines[settings.searchEngine].name}`;
  $("bookmarks-bar").hidden = !settings.showBookmarks;
  renderBookmarks();
}
async function updateSettings(patch) {
  const next = normalizeSettings({ ...settings, ...patch });
  if (next.transport === "external")
    next.endpoint = validateEndpoint(next.endpoint);
  const transportChanged =
    next.transport !== settings.transport ||
    next.endpoint !== settings.endpoint;
  settings = next;
  savePreferences(storage, settings);
  applySettings();
  if (transportChanged) {
    for (const tab of tabs) {
      tab.revision++;
      clearTimeout(tab.timer);
      tab.view?.destroy();
      tab.view = null;
      tab.element = null;
      tab.loading = false;
    }
    if (active.url) void navigateTo(active.url, active, { traverse: true });
  }
  status(
    transportChanged ? "Connection settings applied" : "Preferences saved",
  );
}
function renderBookmarks() {
  $("bookmarks-bar").replaceChildren(
    ...bookmarks.map((item) => {
      const button = document.createElement("button");
      button.textContent = item.title || new URL(item.url).hostname;
      button.title = item.url;
      button.onclick = () => navigateTo(item.url);
      return button;
    }),
  );
  if (!bookmarks.length) {
    const hint = document.createElement("span");
    hint.textContent = "Star a page to keep it here.";
    $("bookmarks-bar").append(hint);
  }
  const selected = bookmarks.some((item) => item.url === active?.url);
  $("bookmark-toggle").setAttribute("aria-pressed", String(selected));
  $("bookmark-toggle").setAttribute(
    "aria-label",
    selected ? "Remove bookmark" : "Bookmark page",
  );
  $("bookmark-toggle").disabled = !active?.url;
}
function toggleBookmark() {
  if (!active.url) return;
  const index = bookmarks.findIndex((item) => item.url === active.url);
  if (index >= 0) bookmarks.splice(index, 1);
  else
    bookmarks.unshift({
      url: active.url,
      title: active.title,
      createdAt: Date.now(),
    });
  writeList(storage, "bookmarks", bookmarks);
  renderBookmarks();
  status(index >= 0 ? "Bookmark removed" : "Page bookmarked");
}
function removeBookmark(url) {
  bookmarks = bookmarks.filter((item) => item.url !== url);
  writeList(storage, "bookmarks", bookmarks);
  renderBookmarks();
}
function addVisit(tab) {
  if (!tab.url || tab.error) return;
  const last = history[0];
  if (last?.url === tab.url && Date.now() - last.visitedAt < 3000) return;
  history.unshift({
    url: tab.url,
    title: tab.title,
    visitedAt: Date.now(),
    favicon: tab.favicon,
  });
  history = history.slice(0, 500);
  writeList(storage, "history", history);
}
function displayAddress() {
  if (document.activeElement === $("address")) return;
  $("address").value = active.home
    ? ""
    : active.url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}
function syncChrome() {
  $("back").disabled = active.historyIndex <= 0;
  $("forward").disabled = active.historyIndex >= active.history.length - 1;
  $("reload").disabled = !active.url;
  $("site-fullscreen").disabled = !active.url || active.home || !!active.error;
  $("reload").setAttribute(
    "aria-label",
    active.loading ? "Stop loading" : "Reload",
  );
  $("reload").title = active.loading ? "Stop loading" : "Reload";
  $("reload").dataset.loading = String(active.loading);
  $("loading-progress").style.width =
    `${active.loading ? active.progress : 0}%`;
  $("loading-progress").hidden = !active.loading;
  $("loading-progress").setAttribute(
    "aria-valuenow",
    String(Math.round(active.progress)),
  );
  displayAddress();
  renderBookmarks();
  status(active.message || engineState);
  document.title = "Home | Schoology";
}
function showError(tab) {
  const region = $("error-view");
  region.replaceChildren();
  region.hidden = tab !== active || !tab.error;
  if (region.hidden) return;
  const icon = document.createElement("img");
  icon.src = "/icon.svg";
  icon.alt = "";
  icon.width = 40;
  icon.height = 40;
  const title = document.createElement("h1");
  title.textContent =
    tab.error.kind === "offline"
      ? "You're offline"
      : tab.error.kind === "invalid"
        ? "That address doesn't look valid."
        : "Couldn't reach this page";
  const text = document.createElement("p");
  text.textContent =
    tab.error.kind === "offline"
      ? "Check your internet connection, then try again."
      : tab.error.kind === "invalid"
        ? "Edit the address, or search for the text you entered."
        : "Frost couldn't establish a connection to this address.";
  const detail = document.createElement("small");
  detail.textContent = tab.error.message;
  const controls = document.createElement("div");
  const retry = document.createElement("button");
  retry.textContent =
    tab.error.kind === "invalid" ? "Search instead" : "Try again";
  retry.onclick = () =>
    navigateTo(
      tab.error.kind === "invalid"
        ? searchEngines[settings.searchEngine].url +
            encodeURIComponent(tab.error.input)
        : tab.url,
      tab,
      { traverse: true },
    );
  const back = document.createElement("button");
  back.textContent = tab.historyIndex > 0 ? "Go back" : "New tab";
  back.onclick = () => (tab.historyIndex > 0 ? goHistory(-1) : goHome());
  controls.append(retry, back);
  region.append(icon, title, text, detail, controls);
}
function activate(tab) {
  if (tab.home || tab.error) exitSiteFullscreen();
  active = tab;
  tabs.forEach((item) => {
    item.active = item === tab;
    if (item.element)
      item.element.hidden = item !== tab || item.home || !!item.error;
  });
  $("landing").hidden = !tab.home || !!tab.error;
  $("viewport").hidden = tab.home || !!tab.error;
  showError(tab);
  syncChrome();
  renderTabs();
  if (tab.url && !tab.home && !tab.view && !tab.loading && !tab.error)
    void navigateTo(tab.url, tab, { traverse: true });
}
function newTab() {
  if (tabs.length >= 24) {
    status("Close a tab before opening another.");
    return;
  }
  const tab = makeTab(crypto.randomUUID());
  tab.message = engineState;
  tabs.push(tab);
  activate(tab);
  $("search").value = "";
  $("search").focus();
  return tab;
}
function closeTab(tab = active) {
  const index = tabs.indexOf(tab);
  if (index < 0) return;
  if (tab.url) closedTabs.unshift({ url: tab.url, title: tab.title });
  closedTabs.splice(20);
  tab.revision++;
  clearTimeout(tab.timer);
  tab.view?.destroy();
  tabs.splice(index, 1);
  if (!tabs.length) newTab();
  else if (tab === active) activate(tabs[Math.min(index, tabs.length - 1)]);
  else renderTabs();
}
function reopenTab() {
  const saved = closedTabs.shift();
  if (!saved) return;
  const tab = newTab();
  if (tab) void navigateTo(saved.url, tab);
}
function goHome() {
  active.home = true;
  active.error = null;
  activate(active);
  $("search").focus();
}
function failure(tab, error, kind = "failed", input = "") {
  clearTimeout(tab.timer);
  tab.loading = false;
  tab.error = { kind, message: error.message, input };
  tab.message = kind === "offline" ? "You're offline" : "Navigation failed";
  if (tab === active) activate(tab);
  else renderTabs();
}
async function attachView(tab, revision) {
  if (tab.view) return;
  const element = document.createElement("iframe");
  element.title = "Webpage";
  element.setAttribute(
    "sandbox",
    "allow-scripts allow-same-origin allow-forms allow-downloads allow-modals allow-pointer-lock",
  );
  element.referrerPolicy = "no-referrer";
  element.allowFullscreen = true;
  element.hidden = true;
  $("viewport").append(element);
  let view;
  try {
    view = await transport.createView(element, (url, options) => {
      if (!tabs.includes(tab)) return;
      if (!options.newTab) { void navigateTo(url, tab); return; }
      if (tabs.length >= 24) { status("Close a tab before opening another."); return; }
      const next = makeTab(crypto.randomUUID());
      tabs.push(next);
      if (!options.background) activate(next);
      renderTabs();
      void navigateTo(url, next);
    });
  } catch (error) {
    element.remove();
    throw error;
  }
  if (!tabs.includes(tab) || revision !== tab.revision) {
    view.destroy();
    return;
  }
  tab.element = element;
  tab.view = view;
  element.addEventListener("load", () => {
    if (
      !tab.url ||
      !tabs.includes(tab) ||
      tab.view !== view ||
      tab.element !== element ||
      tab.error ||
      !element.isConnected
    )
      return;
    try { element.contentDocument.addEventListener("keydown", event => { if (event.key === "Escape") exitSiteFullscreen(); }); } catch {}
    const snapshot = view.inspect();
    if (!snapshot) return;
    if (snapshot.error) {
      failure(
        tab,
        new Error(
          "The browsing connection failed. Check the address or try another site.",
        ),
      );
      return;
    }
    if (snapshot.url) {
      tab.url = snapshot.url;
      tab.title = snapshot.title.slice(0, 120) || new URL(tab.url).hostname;
      tab.favicon = snapshot.favicon || "/icon.svg";
      recordNavigation(tab, tab.url, { replace: tab.replaceOnLoad === true });
    }
    clearTimeout(tab.timer);
    tab.loading = false;
    tab.replaceOnLoad = false;
    tab.progress = 100;
    tab.error = null;
    tab.message = snapshot.external
      ? "External connection loaded · Site details unavailable"
      : "Page loaded";
    addVisit(tab);
    if (tab === active) activate(tab);
    else renderTabs();
  });
}
async function navigateTo(input, tab = active, options = {}) {
  const revision = ++tab.revision;
  let url;
  try {
    url = destination(input, settings.searchEngine);
  } catch (error) {
    failure(tab, error, "invalid", input);
    return;
  }
  tab.error = null;
  tab.url = url;
  tab.title = new URL(url).hostname;
  tab.home = false;
  tab.loading = true;
  tab.replaceOnLoad = true;
  tab.progress = 12;
  tab.message = "Connecting…";
  if (!options.traverse) recordNavigation(tab, url);
  if (tab === active) activate(tab);
  else renderTabs();
  if (!navigator.onLine) {
    failure(tab, new Error("No network connection is available."), "offline");
    return;
  }
  clearTimeout(tab.timer);
  tab.timer = setTimeout(() => {
    tab.view?.stop();
    failure(
      tab,
      new Error(
        "The connection timed out. The website may be unavailable or incompatible with this browser.",
      ),
    );
  }, 30000);
  try {
    await attachView(tab, revision);
    if (!tabs.includes(tab) || tab.revision !== revision) return;
    tab.view.navigate(url);
    tab.favicon = tab.view.favicon(url);
    if (tab === active) activate(tab);
  } catch (error) {
    if (tab.revision === revision) failure(tab, error);
  }
}
function goHistory(direction) {
  const url = historyTarget(active, direction);
  if (url) void navigateTo(url, active, { traverse: true });
}
function reload() {
  if (active.loading) {
    active.view?.stop();
    active.revision++;
    clearTimeout(active.timer);
    active.loading = false;
    active.message = "Loading stopped";
    syncChrome();
    return;
  }
  if (active.url) void navigateTo(active.url, active, { traverse: true });
}
async function clearData() {
  sessionStorage.setItem('frost.reset-request', 'confirmed');
  location.assign("/reset.html");
}
const actions = {
  navigate: navigateTo,
  newTab,
  closeTab: () => closeTab(),
  reopenTab,
  reload,
  toggleFullscreen: siteFullscreen,
  copyUrl: async () => {
    if (active.url) {
      await navigator.clipboard.writeText(active.url);
      status("URL copied");
    }
  },
  clearHistory: () => {
    history = [];
    for (const tab of tabs) { tab.history = tab.url ? [tab.url] : []; tab.historyIndex = tab.url ? 0 : -1; tab.forwardHistory = []; }
    saveSession(storage, tabs, active.id);
    syncChrome();
    writeList(storage, "history", history);
  },
  clearData,
  updateSettings,
  removeBookmark,
  removeDownload: transfers.remove,
  saveDownload: transfers.save,
  cancelDownload: transfers.cancel,
  openDownload: transfers.open,
};
panel = createPanels({ getState, actions });
const restored = loadSession(storage);
if (restored.tabs.length) {
  tabs.push(...restored.tabs);
  activate(tabs.find(tab => tab.id === restored.activeId) || tabs[0]);
} else newTab();
applySettings();
transport
  .initialize()
  .then(() => {
    engineState = "Frost ready";
    if (active.home) {
      active.message = engineState;
      status(engineState);
    }
  })
  .catch((error) => {
    engineState = error.message;
    if (active.home) status(engineState);
  });
const omnibox = setupOmnibox({
  input: $("address"),
  list: $("suggestions"),
  navigate: navigateTo,
  getItems: (text) => {
    const needle = text.trim().toLowerCase();
    const matches = [...bookmarks, ...history]
      .filter(
        (item, index, array) =>
          array.findIndex((other) => other.url === item.url) === index &&
          (!needle ||
            (item.title + " " + item.url).toLowerCase().includes(needle)),
      )
      .slice(0, 5)
      .map((item) => ({
        title: item.title,
        detail: item.url,
        value: item.url,
      }));
    return needle
      ? [
          {
            title: `Open or search “${text.trim()}”`,
            detail: searchEngines[settings.searchEngine].name,
            value: text.trim(),
          },
          ...matches,
        ]
      : matches;
  },
});
$("address").addEventListener("focus", () => {
  $("address").value = active.home ? "" : active.url;
  $("address").select();
});
$("address").addEventListener("blur", displayAddress);
for (const [form, input] of [
  ["address-form", "address"],
  ["search-form", "search"],
])
  $(form).addEventListener("submit", (event) => {
    event.preventDefault();
    omnibox.hide();
    void navigateTo($(input).value);
  });
document
  .querySelectorAll("[data-url]")
  .forEach((button) => (button.onclick = () => navigateTo(button.dataset.url)));
$("new-tab").onclick = newTab;
$("site-fullscreen").onclick = siteFullscreen;
$("exit-fullscreen").onclick = exitSiteFullscreen;
$("home").onclick = goHome;
$("back").onclick = () => goHistory(-1);
$("forward").onclick = () => goHistory(1);
$("reload").onclick = reload;
$("bookmark-toggle").onclick = toggleBookmark;
$("search-engine").onchange = () =>
  updateSettings({ searchEngine: $("search-engine").value });
function openPanel(name) {
  $("browser-menu").hidden = true;
  $("menu-toggle").setAttribute("aria-expanded", "false");
  panel.open(name);
}
const menu = $("browser-menu");
for (const [label, action] of [
  ["New Tab", newTab],
  ["Site fullscreen", siteFullscreen],
  ["Reopen Closed Tab", reopenTab],
  ["History", () => openPanel("history")],
  ["Downloads", () => openPanel("downloads")],
  ["Bookmarks", () => openPanel("bookmarks")],
  ["Settings", () => openPanel("settings")],
  ["Admin Console", () => { if (adminOrigin) window.open(adminOrigin, "_blank", "noopener,noreferrer"); else status("Admin console setup is still in progress."); }],
  ["Command Palette", () => openPanel("commands")],
  ["About Frost", () => openPanel("about")],
]) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.setAttribute("role", "menuitem");
  button.onclick = () => {
    menu.hidden = true;
    action();
  };
  menu.append(button);
}
const zoom = document.createElement("div");
zoom.className = "menu-zoom";
for (const [label, delta] of [
  ["−", -10],
  ["Reset zoom", 0],
  ["+", 10],
]) {
  const button = document.createElement("button");
  button.textContent = label;
  button.onclick = () => {
    active.zoom = delta
      ? Math.max(50, Math.min(200, active.zoom + delta))
      : 100;
    if (active.element) active.element.style.zoom = active.zoom / 100;
    status(`Page zoom ${active.zoom}%`);
  };
  zoom.append(button);
}
menu.append(zoom);
$("menu-toggle").onclick = () => {
  menu.style.top = `${$("menu-toggle").getBoundingClientRect().bottom + 8}px`;
  menu.style.maxHeight = `calc(100dvh - ${$("menu-toggle").getBoundingClientRect().bottom + 16}px)`;
  menu.style.overflowY = "auto";
  menu.hidden = !menu.hidden;
  $("menu-toggle").setAttribute("aria-expanded", String(!menu.hidden));
  if (!menu.hidden) menu.querySelector("button").focus();
};
menu.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    menu.hidden = true;
    $("menu-toggle").focus();
  }
  if (["ArrowDown", "ArrowUp"].includes(event.key)) {
    event.preventDefault();
    const buttons = [...menu.querySelectorAll("button")];
    buttons[
      (buttons.indexOf(document.activeElement) +
        (event.key === "ArrowDown" ? 1 : -1) +
        buttons.length) %
        buttons.length
    ].focus();
  }
});
document.addEventListener("click", (event) => {
  if (!menu.contains(event.target) && !$("menu-toggle").contains(event.target))
    menu.hidden = true;
});
document.addEventListener("keydown", (event) => {
  if ($("panel-dialog").open || document.body.classList.contains("frosty-open")) return;
  const mod = event.ctrlKey || event.metaKey;
  let action;
  if (mod) {
    const key = event.key.toLowerCase();
    if (key === "l")
      action = () => {
        $("address").focus();
        $("address").select();
      };
    if (key === "k") action = () => openPanel("commands");
    if (key === "t") action = event.shiftKey ? reopenTab : newTab;
    if (key === "w") action = () => closeTab();
    if (key === "r") action = reload;
    if (key === "tab")
      action = () =>
        activate(
          tabs[
            (tabs.indexOf(active) + (event.shiftKey ? -1 : 1) + tabs.length) %
              tabs.length
          ],
        );
  }
  if (event.altKey && event.key === "ArrowLeft") action = () => goHistory(-1);
  if (event.altKey && event.key === "ArrowRight") action = () => goHistory(1);
  if (action) {
    event.preventDefault();
    action();
  }
});

addEventListener("offline", () => {
  if (active.loading)
    failure(
      active,
      new Error("No network connection is available."),
      "offline",
    );
  else status("You're offline");
});
addEventListener("online", () => status("Connection restored"));
setInterval(() => {
  let changed = false;
  for (const tab of tabs) {
    if (tab.loading)
      tab.progress = Math.min(85, tab.progress + (85 - tab.progress) * 0.08);
    if (tab.view && !tab.loading && !tab.error) {
      const snapshot = tab.view.inspect();
      if (snapshot?.url && snapshot.url !== tab.url) {
        tab.url = snapshot.url;
        tab.title = snapshot.title.slice(0, 120);
        recordNavigation(tab, tab.url);
        addVisit(tab);
        renderTabs();
        changed = true;
      }
    }
  }
  if (changed) syncChrome();
  if (active.loading) {
    $("loading-progress").style.width = `${active.progress}%`;
    $("loading-progress").setAttribute(
      "aria-valuenow",
      String(Math.round(active.progress)),
    );
  }
}, 500);

function exitSiteFullscreen() {
  document.body.classList.remove('site-fullscreen');
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
}
async function siteFullscreen() {
  if (document.body.classList.contains('site-fullscreen') || document.fullscreenElement) return exitSiteFullscreen();
  if (!active?.url || active.home || active.error) return status('Open a website first.');
  document.body.classList.add('site-fullscreen');
  // Embedded browsers can reject native fullscreen. The site still fills the app.
  if (document.fullscreenEnabled) {
    try { await $('viewport').requestFullscreen(); } catch {}
  }
  $('exit-fullscreen').focus();
}
document.addEventListener('keydown', event => { if(event.key === 'Escape') exitSiteFullscreen(); });
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement) document.body.classList.remove('site-fullscreen');
});
async function refreshAnnouncement() {
  try {
    const response = await fetch('/api/announcement', {cache:'no-store'});
    if (!response.ok) return;
    const {message} = await response.json();
    $('announcement-text').textContent = typeof message === 'string' ? message : '';
    $('announcement').hidden = !message;
  } catch {}
}
void refreshAnnouncement();
setInterval(refreshAnnouncement, 60000);

let adminOrigin = "";
void fetch("/api/config", {cache:"no-store"}).then(response=>response.json()).then(config=>{ if(/^https:\/\/d[a-z0-9]+\.cloudfront\.net$/.test(config.adminOrigin)) adminOrigin=config.adminOrigin; }).catch(()=>{});

// One ID per browser and origin, reused across tabs. Never includes visited URLs.
let visitorId;
try { visitorId=localStorage.getItem('frost.presence.v1'); } catch {}
if(!/^[a-f0-9-]{36}$/.test(visitorId||'')) visitorId=crypto.randomUUID();
try { localStorage.setItem('frost.presence.v1',visitorId); } catch {}
let presencePending=false;
async function refreshPresence(){
 if(presencePending) return;
 presencePending=true;
 try {
  const response=await fetch('/api/presence?id='+encodeURIComponent(visitorId),{cache:'no-store',signal:AbortSignal.timeout(6000)});
  const data=await response.json();
  $('online-count').textContent=response.ok && Number.isInteger(data.online) ? data.online+' online' : 'Online unavailable';
  $('server-name').textContent=typeof data.server==='string' ? 'Server: '+data.server : 'Server unavailable';
 } catch { $('online-count').textContent='Online unavailable'; $('server-name').textContent='Server unavailable'; }
 finally { presencePending=false; }
}
void refreshPresence();
setInterval(refreshPresence,20000);
setInterval(()=>void checkDevice().catch(error=>status(error.message)),15000);
addEventListener('online',refreshPresence);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refreshPresence();});
