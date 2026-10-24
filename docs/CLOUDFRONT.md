# Frost addresses

All main-site addresses share the same two always-on 1GB Fly machines in iad. The browser uses Home | Schoology as its outer tab title and the supplied P favicon.

| Site | Address | Distribution |
| --- | --- | --- |
| Main | https://d29bikvk0kgibf.cloudfront.net | E2KKFB4JYC2B14 |
| Additional 1 | https://d2ryor8waw6z1s.cloudfront.net | EZ93NNNL9U5KX |
| Additional 2 | https://d1q0aijop34kna.cloudfront.net | E2V1CGADCWPJEH |
| Additional 3 | https://d2zy4ij46v7gqx.cloudfront.net | E30407S17WKLML |
| Additional 4 | https://d10u396tqu8xla.cloudfront.net | E2W81LLMYIUP8L |
| Additional 5 | https://dvjtvu2ebcqkl.cloudfront.net | E1T8KJIARODDNE |
| Admin only | https://d2ftxdtd3x015d.cloudfront.net | E1MZU59EXXQJYS |

Presence estimates active browsers (75-second window,20-second heartbeats). IDs are anonymous and shared across tabs on one origin; opening separate addresses counts separately. No browsing URLs enter presence records. The footer identifies the machine answering the latest status request, not a permanent session assignment. Fly keeps balancing requests. The collector is machine683e3d9ae17238; a restart rebuilds the estimate and a collector outage shows unavailable without blocking browsing. Machine839496c774d638 forwards count updates to the collector with Fly-Force-Instance-Id. If machines are replaced, update FROST_PRESENCE_MACHINE and the display-label mapping.

Source: scripts/admin-template.mjs generates admin/stack.json. FROST_EDGE_ORIGIN retains the original address; FROST_EDGE_ORIGINS explicitly lists the additional origins. No wildcard Origin permissions. A reviewed CloudFormation change set adds only the five new distributions.
