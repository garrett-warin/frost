import { searchEngines } from "./navigation.mjs";
export const defaults = Object.freeze({
  theme: "light",
  showBookmarks: false,
  compactTabs: false,
  animations: true,
  accentIntensity: 80,
  searchEngine: "duckduckgo",
  transport: "bonfire",
  endpoint: "",
});
const KEY = "frost.preferences.v1";
export function loadPreferences(storage) {
  try {
    return normalizeSettings(JSON.parse(storage.getItem(KEY) || "{}"));
  } catch {
    return { ...defaults };
  }
}
export function normalizeSettings(value = {}) {
  return {
    ...defaults,
    theme: "light",
    showBookmarks: value.showBookmarks === true,
    compactTabs: value.compactTabs === true,
    animations: value.animations !== false,
    accentIntensity: Number.isFinite(Number(value.accentIntensity))
      ? Math.max(40, Math.min(100, Number(value.accentIntensity)))
      : 80,
    searchEngine: Object.hasOwn(searchEngines, value.searchEngine)
      ? value.searchEngine
      : "duckduckgo",
    transport: value.transport === "external" ? "external" : "bonfire",
    endpoint: typeof value.endpoint === "string" ? value.endpoint : "",
  };
}
export function savePreferences(storage, settings) {
  try {
    storage.setItem(KEY, JSON.stringify(settings));
  } catch {}
}
export function readList(storage, key) {
  try {
    const result = JSON.parse(storage.getItem(`frost.${key}.v1`) || "[]");
    return Array.isArray(result)
      ? result
          .filter(
            (item) =>
              item &&
              typeof item.url === "string" &&
              /^https?:\/\//i.test(item.url),
          )
          .slice(0, 500)
      : [];
  } catch {
    return [];
  }
}
export function writeList(storage, key, value) {
  try {
    storage.setItem(`frost.${key}.v1`, JSON.stringify(value.slice(0, 500)));
  } catch {}
}
export function makeTab(id) {
  return {
    id,
    title: "New Tab",
    url: "",
    favicon: "/icon.svg",
    loading: false,
    progress: 0,
    history: [],
    historyIndex: -1,
    forwardHistory: [],
    active: false,
    home: true,
    revision: 0,
    message: "Ready",
    error: null,
    zoom: 100,
  };
}
export function recordNavigation(tab, url, { replace = false } = {}) {
  if (tab.history[tab.historyIndex] === url) return;
  if (replace && tab.historyIndex >= 0) tab.history[tab.historyIndex] = url;
  else {
    tab.history.splice(tab.historyIndex + 1);
    tab.history.push(url);
    tab.historyIndex = tab.history.length - 1;
  }
  tab.forwardHistory = tab.history.slice(tab.historyIndex + 1);
}
export function historyTarget(tab, direction) {
  const index = tab.historyIndex + direction;
  if (index < 0 || index >= tab.history.length) return null;
  tab.historyIndex = index;
  tab.forwardHistory = tab.history.slice(index + 1);
  return tab.history[index];
}

function safeUrl(value) {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''; } catch { return ''; }
}
export function saveSession(storage, tabs, activeId) {
  try {
    storage.setItem('frost.tabs.v1', JSON.stringify({activeId, tabs: tabs.slice(0,24).map(tab => {
      const start = Math.max(0, Math.min(tab.historyIndex - 49, tab.history.length - 100));
      return {
      id: tab.id, title: tab.title, url: tab.url, home: tab.home,
      history: tab.history.slice(start, start + 100), historyIndex: tab.historyIndex - start
    }; })}));
  } catch {}
}
export function loadSession(storage) {
  try {
    const saved = JSON.parse(storage.getItem('frost.tabs.v1') || '{}');
    const ids = new Set();
    const tabs = (Array.isArray(saved.tabs) ? saved.tabs : []).slice(0,24).flatMap(item => {
      if (!item || typeof item.id !== 'string' || ids.has(item.id)) return [];
      ids.add(item.id);
      const tab = makeTab(item.id);
      tab.url = safeUrl(item.url);
      tab.title = typeof item.title === 'string' ? item.title.slice(0,120) : 'New Tab';
      tab.home = item.home === true || !tab.url;
      const storedHistory = Array.isArray(item.history) ? item.history.slice(0,100) : [];
      if (storedHistory.every(url => safeUrl(url))) {
        tab.history = storedHistory.map(safeUrl);
        tab.historyIndex = Number.isInteger(item.historyIndex) ? Math.max(-1, Math.min(item.historyIndex, tab.history.length - 1)) : -1;
      }
      if (tab.url && tab.historyIndex < 0) { tab.history = [tab.url]; tab.historyIndex = 0; }
      tab.forwardHistory = tab.history.slice(tab.historyIndex + 1);
      return [tab];
    });
    return {tabs, activeId: saved.activeId};
  } catch { return {tabs: [], activeId: null}; }
}
