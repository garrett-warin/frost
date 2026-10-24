# ADR 001 — Local runtime and upstream reuse

Date: 2026-10-20. Status: accepted for this local implementation.

Frost needs a rewriting engine and a TCP-capable relay. Reuse the user's Bonfire source at commit `d9bf318bcc75c7386af4b96e0774e9fc22df8cca`, the pinned Epoxy transport, and Wisp; do not build replacement networking infrastructure. Keep these behind a focused transport boundary so UI state does not depend on engine internals.

Use a separate Frost directory and clean engine clone to preserve unfinished work in the existing Bonfire folder. Build JavaScript from the clone; reuse the matching local WASM/glue artifacts and document provenance. Fresh WASM rebuild requirements remain in upstream build instructions.

The runnable target is local Node at localhost:3100. Sites hosting does not support the raw TCP relay. No remote deployment is part of the current result. Bind loopback, check Host/Origin, normalize IP addresses, and connect only to checked public destinations. External endpoint configuration remains an explicit advanced setting.

Rollback is stopping the independent app. There is no database migration, external resource mutation, or modification to the prior Bonfire checkout. The owner accepts the application using the browser flow in ACCEPTANCE.md; final runtime evidence is recorded in CURRENT.md.
