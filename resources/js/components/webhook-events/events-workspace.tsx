import { Download01Icon, RefreshIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
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
    pagination?: React.ReactNode;
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
    pagination,
}: EventsWorkspaceProps) {
    const filteredEndpoints = endpoints.filter(
        (endpoint) =>
            !filters.project || endpoint.project_id === filters.project,
    );
    const hasFilters = Object.values(filters).some(Boolean);
    const selectClass =
        'h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring';

    return (
        <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        Events
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {events.total.toLocaleString()}{' '}
                        {hasFilters ? 'matching' : 'received'} across{' '}
                        {filters.project ? 'this project' : 'all projects'}
                    </p>
                </div>
                <div className="flex gap-2">
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

            <div className="flex flex-wrap items-end gap-3 border-b border-border pb-5">
                <label className="grid min-w-36 flex-1 gap-1.5 text-xs text-muted-foreground">
                    Project
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
                <label className="grid min-w-40 flex-1 gap-1.5 text-xs text-muted-foreground">
                    Endpoint
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
                <label className="grid min-w-32 flex-1 gap-1.5 text-xs text-muted-foreground">
                    Status
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
                    From
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
                    To
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
            </div>

            <div
                className={cn(
                    'grid min-w-0 gap-5',
                    selectedEvent &&
                        'xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,1fr)]',
                )}
            >
                <div
                    className={cn(
                        'min-w-0',
                        selectedEvent && 'hidden xl:block',
                    )}
                >
                    <div className="overflow-x-auto rounded-lg border border-border">
                        <table
                            className="w-full text-left text-sm"
                            aria-label="Webhook events"
                        >
                            <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                                <tr>
                                    <th className="px-4 py-3 font-medium">
                                        Received
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        Event
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        Source
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        Status
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        Relay Status
                                    </th>
                                    {!selectedEvent && (
                                        <th className="px-4 py-3 font-medium">
                                            Signature
                                        </th>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {events.data.map((event) => (
                                    <tr
                                        key={event.id}
                                        className={cn(
                                            'cursor-pointer hover:bg-muted/50',
                                            selectedEvent?.event.id ===
                                                event.id && 'bg-signal/10',
                                        )}
                                        onClick={() => onSelect(event.id)}
                                        data-test={`event-row-${event.id}`}
                                    >
                                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                                            <div className="text-foreground">
                                                {new Date(
                                                    event.received_at,
                                                ).toLocaleTimeString([], {
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                    second: '2-digit',
                                                })}
                                            </div>
                                            <div className="mt-0.5 text-xs">
                                                {new Date(
                                                    event.received_at,
                                                ).toLocaleDateString([], {
                                                    month: 'short',
                                                    day: 'numeric',
                                                })}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <button
                                                className="max-w-52 truncate text-left font-medium outline-none hover:text-signal focus-visible:ring-2 focus-visible:ring-ring"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onSelect(event.id);
                                                }}
                                            >
                                                {event.event_name ??
                                                    'Unnamed event'}
                                            </button>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="max-w-40 truncate">
                                                {event.project.name}
                                            </div>
                                            <div className="mt-0.5 max-w-40 truncate text-xs text-muted-foreground">
                                                {event.endpoint.name}
                                            </div>
                                        </td>
                                        <td
                                            className={cn(
                                                'px-4 py-3 text-xs font-medium',
                                                statusClasses[event.status],
                                            )}
                                        >
                                            {event.status}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-muted-foreground">
                                            {relayStatus(
                                                event.endpoint.mode,
                                                event.status,
                                                event.latest_delivery,
                                            )}
                                        </td>
                                        {!selectedEvent && (
                                            <td className="px-4 py-3 text-xs text-muted-foreground">
                                                {event.signature_valid ===
                                                null ? (
                                                    'Not checked'
                                                ) : event.signature_valid ? (
                                                    'Valid'
                                                ) : (
                                                    <span className="text-red-500">
                                                        Invalid
                                                    </span>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                ))}
                                {!events.data.length && (
                                    <tr>
                                        <td
                                            colSpan={selectedEvent ? 5 : 6}
                                            className="px-4 py-16 text-center text-muted-foreground"
                                        >
                                            No events match these filters.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                        <span>
                            Page {events.current_page} of {events.last_page} ·{' '}
                            {events.total.toLocaleString()} events
                        </span>
                        {pagination}
                    </div>
                </div>
                {selectedEvent && (
                    <section className="min-w-0" aria-label="Event inspector">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                            <span className="text-muted-foreground">
                                {endpoints.find(
                                    (endpoint) =>
                                        endpoint.id ===
                                        selectedEvent.event.webhookEndpoint.id,
                                )?.name ??
                                    selectedEvent.event.webhookEndpoint.name}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onClose}
                                className="xl:hidden"
                            >
                                Back to events
                            </Button>
                        </div>
                        <EventPane
                            event={selectedEvent.event}
                            deliveries={selectedEvent.deliveries}
                            endpointMode={
                                selectedEvent.event.webhookEndpoint.mode
                            }
                            onClose={onClose}
                        />
                    </section>
                )}
            </div>
        </div>
    );
}
