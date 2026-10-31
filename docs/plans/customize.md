# Visual new-tab editor and community templates

Build on the isolated account site at /customize. Browsing origins receive only a read-only own-account published-design endpoint through the existing scoped gate; never expose editing, gallery publishing, draft or recovery mutations to visited websites. Reuse account CSRF/authentication, conditional transactions, admin roles and existing DynamoDB table.

Use Interact.js 1.10.28 (MIT, registry modified 2026-08-01) for drag/resize/pointer gestures and snapping. Moveable was evaluated but its npm release is older and brings a larger component stack. A general HTML editor conflicts with structured-only design and isolation. Measure final minified/gzip bundle and load it only in Customize. Use pngjs7 to decode/re-encode bounded PNG uploads server-side; browser re-rasterizes PNG/JPEG/WebP, downsizes, strips metadata. No SVG or remote image URLs.

Schema: versioned finite typed fields, 32 elements, separate 960x640 desktop and390x720 mobile placements, generated mobile fallback. Six image slots,64KiB per normalized image,160KiB decoded total,240KiB serialized design. Text/shape/gradient/image/search/clock/shortcuts supported. Wordmark is a structural locked centered overlay; only its validated hex color is editable; no element can cover it. Canvas clipped/isolated, no styles/scripts/HTML from users. All surrounding shell, security/notices/announcements/admin controls stay outside it.

Store published, previous, draft in separate account-keyed records with optimistic revision checks. Draft persistence never publishes. Save atomically snapshots old working design; Cancel discards draft; recovery loads previous into draft until Save. Reset creates default draft until Save. No history is accessed. Public templates are deliberate immutable copies of a saved design with title/description; no history/cookies/account secrets included. Reports have bounded reasons and rates; admins remove with audit and reason. Removed templates cannot be fetched/applied; existing personal copies remain the user's own design.

Tests: schema/HTML/URL bounds, PNG corruption/dimensions, storage isolation, conflicts, draft vs publish/recovery/reset, public template copy/remove/report and auth/CSRF/scope rejection. Browser: all tools/layers/history, dragging/resizing/rotation/snapping, actual preview, save/reload, gallery and responsive fallback. No partial deployment. Prior production image deployment-01M62763JQ902RCSNNPDY8B1MG remains live until complete.

## Implementation and verification, 2026-10-28
- Implemented isolated account editor, structured renderer/runtime, account drafts/published/recovery, community gallery, reports, and authorized admin inspection/removal.
- Mandatory centered wordmark has a color picker. A contrasting protected backing keeps it visible; templates cannot move, hide, delete or cover it.
- Interact.js editor bundle: 126,908 bytes minified / 40,095 bytes gzip; loaded only in Customize. MIT license copied alongside bundle. PNGJS is MIT.
- Independent review found duplicate-IHDR bounds bypass, image normalization before auth/rate, and refresh-token cross-tab race. Fixed each. Follow-up review found generic409 lockout and missing admin template inspection, also fixed.
- Automated: schema and PNG adversarial checks; account isolation; draft/publish/recovery/conflicts; public copies/report/removal; HTTP CSRF and browse scope; staff authorization.
- Browser synthetic fixture: color Save/reload; text edit and undo/redo; mobile fallback and separate placement; drag/resize/60-degree rotation; PNG upload/save/reload; local publishing/gallery preview; reset/default and prior recovery; actual main-page renderer; admin report listing/preview/removal.
- Fixture uses in-memory synthetic accounts only. Screenshot .project-memory/customize-editor.png. No production changes, real-account uploads or history collection.
- Not deployed. Production auth/session and multi-device release smoke checks remain deployment steps. Narrow Fly overlay and both existing Lambda packages must ship together after release validation.

Final automated run: **143 passed, 0 failed** (`node --test test/*.test.mjs`); both Lambda package builds and app/admin syntax checks succeeded. Independent reviewer: 21 targeted tests passed, no remaining concrete blockers in reviewed patches.

Changed source files: `public/customize/{schema,render,runtime,api,editor}.mjs`, `public/customize/{index.html,editor.css,render.css}` and generated bundle/license; `public/app.mjs`, `public/index.html`; `platform/{designs,design-validation,http,internal,staff,owner,control}.mjs`, `platform/ui/index.html`; `account-access.mjs`; `admin/{admin.js,index.html,service.mjs,assets.mjs}`; `scripts/{build-customize,build-platform,build-admin,build}.mjs`; `package.json`, `package-lock.json`; `test/{customize,platform-http,staff}.test.mjs`; `docs/{INDEX,CURRENT,PRD,ACCEPTANCE}.md` and this plan.

Released 2026-10-28: AWS account/admin Lambdas plus Fly deployment-01M628TNDGD95FHPM0RCQVA7CB completed. Both Machines healthy. Live authenticated editor/gallery/admin Templates and mirror navigation verified; static files match. No production user data changed for testing. See CURRENT for backup/rollback.
