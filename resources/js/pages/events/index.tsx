import { Head, router, usePage } from '@inertiajs/react';
import { Pagination } from '@/components/pagination';
import { EventsWorkspace } from '@/components/webhook-events/events-workspace';
import { eventPagination } from '@/lib/event-pagination';
import type { EventFilters, EventsPageProps } from '@/types/event-workspace';

export default function EventsIndex(props: EventsPageProps) {
    const {
        url,
        props: { errors },
    } = usePage();
    function visit(filters: EventFilters, event?: string, partial = false) {
        const query: Record<string, string> = Object.fromEntries(
            Object.entries(filters).filter(([, value]) => value !== ''),
        );

        if (event) {
            query.event = event;
        }

        if (partial) {
            query.page = String(props.events.current_page);
        }

        router.get('/events', query, {
            preserveScroll: true,
            preserveState: true,
            replace: true,
            ...(partial ? { only: ['selectedEvent'] } : {}),
        });
    }
    function download() {
        const query = new URLSearchParams(
            Object.entries(props.filters).filter(([, value]) => value !== ''),
        );
        window.location.href = `/events/export?${query}`;
    }

    return (
        <>
            <Head title="Events" />
            {Object.values(errors).length > 0 && (
                <div
                    role="alert"
                    className="mx-6 mt-4 text-sm text-destructive"
                >
                    {Object.values(errors).join(' ')}
                </div>
            )}
            <EventsWorkspace
                {...props}
                onFiltersChange={(filters) => visit(filters)}
                onSelect={(id) => visit(props.filters, id, true)}
                onClose={() => visit(props.filters, undefined, true)}
                onRefresh={() =>
                    router.get(
                        url,
                        {},
                        { preserveScroll: true, preserveState: true },
                    )
                }
                onDownload={download}
                pagination={
                    <Pagination
                        paginator={eventPagination(
                            props.events,
                            props.selectedEvent?.event.id,
                        )}
                    />
                }
            />
        </>
    );
}

EventsIndex.layout = { breadcrumbs: [{ title: 'Events', href: '/events' }] };
