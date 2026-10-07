# Local Kook preview

From the Kook checkout run `node preview/server.mjs`, then open
`http://127.0.0.1:5178/events?event=30000000-0000-4000-8000-000000000001`.

Uses installed Node dependencies and the actual React/Inertia pages with a separate
Vite configuration; no PHP or package/config changes are required. The server binds
only to loopback. Fixtures contain 90 synthetic events, three projects and five
endpoints, anchored to October 7, 2026 in Jakarta. Emails, destinations and secrets
are explicitly fake. Restart to reset simulated replay attempts.

Events filtering, selection, pagination, JSON download, dashboard and existing
project/endpoint inspection work locally. Replay adds one in-memory synthetic
delivery and sends no network request. Other writes and unrelated administration
routes are unavailable. This preview does not connect to the VPS or a database.
Downloads omit raw bodies and retain parsed payloads and headers.
