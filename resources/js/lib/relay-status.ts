import type {
    WebhookDelivery,
    WebhookEndpointMode,
    WebhookEventStatus,
} from '@/types';

export type RelayDelivery = Pick<
    WebhookDelivery,
    'status' | 'http_status_code'
>;

export function relayStatus(
    mode: WebhookEndpointMode,
    eventStatus: WebhookEventStatus,
    delivery: RelayDelivery | null,
): string {
    if (mode === 'capture') {
        return 'Receive Only';
    }

    if (!delivery) {
        return eventStatus === 'failed' ? 'Not relayed' : 'Queued';
    }

    const label =
        delivery.status === 'pending'
            ? 'Queued'
            : delivery.status[0].toUpperCase() + delivery.status.slice(1);

    return delivery.http_status_code === null
        ? label
        : `${label} · HTTP ${delivery.http_status_code}`;
}
