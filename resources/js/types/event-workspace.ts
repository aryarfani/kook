import type { RelayDelivery } from '@/lib/relay-status';
import type {
    Paginated,
    WebhookDelivery,
    WebhookEndpointMode,
    WebhookEventStatus,
    WebhookEventWithEndpoint,
} from '@/types';

export type EventProject = { id: string; name: string };
export type EventEndpoint = {
    id: string;
    name: string;
    project_id: string;
    mode: WebhookEndpointMode;
};
export type EventFilters = {
    project: string;
    endpoint: string;
    status: string;
    from: string;
    to: string;
};
export type EventRow = {
    id: string;
    event_name: string | null;
    status: WebhookEventStatus;
    received_at: string;
    signature_valid: boolean | null;
    project: EventProject;
    endpoint: EventEndpoint;
    latest_delivery: RelayDelivery | null;
};
export type EventsPageProps = {
    events: Paginated<EventRow>;
    projects: EventProject[];
    endpoints: EventEndpoint[];
    filters: EventFilters;
    selectedEvent: {
        event: WebhookEventWithEndpoint;
        deliveries: WebhookDelivery[];
    } | null;
};
