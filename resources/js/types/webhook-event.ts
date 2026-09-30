import type { WebhookEndpointMode } from '@/types/webhook-endpoint';

export type WebhookEventStatus =
    'pending' | 'processing' | 'success' | 'failed';
export type WebhookDeliveryStatus =
    'pending' | 'delivered' | 'failed' | 'retrying';

export type WebhookEvent = {
    id: string;
    webhook_endpoint_id: string;
    project_id: string;
    idempotency_key: string | null;
    event_name: string | null;
    headers: Record<string, string>;
    payload: Record<string, unknown>;
    raw_body: string;
    signature_valid: boolean | null;
    status: WebhookEventStatus;
    received_at: string;
    created_at: string;
};

/**
 * The event shape behind the standalone event page and the endpoint page's
 * side-by-side pane - both render the same detail component.
 */
export type WebhookEventDetail = {
    id: string;
    event_name: string | null;
    status: WebhookEventStatus;
    signature_valid: boolean | null;
    received_at: string;
    raw_body: string;
    headers: Record<string, string>;
};

/**
 * The standalone page additionally gets the endpoint it belongs to, which is
 * what the back link and the replay action need.
 */
export type WebhookEventPageDetail = WebhookEventDetail & {
    webhookEndpoint: {
        id: string;
        name: string;
        mode: WebhookEndpointMode;
    };
};

export type WebhookDelivery = {
    id: string;
    event_id: string;
    attempt_number: number;
    status: WebhookDeliveryStatus;
    http_status_code: number | null;
    response_body: string | null;
    error_message: string | null;
    duration_ms: number | null;
    next_retry_at: string | null;
    delivered_at: string | null;
    created_at: string;
};
