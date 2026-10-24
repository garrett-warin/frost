# PRD — Frost

Status: active. Last updated: 2026-10-20.

## Active requirements

- REQ-01: Use the supplied garrett-warin/engine GitHub source with preserved provenance and license; isolate proxy transport from the visual UI.
- REQ-02: Use a handmade, slightly uneven but legible SVG Frost wordmark/static variant with tiny icicle tails and a neutral globe favicon/fallback. Match it with cold charcoal/navy surfaces, flat modestly squared controls, monospace utility text, compact 40px tab strip and 48px navigation toolbar. Keep centered functional search and horizontal quick links; omit gradients, corner crack textures, ambient logo/search glow, and marketing footer copy. Do not display a standalone f in the toolbar or empty tabs. Keep upstream names in legal/source attribution rather than ordinary browser labels.
- REQ-03: Begin with exactly one New Tab, empty address bar, focused start-page search. Distinguish URLs/domains/search queries. Offer DuckDuckGo, Bing, and Brave only; persist the selected engine locally.
- REQ-04: Track structured independent tabs, title, URL, favicon, loading, navigation history, and active state. Support new/close/switch/reopen, adjacent selection, and replacement after closing the last tab.
- REQ-05: Provide back/forward/reload/stop, address suggestions, keyboard shortcuts where the host permits, and a thin icy loading indicator.
- REQ-06: Provide searchable local history, bookmark toggling/manager/optional bar, command palette, contextual menu, zoom, and about view.
- REQ-07: Provide a light-only interface and settings for compact tabs, animation, accent intensity, search, privacy clearing, and advanced proxy configuration.
- REQ-08: Provide a downloads interface showing actual known state, source, size/progress, and supported actions. Do not imply access to host-browser downloads or OS reveal when unavailable.
- REQ-09: Provide Frost connection, offline, and invalid-address recovery states with meaningful retry/back/search actions.
- REQ-10: Maintain keyboard focus, reduced-motion behavior, responsive chrome, readable contrast, and layout integrity at desktop sizes and narrower widths.

## Constraints and non-goals

Local Node server binds to loopback, validates Host and relay Origin, and permits only public web destinations on ports 80/443. Website rewriting is not an isolation boundary. External endpoint support is advanced and must validate supported URL schemes. Tabs and navigation history persist per browser/origin. Downloads covers explicitly requested direct file URLs, with a 100 MB transfer limit and browser handoff; filesystem reveal and host-download enumeration are unavailable. Some shortcuts may be reserved by the host. No Google search option, native browser shell, account system, or guarantees of universal site compatibility. External adapter configuration is validated, but remote compatibility remains untested without a supplied endpoint.

## Acceptance linkage

Each requirement is covered by the checks in [ACCEPTANCE.md](ACCEPTANCE.md). Verified checkpoints and remaining acceptance work are recorded separately in CURRENT.md and ACCEPTANCE.md.






## Hosted release (supersedes earlier local-only scope)

Use garrett-warin/engine at commit 23f410dd46d6bfc66cef5cf51e98bb550251d265. Deploy frost-browsing on Fly with exactly two iad (Ashburn) Machines, each shared-cpu-1x and 1024 MB. Both remain running: autostop off, minimum running 2, restart always. Fly balances new connections using active connection concurrency (soft 50, hard 100); existing WebSockets do not migrate. These are starting thresholds, not benchmarked capacity. No database migration or server session affinity is needed.

## Browser persistence and owner announcements

Frost is now light-only; old dark/system preferences normalize to light. Open tabs, active selection, order, URLs and up to 100 back/forward entries per tab persist locally, with a window retaining the current page. Background tabs load on selection. History already persists (up to 500 visits). Clearing history also clears saved per-tab navigation trails; clearing browsing data removes the session. Storage is per browser and origin, not account sync.

Site fullscreen expands the webpage viewport, with an exit button and Escape. Home/error states exit fullscreen to keep recovery visible. Unsupported browsers report a status message.

Owner announcements are published through the isolated TOTP Admin Console. The server exposes a read-only public message endpoint; no website write API or frontend admin password exists. UI renders literal text with an SVG hammer and Developer Announcement label. See ANNOUNCEMENTS.md for commands. No production message has been published.

## Admin console requirement

Add Admin Console to the three-dot menu; open a separate CloudFront origin with noopener/noreferrer. Require server-verified TOTP for access from other devices. Use a private one-time enrollment link, atomic attempt/replay limits, 15-minute sessions, and a plain-text announcement editor. Do not expose an admin credential or privileged endpoint on the browsing origin. Use shared encrypted AWS state and protect the Lambda origin with CloudFront OAC/IAM. Owner enrollment requires the human to scan and confirm a code. This supersedes CLI-only announcement publishing.


## CloudFront main-site correction
The existing d29bikvk0kgibf.cloudfront.net address must serve Frost from Fly, including the WebSocket relay. Move the isolated admin frontend to a second distribution while preserving its DynamoDB table and enrolled authenticator. Keep HTTPS origin connections and caching disabled. Only the configured Fly Host and exact browser origins are accepted. Verify the main homepage, real browsing, unauthorized admin rejection, and both Fly health checks. Rollback uses the previous template and Fly image; enrollment state remains retained. Deployment in progress.

Outer browser tab identity: use the user-supplied P PNG as favicon and keep the exact title Home | Schoology on home and while browsing. Internal Frost tabs retain visited-page titles and favicons.

User requested five additional main-site CloudFront distributions, sharing the existing Fly machines and isolated admin console. Clone the established main-site behavior; explicitly allow each assigned HTTPS origin for the relay. Existing addresses remain supported. Verify five homepage/health/relay endpoints. Rollback removes only the five new template resources and restores previous server image/environment. Deployment pending.

Online status: estimate active browsers with an anonymous per-origin ID, heartbeat20s/expiry75s. Deduplicate tabs per origin. A bounded in-memory collector on existing machine683e3d9ae17238 combines both machines; no browsing history collected. Restart rebuilds count, outages display unavailable rather than zero. Show machine answering latest status request (load-balancing may change it). Other origins/browsers count separately.

Link containment: normal links remain in the current Frost tab; target-blank/named links, modified/middle clicks and HTTP(S) window.open requests route through internal tabs. Top/parent links remain contained. Form submissions stay in their frame to preserve POST data. Downloads keep download behavior. Admin remains intentionally separate. Native context-menu commands are controlled by the host browser; blank-popup WindowProxy/OAuth flows are not fully emulated.

Browser bans: owner-only TOTP console accepts a browser device code and private note; supports status, ban, and unban. A host-only HttpOnly cookie identifies a browser per Frost origin. No fingerprinting, IP bans, or hardware identity claim. Ban state reuses retained DynamoDB records. Fly rejects new relays and terminates existing relays within about30 seconds; upstream access-check outages fail closed. Public status exposes only a boolean for a supplied random UUID. No cross-origin browser correlation or active-visitor directory.

Frosty: integrated snowman AI companion using current vanilla UI. Small intact hop with reduced-motion support; accessible desktop/mobile page; opt-in page/selection snapshots; session conversation history; sanitized Markdown, highlighted code, copy/retry/stop. Real server streaming with configurable OpenAI-compatible endpoint/model and environment key; absent credentials explicitly disabled, no fake outputs/tools. No paid requests until approved. Bounded input/output, deadlines, per-browser/global rate and concurrency limits, ban checks. Page contents untrusted, no autonomous browser tools or hidden reasoning.

Frosty page revision: give the assistant a dedicated /#frosty page opened by a sparkle toolbar button. Preserve browser tabs and chat while switching back. Keep minimal wordmark-derived styling. Use a minimal snowman model: two small outline snowballs, dot eyes and a small nose, without arms, buttons, mouth or shadow. Keep only a small intact hop; remove head separation and screw-in motion. Remove the preview page, preview controls and its navigation link. Respect reduced motion.

Frosty mascot follows the latest assistant reply; only the empty chat displays it centrally. Restore and clear operations must keep exactly one mascot.
