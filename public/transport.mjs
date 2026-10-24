import { routingPlugin } from "./link-routing.mjs";
import { checkDevice } from "./device-access.mjs";
export function validateEndpoint(endpoint) {
  const url = new URL(endpoint);
  if (
    url.username ||
    url.password ||
    !(
      url.protocol === "https:" ||
      (url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname))
    )
  )
    throw new Error("Use an HTTPS endpoint, or localhost for development.");
  if (url.hash) throw new Error("The endpoint cannot contain a fragment.");
  return url.href;
}
export function createProxyUrl(targetUrl, { prefix, endpoint } = {}) {
  const target = new URL(targetUrl);
  if (
    !["https:", "http:"].includes(target.protocol) ||
    target.username ||
    target.password
  )
    throw new Error("Use an HTTP or HTTPS website address.");
  return endpoint
    ? validateEndpoint(endpoint) + encodeURIComponent(target.href)
    : prefix + encodeURIComponent(target.href);
}
function deadline(promise, ms, message) {
  let timeout;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timeout = setTimeout(() => reject(new Error(message)), ms);
    }),
  ]).finally(() => clearTimeout(timeout));
}
export function initializeTransportOnce(transport) {
  const init = transport.init.bind(transport);
  let pending;
  transport.init = () => pending ||= Promise.resolve().then(init).catch(error => {
    pending = undefined;
    throw error;
  });
  return transport.init();
}
export function createBrowserTransport(getSettings) {
  let boot, controller;
  async function initialize() {
    if (controller) return controller;
    if (boot) return boot;
    boot = (async () => {
      await checkDevice();
      if (!isSecureContext || !navigator.serviceWorker)
        throw new Error(
          "Frost needs HTTPS or localhost with service workers enabled.",
        );
      if (document.readyState === "loading")
        await new Promise((resolve) =>
          document.addEventListener("DOMContentLoaded", resolve, {
            once: true,
          }),
        );
      if (!window.$runtimekitController || !window.HttpEngineTransport)
        throw new Error(
          "Browser assets are unavailable. Run npm run build, then reload Frost.",
        );
      const registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      });
      await deadline(
        navigator.serviceWorker.ready,
        12000,
        "The service worker did not start. Reload Frost to retry.",
      );
      if (!navigator.serviceWorker.controller)
        await deadline(
          new Promise((resolve) =>
            navigator.serviceWorker.addEventListener(
              "controllerchange",
              resolve,
              { once: true },
            ),
          ),
          12000,
          "Service worker activation timed out.",
        );
      const transport = new window.HttpEngineTransport.HttpEngineClient({
        relay: `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/relay/`,
      });
      await deadline(initializeTransportOnce(transport), 15000,
        "The connection could not start. Reload Frost to retry.");
      const candidate = new window.$runtimekitController.Controller({
        serviceworker: registration.active,
        transport,
        config: {
          prefix: "/browse/",
          runtimekitPath: "/vendor/runtimekit.js",
          wasmPath: "/vendor/runtimekit.wasm",
          injectPath: "/vendor/controller.inject.js",
        },
      });
      await deadline(
        candidate.wait(),
        15000,
        "The browsing engine could not start. Reload Frost to retry.",
      );
      controller = candidate;
      return controller;
    })();
    try {
      return await boot;
    } catch (error) {
      boot = null;
      throw error;
    }
  }
  async function createView(element, openLink = () => {}) {
    await checkDevice();
    const settings = { ...getSettings() };
    let frame;
    if (settings.transport === "bonfire")
      frame = (await initialize()).createFrame(element, {plugins:[routingPlugin(window.$runtimekitController.ManagedPlugin, openLink, location.origin)]});
    else validateEndpoint(settings.endpoint);
    return {
      mode: settings.transport,
      navigate(url) {
        element.src = createProxyUrl(
          url,
          frame ? { prefix: frame.prefix } : { endpoint: settings.endpoint },
        );
      },
      favicon(url) {
        return frame
          ? createProxyUrl(new URL("/favicon.ico", url).href, {
              prefix: frame.prefix,
            })
          : "/icon.svg";
      },
      inspect() {
        if (!frame) return { external: true };
        try {
          const loaded = new URL(element.contentWindow.location.href);
          if (!loaded.pathname.startsWith(frame.prefix)) return null;
          const url =
            decodeURIComponent(loaded.pathname.slice(frame.prefix.length)) +
            loaded.hash;
          if (!/^https?:\/\//i.test(url)) return null;
          const doc = element.contentDocument;
          const icon = doc?.querySelector('link[rel~="icon"]')?.href;
          return {
            url,
            title: doc?.title || new URL(url).hostname,
            favicon: icon?.startsWith(location.origin + frame.prefix)
              ? icon
              : createProxyUrl(new URL("/favicon.ico", url).href, {
                  prefix: frame.prefix,
                }),
            error: doc?.body?.hasAttribute("data-frost-error"),
          };
        } catch {
          return null;
        }
      },
      stop() {
        try {
          element.contentWindow.stop();
        } catch {}
      },
      destroy() {
        element.src = "about:blank";
        element.remove();
        if (frame)
          controller.frames = controller.frames.filter(
            (item) => item !== frame,
          );
      },
    };
  }
  return {
    initialize,
    createView,
    async request(url) {
      if (getSettings().transport !== "bonfire")
        throw new Error(
          "File transfers are available with the Frost connection.",
        );
      return (await initialize()).transport.request(
        new URL(url),
        "GET",
        null,
        [],
      );
    },
  };
}
