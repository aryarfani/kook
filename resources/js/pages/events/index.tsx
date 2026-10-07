import { Head, router, usePage } from '@inertiajs/react';
import { EventsWorkspace } from '@/components/webhook-events/events-workspace';
import { useEventInbox } from '@/hooks/use-event-inbox';
import type { EventFilters, EventsPageProps } from '@/types/event-workspace';

export default function EventsIndex(props: EventsPageProps) {
    const {
        url,
        props: { errors },
    } = usePage();
    const inbox = useEventInbox(props.events, props.filters);
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
            preserveScroll: partial,
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
                        {
                            preserveScroll: false,
                            preserveState: true,
                            onSuccess: inbox.reset,
                        },
                    )
                }
                onDownload={download}
                events={inbox.events}
                inboxRevision={inbox.revision}
                onLoadMore={inbox.loadMore}
                hasMore={inbox.hasMore}
                loadingMore={inbox.loading}
                loadError={inbox.error}
            />
        </>
    );
}

EventsIndex.layout = { breadcrumbs: [{ title: 'Events', href: '/events' }] };
