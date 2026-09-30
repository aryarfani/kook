import { ArrowLeft01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { Head, Link } from '@inertiajs/react';
import { PageHeader } from '@/components/dashboard/page-header';
import { StatusChip } from '@/components/dashboard/status-chip';
import { EventDetailSections } from '@/components/webhook-events/event-detail-sections';
import { ReplayEventButton } from '@/components/webhook-events/replay-event-button';
import { eventStatusTone } from '@/lib/status-tones';
import { show as showEndpoint } from '@/routes/webhook-endpoints';
import type { WebhookDelivery, WebhookEventPageDetail } from '@/types';

export default function EventsShow({
    event,
    deliveries,
}: {
    event: WebhookEventPageDetail;
    deliveries: WebhookDelivery[];
}) {
    return (
        <>
            <Head title={`Event ${event.id}`} />

            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <Link
                    href={showEndpoint(event.webhookEndpoint)}
                    className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                    data-test="back-to-endpoint-link"
                >
                    <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
                    Back to {event.webhookEndpoint.name}
                </Link>

                <PageHeader
                    eyebrow={event.webhookEndpoint.name}
                    title={
                        <span className="flex flex-wrap items-center gap-3">
                            {event.event_name ?? 'Event'}
                            <StatusChip tone={eventStatusTone[event.status]}>
                                {event.status}
                            </StatusChip>
                            {event.signature_valid !== null && (
                                <StatusChip
                                    tone={
                                        event.signature_valid
                                            ? 'success'
                                            : 'danger'
                                    }
                                >
                                    {event.signature_valid
                                        ? 'valid signature'
                                        : 'invalid signature'}
                                </StatusChip>
                            )}
                        </span>
                    }
                    description={new Date(event.received_at).toLocaleString()}
                >
                    {event.status === 'success' &&
                        event.webhookEndpoint.mode !== 'capture' && (
                            <ReplayEventButton event={event} />
                        )}
                </PageHeader>

                <EventDetailSections
                    event={event}
                    deliveries={deliveries}
                    endpointMode={event.webhookEndpoint.mode}
                />
            </div>
        </>
    );
}
