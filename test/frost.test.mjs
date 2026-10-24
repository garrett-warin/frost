import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { destination, searchEngines } from "../public/navigation.mjs";
import { isPublicAddress } from "../relay-policy.mjs";
import { createFrostServer } from "../server.mjs";
import { get } from "node:http";
test("addresses and searches", () => {
  assert.equal(destination("example.com"), "https://example.com/");
  assert.equal(
    destination("http://example.com/a?q=b"),
    "http://example.com/a?q=b",
  );
  assert.equal(
    destination("snow & ice"),
    "https://duckduckgo.com/?q=snow%20%26%20ice",
  );
  for (const input of [
    "",
    "javascript:alert(1)",
    "file:///etc/passwd",
    "https://user:pass@example.com",
  ])
    assert.throws(() => destination(input));
});
test("engine choices exclude Google and preserve search escaping", () => {
  assert.deepEqual(Object.keys(searchEngines), ["duckduckgo", "bing", "brave"]);
  assert.equal(
    destination("snow & ice", "bing"),
    "https://www.bing.com/search?q=snow%20%26%20ice",
  );
  assert.equal(
    destination("snow & ice", "brave"),
    "https://search.brave.com/search?q=snow%20%26%20ice",
  );
  assert.equal(
    destination("https://example.com", "brave"),
    "https://example.com/",
  );
});
test("private, mapped, reserved, and malformed destinations fail closed", () => {
  for (const address of [
    "127.0.0.1",
    "10.0.0.1",
    "169.254.1.2",
    "::1",
    "::ffff:127.0.0.1",
    "fc00::1",
    "fe80::1",
    "garbage",
    "192.0.2.1",
  ])
    assert.equal(isPublicAddress(address), false, address);
  assert.equal(isPublicAddress("1.1.1.1"), true);
  assert.equal(isPublicAddress("2606:4700:4700::1111"), true);
});
test("HTTP serves Frost, engine assets, and errors safely", async () => {
  const server = createFrostServer().listen(0, "127.0.0.1");
  await once(server, "listening");
  const origin = `http://localhost:${server.address().port}`;
  try {
    const home = await fetch(origin);
    assert.equal(home.status, 200);
    assert.match(await home.text(), /Frost/);
    const wasm = await fetch(origin + "/vendor/runtimekit.wasm");
    assert.equal(wasm.status, 200);
    assert.equal(wasm.headers.get("content-type"), "application/wasm");
    assert.equal((await fetch(origin + "/missing")).status, 404);
    assert.equal((await fetch(origin, { method: "POST" })).status, 405);
    const hostileStatus = await new Promise((resolve, reject) =>
      get(origin, { headers: { Host: "attacker.example" } }, (response) => {
        response.resume();
        resolve(response.statusCode);
      }).on("error", reject),
    );
    assert.equal(hostileStatus, 403);
    assert.equal((await fetch(origin + "/%2e%2e%5cpackage.json")).status, 403);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
