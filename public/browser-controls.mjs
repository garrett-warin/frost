export function createTabBar({ container, select, close, reorder }) {
  let dragging;
  return function render(tabs, active) {
    container.replaceChildren(
      ...tabs.map((tab) => {
        const wrap = document.createElement("div");
        wrap.className = "browser-tab" + (tab === active ? " active" : "");
        wrap.draggable = true;
        wrap.addEventListener("dragstart", (event) => {
          dragging = tab.id;
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", tab.id);
        });
        wrap.addEventListener("dragover", (event) => event.preventDefault());
        wrap.addEventListener("drop", (event) => {
          event.preventDefault();
          if (dragging) reorder(dragging, tab.id);
          dragging = null;
        });
        const button = document.createElement("button");
        button.className = "tab-select";
        button.id = `tab-${tab.id}`;
        button.setAttribute("role", "tab");
        button.setAttribute("aria-selected", String(tab === active));
        button.tabIndex = tab === active ? 0 : -1;
        button.title = tab.url || "New Tab";
        const icon = document.createElement("img");
        icon.src = tab.favicon || "/icon.svg";
        icon.alt = "";
        icon.width = 14;
        icon.height = 14;
        icon.onerror = () => {
          icon.onerror = null;
          icon.src = "/icon.svg";
        };
        const title = document.createElement("span");
        title.textContent = tab.title;
        if (tab.url) button.append(icon);
      button.append(title);
        button.onclick = () => select(tab);
        button.onkeydown = (event) => {
          const index = tabs.indexOf(tab);
          let target;
          if (event.key === "ArrowRight")
            target = tabs[(index + 1) % tabs.length];
          if (event.key === "ArrowLeft")
            target = tabs[(index - 1 + tabs.length) % tabs.length];
          if (event.key === "Home") target = tabs[0];
          if (event.key === "End") target = tabs.at(-1);
          if (target) {
            event.preventDefault();
            select(target);
            document.getElementById(`tab-${target.id}`).focus();
          }
          if (event.key === "Delete") {
            event.preventDefault();
            close(tab);
          }
        };
        const remove = document.createElement("button");
        remove.className = "tab-close";
        remove.textContent = "×";
        remove.setAttribute("aria-label", `Close ${tab.title}`);
        remove.onclick = () => close(tab);
        wrap.append(button, remove);
        return wrap;
      }),
    );
  };
}
export function setupOmnibox({ input, list, getItems, navigate }) {
  let selected = -1,
    items = [];
  function hide() {
    list.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
  }
  function render() {
    items = getItems(input.value).slice(0, 6);
    selected = -1;
    list.replaceChildren(
      ...items.map((item, index) => {
        const row = document.createElement("button");
        row.type = "button";
        row.id = `suggestion-${index}`;
        row.className = "suggestion-row";
        row.setAttribute("role", "option");
        const title = document.createElement("strong");
        title.textContent = item.title;
        const detail = document.createElement("span");
        detail.textContent = item.detail;
        row.append(title, detail);
        row.onmousedown = (event) => event.preventDefault();
        row.onclick = () => {
          input.value = item.value;
          hide();
          navigate(item.value);
        };
        return row;
      }),
    );
    list.hidden = !items.length;
    input.setAttribute("aria-expanded", String(items.length > 0));
  }
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-controls", list.id);
  input.setAttribute("aria-expanded", "false");
  input.addEventListener("input", render);
  input.addEventListener("focus", render);
  input.addEventListener("blur", hide);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      hide();
      return;
    }
    if (list.hidden) return;
    if (["ArrowDown", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      selected =
        (selected + (event.key === "ArrowDown" ? 1 : -1) + items.length) %
        items.length;
      [...list.children].forEach((row, index) =>
        row.setAttribute("aria-selected", String(index === selected)),
      );
      input.setAttribute("aria-activedescendant", `suggestion-${selected}`);
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const value = selected >= 0 ? items[selected].value : input.value;
      hide();
      navigate(value);
    }
  });
  return { hide };
}
