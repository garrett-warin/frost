importScripts("/vendor/controller.worker.js");
addEventListener("install", () => self.skipWaiting());
addEventListener("activate", (event) => event.waitUntil(clients.claim()));
addEventListener("fetch", (event) => {
  if (
    new URL(event.request.url).pathname.startsWith("/browse/") ||
    $runtimekitController.shouldRoute(event)
  ) {
    event.respondWith(
      (async () => {
        for (
          let attempt = 0;
          !$runtimekitController.shouldRoute(event) && attempt < 60;
          attempt++
        )
          await new Promise((resolve) => setTimeout(resolve, 50));
        if (!$runtimekitController.shouldRoute(event))
          throw new Error("Controller unavailable");
        const response = await $runtimekitController.route(event);
        if (
          response.status === 500 &&
          (response.headers.get("content-type") || "").includes("text/plain") &&
          (await response.clone().text()).startsWith(
            "Internal Service Worker Error:",
          )
        )
          throw new Error("Connection failed");
        return response;
      })().catch(
        () =>
          new Response(
            '<!doctype html><title>Frost connection error</title><body data-frost-error style="background:#edf1ec;color:#253b42;font:18px system-ui;padding:60px"><h1>This page couldn’t load.</h1><p>Check the address and your connection, then use Frost’s reload button. Some websites are incompatible with this browser.</p></body>',
            { status: 502, headers: { "Content-Type": "text/html" } },
          ),
      ),
    );
  }
});

