// All identities, payloads, keys and signatures below are synthetic.
export const anchor = Date.parse('2026-10-07T15:30:00+07:00');
const uuid = (prefix, n) =>
    `${prefix}0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const iso = (ms) => new Date(ms).toISOString();
export const projects = [
    'Commerce production',
    'Platform engineering',
    'Development sandbox',
].map((name, n) => ({
    id: uuid('1', n + 1),
    user_id: uuid('9', 1),
    name,
    slug: [
        'commerce-production',
        'platform-engineering',
        'development-sandbox',
    ][n],
    failure_emails_enabled: true,
    webhook_endpoints_count: [2, 2, 1][n],
    api_keys_count: 0,
    created_at: iso(anchor - 30 * 86400000),
    updated_at: iso(anchor),
}));
export const providers = ['Stripe', 'GitHub', 'Shopify'].map((name, n) => ({
    id: uuid('4', n + 1),
    key: name.toLowerCase(),
    name,
    docs_url: null,
    is_active: true,
}));
export const endpoints = [
    ['Stripe billing', 0, 'managed', 0],
    ['Shopify orders', 0, 'managed', 2],
    ['GitHub deployments', 1, 'managed', 1],
    ['Build notifications', 1, 'relay', null],
    ['Receive-only development', 2, 'capture', null],
].map(([name, project, mode, provider], n) => ({
    id: uuid('2', n + 1),
    project_id: projects[project].id,
    name,
    mode,
    destination_url:
        mode === 'capture' ? null : `https://app-${n + 1}.example/webhooks`,
    provider_id: provider === null ? null : providers[provider].id,
    provider: provider === null ? null : providers[provider],
    ingest_token: `synthetic-preview-endpoint-${n + 1}`,
    signing_secret: 'SYNTHETIC-NOT-A-REAL-SECRET',
    status: 'active',
    created_at: iso(anchor - 20 * 86400000),
    updated_at: iso(anchor),
    latest_event: null,
}));
export const events = Array.from({ length: 90 }, (_, n) => {
    const endpoint = endpoints[n % endpoints.length];
    const names = [
        [
            'invoice.payment_succeeded',
            'invoice.payment_failed',
            'customer.subscription.updated',
        ],
        ['orders/create', 'orders/paid', 'orders/fulfilled'],
        ['deployment_status', 'push', 'workflow_run'],
        ['build.completed', 'build.failed', 'release.published'],
        ['test.ping', 'customer.updated', 'subscription.created'],
    ];
    const event_name = names[n % 5][Math.floor(n / 5) % 3];
    const status =
        endpoint.mode === 'capture'
            ? 'success'
            : [
                  'success',
                  'failed',
                  'pending',
                  'processing',
                  'success',
                  'success',
              ][Math.floor(n / 5) % 6];
    const payload = {
        id: `synthetic_evt_${String(n + 1).padStart(4, '0')}`,
        type: event_name,
        livemode: false,
        data: {
            object: {
                id: `synthetic_object_${n + 1}`,
                customer: {
                    name: ['Avery Chen', 'Morgan Rivera', 'Jamie Patel'][n % 3],
                    email: `customer-${n + 1}@demo.example`,
                },
                amount: 12900 + n * 100,
                currency: 'usd',
                metadata: {
                    environment: 'local-preview',
                    order: `ORDER-${2040 + n}`,
                },
            },
        },
        preview_notice:
            'Synthetic fixture. No real customer or credential data.',
    };
    const headers = {
        'content-type': 'application/json',
        'user-agent': [
            'Stripe/1.0 (synthetic)',
            'Shopify/synthetic',
            'GitHub-Hookshot/synthetic',
            'Preview-CI/1.0',
            'Local-Test/1.0',
        ][n % 5],
        'x-request-id': `synthetic-request-${n + 1}`,
        'x-preview-signature': 'FAKE-SIGNATURE-FOR-LOCAL-PREVIEW',
    };
    const received_at = iso(
        anchor -
            (n < 35
                ? n * 17 * 60000
                : n < 65
                  ? 86400000 + (n - 35) * 23 * 60000
                  : (2 + Math.floor((n - 65) / 5)) * 86400000 + n * 60000),
    );

    return {
        id: uuid('3', n + 1),
        webhook_endpoint_id: endpoint.id,
        project_id: endpoint.project_id,
        idempotency_key: `synthetic-${n + 1}`,
        event_name,
        status,
        received_at,
        created_at: received_at,
        signature_valid:
            endpoint.mode === 'relay' || endpoint.mode === 'capture'
                ? null
                : status === 'failed' && n % 2
                  ? false
                  : true,
        payload,
        headers,
        raw_body: JSON.stringify(payload, null, 2),
        webhookEndpoint: endpoint,
        webhook_endpoint: { id: endpoint.id, name: endpoint.name },
    };
});
export const deliveries = new Map(
    events.map((event, n) => {
        if (
            event.webhookEndpoint.mode === 'capture' ||
            event.signature_valid === false ||
            event.status === 'pending'
        ) {
            return [event.id, []];
        }

        const retry = event.status === 'success' && n % 3 === 0;
        const states = retry
            ? ['failed', 'retrying', 'delivered']
            : [
                  event.status === 'success'
                      ? 'delivered'
                      : event.status === 'processing'
                        ? 'retrying'
                        : 'failed',
              ];

        return [
            event.id,
            states.map((status, attempt) => ({
                id: uuid('5', n * 3 + attempt + 1),
                event_id: event.id,
                attempt_number: attempt + 1,
                status,
                http_status_code: status === 'delivered' ? 200 : 502,
                response_body:
                    status === 'delivered'
                        ? '{"accepted":true,"synthetic":true}'
                        : '{"error":"Synthetic upstream unavailable"}',
                error_message:
                    status === 'delivered'
                        ? null
                        : 'Synthetic gateway returned 502',
                duration_ms: status === 'delivered' ? 85 + n : 1200 + n,
                next_retry_at:
                    status === 'retrying' ? iso(anchor + 60000) : null,
                delivered_at:
                    status === 'delivered'
                        ? iso(
                              Date.parse(event.received_at) +
                                  (attempt + 1) * 60000,
                          )
                        : null,
                created_at: iso(
                    Date.parse(event.received_at) + attempt * 60000,
                ),
            })),
        ];
    }),
);
endpoints.forEach((endpoint) => {
    const event = events.find(
        (event) => event.webhook_endpoint_id === endpoint.id,
    );
    const attempts = deliveries.get(event.id);
    endpoint.latest_event = {
        id: event.id,
        status: event.status,
        latest_delivery: attempts.at(-1) || null,
    };
});
