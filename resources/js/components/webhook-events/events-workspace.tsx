import { Download01Icon, RefreshIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { EventPane } from '@/components/webhook-events/event-pane';
import { toLocalIso } from '@/lib/export-date';
import { relayStatus } from '@/lib/relay-status';
import { cn } from '@/lib/utils';
import type { EventsPageProps, EventFilters } from '@/types/event-workspace';

export type EventsWorkspaceProps = EventsPageProps & {
    onFiltersChange: (filters: EventFilters) => void;
    onSelect: (id: string) => void;
    onClose: () => void;
    onDownload: () => void;
    onRefresh: () => void;
    onLoadMore?: () => void;
    hasMore?: boolean;
    loadingMore?: boolean;
    loadError?: string;
    inboxRevision?: number;
};

function calendarDate(value: string, end: boolean): string {
    if (!value) {
        return '';
    }

    const [year, month, day] = value.split('-').map(Number);

    return toLocalIso(new Date(year, month - 1, day), end);
}

const statusClasses = {
    success: 'text-emerald-600 dark:text-emerald-400',
    failed: 'text-red-600 dark:text-red-400',
    processing: 'text-amber-600 dark:text-amber-400',
    pending: 'text-muted-foreground',
};

export function EventsWorkspace({
    events,
    projects,
    endpoints,
    filters,
    selectedEvent,
    onFiltersChange,
    onSelect,
    onClose,
    onDownload,
    onRefresh,
    onLoadMore,
    hasMore = false,
    loadingMore = false,
    loadError = '',
    inboxRevision = 0,
}: EventsWorkspaceProps) {
    const listRef = useRef<HTMLDivElement>(null);
    const sentinelRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (
            !hasMore ||
            loadingMore ||
            loadError ||
            !onLoadMore ||
            !sentinelRef.current ||
            !listRef.current
        ) {
            return;
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    onLoadMore();
                }
            },
            { root: listRef.current, rootMargin: '160px' },
        );
        observer.observe(sentinelRef.current);

        return () => observer.disconnect();
    }, [hasMore, loadingMore, loadError, onLoadMore, inboxRevision]);
    const filteredEndpoints = endpoints.filter(
        (endpoint) =>
            !filters.project || endpoint.project_id === filters.project,
    );
    const hasFilters = Object.values(filters).some(Boolean);
    const selectedEndpoint = endpoints.find(
        (endpoint) => endpoint.id === selectedEvent?.event.webhookEndpoint.id,
    );
    const selectedProject = projects.find(
        (project) => project.id === selectedEndpoint?.project_id,
    );
    const selectClass =
        'h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring';

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-3">
                <label className="grid min-w-32 gap-1.5 text-xs text-muted-foreground">
                    <span className="sr-only">Project</span>
                    <select
                        aria-label="Project"
                        className={selectClass}
                        value={filters.project}
                        onChange={(e) =>
                            onFiltersChange({
                                ...filters,
                                project: e.target.value,
                                endpoint: '',
                            })
                        }
                    >
                        <option value="">All projects</option>
                        {projects.map((project) => (
                            <option key={project.id} value={project.id}>
                                {project.name}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="grid min-w-40 gap-1.5 text-xs text-muted-foreground">
                    <span className="sr-only">Endpoint</span>
                    <select
                        aria-label="Endpoint"
                        className={selectClass}
                        value={filters.endpoint}
                        onChange={(e) =>
                            onFiltersChange({
                                ...filters,
                                endpoint: e.target.value,
                            })
                        }
                    >
                        <option value="">All endpoints</option>
                        {filteredEndpoints.map((endpoint) => (
                            <option key={endpoint.id} value={endpoint.id}>
                                {endpoint.name}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="grid min-w-32 gap-1.5 text-xs text-muted-foreground">
                    <span className="sr-only">Status</span>
                    <select
                        aria-label="Status"
                        className={selectClass}
                        value={filters.status}
                        onChange={(e) =>
                            onFiltersChange({
                                ...filters,
                                status: e.target.value,
                            })
                        }
                    >
                        <option value="">All statuses</option>
                        {['success', 'failed', 'processing', 'pending'].map(
                            (status) => (
                                <option key={status} value={status}>
                                    {status[0].toUpperCase() + status.slice(1)}
                                </option>
                            ),
                        )}
                    </select>
                </label>
                <label className="grid gap-1.5 text-xs text-muted-foreground">
                    <span className="sr-only">From</span>
                    <input
                        aria-label="From"
                        type="date"
                        className={selectClass}
                        value={filters.from.split('T')[0]}
                        max={filters.to.split('T')[0] || undefined}
                        onChange={(e) =>
                            onFiltersChange({
                                ...filters,
                                from: calendarDate(e.target.value, false),
                            })
                        }
                    />
                </label>
                <label className="grid gap-1.5 text-xs text-muted-foreground">
                    <span className="sr-only">To</span>
                    <input
                        aria-label="To"
                        type="date"
                        className={selectClass}
                        value={filters.to.split('T')[0]}
                        min={filters.from.split('T')[0] || undefined}
                        onChange={(e) =>
                            onFiltersChange({
                                ...filters,
                                to: calendarDate(e.target.value, true),
                            })
                        }
                    />
                </label>
                <Button
                    variant="outline"
                    size="sm"
                    className="h-9"
                    onClick={() => {
                        const today = new Date();
                        onFiltersChange({
                            ...filters,
                            from: toLocalIso(today, false),
                            to: toLocalIso(today, true),
                        });
                    }}
                >
                    Today
                </Button>
                {hasFilters && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-9"
                        onClick={() =>
                            onFiltersChange({
                                project: '',
                                endpoint: '',
                                status: '',
                                from: '',
                                to: '',
                            })
                        }
                    >
                        Clear
                    </Button>
                )}

                <div className="ml-auto flex gap-2">
                    <Button variant="outline" size="sm" onClick={onRefresh}>
                        <HugeiconsIcon icon={RefreshIcon} className="size-4" />
                        Refresh
                    </Button>
                    <Button
                        size="sm"
                        onClick={onDownload}
                        className="bg-signal text-signal-foreground hover:bg-signal/90"
                    >
                        <HugeiconsIcon
                            icon={Download01Icon}
                            className="size-4"
                        />
                        Download JSON
                    </Button>
                </div>
            </div>
            <div className="grid min-h-0 flex-1 md:grid-cols-[300px_minmax(0,1fr)]">
                <section
                    aria-label="Event inbox"
                    className={cn(
                        'flex min-h-0 flex-col border-r border-border',
                        selectedEvent && 'hidden md:flex',
                    )}
                >
                    <div className="shrink-0 border-b border-border px-4 py-4">
                        <div className="flex items-baseline justify-between">
                            <h1 className="text-lg font-semibold">Events</h1>
                            <span className="text-xs text-muted-foreground">
                                {events.total.toLocaleString()}{' '}
                                {hasFilters ? 'matching' : 'events'}
                            </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Newest first
                        </p>
                    </div>
                    <div
                        key={inboxRevision}
                        ref={listRef}
                        className="min-h-0 flex-1 overflow-y-auto"
                    >
                        {events.data.map((event) => (
                            <button
                                key={event.id}
                                onClick={() => onSelect(event.id)}
                                data-test={`event-row-${event.id}`}
                                aria-pressed={
                                    selectedEvent?.event.id === event.id
                                }
                                className={cn(
                                    'block w-full border-b border-l-2 border-border border-l-transparent px-4 py-3 text-left hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring',
                                    selectedEvent?.event.id === event.id &&
                                        'border-l-signal bg-signal/10',
                                )}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <span className="min-w-0 text-sm font-medium break-words">
                                        {event.event_name ?? 'Unnamed event'}
                                    </span>
                                    <time className="shrink-0 text-xs text-muted-foreground">
                                        {new Date(
                                            event.received_at,
                                        ).toLocaleTimeString([], {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })}
                                    </time>
                                </div>
                                <p
                                    className="mt-1 truncate text-xs text-muted-foreground"
                                    title={`${event.project.name} / ${event.endpoint.name}`}
                                >
                                    {event.project.name} / {event.endpoint.name}
                                </p>
                                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                                    <span
                                        className={statusClasses[event.status]}
                                    >
                                        {event.status}
                                    </span>
                                    <span className="text-muted-foreground">
                                        ·
                                    </span>
                                    <span className="text-muted-foreground">
                                        {relayStatus(
                                            event.endpoint.mode,
                                            event.status,
                                            event.latest_delivery,
                                        )}
                                    </span>
                                </div>
                                <p className="mt-1 text-[11px] text-muted-foreground">
                                    {new Date(
                                        event.received_at,
                                    ).toLocaleDateString([], {
                                        month: 'short',
                                        day: 'numeric',
                                    })}
                                </p>
                            </button>
                        ))}
                        {!events.data.length && (
                            <p className="px-4 py-10 text-sm text-muted-foreground">
                                No events match these filters.
                            </p>
                        )}
                        <div
                            ref={sentinelRef}
                            className="px-4 py-3 text-xs text-muted-foreground"
                            aria-live="polite"
                        >
                            {loadingMore ? (
                                'Loading more events…'
                            ) : loadError ? (
                                <>
                                    <p>{loadError}</p>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={onLoadMore}
                                    >
                                        Retry
                                    </Button>
                                </>
                            ) : events.data.length > 0 && !hasMore ? (
                                'All matching events loaded.'
                            ) : null}
                        </div>
                    </div>
                </section>
                <section
                    aria-label="Event inspector"
                    className={cn(
                        'flex min-h-0 min-w-0 flex-col',
                        !selectedEvent && 'hidden md:flex',
                    )}
                >
                    {selectedEvent ? (
                        <>
                            <Button
                                variant="ghost"
                                onClick={onClose}
                                className="shrink-0 self-start md:hidden"
                            >
                                Back to events
                            </Button>
                            <EventPane
                                key={selectedEvent.event.id}
                                event={selectedEvent.event}
                                deliveries={selectedEvent.deliveries}
                                endpointMode={
                                    selectedEvent.event.webhookEndpoint.mode
                                }
                                source={[
                                    selectedProject?.name,
                                    selectedEvent.event.webhookEndpoint.name,
                                ]
                                    .filter(Boolean)
                                    .join(' / ')}
                                onClose={onClose}
                            />
                        </>
                    ) : (
                        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                            Select an event to inspect its payload, headers, and
                            delivery attempts.
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
