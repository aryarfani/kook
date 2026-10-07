import http from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { createServer } from 'vite';
import {
    anchor,
    projects,
    endpoints,
    providers,
    events,
    deliveries,
} from './fixtures.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const version = 'kook-synthetic-preview-v1';
const vite = await createServer({
    configFile: false,
    root,
    publicDir: path.join(root, 'public'),
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': path.join(root, 'resources/js') } },
    server: { middlewareMode: true, hmr: { host: '127.0.0.1' } },
    appType: 'custom',
});
const { formatEventTitle, validTitleFormat } = await vite.ssrLoadModule(
    '/resources/js/lib/event-title.ts',
);
const titleFor = (event) =>
    formatEventTitle(
        event.webhookEndpoint.event_title_format,
        event.payload,
        event.event_name,
    );
function filters(url) {
    return Object.fromEntries(
        ['project', 'endpoint', 'status', 'from', 'to', 'search'].map((key) => [
            key,
            url.searchParams.get(key) || '',
        ]),
    );
}
function filtered(url, rows = events) {
    const f = filters(url);

    return rows.filter(
        (row) =>
            (!f.project || row.project_id === f.project) &&
            (!f.endpoint || row.webhook_endpoint_id === f.endpoint) &&
            (!f.status || row.status === f.status) &&
            (!f.search ||
                JSON.stringify(row.payload)
                    .toLowerCase()
                    .includes(f.search.trim().toLowerCase())) &&
            (!f.from || Date.parse(row.received_at) >= Date.parse(f.from)) &&
            (!f.to || Date.parse(row.received_at) <= Date.parse(f.to)),
    );
}
function paginate(rows, url) {
    const last_page = Math.max(1, Math.ceil(rows.length / 25));
    const current_page = Math.min(
        last_page,
        Math.max(1, Number(url.searchParams.get('page')) || 1),
    );
    const pageUrl = (n) => {
        const next = new URL(url);
        next.searchParams.set('page', String(n));

        return next.pathname + next.search;
    };

    return {
        data: rows.slice((current_page - 1) * 25, current_page * 25),
        total: rows.length,
        per_page: 25,
        current_page,
        last_page,
        links: [
            {
                url: current_page > 1 ? pageUrl(current_page - 1) : null,
                label: '&laquo; Previous',
                active: false,
            },
            ...Array.from({ length: last_page }, (_, n) => ({
                url: pageUrl(n + 1),
                label: String(n + 1),
                active: current_page === n + 1,
            })),
            {
                url:
                    current_page < last_page ? pageUrl(current_page + 1) : null,
                label: 'Next &raquo;',
                active: false,
            },
        ],
    };
}
function selection(url, rows = events) {
    const event = rows.find((row) => row.id === url.searchParams.get('event'));

    if (!event) {
        return null;
    }

    return {
        event: {
            id: event.id,
            event_name: event.event_name,
            display_title: titleFor(event),
            status: event.status,
            signature_valid: event.signature_valid,
            received_at: event.received_at,
            raw_body: event.raw_body,
            headers: event.headers,
            webhookEndpoint: {
                id: event.webhookEndpoint.id,
                name: event.webhookEndpoint.name,
                mode: event.webhookEndpoint.mode,
            },
        },
        deliveries: deliveries.get(event.id),
    };
}
function pageFor(url) {
    if (url.pathname === '/events') {
        return [
            'events/index',
            {
                events: paginate(
                    filtered(url).map((event) => ({
                        ...event,
                        display_title: titleFor(event),
                        latest_delivery:
                            deliveries.get(event.id)?.at(-1) ?? null,
                        project: projects.find(
                            (project) => project.id === event.project_id,
                        ),
                        endpoint: {
                            id: event.webhookEndpoint.id,
                            name: event.webhookEndpoint.name,
                            project_id: event.project_id,
                            mode: event.webhookEndpoint.mode,
                        },
                    })),
                    url,
                ),
                projects,
                endpoints,
                filters: filters(url),
                selectedEvent: selection(url),
            },
        ];
    }

    if (url.pathname === '/' || url.pathname === '/dashboard') {
        return [
            'dashboard',
            {
                stats: {
                    projects: projects.length,
                    webhookEndpoints: endpoints.length,
                    eventsLast24h: events.filter(
                        (event) =>
                            Date.parse(event.received_at) >= anchor - 86400000,
                    ).length,
                    failedEventsLast24h: events.filter(
                        (event) =>
                            event.status === 'failed' &&
                            Date.parse(event.received_at) >= anchor - 86400000,
                    ).length,
                },
                recentEvents: events.slice(0, 8),
            },
        ];
    }

    if (url.pathname === '/projects') {
        return ['projects/index', { projects }];
    }

    const project = projects.find(
        (project) => url.pathname === `/projects/${project.id}`,
    );

    if (project) {
        const rows = events.filter((event) => event.project_id === project.id);

        return [
            'projects/show',
            {
                project,
                projects,
                webhookEndpoints: endpoints.filter(
                    (endpoint) => endpoint.project_id === project.id,
                ),
                providers,
                apiKeys: [],
                events: paginate(rows, url),
                activeTab: url.searchParams.get('tab') || 'endpoints',
                selectedEvent: selection(url, rows),
            },
        ];
    }

    const endpoint = endpoints.find(
        (endpoint) => url.pathname === `/webhook-endpoints/${endpoint.id}`,
    );

    if (endpoint) {
        const rows = events.filter(
            (event) => event.webhook_endpoint_id === endpoint.id,
        );

        return [
            'webhook-endpoints/show',
            {
                project: projects.find(
                    (project) => project.id === endpoint.project_id,
                ),
                projects,
                providers,
                webhookEndpoint: endpoint,
                events: paginate(rows, url),
                selectedEvent: selection(url, rows),
            },
        ];
    }

    return [
        'preview/unavailable',
        {
            message:
                'This route is outside the local events preview. Administration, provider changes, settings and audit history are unavailable here. All displayed events are synthetic.',
        },
    ];
}
const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1:5178');
    const redirect = (target) => {
        response.writeHead(303, { Location: target });
        response.end();
    };

    try {
        const directEvent = events.find(
            (event) => url.pathname === `/events/${event.id}`,
        );

        if (directEvent) {
            return redirect(`/events?event=${directEvent.id}`);
        }

        const endpointExport = endpoints.find(
            (endpoint) =>
                url.pathname === `/webhook-endpoints/${endpoint.id}/export` ||
                url.pathname ===
                    `/webhook-endpoints/${endpoint.id}/events/export`,
        );

        if (url.pathname === '/events/export' || endpointExport) {
            const rows = filtered(
                url,
                endpointExport
                    ? events.filter(
                          (event) =>
                              event.webhook_endpoint_id === endpointExport.id,
                      )
                    : events,
            );
            const exported = rows.map((event) => ({
                ...Object.fromEntries(
                    Object.entries(event).filter(
                        ([key]) =>
                            ![
                                'raw_body',
                                'webhookEndpoint',
                                'webhook_endpoint',
                            ].includes(key),
                    ),
                ),
                project: {
                    id: event.project_id,
                    name: projects.find(
                        (project) => project.id === event.project_id,
                    ).name,
                },
                endpoint: {
                    id: event.webhookEndpoint.id,
                    name: event.webhookEndpoint.name,
                    mode: event.webhookEndpoint.mode,
                },
            }));
            response.writeHead(200, {
                'Content-Type': 'application/json',
                'Content-Disposition':
                    'attachment; filename="kook-synthetic-events.json"',
            });
            response.end(JSON.stringify(exported, null, 2));

            return;
        }

        if (request.method !== 'GET' && request.method !== 'HEAD') {
            const titleEndpoint = endpoints.find(
                (endpoint) =>
                    url.pathname ===
                    `/webhook-endpoints/${endpoint.id}/title-format`,
            );

            if (titleEndpoint && request.method === 'PATCH') {
                let body = '';

                for await (const chunk of request) {
                    body += chunk;

                    if (body.length > 10000) {
                        throw new Error('Format request too large');
                    }
                }

                const format = JSON.parse(body).event_title_format;

                if (typeof format !== 'string' || !validTitleFormat(format)) {
                    response.writeHead(422, {
                        'Content-Type': 'application/json',
                    });
                    response.end(
                        JSON.stringify({
                            errors: {
                                event_title_format: 'Invalid title format.',
                            },
                        }),
                    );

                    return;
                }

                titleEndpoint.event_title_format = format || null;

                return redirect(
                    request.headers.referer
                        ? new URL(request.headers.referer).pathname +
                              new URL(request.headers.referer).search
                        : '/events',
                );
            }

            const event = events.find(
                (event) => url.pathname === `/events/${event.id}/replay`,
            );

            if (event && event.webhookEndpoint.mode !== 'capture') {
                const attempts = deliveries.get(event.id);
                const now = new Date(anchor).toISOString();
                attempts.push({
                    id: `synthetic-replay-${attempts.length + 1}`,
                    event_id: event.id,
                    attempt_number: attempts.length + 1,
                    status: 'delivered',
                    http_status_code: 200,
                    response_body:
                        '{"synthetic":true,"network_request_sent":false}',
                    error_message: null,
                    duration_ms: 42,
                    next_retry_at: null,
                    delivered_at: now,
                    created_at: now,
                });
                event.status = 'success';

                return redirect(
                    request.headers.referer
                        ? new URL(request.headers.referer).pathname +
                              new URL(request.headers.referer).search
                        : `/events?event=${event.id}`,
                );
            }

            response.writeHead(409, {
                'Content-Type': 'text/html; charset=utf-8',
            });
            response.end(
                '<h1>Local preview only</h1><p>This action is unavailable. No changes were made.</p>',
            );

            return;
        }

        if (
            /^\/(?:@|node_modules|resources|preview|branding|fonts|favicon)/.test(
                url.pathname,
            )
        ) {
            return vite.middlewares(request, response, () => {
                response.statusCode = 404;
                response.end('Not found');
            });
        }

        const [component, data] = pageFor(url);
        let props = {
            name: 'Kook local preview',
            auth: {
                user: {
                    id: 'synthetic-preview-user',
                    name: 'Local preview',
                    email: 'preview@demo.example',
                    email_verified_at: '2026-10-07T00:00:00Z',
                },
            },
            sidebarOpen: true,
            errors: {},
            flash: {},
            ...data,
        };
        const partial = request.headers['x-inertia-partial-data'];

        if (
            partial &&
            request.headers['x-inertia-partial-component'] === component
        ) {
            props = Object.fromEntries(
                partial
                    .split(',')
                    .filter((key) => key in props)
                    .map((key) => [key, props[key]]),
            );
        }

        const page = {
            component,
            props,
            url: url.pathname + url.search,
            version,
            clearHistory: false,
            encryptHistory: false,
        };

        if (request.headers['x-inertia']) {
            response.writeHead(200, {
                'Content-Type': 'application/json',
                'X-Inertia': 'true',
                Vary: 'X-Inertia',
                'Cache-Control': 'no-store',
            });
            response.end(JSON.stringify(page));

            return;
        }

        const encoded = JSON.stringify(page).replaceAll('<', '\\u003c');
        const html = await vite.transformIndexHtml(
            url.pathname,
            `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kook local preview</title></head><body><div id="app"></div><script type="application/json" data-page="app">${encoded}</script><script type="module" src="/preview/main.tsx"></script></body></html>`,
        );
        response.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
            Vary: 'X-Inertia',
        });
        response.end(html);
    } catch (error) {
        console.error(error);
        response.statusCode = 500;
        response.end('Local preview failed. See the local terminal.');
    }
});
server.listen(5178, '127.0.0.1', () =>
    console.log(
        `Synthetic Kook preview: http://127.0.0.1:5178/events?event=${events[0].id}\nLoopback only. No PHP, VPS, database, or outbound webhook traffic.`,
    ),
);

for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, async () => {
        server.close();
        await vite.close();
        process.exit(0);
    });
}
