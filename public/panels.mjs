const engineNames = {
  duckduckgo: "DuckDuckGo",
  bing: "Bing",
  brave: "Brave Search",
};
const panelTitles = {
  settings: "Settings",
  history: "History",
  bookmarks: "Bookmarks",
  downloads: "Downloads",
  commands: "Commands",
  about: "About Frost",
};
const element = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
const domain = (value) => {
  try {
    return new URL(value).hostname;
  } catch {
    return value || "";
  }
};
const formatBytes = (value) => {
  if (!Number.isFinite(Number(value)) || Number(value) < 0)
    return "Size unknown";
  const size = Number(value);
  if (size < 1024) return `${size} B`;
  if (size < 1024 ** 2) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 ** 3) return `${(size / 1024 ** 2).toFixed(1)} MB`;
  return `${(size / 1024 ** 3).toFixed(1)} GB`;
};

export function createPanels({ getState, actions }) {
  const dialog = document.getElementById("panel-dialog");
  if (!dialog) throw new Error("Frost panel dialog is missing.");
  let current = "",
    returnFocus = null,
    body,
    notice,
    query = "",
    selectedCommand = 0,
    confirmClear = false;
  let downloadSignature = "";
  dialog.classList.add("frost-panel");
  dialog.setAttribute("aria-labelledby", "frost-panel-title");
  dialog.addEventListener("click", (event) => {
    if (
      event.target === dialog &&
      (event.clientX < dialog.getBoundingClientRect().left ||
        event.clientX > dialog.getBoundingClientRect().right ||
        event.clientY < dialog.getBoundingClientRect().top ||
        event.clientY > dialog.getBoundingClientRect().bottom)
    )
      close();
  });
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });
  dialog.addEventListener("close", () => {
    current = "";
    if (returnFocus?.isConnected) returnFocus.focus();
  });

  function close() {
    if (dialog.open) dialog.close();
    current = "";
  }
  function report(message, failed = false) {
    notice.textContent = message;
    notice.classList.toggle("panel-error", failed);
  }
  async function run(fn, { leave = false, message = "", redraw = false } = {}) {
    try {
      const result = await fn();
      if (leave) close();
      else {
        if (redraw) renderContent();
        if (message) report(message);
      }
      return result;
    } catch (error) {
      report(error?.message || "This action could not be completed.", true);
    }
  }
  function button(text, fn, className = "panel-button") {
    const node = element("button", className, text);
    node.type = "button";
    node.addEventListener("click", fn);
    return node;
  }
  function input(label, placeholder, value = "") {
    const node = element("input", "panel-input");
    node.type = "text";
    node.setAttribute("aria-label", label);
    node.placeholder = placeholder;
    node.value = value;
    node.autocomplete = "off";
    return node;
  }
  function empty(title, description) {
    const section = element("div", "panel-empty");
    section.append(element("strong", "", title), element("p", "", description));
    return section;
  }
  function heading(text) {
    const title = element("h3", "panel-section-title", text);
    body.append(title);
    return title;
  }
  function section(text, description) {
    const group = element("section", "settings-section");
    group.append(element("h3", "panel-section-title", text));
    if (description)
      group.append(element("p", "panel-description", description));
    body.append(group);
    return group;
  }
  function row(title, description, control) {
    const container = element("div", "settings-row");
    const copy = element("div", "settings-copy");
    copy.append(element("span", "settings-label", title));
    if (description)
      copy.append(element("span", "settings-description", description));
    container.append(copy, control);
    return container;
  }
  function select(label, options, value, onChange) {
    const control = element("select", "panel-select");
    control.setAttribute("aria-label", label);
    for (const [key, text] of Object.entries(options)) {
      const item = element("option", "", text);
      item.value = key;
      control.append(item);
    }
    control.value = value;
    control.addEventListener("change", () => onChange(control.value));
    return control;
  }
  function toggle(label, checked, onChange) {
    const control = element("input", "panel-switch");
    control.type = "checkbox";
    control.checked = !!checked;
    control.setAttribute("role", "switch");
    control.setAttribute("aria-label", label);
    control.addEventListener("change", () => onChange(control.checked));
    return control;
  }
  function open(name) {
    if (!Object.hasOwn(panelTitles, name)) return;
    const wasOpen = dialog.open;
    if (!wasOpen) returnFocus = document.activeElement;
    current = name;
    query = "";
    selectedCommand = 0;
    confirmClear = false;
    dialog.classList.toggle("command-panel", name === "commands");
    dialog.replaceChildren();
    const head = element("header", "panel-header");
    const title = element("h2", "", panelTitles[name]);
    title.id = "frost-panel-title";
    const dismiss = button("×", close, "panel-dismiss");
    dismiss.setAttribute("aria-label", "Close panel");
    head.append(title, dismiss);
    body = element("div", "panel-body");
    notice = element("p", "panel-notice");
    notice.setAttribute("role", "status");
    notice.setAttribute("aria-live", "polite");
    dialog.append(head, body, notice);
    renderContent();
    if (!wasOpen) dialog.showModal();
    const focusable = body.querySelector(
      '[autofocus], input:not([type="checkbox"]), button, select',
    );
    (focusable || dismiss).focus();
  }
  function renderContent() {
    body.replaceChildren();
    if (current === "settings") settings();
    if (current === "history") history();
    if (current === "bookmarks") bookmarks();
    if (current === "downloads") downloads();
    if (current === "commands") commands();
    if (current === "about") about();
  }
  function setting(patch) {
    return run(() => actions.updateSettings(patch), { message: "Saved." });
  }
  function settings() {
    const state = getState();
    const prefs = state.settings || {};
    const appearance = section("Appearance");

    appearance.append(
      row(
        "Bookmarks bar",
        "Keep saved websites below the address bar.",
        toggle("Show bookmarks bar", prefs.showBookmarks, (value) =>
          setting({ showBookmarks: value }),
        ),
      ),
    );
    appearance.append(
      row(
        "Compact tabs",
        "Make room for more tabs.",
        toggle("Compact tabs", prefs.compactTabs, (value) =>
          setting({ compactTabs: value }),
        ),
      ),
    );
    appearance.append(
      row(
        "Animations",
        "Use brief transitions and the Frost loading effect.",
        toggle("Animations", prefs.animations !== false, (value) =>
          setting({ animations: value }),
        ),
      ),
    );
    const accentWrap = element("div", "panel-range-wrap");
    const accent = element("input", "panel-range");
    accent.type = "range";
    accent.min = "40";
    accent.max = "100";
    accent.step = "10";
    accent.value = String(prefs.accentIntensity ?? 80);
    accent.setAttribute("aria-label", "Accent intensity");
    const output = element("output", "", `${accent.value}%`);
    accent.addEventListener("input", () => {
      output.value = `${accent.value}%`;
    });
    accent.addEventListener("change", () =>
      setting({ accentIntensity: Number(accent.value) }),
    );
    accentWrap.append(accent, output);
    appearance.append(
      row(
        "Accent intensity",
        "Control the strength of icy-blue accents.",
        accentWrap,
      ),
    );
    const search = section("Search");
    search.append(
      row(
        "Default search engine",
        "Used by both the address bar and new-tab search.",
        select(
          "Default search engine",
          engineNames,
          prefs.searchEngine || "duckduckgo",
          (value) => setting({ searchEngine: value }),
        ),
      ),
    );
    const privacy = section("Privacy");
    privacy.append(
      row(
        "Local history",
        "Remove the list of websites visited in Frost.",
        button("Clear history", () =>
          run(() => actions.clearHistory(), {
            message: "Local history cleared.",
          }),
        ),
      ),
    );
    privacy.append(
      row(
        "Frost browsing data",
        "Clear stored browser data and start a fresh session.",
        button("Clear data…", () => {
          confirmClear = !confirmClear;
          renderContent();
          body.querySelector(".panel-confirm button")?.focus();
        }),
      ),
    );
    if (confirmClear) {
      const confirm = element("div", "panel-confirm");
      confirm.append(
        element(
          "p",
          "",
          "Clear Frost’s saved data and website storage? This may sign you out of websites. Open pages may need to reload.",
        ),
      );
      const controls = element("div", "panel-actions");
      controls.append(
        button("Cancel", () => {
          confirmClear = false;
          renderContent();
        }),
        button(
          "Clear browsing data",
          () =>
            run(() => actions.clearData(), {
              message: "Browsing data cleared.",
              redraw: true,
            }),
          "panel-button panel-danger",
        ),
      );
      confirm.append(controls);
      privacy.append(confirm);
    }
    const proxy = element("details", "proxy-settings");
    const summary = element("summary", "", "Advanced connection settings");
    proxy.append(summary);
    body.append(proxy);
    proxy.append(
      element(
        "p",
        "panel-description",
        "Frost uses a local connection service. An external endpoint must accept an encoded target URL and support framing. Connection changes affect new navigations.",
      ),
    );
    const transport = select(
      "Connection type",
      { bonfire: "Frost", external: "External endpoint" },
      prefs.transport || "bonfire",
      (value) => {
        endpoint.disabled = value !== "external";
      },
    );
    const endpoint = input(
      "Backend endpoint",
      "https://browser.example/browse?url=",
      prefs.endpoint || "",
    );
    endpoint.type = "url";
    endpoint.disabled = transport.value !== "external";
    proxy.append(row("Connection type", "", transport));
    const field = element("label", "panel-field");
    field.append(element("span", "", "Backend endpoint"), endpoint);
    proxy.append(field);
    proxy.append(
      button(
        "Save connection settings",
        () =>
          run(
            () =>
              actions.updateSettings({
                transport: transport.value,
                endpoint: endpoint.value.trim(),
              }),
            { message: "Connection settings saved." },
          ),
        "panel-button panel-primary",
      ),
    );
  }
  function filtered(items) {
    const text = query.toLocaleLowerCase();
    return (items || []).filter((item) =>
      `${item.title || item.filename || ""} ${item.url || item.source || ""}`
        .toLocaleLowerCase()
        .includes(text),
    );
  }
  function searchList(label, placeholder, render) {
    const search = input(label, placeholder, query);
    search.autofocus = true;
    const list = element("div", "panel-list");
    search.addEventListener("input", () => {
      query = search.value;
      list.replaceChildren();
      render(list);
    });
    body.append(search, list);
    render(list);
  }
  function siteIcon(item) {
    const icon = element("span", "panel-site-icon");
    icon.setAttribute("aria-hidden", "true");
    if (item.favicon && /^(https?:|data:image\/|blob:|\/)/.test(item.favicon)) {
      const img = element("img");
      img.src = item.favicon;
      img.alt = "";
      img.referrerPolicy = "no-referrer";
      img.onerror = () => {
        icon.textContent = domain(item.url).charAt(0).toUpperCase() || "◇";
      };
      icon.append(img);
    } else icon.textContent = domain(item.url).charAt(0).toUpperCase() || "◇";
    return icon;
  }
  function siteRow(item, trail) {
    const entry = element("div", "panel-list-row");
    const visit = button(
      "",
      () => run(() => actions.navigate(item.url), { leave: true }),
      "panel-visit",
    );
    const text = element("span", "panel-entry-copy");
    text.append(
      element("span", "panel-entry-title", item.title || domain(item.url)),
      element("span", "panel-entry-subtitle", domain(item.url)),
    );
    visit.append(siteIcon(item), text);
    entry.append(visit);
    if (trail) entry.append(trail);
    return entry;
  }
  function history() {
    const tools = element("div", "panel-intro");
    tools.append(
      element("p", "panel-description", "Websites visited on this device."),
      button(
        "Clear history",
        () =>
          run(() => actions.clearHistory(), {
            redraw: true,
            message: "Local history cleared.",
          }),
        "panel-text-button",
      ),
    );
    body.append(tools);
    searchList("Search history", "Search history", (list) => {
      const entries = filtered(getState().history);
      if (!entries.length) {
        list.append(
          empty(
            query ? "No matching visits" : "No history yet",
            query
              ? "Try a different website or title."
              : "Websites you visit in Frost will appear here.",
          ),
        );
        return;
      }
      let lastDate = "";
      for (const entry of entries) {
        const date = new Date(
          entry.visitedAt ?? entry.timestamp ?? entry.time ?? Date.now(),
        );
        const valid = !Number.isNaN(date.getTime());
        const dateLabel = valid
          ? date.toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })
          : "Earlier";
        if (dateLabel !== lastDate) {
          list.append(element("h3", "panel-date", dateLabel));
          lastDate = dateLabel;
        }
        const time = element(
          "time",
          "panel-entry-time",
          valid
            ? date.toLocaleTimeString(undefined, {
                hour: "numeric",
                minute: "2-digit",
              })
            : "",
        );
        if (valid) time.dateTime = date.toISOString();
        list.append(siteRow(entry, time));
      }
    });
  }
  function bookmarks() {
    body.append(
      element(
        "p",
        "panel-description",
        "Use the star in the address bar to save a website.",
      ),
    );
    searchList("Search bookmarks", "Search bookmarks", (list) => {
      const entries = filtered(getState().bookmarks);
      if (!entries.length) {
        list.append(
          empty(
            query ? "No matching bookmarks" : "No bookmarks yet",
            query
              ? "Try another title or website."
              : "Star a page to keep it here.",
          ),
        );
        return;
      }
      for (const entry of entries) {
        const remove = button(
          "Remove",
          () => run(() => actions.removeBookmark(entry.url), { redraw: true }),
          "panel-text-button",
        );
        remove.setAttribute(
          "aria-label",
          `Remove ${entry.title || domain(entry.url)} bookmark`,
        );
        list.append(siteRow(entry, remove));
      }
    });
  }
  function downloads() {
    body.append(
      element(
        "p",
        "panel-description",
        "Save a file through the current connection. Downloads started by a website are handled by your browser and may not appear here.",
      ),
    );
    const form = element("form", "download-form");
    const url = input("File URL", "Paste a direct file URL");
    url.type = "url";
    url.required = true;
    const submit = element("button", "panel-button panel-primary", "Download");
    submit.type = "submit";
    form.append(url, submit);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      void run(() => actions.saveDownload(url.value.trim()), {
        message: "Download started.",
      });
    });
    body.append(form);
    const list = element("div", "panel-list download-list");
    list.id = "frost-download-list";
    body.append(list);
    renderDownloads(list);
  }
  function renderDownloads(list) {
    const entries = getState().downloads || [];
    list.replaceChildren();
    downloadSignature = JSON.stringify(
      entries.map((entry) => [
        entry.id,
        entry.status,
        entry.progress,
        entry.received,
        entry.size,
        entry.error,
      ]),
    );
    if (!entries.length) {
      list.append(
        empty(
          "No downloads yet",
          "Paste a direct file URL above to save it through Frost.",
        ),
      );
      return;
    }
    for (const item of entries) {
      const row = element("article", "download-row");
      const top = element("div", "download-heading");
      top.append(element("strong", "", item.filename || "Download"));
      const state = item.status || "pending";
      top.append(
        element(
          "span",
          "download-state",
          state === "complete"
            ? "Complete"
            : state.charAt(0).toUpperCase() + state.slice(1),
        ),
      );
      row.append(top);
      row.append(
        element(
          "p",
          "download-source",
          item.source || item.url || "Unknown source",
        ),
      );
      const details = element("div", "download-details");
      const total = item.total ?? item.size;
      details.append(
        element(
          "span",
          "",
          total
            ? `${formatBytes(item.received ?? total)} / ${formatBytes(total)}`
            : item.received
              ? formatBytes(item.received)
              : "Size unknown",
        ),
      );
      const controls = element("div", "download-actions");
      const busy = ["loading", "downloading", "pending", "fetching"].includes(
        state,
      );
      if (busy)
        controls.append(
          button(
            "Cancel",
            () => run(() => actions.cancelDownload(item.id), { redraw: true }),
            "panel-text-button",
          ),
        );
      else {
        if (["complete", "completed", "saved"].includes(state))
          controls.append(
            button(
              "Save again",
              () => run(() => actions.openDownload(item.id)),
              "panel-text-button",
            ),
          );
        controls.append(
          button(
            "Remove",
            () => run(() => actions.removeDownload(item.id), { redraw: true }),
            "panel-text-button",
          ),
        );
      }
      details.append(controls);
      row.append(details);
      if (busy) {
        const progress = element("progress", "download-progress");
        progress.max = 100;
        const numeric = Number(item.progress);
        if (Number.isFinite(numeric) && item.progress !== undefined)
          progress.value = numeric;
        else if (total)
          progress.value = Math.min(100, ((item.received || 0) / total) * 100);
        progress.setAttribute(
          "aria-label",
          `Downloading ${item.filename || "file"}`,
        );
        row.append(progress);
      }
      if (item.error)
        row.append(element("p", "panel-error download-error", item.error));
      list.append(row);
    }
  }
  function commandItems() {
    const state = getState();
    return [
      { label: "New Tab", key: "Ctrl T", run: actions.newTab },
      { label: "Close Tab", key: "Ctrl W", run: actions.closeTab },
      {
        label: "Reopen Closed Tab",
        key: "Ctrl Shift T",
        run: actions.reopenTab,
        disabled: !state.closedTabs?.length,
      },
      { label: "History", run: () => open("history"), panel: true },
      { label: "Downloads", run: () => open("downloads"), panel: true },
      { label: "Bookmarks", run: () => open("bookmarks"), panel: true },
      { label: "Settings", run: () => open("settings"), panel: true },
      {
        label: "Clear Browsing Data",
        run: () => {
          open("settings");
          confirmClear = true;
          renderContent();
          body
            .querySelector(".panel-confirm")
            ?.scrollIntoView({ block: "center" });
        },
        panel: true,
      },
      { label: "Site fullscreen", run: actions.toggleFullscreen, disabled: !state.active?.url || state.active?.home },
      {
        label: "Copy Current URL",
        run: actions.copyUrl,
        disabled: !state.active?.url,
      },
      {
        label: "Reload Page",
        key: "Ctrl R",
        run: actions.reload,
        disabled: !state.active?.url,
      },
    ].filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));
  }
  function commands() {
    const search = input("Search Frost commands", "Search commands", query);
    search.autofocus = true;
    search.setAttribute("role", "combobox");
    search.setAttribute("aria-expanded", "true");
    search.setAttribute("aria-controls", "frost-command-list");
    search.setAttribute("aria-autocomplete", "list");
    const list = element("div", "command-list");
    list.id = "frost-command-list";
    list.setAttribute("role", "listbox");
    function activate(item) {
      if (item.disabled) return;
      if (item.panel) item.run();
      else void run(item.run, { leave: true });
    }
    function draw() {
      const items = commandItems();
      selectedCommand = Math.min(
        selectedCommand,
        Math.max(0, items.length - 1),
      );
      list.replaceChildren();
      if (!items.length) {
        search.removeAttribute("aria-activedescendant");
        list.append(
          empty("No commands found", "Try “tab”, “history”, or “settings”."),
        );
        return;
      }
      items.forEach((item, index) => {
        const option = button(
          "",
          () => activate(item),
          "command-option" + (index === selectedCommand ? " selected" : ""),
        );
        option.id = `frost-command-${index}`;
        option.tabIndex = -1;
        option.disabled = !!item.disabled;
        option.setAttribute("role", "option");
        option.setAttribute("aria-selected", String(index === selectedCommand));
        option.append(element("span", "", item.label));
        if (item.key) option.append(element("kbd", "", item.key));
        option.addEventListener("pointermove", () => {
          selectedCommand = index;
          for (const [i, node] of [...list.children].entries()) {
            node.classList.toggle("selected", i === index);
            node.setAttribute("aria-selected", String(i === index));
          }
          search.setAttribute("aria-activedescendant", option.id);
        });
        list.append(option);
      });
      search.setAttribute(
        "aria-activedescendant",
        `frost-command-${selectedCommand}`,
      );
    }
    search.addEventListener("input", () => {
      query = search.value;
      selectedCommand = 0;
      draw();
    });
    search.addEventListener("keydown", (event) => {
      const items = commandItems();
      if (["ArrowDown", "ArrowUp"].includes(event.key)) {
        event.preventDefault();
        if (!items.length) return;
        selectedCommand =
          (selectedCommand +
            (event.key === "ArrowDown" ? 1 : -1) +
            items.length) %
          items.length;
        draw();
        list.children[selectedCommand]?.scrollIntoView({ block: "nearest" });
      } else if (event.key === "Enter") {
        event.preventDefault();
        if (items[selectedCommand]) activate(items[selectedCommand]);
      }
    });
    body.append(
      search,
      list,
      element("p", "command-help", "↑ ↓ to move · Enter to run · Esc to close"),
    );
    draw();
  }
  function about() {
    const logo = element("img", "about-wordmark");
    logo.src = "/wordmark.svg";
    logo.alt = "frost";
    body.append(
      logo,
      element("p", "about-version", "Frost 1.1"),
      element(
        "p",
        "panel-description",
        "Frost is a focused browser for the web.",
      ),
    );
    const detail = element("dl", "about-details");
    for (const [label, value] of [
      ["Browser", "Frost"],
      [
        "Connection",
        getState().settings?.transport === "external"
          ? "External endpoint"
          : "Local relay",
      ],
      ["License", "AGPL-3.0-only"],
    ])
      detail.append(element("dt", "", label), element("dd", "", value));
    body.append(detail);
    body.append(
      element(
        "p",
        "panel-description",
        "Frost runs inside your browser. Some browser shortcuts and website downloads remain controlled by the host browser. Website compatibility depends on the selected connection type.",
      ),
    );
  }
  function refresh() {
    if (!dialog.open) return;
    if (current === "downloads") {
      const signature = JSON.stringify(
        (getState().downloads || []).map((entry) => [
          entry.id,
          entry.status,
          entry.progress,
          entry.received,
          entry.size,
          entry.error,
        ]),
      );
      if (signature !== downloadSignature)
        renderDownloads(body.querySelector("#frost-download-list"));
    }
  }
  return { open, close, refresh };
}
