import { Cancel01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { StatusChip } from '@/components/dashboard/status-chip';
import { Button } from '@/components/ui/button';
import { EventDetailSections } from '@/components/webhook-events/event-detail-sections';
import { ReplayEventButton } from '@/components/webhook-events/replay-event-button';
import { relayStatus } from '@/lib/relay-status';
import { eventStatusTone } from '@/lib/status-tones';
import type {
    WebhookDelivery,
    WebhookEndpointMode,
    WebhookEventDetail,
} from '@/types';

export function EventPane({
    event,
    deliveries,
    endpointMode,
    onClose,
}: {
    event: WebhookEventDetail;
    deliveries: WebhookDelivery[];
    endpointMode: WebhookEndpointMode;
    onClose: () => void;
}) {
    const latestDelivery = deliveries.reduce<WebhookDelivery | null>(
        (latest, delivery) =>
            !latest || delivery.attempt_number > latest.attempt_number
                ? delivery
                : latest,
        null,
    );

    return (
        <div
            className="space-y-6 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:pr-1"
            data-test="event-pane"
        >
            <div className="rounded-2xl border border-border bg-card px-6 py-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h2 className="truncate font-semibold">
                            {event.event_name ?? 'Event'}
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {new Date(event.received_at).toLocaleString()}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
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
                        </div>
                        <p className="mt-3 text-xs text-muted-foreground">
                            Relay Status:{' '}
                            {relayStatus(
                                endpointMode,
                                event.status,
                                latestDelivery,
                            )}
                        </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        {event.status === 'success' &&
                            endpointMode !== 'capture' && (
                                <ReplayEventButton event={event} />
                            )}
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={onClose}
                            aria-label="Close event"
                            data-test="close-event-pane-button"
                        >
                            <HugeiconsIcon
                                icon={Cancel01Icon}
                                className="size-4"
                            />
                        </Button>
                    </div>
                </div>
            </div>

            <EventDetailSections
                event={event}
                deliveries={deliveries}
                endpointMode={endpointMode}
            />
        </div>
    );
}
