import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { server as wisp, logging } from "@mercuryworkshop/wisp-js/server";
import { WebSocketServer } from "ws";
import { createPresence } from "./presence.mjs";
import { createDeviceAccess } from "./device-access.mjs";
import { resolvePublic } from "./relay-policy.mjs";

const root = fileURLToPath(new URL("./public/", import.meta.url));
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".wasm": "application/wasm",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json",
};
export function createFrostServer({ deviceStatusFetch = fetch, publicOrigin = process.env.PUBLIC_ORIGIN, edgeOrigin = process.env.FROST_EDGE_ORIGIN || "", edgeOrigins = process.env.FROST_EDGE_ORIGINS || "", machineId = process.env.FLY_MACHINE_ID || "local", presenceMachine = process.env.FROST_PRESENCE_MACHINE || "", announcement = process.env.FROST_ANNOUNCEMENT || "", adminOrigin = process.env.FROST_ADMIN_ORIGIN || "" } = {}) {
  if (adminOrigin && !/^https:\/\/d[a-z0-9]+\.cloudfront\.net$/.test(adminOrigin)) throw new Error("Invalid admin origin.");
  const allowedEdges = [...new Set([edgeOrigin, ...edgeOrigins.split(",")].map(value => value.trim()).filter(Boolean))];
  if (allowedEdges.some(origin => !publicOrigin || !/^https:\/\/d[a-z0-9]+\.cloudfront\.net$/.test(origin))) throw new Error("Invalid edge origin.");
  let announcementCache = { message: String(announcement).slice(0, 1000) }, announcementChecked = 0, announcementFetch;
  async function currentAnnouncement() {
    if (!adminOrigin || Date.now() - announcementChecked < 15000) return announcementCache;
    if (!announcementFetch) announcementFetch = (async () => {
      try {
        const response = await fetch(adminOrigin + "/announcement", { signal: AbortSignal.timeout(4000) });
        if (response.ok) {
          const data = await response.json();
          if (typeof data.message === "string") announcementCache = { message: data.message.slice(0, 1000) };
        }
      } catch {} finally { announcementChecked = Date.now(); announcementFetch = null; }
      return announcementCache;
    })();
    return announcementFetch;
  }
  let configuredOrigin;
  if (publicOrigin) {
    const url = new URL(publicOrigin);
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash)
      throw new Error("PUBLIC_ORIGIN must be an HTTPS origin without credentials or a path.");
    configuredOrigin = url.origin;
  }
  const allowedHost = (host) => configuredOrigin
    ? host === new URL(configuredOrigin).host
    : /^localhost:\d+$/.test(host || "");
  const presence = createPresence();
  const deviceAccess = createDeviceAccess({adminOrigin,secure:!!publicOrigin,fetchStatus:deviceStatusFetch});
  const serverLabel = machineId === "683e3d9ae17238" ? "Ashburn 1" : machineId === "839496c774d638" ? "Ashburn 2" : machineId === "local" ? "Local" : machineId;
  logging.set_level(logging.NONE);
  Object.assign(wisp.options, {
    dns_method: resolvePublic,
    allow_udp_streams: false,
    allow_direct_ip: false,
    allow_private_ips: false,
    allow_loopback_ips: false,
    port_whitelist: [80, 443],
    stream_limit_total: 64,
  });
  const app = createServer(async (req, res) => {
    if (!allowedHost(req.headers.host)) {
      res.writeHead(403).end("Unrecognized host.");
      return;
    }
    if (!["GET", "HEAD"].includes(req.method)) {
      res.writeHead(405).end();
      return;
    }
    try {
      const pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      if (pathname === '/api/device') {
        const id=deviceAccess.read(req) || deviceAccess.issue(res);
        try {
          const banned=await deviceAccess.banned(id);
          res.writeHead(banned?403:200,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify({device:id,banned}));
        } catch {res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify({device:id,error:'Device access check unavailable. Try again shortly.'}));}
        return;
      }
      if (pathname === "/api/presence" || pathname === "/api/presence/collect") {
        const id = new URL(req.url, "http://localhost").searchParams.get("id");
        const headers = {"Content-Type":"application/json", "Cache-Control":"no-store"};
        if (id !== null && !/^[a-f0-9-]{36}$/.test(id)) { res.writeHead(400,headers).end('{"error":"Invalid visitor ID"}'); return; }
        let online = null;
        try {
          if (!presenceMachine || machineId === presenceMachine) online = presence(req.method === "HEAD" ? null : id);
          else if (pathname === "/api/presence/collect") throw new Error("Wrong collector");
          else {
            const target = new URL("/api/presence/collect", configuredOrigin);
            if (id && req.method !== "HEAD") target.searchParams.set("id", id);
            const response = await fetch(target, {headers:{"Fly-Force-Instance-Id":presenceMachine},signal:AbortSignal.timeout(4000)});
            if (!response.ok) throw new Error("Collector unavailable");
            const result = await response.json();
            if (!Number.isInteger(result.online) || result.online < 0) throw new Error("Invalid count");
            online = result.online;
          }
        } catch {}
        res.writeHead(online === null ? 503 : 200,headers).end(req.method === "HEAD" ? undefined : JSON.stringify({online,server:serverLabel,machine:machineId}));
        return;
      }
      if (pathname === "/api/announcement") {
        res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
        res.end(req.method === "HEAD" ? undefined : JSON.stringify(await currentAnnouncement()));
        return;
      }
      if (pathname === "/api/config") {
        res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
        res.end(req.method === "HEAD" ? undefined : JSON.stringify({ adminOrigin }));
        return;
      }
      if (pathname === "/health") {
        res
          .writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" })
          .end('{"ok":true}');
        return;
      }
      const path = resolve(
        root,
        "." + (pathname === "/" ? "/index.html" : pathname),
      );
      if (!path.startsWith(resolve(root) + sep)) {
        res.writeHead(403).end();
        return;
      }
      const body = await readFile(path);
      res.writeHead(200, {
        "Content-Type": mime[extname(path)] || "application/octet-stream",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        "X-Frame-Options": "SAMEORIGIN",
      });
      res.end(req.method === "HEAD" ? undefined : body);
    } catch {
      res.writeHead(404).end("Not found");
    }
  });
  const upgrades = new WebSocketServer({
    noServer: true,
    maxPayload: 1024 * 1024,
  });
  app.on("upgrade", async (req, socket, head) => {
    // An upgraded socket has no HTTP error owner while authorization awaits.
    const onSocketError=()=>socket.destroy();
    socket.on('error',onSocketError);
    const expected = configuredOrigin || `http://localhost:${app.address().port}`;
    if (
      req.url !== "/relay/" ||
      ![expected, ...allowedEdges].includes(req.headers.origin) ||
      req.headers.host !== new URL(expected).host
    ) {
      socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      return;
    }
    const device=deviceAccess.read(req);
    if(adminOrigin){
      try {if(await deviceAccess.banned(device)){socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');return;}}
      catch {socket.end('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n');return;}
    }
    if(socket.destroyed)return;
    upgrades.handleUpgrade(req, socket, head, (ws) => {
      socket.removeListener('error',onSocketError);
      if(adminOrigin){
        let checking=false;
        const timer=setInterval(async()=>{
          if(checking)return;checking=true;
          try {if(await deviceAccess.banned(device))ws.terminate();}
          catch {ws.terminate();}
          finally {checking=false;}
        },15000);
        timer.unref();ws.once('close',()=>clearInterval(timer));
      }
      ws.binaryType = "arraybuffer";
      ws.on("error", () => ws.terminate());
      const connection = new wisp.ServerConnection(ws, req.url, {
        wisp_version: req.headers["sec-websocket-protocol"]
          ?.split(",")
          .map((x) => x.trim())
          .includes("wisp-v2")
          ? 2
          : 1,
      });
      void (async () => {
        try {
          await connection.setup();
          await connection.run();
        } catch {
          ws.close(1011, "Connection failed");
        } finally {
          await connection.cleanup();
        }
      })();
    });
  });
  app.on("close", () => {
    for (const client of upgrades.clients) client.terminate();
    upgrades.close();
  });
  return app;
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const port = Number(process.env.PORT || 3100);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT.");
  if (process.env.NODE_ENV === "production" && !process.env.PUBLIC_ORIGIN)
    throw new Error("Production requires PUBLIC_ORIGIN.");
  const host = process.env.HOST || "127.0.0.1";
  const app = createFrostServer().listen(port, host, () =>
    console.log(`Frost listening on ${host}:${port}`),
  );
  const shutdown = () => {
    app.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 10000).unref();
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

