export function validateNotice(value) {
  if (!value || value.enabled !== true || typeof value.id !== 'string' || !/^[a-z0-9-]{1,80}$/.test(value.id)) return null;
  for (const [key, max] of [['title', 100], ['message', 800], ['detail', 800]]) {
    if (typeof value[key] !== 'string' || !value[key].trim() || value[key].length > max) return null;
  }
  return value;
}

export function startMigrationNotice({document, storage, fetchNotice, setTimer = setInterval}) {
  const acknowledged = new Set();
  let dialog, currentId, checking = false;
  const key = id => `frost-notice-seen:${id}`;
  function seen(id) {
    try { return acknowledged.has(id) || storage.getItem(key(id)) === 'yes'; }
    catch { return acknowledged.has(id); }
  }
  function dismiss() {
    if (currentId) {
      acknowledged.add(currentId);
      try { storage.setItem(key(currentId), 'yes'); } catch {}
    }
    dialog?.close();
  }
  function show(notice) {
    if (dialog?.open || seen(notice.id)) return;
    dialog?.remove();
    dialog = document.createElement('dialog');
    dialog.className = 'migration-notice';
    dialog.setAttribute('aria-labelledby', 'migration-title');
    dialog.setAttribute('aria-describedby', 'migration-message');
    const label = document.createElement('p');
    label.className = 'migration-label';
    label.textContent = 'GROVE / SERVER MOVE';
    const title = document.createElement('h1');
    title.id = 'migration-title'; title.textContent = notice.title;
    const message = document.createElement('p');
    message.id = 'migration-message'; message.textContent = notice.message;
    const detail = document.createElement('p');
    detail.textContent = notice.detail;
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = 'Got it, continue browsing';
    button.addEventListener('click', dismiss);
    dialog.addEventListener('cancel', event => { event.preventDefault(); dismiss(); });
    dialog.addEventListener('keydown', event => event.stopPropagation());
    dialog.append(label, title, message, detail, button);
    document.body.append(dialog);
    currentId = notice.id;
    dialog.showModal();
  }
  async function check() {
    if (checking) return;
    checking = true;
    try {
      const response = await fetchNotice();
      if (!response.ok) return;
      const notice = validateNotice(await response.json());
      if (!notice) { dialog?.close(); return; }
      if (document.visibilityState !== 'hidden') show(notice);
    } catch {                                                    }
    finally { checking = false; }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void check();
  });
  void check();
  setTimer(check, 60000);
  return {check};
}

if (typeof document !== 'undefined') {
  let storage;
  try { storage = window.localStorage; } catch {}
  startMigrationNotice({document, storage, fetchNotice: () => fetch('/migration-notice.json', {cache: 'no-store', signal: AbortSignal.timeout(8000)})});
}
