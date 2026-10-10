import type { ReactNode } from 'react';
import { PayloadViewer } from '@/components/dashboard/payload-viewer';
import { StatusChip } from '@/components/dashboard/status-chip';
import { deliveryStatusTone } from '@/lib/status-tones';
import type {
    WebhookDelivery,
    WebhookEndpointMode,
    WebhookEventDetail,
} from '@/types';

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <div className="rounded-2xl border border-border bg-card">
            <div className="border-b border-border px-6 py-4">
                <h2 className="font-semibold">{title}</h2>
            </div>
            <div className="p-6">{children}</div>
        </div>
    );
}

/**
 * Shared by the standalone event page and the endpoint page's pane, so both
 * render exactly the same payload, headers and delivery history.
 */
export function EventDetailSections({
    event,
    deliveries,
    endpointMode,
}: {
    event: WebhookEventDetail;
    deliveries: WebhookDelivery[];
    endpointMode: WebhookEndpointMode;
}) {
    return (
        <>
            <Section title="Payload">
                <PayloadViewer raw={event.raw_body} />
            </Section>

            <Section title="Headers">
                <dl className="grid gap-2 font-mono text-xs">
                    {Object.entries(event.headers).map(([name, value]) => (
                        <div
                            key={name}
                            className="grid grid-cols-1 gap-1 sm:grid-cols-3 sm:gap-2"
                        >
                            <dt className="truncate text-muted-foreground">
                                {name}
                            </dt>
                            <dd className="break-words sm:col-span-2 sm:truncate">
                                {value}
                            </dd>
                        </div>
                    ))}
                </dl>
            </Section>

            <Section title="Delivery attempts">
                {endpointMode === 'capture' ? (
                    <p className="text-sm text-muted-foreground">
                        This endpoint is receive-only, so events are stored and
                        never forwarded.
                    </p>
                ) : deliveries.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        No delivery attempts yet.
                    </p>
                ) : (
                    <div className="-m-6 divide-y divide-border">
                        {deliveries.map((delivery) => (
                            <div
                                key={delivery.id}
                                className="flex items-start justify-between gap-3 px-6 py-4"
                            >
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium">
                                        Attempt {delivery.attempt_number}
                                    </p>
                                    {delivery.destination_url && (
                                        <p className="text-xs break-all text-muted-foreground">
                                            → {delivery.destination_url}
                                        </p>
                                    )}
                                    <p className="text-sm break-words text-muted-foreground">
                                        {delivery.http_status_code
                                            ? `HTTP ${delivery.http_status_code}`
                                            : (delivery.error_message ??
                                              'No response')}
                                        {delivery.duration_ms !== null &&
                                            ` in ${delivery.duration_ms}ms`}
                                    </p>
                                </div>
                                <StatusChip
                                    tone={deliveryStatusTone[delivery.status]}
                                    className="shrink-0"
                                >
                                    {delivery.status}
                                </StatusChip>
                            </div>
                        ))}
                    </div>
                )}
            </Section>
        </>
    );
}
