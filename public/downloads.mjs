export function createDownloads({ transport, changed }) {
  const items = [];
  const limit = 100 * 1024 * 1024;
  function notify() {
    changed();
  }
  function open(id) {
    const item = items.find((item) => item.id === id);
    if (!item?.objectUrl) return;
    const link = document.createElement("a");
    link.href = item.objectUrl;
    link.download = item.filename;
    link.click();
  }
  async function save(url) {
    const target = new URL(url);
    if (
      !["https:", "http:"].includes(target.protocol) ||
      target.username ||
      target.password
    )
      throw new Error("Enter an HTTP or HTTPS file URL.");
    const item = {
      id: crypto.randomUUID(),
      url: target.href,
      source: target.hostname,
      filename: decodeURIComponent(
        target.pathname.split("/").pop() || "download",
      ),
      received: 0,
      size: 0,
      progress: 0,
      status: "downloading",
    };
    items.unshift(item);
    notify();
    try {
      const response = await transport.request(target.href);
      if (item.status === "cancelled") {
        await response.body?.cancel();
        return;
      }
      if (response.status < 200 || response.status >= 300)
        throw new Error(`The server returned HTTP ${response.status}.`);
      const headers = new Headers(response.headers);
      item.size = Number(headers.get("content-length")) || 0;
      if (item.size > limit) {
        await response.body?.cancel();
        throw new Error("This browser transfer supports files up to 100 MB.");
      }
      const reader = response.body.getReader();
      item.reader = reader;
      const chunks = [];
      while (true) {
        const { value, done } = await reader.read();
        if (done || item.status === "cancelled") break;
        item.received += value.byteLength;
        if (item.received > limit) {
          await reader.cancel();
          throw new Error("This browser transfer supports files up to 100 MB.");
        }
        chunks.push(value);
        item.progress = item.size
          ? Math.min(99, (item.received / item.size) * 100)
          : null;
        notify();
      }
      if (item.status === "cancelled") return;
      item.size = item.received;
      item.progress = 100;
      item.status = "complete";
      item.objectUrl = URL.createObjectURL(
        new Blob(chunks, {
          type: headers.get("content-type") || "application/octet-stream",
        }),
      );
      open(item.id);
    } catch (error) {
      if (item.status !== "cancelled") {
        item.status = "failed";
        item.error = error.message;
      }
    } finally {
      delete item.reader;
      notify();
    }
  }
  function cancel(id) {
    const item = items.find((item) => item.id === id);
    if (!item || item.status !== "downloading") return;
    item.status = "cancelled";
    void item.reader?.cancel();
    notify();
  }
  function remove(id) {
    const index = items.findIndex((item) => item.id === id);
    if (index < 0) return;
    cancel(id);
    if (items[index].objectUrl) URL.revokeObjectURL(items[index].objectUrl);
    items.splice(index, 1);
    notify();
  }
  return { items, save, open, cancel, remove };
}
