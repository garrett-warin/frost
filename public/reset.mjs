const status = document.getElementById("reset-status");
async function reset() {
  document.getElementById("retry-reset").hidden = true;
  try {
    for (const worker of await navigator.serviceWorker.getRegistrations())
      await worker.unregister();
    for (const key of await caches.keys()) await caches.delete(key);
    const databases = await indexedDB.databases();
    await Promise.all(
      databases
        .filter((db) => db.name)
        .map(
          (db) =>
            new Promise((resolve, reject) => {
              const request = indexedDB.deleteDatabase(db.name);
              const timer = setTimeout(
                () =>
                  reject(
                    new Error(
                      "Another Frost window still has website data open. Close other Frost windows, then try again.",
                    ),
                  ),
                5000,
              );
              request.onsuccess = () => {
                clearTimeout(timer);
                resolve();
              };
              request.onerror = () => {
                clearTimeout(timer);
                reject(request.error);
              };
              request.onblocked = () => {
                status.textContent =
                  "Close other Frost windows so their website storage can be cleared.";
              };
            }),
        ),
    );
    localStorage.clear();
    sessionStorage.clear();
    status.textContent =
      "Local history, bookmarks, preferences, cookies and website storage cleared.";
    location.replace("/");
  } catch (error) {
    status.textContent = error.message;
    document.getElementById("retry-reset").hidden = false;
  }
}
document.getElementById("retry-reset").onclick = reset;
if (sessionStorage.getItem('frost.reset-request') === 'confirmed') {
  sessionStorage.removeItem('frost.reset-request');
  void reset();
} else {
  status.textContent = 'Open Settings in Frost to clear browsing data.';
}
