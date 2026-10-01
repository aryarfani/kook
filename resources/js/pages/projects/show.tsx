import { Form, Head, Link, router } from '@inertiajs/react';
import type { MouseEvent } from 'react';
import ProjectController from '@/actions/App/Http/Controllers/ProjectController';
import { PageHeader } from '@/components/dashboard/page-header';
import { StatusChip } from '@/components/dashboard/status-chip';
import InputError from '@/components/input-error';
import { Pagination } from '@/components/pagination';
import { ApiKeysCard } from '@/components/projects/api-keys-card';
import { CreateEndpointDialog } from '@/components/projects/create-endpoint-dialog';
import { DeleteProjectDialog } from '@/components/projects/delete-project-dialog';
import { EmptyState } from '@/components/projects/empty-state';
import { ProjectNav } from '@/components/projects/project-nav';
import type { ProjectNavTab } from '@/components/projects/project-nav';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EventPane } from '@/components/webhook-events/event-pane';
import { endpointHealth } from '@/lib/endpoint-health';
import { endpointStatusTone, eventStatusTone } from '@/lib/status-tones';
import { cn } from '@/lib/utils';
import { show as showProject } from '@/routes/projects';
import { show as showEndpoint } from '@/routes/webhook-endpoints';
import { show as showEvent } from '@/routes/webhook-events';
import type {
    ApiKey,
    Paginated,
    Project,
    Provider,
    WebhookDelivery,
    WebhookEndpoint,
    WebhookEvent,
    WebhookEventWithEndpoint,
} from '@/types';

type ProjectEvent = WebhookEvent & {
    webhook_endpoint: { id: string; name: string };
};

export default function ProjectsShow({
    project,
    projects,
    webhookEndpoints,
    providers,
    apiKeys,
    events,
    activeTab,
    selectedEvent,
}: {
    project: Project;
    projects: Project[];
    webhookEndpoints: WebhookEndpoint[];
    providers: Provider[];
    apiKeys: ApiKey[];
    events: Paginated<ProjectEvent>;
    activeTab: ProjectNavTab;
    selectedEvent: {
        event: WebhookEventWithEndpoint;
        deliveries: WebhookDelivery[];
    } | null;
}) {
    const showEventInPane = (
        clickEvent: MouseEvent<Element>,
        event: ProjectEvent,
    ) => {
        // Below lg there is no room for a side-by-side pane, so the links are
        // left alone and navigate to the standalone event page. Modifier
        // clicks stay untouched everywhere so they can still open a new tab.
        if (!window.matchMedia('(min-width: 1024px)').matches) {
            return;
        }

        if (
            clickEvent.metaKey ||
            clickEvent.ctrlKey ||
            clickEvent.shiftKey ||
            clickEvent.altKey ||
            clickEvent.button !== 0
        ) {
            return;
        }

        clickEvent.preventDefault();

        const isSelected = selectedEvent?.event.id === event.id;

        router.get(
            showProject(project, {
                query: isSelected
                    ? { tab: 'events' }
                    : { tab: 'events', event: event.id },
            }),
            {},
            {
                only: ['selectedEvent'],
                preserveState: true,
                preserveScroll: true,
                replace: true,
            },
        );
    };

    const closeEventPane = () => {
        router.get(
            showProject(project, { query: { tab: 'events' } }),
            {},
            {
                only: ['selectedEvent'],
                preserveState: true,
                preserveScroll: true,
                replace: true,
            },
        );
    };

    return (
        <>
            <Head title={project.name} />

            <ProjectNav
                project={project}
                projects={projects}
                active={activeTab}
            />

            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <PageHeader eyebrow={project.slug} title={project.name} />

                {activeTab === 'endpoints' && (
                    <div className="space-y-4">
                        {webhookEndpoints.length === 0 ? (
                            <div className="rounded-2xl border border-border bg-card">
                                <EmptyState
                                    title="No endpoints yet"
                                    description="Create one to start receiving webhooks."
                                    action={
                                        <CreateEndpointDialog
                                            project={project}
                                            providers={providers}
                                        />
                                    }
                                />
                            </div>
                        ) : (
                            <>
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-sm text-muted-foreground">
                                        {webhookEndpoints.length}{' '}
                                        {webhookEndpoints.length === 1
                                            ? 'endpoint'
                                            : 'endpoints'}
                                    </p>
                                    <CreateEndpointDialog
                                        project={project}
                                        providers={providers}
                                    />
                                </div>
                                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                    {webhookEndpoints.map((endpoint) => {
                                        const health = endpointHealth(endpoint);

                                        return (
                                            <Link
                                                key={endpoint.id}
                                                href={showEndpoint(endpoint)}
                                                className="rounded-2xl border border-border bg-card p-5 transition-colors hover:border-signal/40 hover:bg-accent/30"
                                                data-test={`webhook-endpoint-link-${endpoint.id}`}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <p className="min-w-0 truncate font-medium">
                                                        {endpoint.name}
                                                    </p>
                                                    <StatusChip
                                                        tone={
                                                            endpointStatusTone[
                                                                endpoint.status
                                                            ]
                                                        }
                                                    >
                                                        {endpoint.status}
                                                    </StatusChip>
                                                </div>
                                                <p className="mt-1 truncate text-sm text-muted-foreground">
                                                    {endpoint.destination_url}
                                                </p>
                                                <div className="mt-4 flex items-center justify-between border-t border-border pt-4 text-sm">
                                                    <span className="text-muted-foreground">
                                                        Last delivery
                                                    </span>
                                                    {health ? (
                                                        <StatusChip
                                                            tone={health.tone}
                                                        >
                                                            {health.label}
                                                        </StatusChip>
                                                    ) : (
                                                        <span className="text-muted-foreground">
                                                            No events yet
                                                        </span>
                                                    )}
                                                </div>
                                            </Link>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {activeTab === 'events' && (
                    <div
                        className={cn(
                            selectedEvent !== null &&
                                'grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]',
                        )}
                    >
                        <div className="rounded-2xl border border-border bg-card">
                            <div className="border-b border-border px-6 py-4">
                                <p className="text-sm text-muted-foreground">
                                    {events.total} received across all endpoints
                                </p>
                            </div>

                            {events.data.length === 0 ? (
                                <EmptyState
                                    title="No events yet"
                                    description="Once one of this project's endpoints receives a webhook, it will show up here."
                                />
                            ) : (
                                <div className="overflow-x-auto">
                                    <table
                                        className={cn(
                                            'w-full text-sm',
                                            selectedEvent === null &&
                                                'min-w-[720px]',
                                        )}
                                    >
                                        <thead>
                                            <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase">
                                                <th className="px-6 py-3 font-medium">
                                                    Received
                                                </th>
                                                <th className="px-4 py-3 font-medium">
                                                    Endpoint
                                                </th>
                                                {selectedEvent === null && (
                                                    <th className="px-4 py-3 font-medium">
                                                        Event
                                                    </th>
                                                )}
                                                <th className="px-4 py-3 font-medium">
                                                    Status
                                                </th>
                                                {selectedEvent === null && (
                                                    <th className="px-6 py-3 font-medium">
                                                        Signature
                                                    </th>
                                                )}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {events.data.map((event) => {
                                                const isSelected =
                                                    selectedEvent?.event.id ===
                                                    event.id;

                                                return (
                                                    <tr
                                                        key={event.id}
                                                        onClick={(
                                                            clickEvent,
                                                        ) => {
                                                            // A click that started
                                                            // inside one of the
                                                            // row's own links
                                                            // belongs to that link.
                                                            if (
                                                                (
                                                                    clickEvent.target as HTMLElement
                                                                ).closest('a')
                                                            ) {
                                                                return;
                                                            }

                                                            showEventInPane(
                                                                clickEvent,
                                                                event,
                                                            );
                                                        }}
                                                        aria-current={
                                                            isSelected
                                                                ? 'true'
                                                                : undefined
                                                        }
                                                        className={cn(
                                                            'cursor-pointer transition-colors hover:bg-accent/50',
                                                            isSelected &&
                                                                'bg-accent/50',
                                                        )}
                                                        data-test={`event-row-${event.id}`}
                                                    >
                                                        <td className="px-6 py-3 whitespace-nowrap">
                                                            <Link
                                                                href={showEvent(
                                                                    event,
                                                                )}
                                                                onClick={(
                                                                    clickEvent,
                                                                ) =>
                                                                    showEventInPane(
                                                                        clickEvent,
                                                                        event,
                                                                    )
                                                                }
                                                                className="hover:underline"
                                                                data-test={`event-link-${event.id}`}
                                                            >
                                                                {new Date(
                                                                    event.received_at,
                                                                ).toLocaleString()}
                                                            </Link>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <Link
                                                                href={showEndpoint(
                                                                    event.webhook_endpoint,
                                                                )}
                                                                className="hover:underline"
                                                            >
                                                                {
                                                                    event
                                                                        .webhook_endpoint
                                                                        .name
                                                                }
                                                            </Link>
                                                        </td>
                                                        {selectedEvent ===
                                                            null && (
                                                            <td className="px-4 py-3 font-mono text-xs">
                                                                {event.event_name ??
                                                                    'n/a'}
                                                            </td>
                                                        )}
                                                        <td className="px-4 py-3">
                                                            <StatusChip
                                                                tone={
                                                                    eventStatusTone[
                                                                        event
                                                                            .status
                                                                    ]
                                                                }
                                                            >
                                                                {event.status}
                                                            </StatusChip>
                                                        </td>
                                                        {selectedEvent ===
                                                            null && (
                                                            <td className="px-6 py-3 text-muted-foreground">
                                                                {event.signature_valid ===
                                                                null
                                                                    ? 'n/a'
                                                                    : event.signature_valid
                                                                      ? 'valid'
                                                                      : 'invalid'}
                                                            </td>
                                                        )}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            <div className="px-6 py-4">
                                <Pagination paginator={events} />
                            </div>
                        </div>

                        {selectedEvent && (
                            <EventPane
                                event={selectedEvent.event}
                                deliveries={selectedEvent.deliveries}
                                endpointMode={
                                    selectedEvent.event.webhookEndpoint.mode
                                }
                                onClose={closeEventPane}
                            />
                        )}
                    </div>
                )}

                {activeTab === 'api-keys' && (
                    <ApiKeysCard project={project} apiKeys={apiKeys} />
                )}

                {activeTab === 'settings' && (
                    <div className="grid gap-6 md:grid-cols-2">
                        <div className="rounded-2xl border border-border bg-card">
                            <div className="border-b border-border px-6 py-4">
                                <h2 className="font-semibold">
                                    Project settings
                                </h2>
                            </div>
                            <div className="p-6">
                                <Form
                                    {...ProjectController.update.form(project)}
                                    options={{ preserveScroll: true }}
                                    className="space-y-6"
                                >
                                    {({ processing, errors }) => (
                                        <>
                                            <div className="grid gap-2">
                                                <Label htmlFor="name">
                                                    Name
                                                </Label>
                                                <Input
                                                    id="name"
                                                    name="name"
                                                    required
                                                    defaultValue={project.name}
                                                />
                                                <InputError
                                                    message={errors.name}
                                                />
                                            </div>

                                            <div className="flex items-start gap-3">
                                                <Checkbox
                                                    id="failure_emails_enabled"
                                                    name="failure_emails_enabled"
                                                    defaultChecked={
                                                        project.failure_emails_enabled
                                                    }
                                                    data-test="failure-emails-enabled-checkbox"
                                                />
                                                <div className="grid gap-1">
                                                    <Label htmlFor="failure_emails_enabled">
                                                        Email me when a webhook
                                                        stops delivering
                                                    </Label>
                                                    <p className="text-sm text-muted-foreground">
                                                        Sent once a delivery has
                                                        exhausted all retries
                                                        for this project.
                                                    </p>
                                                </div>
                                            </div>

                                            <Button
                                                disabled={processing}
                                                className="bg-signal text-signal-foreground hover:bg-signal/90"
                                                data-test="update-project-button"
                                            >
                                                Save
                                            </Button>
                                        </>
                                    )}
                                </Form>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-red-200 bg-card dark:border-red-500/20">
                            <div className="border-b border-red-200 px-6 py-4 dark:border-red-500/20">
                                <h2 className="font-semibold text-red-600 dark:text-red-400">
                                    Danger zone
                                </h2>
                            </div>
                            <div className="p-6">
                                <DeleteProjectDialog project={project} />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
