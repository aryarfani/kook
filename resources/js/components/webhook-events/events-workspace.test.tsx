import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { EventsWorkspace } from '@/components/webhook-events/events-workspace';
import type { EventsWorkspaceProps } from '@/components/webhook-events/events-workspace';

function props(): EventsWorkspaceProps {
    return {
        projects: [{ id: 'shop', name: 'Demo shop' }],
        endpoints: [
            {
                id: 'billing',
                name: 'Stripe billing',
                project_id: 'shop',
                mode: 'relay',
            },
        ],
        filters: { project: '', endpoint: '', status: '', from: '', to: '' },
        selectedEvent: null,
        events: {
            data: [
                {
                    id: 'evt-one',
                    event_name: 'invoice.paid',
                    status: 'success',
                    signature_valid: true,
                    latest_delivery: {
                        status: 'delivered',
                        http_status_code: 200,
                    },
                    received_at: '2026-10-07T06:00:00Z',
                    project: { id: 'shop', name: 'Demo shop' },
                    endpoint: {
                        id: 'billing',
                        name: 'Stripe billing',
                        project_id: 'shop',
                        mode: 'relay',
                    },
                },
            ],
            total: 1,
            per_page: 25,
            current_page: 1,
            last_page: 1,
            links: [],
        },
        onFiltersChange: vi.fn(),
        onSelect: vi.fn(),
        onClose: vi.fn(),
        onDownload: vi.fn(),
        onRefresh: vi.fn(),
    };
}

describe('Events workspace', () => {
    test('shows source context and opens the selected event from one list', async () => {
        const page = props();
        render(<EventsWorkspace {...page} />);
        const table = within(
            screen.getByRole('table', { name: 'Webhook events' }),
        );
        expect(table.getByText('Demo shop')).toBeInTheDocument();
        expect(table.getByText('Stripe billing')).toBeInTheDocument();
        expect(table.getByText('Relay Status')).toBeInTheDocument();
        expect(table.getByText('Delivered · HTTP 200')).toBeInTheDocument();
        await userEvent.click(
            screen.getByRole('button', { name: 'invoice.paid' }),
        );
        expect(page.onSelect).toHaveBeenCalledWith('evt-one');
    });

    test('changing project clears a previously selected endpoint', async () => {
        const page = props();
        page.filters.endpoint = 'billing';
        render(<EventsWorkspace {...page} />);
        await userEvent.selectOptions(screen.getByLabelText('Project'), 'shop');
        expect(page.onFiltersChange).toHaveBeenCalledWith({
            project: 'shop',
            endpoint: '',
            status: '',
            from: '',
            to: '',
        });
    });

    test('downloads and refreshes from the Events toolbar', async () => {
        const page = props();
        render(<EventsWorkspace {...page} />);
        await userEvent.click(
            screen.getByRole('button', { name: /download json/i }),
        );
        await userEvent.click(screen.getByRole('button', { name: /refresh/i }));
        expect(page.onDownload).toHaveBeenCalledOnce();
        expect(page.onRefresh).toHaveBeenCalledOnce();
    });

    test('an empty filter result keeps the filters available', () => {
        const page = props();
        page.events.data = [];
        page.events.total = 0;
        render(<EventsWorkspace {...page} />);
        expect(
            screen.getByText('No events match these filters.'),
        ).toBeInTheDocument();
        expect(screen.getByLabelText('Project')).toBeInTheDocument();
    });

    test('receive-only events expose payload and headers in a closable inspector', async () => {
        const page = props();
        page.selectedEvent = {
            event: {
                id: 'evt-one',
                event_name: 'invoice.paid',
                status: 'success',
                signature_valid: null,
                received_at: '2026-10-07T06:00:00Z',
                raw_body: '{"invoice_id":"demo-invoice-100"}',
                headers: { 'content-type': 'application/json' },
                webhookEndpoint: {
                    id: 'billing',
                    name: 'Stripe billing',
                    mode: 'capture',
                },
            },
            deliveries: [],
        };
        render(<EventsWorkspace {...page} />);
        const inspector = within(
            screen.getByRole('region', { name: 'Event inspector' }),
        );
        expect(inspector.getByText(/demo-invoice-100/)).toBeInTheDocument();
        expect(inspector.getByText('content-type')).toBeInTheDocument();
        expect(
            inspector.getByText('Relay Status: Receive Only'),
        ).toBeInTheDocument();
        expect(
            inspector.queryByRole('button', { name: /replay/i }),
        ).not.toBeInTheDocument();
        await userEvent.click(
            inspector.getByRole('button', { name: 'Close event' }),
        );
        expect(page.onClose).toHaveBeenCalledOnce();
    });
});
