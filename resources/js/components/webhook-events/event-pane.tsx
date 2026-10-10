import { Cancel01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { PayloadViewer } from '@/components/dashboard/payload-viewer';
import { StatusChip } from '@/components/dashboard/status-chip';
import { Button } from '@/components/ui/button';
import { ReplayEventButton } from '@/components/webhook-events/replay-event-button';
import { useClipboard } from '@/hooks/use-clipboard';
import { relayStatus } from '@/lib/relay-status';
import { deliveryStatusTone, eventStatusTone } from '@/lib/status-tones';
import { cn } from '@/lib/utils';
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
    source,
    titleEditor,
}: {
    event: WebhookEventDetail;
    deliveries: WebhookDelivery[];
    endpointMode: WebhookEndpointMode;
    onClose: () => void;
    source?: string;
    titleEditor?: ReactNode;
}) {
    const [payloadControls, setPayloadControls] =
        useState<HTMLDivElement | null>(null);
    const [tab, setTab] = useState('Payload');
    const [copied, copy] = useClipboard();
    const latest = deliveries.reduce<WebhookDelivery | null>(
        (current, delivery) =>
            !current || delivery.attempt_number > current.attempt_number
                ? delivery
                : current,
        null,
    );

    return (
        <div className="flex h-full min-h-0 flex-col" data-test="event-pane">
            <div className="shrink-0 px-5 pt-5 pb-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h2 className="text-lg font-semibold break-words">
                            {event.display_title ??
                                event.event_name ??
                                'Unnamed event'}
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {source} <span className="mx-2">·</span>
                            {new Date(event.received_at).toLocaleString()}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {titleEditor}
                        <Button
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
                <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-3 border-y border-border py-2 text-xs">
                    <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Ingestion</span>
                        <StatusChip tone={eventStatusTone[event.status]}>
                            {event.status}
                        </StatusChip>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Signature</span>
                        <span>
                            {event.signature_valid === null
                                ? 'Not checked'
                                : event.signature_valid
                                  ? 'Valid'
                                  : 'Invalid'}
                        </span>
                    </div>
                    <p>
                        Relay Status:{' '}
                        {relayStatus(endpointMode, event.status, latest)}
                    </p>
                    <div className="ml-auto flex items-center gap-2">
                        {event.status === 'success' &&
                            endpointMode !== 'capture' && (
                                <ReplayEventButton event={event} />
                            )}
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copy(event.id)}
                        >
                            {copied === event.id ? 'Copied' : 'Copy event ID'}
                        </Button>
                    </div>
                </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 border-b border-border px-5">
                <div
                    role="tablist"
                    aria-label="Event data"
                    className="flex shrink-0 gap-6"
                >
                    {['Payload', 'Headers', 'Delivery attempts'].map((name) => (
                        <button
                            key={name}
                            id={`event-tab-${name.replaceAll(' ', '-')}`}
                            role="tab"
                            tabIndex={tab === name ? 0 : -1}
                            aria-selected={tab === name}
                            aria-controls="event-data-panel"
                            onClick={() => setTab(name)}
                            onKeyDown={(e) => {
                                const names = [
                                    'Payload',
                                    'Headers',
                                    'Delivery attempts',
                                ];
                                const index = names.indexOf(name);
                                const next =
                                    e.key === 'ArrowRight'
                                        ? (index + 1) % 3
                                        : e.key === 'ArrowLeft'
                                          ? (index + 2) % 3
                                          : e.key === 'Home'
                                            ? 0
                                            : e.key === 'End'
                                              ? 2
                                              : null;

                                if (next !== null) {
                                    e.preventDefault();
                                    setTab(names[next]);
                                    e.currentTarget.parentElement
                                        ?.querySelectorAll<HTMLButtonElement>(
                                            '[role="tab"]',
                                        )
                                        [next]?.focus();
                                }
                            }}
                            className={cn(
                                'border-b-2 border-transparent py-3 text-sm text-muted-foreground hover:text-foreground',
                                tab === name && 'border-signal text-signal',
                            )}
                        >
                            {name}
                            {name === 'Delivery attempts' &&
                                ` (${deliveries.length})`}
                        </button>
                    ))}
                </div>
                <div
                    ref={setPayloadControls}
                    className="ml-auto flex items-center gap-4 py-2 text-xs text-muted-foreground"
                />
            </div>
            <div
                id="event-data-panel"
                role="tabpanel"
                aria-labelledby={`event-tab-${tab.replaceAll(' ', '-')}`}
                className="flex min-h-0 flex-1 flex-col"
            >
                {tab === 'Payload' && (
                    <PayloadViewer
                        raw={event.raw_body}
                        expanded
                        controlsContainer={payloadControls}
                    />
                )}
                {tab === 'Headers' && (
                    <dl className="min-h-0 overflow-auto px-5 py-3 font-mono text-xs">
                        {Object.entries(event.headers).map(([name, value]) => (
                            <div
                                key={name}
                                className="grid gap-2 border-b border-border py-3 sm:grid-cols-[minmax(160px,1fr)_3fr]"
                            >
                                <dt className="break-all text-muted-foreground">
                                    {name}
                                </dt>
                                <dd className="break-all whitespace-pre-wrap">
                                    {value}
                                </dd>
                            </div>
                        ))}
                        {!Object.keys(event.headers).length && (
                            <p className="text-muted-foreground">
                                No headers recorded.
                            </p>
                        )}
                    </dl>
                )}
                {tab === 'Delivery attempts' && (
                    <div className="min-h-0 overflow-auto px-5 py-3">
                        {endpointMode === 'capture' ? (
                            <p className="text-sm text-muted-foreground">
                                This endpoint is receive-only, so events are
                                stored and never forwarded.
                            </p>
                        ) : !deliveries.length ? (
                            <p className="text-sm text-muted-foreground">
                                No delivery attempts yet.
                            </p>
                        ) : (
                            deliveries.map((delivery) => (
                                <div
                                    key={delivery.id}
                                    className="border-b border-border py-4"
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <h3 className="text-sm font-medium">
                                            Attempt {delivery.attempt_number}
                                        </h3>
                                        <StatusChip
                                            tone={
                                                deliveryStatusTone[
                                                    delivery.status
                                                ]
                                            }
                                        >
                                            {delivery.status}
                                        </StatusChip>
                                    </div>
                                    {delivery.destination_url && (
                                        <p className="mt-1 text-xs break-all text-muted-foreground">
                                            → {delivery.destination_url}
                                        </p>
                                    )}
                                    <p className="mt-2 text-sm text-muted-foreground">
                                        {delivery.http_status_code
                                            ? `HTTP ${delivery.http_status_code}`
                                            : 'No response'}
                                        {delivery.duration_ms !== null &&
                                            ` · ${delivery.duration_ms}ms`}
                                    </p>
                                    {delivery.error_message && (
                                        <p className="mt-2 text-sm break-words text-destructive">
                                            {delivery.error_message}
                                        </p>
                                    )}
                                    {delivery.response_body && (
                                        <pre className="mt-3 overflow-auto font-mono text-xs break-all whitespace-pre-wrap">
                                            {delivery.response_body}
                                        </pre>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
