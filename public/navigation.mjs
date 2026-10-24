export const searchEngines = {
  duckduckgo: { name: "DuckDuckGo", url: "https://duckduckgo.com/?q=" },
  bing: { name: "Bing", url: "https://www.bing.com/search?q=" },
  brave: { name: "Brave", url: "https://search.brave.com/search?q=" },
};
export function destination(input, engine = "duckduckgo") {
  const text = input.trim();
  if (!text) throw new Error("Enter a website or a search.");
  if (
    /^[a-z][a-z\d+.-]*:/i.test(text) &&
    !/^https?:\/\//i.test(text) &&
    !/^[\w.-]+:\d+(?:\/|$)/.test(text)
  )
    throw new Error("Use an HTTP or HTTPS website address.");
  const isAddress =
    /^https?:\/\//i.test(text) ||
    (!/\s/.test(text) &&
      /^(?:localhost|[^/]+\.[^/]+)(?::\d+)?(?:\/|$)/i.test(text));
  const search = searchEngines[engine] || searchEngines.duckduckgo;
  const url = new URL(
    isAddress
      ? /^https?:\/\//i.test(text)
        ? text
        : `https://${text}`
      : search.url + encodeURIComponent(text),
  );
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error("Use a website address without embedded credentials.");
  return url.href;
}
