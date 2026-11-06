export function outageMessage(data, now = Date.now()) {
  const valid = ['healthy', 'unavailable', 'unreachable', 'unknown'];
  if (!data || !Number.isFinite(data.checkedAt) || now - data.checkedAt > 60000 || data.checkedAt > now + 5000 ||
      !Array.isArray(data.servers) || !([1,2].includes(data.servers.length)) ||
      data.servers.some(server => !server || !valid.includes(server.status))) return null;
  const healthy = data.servers.filter(server => server.status === 'healthy').length;
  if (healthy === data.servers.length) return '';
  if(data.servers.length===1) return 'Outage: Frost’s server is not responding normally. Please try again shortly.';
  const failed = data.servers.some(server => ['unavailable', 'unreachable'].includes(server.status));
  if (healthy === 1) return failed
    ? 'Outage: One server is unavailable. New connections will use the healthy server. If a page stops loading, refresh it.'
    : 'Server warning: We couldn’t confirm one server’s status. New connections will use an available server.';
  return failed
    ? 'Outage: Our servers are having trouble responding. Some pages may not load. We’ll keep checking for recovery.'
    : 'Server status is temporarily unavailable. We’ll keep checking.';
}

export function startOutageMonitor({ banner, message, fetchHealth = fetch, doc = document,
  schedule = setTimeout, cancel = clearTimeout, now = Date.now } = {}) {
  let stopped = false, pending = false, timer, errors = 0;
  function render(text) {
    if (message.textContent !== text) message.textContent = text;
    banner.hidden = !text;
  }
  async function check() {
    if (stopped || pending || doc.hidden) return;
    pending = true;
    cancel(timer);
    try {
      const response = await fetchHealth('/api/server-health', { cache: 'no-store', signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw Error('Health check unavailable');
      const text = outageMessage(await response.json(), now());
      if (text === null) throw Error('Invalid or stale health check');
      if (!stopped) { errors = 0; render(text); }
    } catch {
      if (!stopped && ++errors >= 2) render('Connection warning: We can’t check server status right now. Check your connection or try again shortly.');
    } finally {
      pending = false;
      if (!stopped) timer = schedule(check, 15000);
    }
  }
  const resume = () => { if (!doc.hidden) { cancel(timer); void check(); } };
  doc.addEventListener('visibilitychange', resume);
  void check();
  return () => { stopped = true; cancel(timer); doc.removeEventListener('visibilitychange', resume); };
}

if (typeof document !== 'undefined') {
  const banner = document.getElementById('outage-banner');
  const message = document.getElementById('outage-message');
  if (banner && message) startOutageMonitor({ banner, message });
}
