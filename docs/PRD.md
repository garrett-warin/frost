# PRD — Frost

Repository requirement (November 6): synchronize deployed Grove source to GitHub and provide OVH code assembly. Remove ordinary first-party comments; preserve legal notices, executable directives, documentation and pinned third-party code. Exclude private configuration and user data. Publishing source must not redeploy production.

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

Frosty: integrated snowman AI companion using current vanilla UI. Small intact hop with reduced-motion support; accessible desktop/mobile page; opt-in page/selection snapshots; session conversation history; sanitized Markdown, highlighted code, copy/retry/stop. Real server streaming through an explicitly selected provider adapter with an approved model list and separate server-only credential; absent credentials explicitly disabled, no fake outputs/tools. No paid requests until approved. Bounded input/output, deadlines, per-browser/global rate and concurrency limits, ban checks. Page contents untrusted, no autonomous browser tools or hidden reasoning.

Frosty page revision: give the assistant a dedicated /#frosty page opened by a sparkle toolbar button. Preserve browser tabs and chat while switching back. Keep minimal wordmark-derived styling. Use a minimal snowman model: two small outline snowballs, dot eyes and a small nose, without arms, buttons, mouth or shadow. Keep only a small intact hop; remove head separation and screw-in motion. Remove the preview page, preview controls and its navigation link. Respect reduced motion.

Frosty mascot follows the latest assistant reply; only the empty chat displays it centrally. Restore and clear operations must keep exactly one mascot.

Frosty image upload: one PNG/JPEG/WebP up to2MiB per send, local preview/remove, explicit Send before transmission, auto-select an available image-capable model with visible notice. Server validates declared MIME against bytes and bounds request size; text-only models reject image payloads. Image bytes are not written to session history or server files; reattach for follow-ups. Verify valid images, mismatched/unsupported/oversized input, selection gating, removal and provider failures.

## Frosty provider revision — 2026-10-23

The accepted pre-deployment provider is Groq Free: `FROST_AI_PROVIDER=groq`, fixed official API endpoint, separate `GROQ_API_KEY`, and only `openai/gpt-oss-20b`, `openai/gpt-oss-120b`, or `qwen/qwen3.8-27b`. Qwen is preview/image-capable; GPT-OSS options are text-only. Preserve explicit OpenRouter fallback with its own key, `:free` validation and zero-price guard; no automatic provider fallback or account upgrade.

Keep the Groq organization on Free. Apply the conservative full-prompt UTF-8 budget: 5,440 text bytes without an image, 3,392 with one, including system/history/context; reserve 2,048 output, 512 framing, and 2,048 image tokens. Reject excess explicitly without truncation. Existing 2 MiB image/type/capability controls remain. Provider quota errors are recoverable and shared across visitors/Machines. Key entry, new provider tests, real Groq requests and rollout are pending; see [Frosty configuration](FROSTY.md).

## Account platform requirements — 2026-10-25 (in progress)

- ACC-1: Implement the approved account/dispenser and device-trust specifications. Google Form registration must use Google-verified respondent email, signed idempotent events, bounded polling and recovery through fresh signed Google Form email verification. Public Frost ID never authenticates.
- ACC-2: Persistent device grants survive server-side inactivity until logout, device revocation, deletion or restriction. Rotate short-lived access and hashed refresh credentials; browser cookie eviction remains possible. A verified user must recover even at the device limit.
- ACC-3: Save current tabs and website cookies per account in an encrypted, revision-controlled vault. Exclude browsing history and page content. Preserve websites' cookie expiration rules. Clear account-specific local state when switching accounts.
- ACC-4: Restricted browsing must redirect to the dispenser's appeal route; banned users may authenticate there for support. Ban checks cover navigation, API, relay establishment and active connections. Deleting an account or changing email must not erase an identity restriction.
- ACC-5: Expose /admin on all main origins as a fixed redirect to the existing isolated TOTP console. Preserve enrollment and never place owner credentials on browsed-content origins.
- ACC-6: Keep Google setup honest, secrets out of source and browser JavaScript, and live sign-in unchanged until isolated runtime, real registration/recovery/handoff and deployment acceptance are verified.

See ACCOUNT-SETUP.md and plans/account-platform.md for setup and remaining integration work.


## Email-only sign-in revision — 2026-10-25

The owner requested site-generated codes with no outgoing email and no visitor OAuth. Frost displays a one-time code which the user manually pastes into the Google Form. A signed Apps Script event must match both this code and the pending Google-verified email. The original dispenser browser completes using its separate private HttpOnly polling cookie. Requests expire after fifteen minutes and complete once; returning verification preserves the Frost ID. Restricted accounts remain appeals-only. Forwarding a code to another person can still authorize the initiating browser: this social-engineering limitation is not solved by the polling cookie. Live integration and deployment remain pending.

## Unified entry and owner dashboard — 2026-10-26

- ACC-7: One email/Continue entry handles returning and new users. Google verification precedes account lookup outcomes. Returning accounts preserve their ID; new identities choose a username only afterward. Concurrent signup, revocation, and restrictions cannot revive older proof.
- ADM-1: Preserve isolated TOTP enrollment and 15-minute sessions; add owner-only account search, status filters, ban/unban/suspend/session revocation, announcements, support replies, and account action history. Require a reason and confirmation for account moderation.
- ADM-2: Today/last-seven-days UTC analytics display online browser estimates, observed daily peak, account/ban totals, registrations and open support requests. Minute sampling begins at deployment; missing samples remain gaps. Registration charts count retained accounts (deleted identities are excluded). No historical figures are invented. Main-site online browser estimates are distinct from signed-in account identities.
- ADM-3: Reuse the existing account control service through IAM direct Lambda invocation, never through a public admin route or a browser-shared secret. Reuse existing Fly presence; store aggregate hourly samples with 32-day retention. No browsing URLs, contents, or tracking identifiers enter analytics. Account restrictions remain dispenser-only until separately verified browser integration ships.

All Frost-owned main, account and admin surfaces use thin cream-track muted-teal scrollbars. Embedded websites retain their own styles. Successful null account API responses are valid and must not expose mixed authenticated/entry views.

## Mirror management — 2026-10-26
Add ten CloudFront browser mirrors to the existing fifteen-resource total (five existing plus ten new). Automatically assign active accounts to available links using assignment counts. Owner TOTP console lists links and allows reasoned block/unblock and manual account assignment. Blocked links cannot receive assignments; existing assigned active accounts move in bounded background batches or on their next assignment check. No available destination yields a clear waiting state. Existing browser isolation work remains a separate unreleased prerequisite for mandatory account authentication and cookie sync.

## Account ban enforcement
Require scoped account grants for all browsing relays and Frosty, on Fly and every mirror. Active sockets and AI streams recheck account restrictions, revocation and assignment at15-second intervals and terminate on denial or service failure. Return banned/suspended users to dispenser appeals. Missing/revoked sessions require dispenser verification. Retain persistent refresh grants. No privileged storage/session APIs are enabled on browsing origins.


Admin browser refresh: TOTP owner can request one active account or all signed-in browsers to reload for updates. Confirm scope and reason, audit each request, throttle repeated requests per target, and preserve locally saved tabs. Online browsers observe within their 15-second access check; inactive browsers act on resume. Existing pages must load this listener once. Unsaved website state is not preserved.


Verification response sheet: TOTP-only read view of latest100 rows from the owner-linked sheet; email/time and masked code suffix. Five-minute private script snapshots, exact source validation, path-bound signing, stale status, seven-day snapshot expiry. Sheet rows never grant sign-in or moderation privileges. Google sheet remains private.

## Account-based admin access

Authorized owner Frost ID fr_a1359b81-1fde-48e7-be73-1cac9a58f425 manages admin membership from isolated dispenser /admin using the existing verified account session without TOTP entry. Members have no admin link or API permissions. Owner alone grants/revokes roles; the owner role is protected from UI removal/deletion. Existing isolated TOTP console is a recovery path approved by the owner.


Online account viewer: existing protected Accounts search supports Online now with username, Frost ID and last browsing check. Presence is approximate, refreshed by successful scoped browsing checks, written at most every30seconds and expires after75seconds. Revocation epoch and restriction invalidate presence. No URLs collected. Verify zero/fresh/expired/revoked/banned and owner-only access. Viewer-facing timestamps use local timezone; new-tab page has a quiet local clock.

Viewer timezone correction: client sends its IANA timezone through both TOTP and account-admin routes. Today/7-day local calendar boundaries drive registrations, daily peaks and chart bins; UTC remains storage only. Test spring/fall DST, fractional offsets, invalid zones, and staff-route forwarding.


Forced username change: authorized admins select category and explanation for an active account, with existing owner/peer protections. Preserve account sessions/data; block handoff, redemption, new browsing and active connection checks until atomic unique rename clears the flag. Previously flagged names cannot be reused on that account. Dispenser shows mandatory form and reason; deletion cannot bypass pending change. Bans take priority and retain appeals. Test old/in-flight grants, same/invalid/taken names, audit, protected targets and successful recovery.

Server outage notice: main browser shows a compact orange top banner based on existing two-machine health checks. Distinguish a failed probe from unknown or failed status retrieval; explain new-connection routing and refresh guidance without promising seamless migration. Poll every15seconds while visible and clear on verified recovery. Flaticon icon with visible attribution.

Timed suspensions: administrators choose an integer duration (1 minute–365 days); bans remain indefinite. Server-side effective status expires at the deadline, without relying on TTL or a scheduler. Expiry never restores credentials invalidated by the original moderation epoch. Preserve legacy indefinite suspensions, owner/staff protections, username restrictions and deleted-identity restrictions until their deadline. Restricted page shows reason, local end time, remaining time, appeals and a status recheck.

Maintenance notice: existing administrators can enable/remove a blue banner independent of the orange outage banner and developer announcement. Require a reason (1–300 characters), start and expected end in the admin's local timezone. Display immediately as scheduled, then in progress, then hide on the next poll after end. This is a notice only; no service shutdown. Public text and dates are not private. Existing authentication, store and announcement delivery are reused; no permissions or infrastructure added.

404 page: Frost-owned missing page URLs show a quiet branded Lost in the frost page with a home link, custom wordmark and existing tab title/favicon. Return HTTP404, including /404.html and HEAD; missing scripts/styles stay plain text, unknown API returns JSON. Never echo request paths into HTML. No changes to destination-site errors inside browsing tabs.

Retired 2026-11-04 by owner request: no new-tab editor or community template gallery. Always render the original wordmark, note, clock, search and shortcuts. Saved designs must not load. Editor, design and template APIs return 410; account/admin navigation contains no customization entries. Existing database records remain dormant; no account/tab/cookie deletion. Historical plan: docs/plans/customize.md.


2026-10-31 versioned terms: updated disclosure distinguishes planned administrator history access from current local-only history. No history collection added. Build derives terms version from normalized document SHA-256; explicit authenticated CSRF-protected acceptance records version/time on account. All handoff, redemption, browse checks, refresh and ongoing connection checks require current acceptance. Account support, appeals, logout and deletion remain accessible. UI offers explicit unchecked agreement and account-options alternative. No production deployment or GitHub push for this change.

## REQ-HISTORY — 2026-10-31

Add an audited admin account-history viewer using existing isolated staff/TOTP authorization. Collect only newly reported HTTP(S) visits after current explicit terms acceptance; bind identity to browsing credentials, enforce assignment and restrictions, strip URL credentials/query/fragment, and bound URL/title/payload/rate. Keep at most 100 visits for a 30-day visibility window; remove on account deletion. No backfill, no privileged read route on browsing origins, no promise of complete capture. Disclose admin access, retention and local-clear behavior in terms, acceptance screen and local History panel.

October31 repository repair: a clean clone must contain the account source, build its own engine/UI assets in Docker, pass tests, and package only explicitly tracked source. Release verification must reject dirty checkouts or stale Docker context. Disable automatic history reporting and production collection pending separate transparent opt-in.

## Verification reliability — 2026-11-04

REQ-VERIFY-RETRY: Verified-email mismatches must produce an actionable polling error without authenticating the request or revealing the Google email. A correct resubmission may recover the same unexpired request. Queue before contacting Google; verify VERIFIED collection before delivery. Retain temporary delivery failures, fail the execution visibly, and log no personal data or credentials. Keep the Form in VERIFIED mode continuously.

## Migration notice — 2026-11-04
Provide a dismissible modal announcing the planned server move, with literal bounded copy, keyboard focus, per-origin acknowledgement and a remotely withdrawable JSON notice. Keep migration paused. Owner authorized an all-user browser refresh after the popup release; preserve the existing browser session behavior. No account/database migration in this change.

## OVH migration — 2026-11-04
Owner resumed migration to a single Debian 13 OVH VPS (6 vCores, 12 GB, 100 GB) while retaining CloudFront public links. Scope includes browsing, accounts, admin and storage. Preserve IDs, sessions, encryption/signing keys and Google verification. Existing Fly remains live until rehearsal and cutover checks pass; single VPS cannot provide host failover. See [migration plan](plans/ovh-migration.md).

## Server history revision — 2026-11-04
Owner removes TOS page/agreement gates. New Frost visits are sent to the account service and stamped with authenticated username, site and time. Show the approved notice only in the user-facing History panel. No local-history backfill. Preserve bounded retention, signed account attribution, admin access auditing and bans. See plans/server-history.md.

## Replacement dispenser (2026-11-04)
Use a new CloudFront distribution for the account dispenser. Preserve accounts, assignments, bans, TOTP isolation and the existing Google Form callback. Retain the old origin as a strict compatibility alias; cookies remain host-only. Do not merge sessions across origins.

## Support workspace revision (2026-11-05)
Separate Support and Audit log. Open/closed/unclaimed/help filters, claim/unclaim, quick different healthy-link assignment, close/reopen, and help escalation. One open request per account including appeals; users close and reply to their own requests. Both sides use a polling chat panel. Administrator replies are always anonymous; audit records authenticated actors. Main browsing UI exposes only an admin-only unclaimed boolean notification. Preserve existing requests and hidden internal claim metadata.


## Main-site support and administrator outreach — 2026-11-05

Main Frost Support entry opens the existing isolated account support chat. Personal unread-message notification reveals no message contents on browsing origins. Administrators can initiate a conversation, automatically claimed by the initiator, while preserving the single-open-ticket rule and anonymous public labels. User replies notify the claimed account admin; viewing messages clears only the matching notification revision.


## Shared service notices — 2026-11-05

Service notices appear on both the main browser and dispenser, including signed-out entry. Administrators choose Maintenance or Service disruption, with start/end times and reason. Existing notices default to maintenance; disruption uses teal, maintenance blue, automatic outage remains orange.

Username rules: public rules page with no real-name requirement, linked from username creation, mandatory rename, settings and both admin surfaces. No automated moderation behavior change.

- Weekly link replacement: discreet Blocked action in dispenser; warning before confirmation; one successful replacement per account per rolling seven days, enforced atomically. No global block, no automatic report rotation, no cooldown on failure.

- Grove rebrand: use handmade Grove leaf wordmark, forest-green browser/account/admin palette, Grove AI naming, and Grove in all product-authored user-facing messages. Preserve legacy cookie/storage/API/environment identifiers, account IDs and existing deployment URLs for compatibility. Historical audit/support content remains unmodified. New assistant navigation uses #ai; #frosty remains an alias.

Admin overview shows named administrator account presence. Admin reset username uses grove_user_<full existing uid>, confirmation and required reason, audit identity and notification; ordinary users cannot choose reserved generated names.


Approved Grove TOS publication: public static terms, no privacy section; Browsing prohibits only poki.com/crazygames.com. Link from account restrictions/footer and both admin consoles. No consent gate requested.


## AI support — 2026-11-06
New ordinary support requests use clearly labeled Grove AI replies grounded in the published terms. Request a human and natural-language human requests hand off immediately; appeals/restricted users always human with a minimum-two-sentence instruction (why banned and whether it will happen again). This is guidance, not a submission-blocking sentence validator. Human staff claim to take over and may return owned ordinary tickets to AI. Existing human tickets stay human. AI has no moderation/assignment tools. Private handoff summary is AI-generated with a deterministic conversation-excerpt fallback. Bounded Groq free provider, durable jobs, leases/revisions and rate limits prevent duplicate/stale answers. Account UI and admin console preserve drafts and poll mode transitions.

Appeal advisory: staff-only accept/deny/review_deeper recommendation plus rationale with summary timestamp. Ground in terms/conversation, default deeper review on missing evidence/failure; no automated decision or restriction mutation.


Head admin role: owner alone appoints/demotes heads; heads add/remove regular admins and ban regular admins. Owner and peer heads protected; other peer-admin actions remain owner-only. Head IDs must be a subset of admin IDs. Identity and target checked transactionally for roster and account/assignment mutations. Account navigation and presence show head role. No automatic real role grants.


## Administrator notifications — 2026-11-06
Live on OVH. Account rows offer Send notification (500 characters). Delivery is account-scoped on the browsing shell and dispenser, with a dismissible green slide-down message, silent animated SVG bell, reduced-motion support, and retry on failed dismissal. Offline notes remain queued for up to 30 days. Dismissal removes popup delivery and marks the Activity notice read. Admin identity is audited, user-facing sender is Administrator. Sending limits: 5 per recipient per minute, 30 per sender per hour. Staff session is revalidated within the mutation transaction. Browser dismissal uses only the limited browse signing key. Existing open pages need one normal reload to load the new client.
Validation: 208/208 tests passed; browser preview verified appearance, plain-text rendering, retry and queue progression. Accounts/admin deployed smoke tests passed; all 19 public routes passed; canonical dispenser, browser CSS and both admin JS assets matched source. No notifications sent to real users during testing. Rollback: /opt/frost/releases/before-notifications-theme-20261106/source.tgz.
Changed files: platform/accounts.mjs, control.mjs, staff.mjs, owner.mjs, http.mjs, internal.mjs, ui/account.mjs; admin/admin.js, index.html, service.mjs, assets.mjs; account-access.mjs; server.mjs; public/device-access.mjs, admin-notifications.mjs, admin-notifications.css; scripts/build-platform.mjs; test/admin-notifications.test.mjs, staff.test.mjs, account-ui.test.mjs, account-client.test.mjs.
