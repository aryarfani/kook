import { ArrowLeft01Icon, Refresh01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { Form, Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import WebhookEndpointController from '@/actions/App/Http/Controllers/WebhookEndpointController';
import { CopyField } from '@/components/copy-field';
import { PageHeader } from '@/components/dashboard/page-header';
import { StatusChip } from '@/components/dashboard/status-chip';
import InputError from '@/components/input-error';
import { Pagination } from '@/components/pagination';
import { EmptyState } from '@/components/projects/empty-state';
import { ProjectNav } from '@/components/projects/project-nav';
import { ProviderLogo } from '@/components/providers/provider-logo';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { DeleteEndpointDialog } from '@/components/webhook-endpoints/delete-endpoint-dialog';
import { ExportEventsDialog } from '@/components/webhook-endpoints/export-events-dialog';
import { EventPane } from '@/components/webhook-events/event-pane';
import { endpointHealth } from '@/lib/endpoint-health';
import { providerSecretGuidance } from '@/lib/provider-secret-guidance';
import { endpointStatusTone, eventStatusTone } from '@/lib/status-tones';
import { cn } from '@/lib/utils';
import { show as showProject } from '@/routes/projects';
import { show as showEndpoint } from '@/routes/webhook-endpoints';
import { show as showEvent } from '@/routes/webhook-events';
import type {
    Paginated,
    Project,
    Provider,
    WebhookDelivery,
    WebhookEndpoint,
    WebhookEndpointMode,
    WebhookEvent,
    WebhookEventDetail,
} from '@/types';

function Section({
    title,
    children,
    className = '',
}: {
    title: string;
    children: ReactNode;
    className?: string;
}) {
    return (
        <div
            className={`rounded-2xl border border-border bg-card ${className}`}
        >
            <div className="border-b border-border px-6 py-4">
                <h2 className="font-semibold">{title}</h2>
            </div>
            <div className="space-y-4 p-6">{children}</div>
        </div>
    );
}

export default function WebhookEndpointsShow({
    project,
    projects,
    providers,
    webhookEndpoint,
    events,
    selectedEvent,
}: {
    project: Project;
    projects: Project[];
    providers: Provider[];
    webhookEndpoint: WebhookEndpoint;
    events: Paginated<WebhookEvent>;
    selectedEvent: {
        event: WebhookEventDetail;
        deliveries: WebhookDelivery[];
    } | null;
}) {
    const [ingestUrl] = useState(
        () =>
            `${window.location.origin}/webhooks/${webhookEndpoint.ingest_token}`,
    );
    const [mode, setMode] = useState<WebhookEndpointMode>(webhookEndpoint.mode);
    const [regenerateOpen, setRegenerateOpen] = useState(false);
    const health = endpointHealth(webhookEndpoint);
    const secretGuidance = providerSecretGuidance(
        webhookEndpoint.provider?.key,
    );

    const showEventInPane = (
        clickEvent: MouseEvent<Element>,
        event: WebhookEvent,
    ) => {
        // Below lg there is no room for a side-by-side pane, so the row link
        // is left alone and navigates to the standalone event page. Modifier
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
            isSelected
                ? showEndpoint(webhookEndpoint)
                : showEndpoint(webhookEndpoint, { query: { event: event.id } }),
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
            showEndpoint(webhookEndpoint),
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
            <Head title={webhookEndpoint.name} />

            <ProjectNav
                project={project}
                projects={projects}
                active="endpoints"
            />

            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <Link
                    href={showProject(project, {
                        query: { tab: 'endpoints' },
                    })}
                    className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                    data-test="back-to-endpoints-link"
                >
                    <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
                    Back to endpoints
                </Link>

                <PageHeader
                    eyebrow={project.name}
                    title={
                        <span className="flex flex-wrap items-center gap-3">
                            {webhookEndpoint.provider && (
                                <ProviderLogo
                                    provider={webhookEndpoint.provider}
                                    className="h-7"
                                    imageClassName="h-4"
                                />
                            )}
                            {webhookEndpoint.name}
                            <StatusChip
                                tone={
                                    endpointStatusTone[webhookEndpoint.status]
                                }
                            >
                                {webhookEndpoint.status}
                            </StatusChip>
                            {health && (
                                <StatusChip tone={health.tone}>
                                    {webhookEndpoint.mode === 'capture'
                                        ? 'last event'
                                        : 'last delivery'}
                                    : {health.label}
                                </StatusChip>
                            )}
                        </span>
                    }
                >
                    <DeleteEndpointDialog webhookEndpoint={webhookEndpoint} />
                </PageHeader>

                <div className="grid gap-6 md:grid-cols-2">
                    <Section title="Ingest URL">
                        <CopyField value={ingestUrl} />
                        <p className="text-sm text-muted-foreground">
                            {mode === 'managed'
                                ? `Configure this URL in ${webhookEndpoint.provider?.name ?? 'your provider'} and verify signatures with the secret you set below.`
                                : mode === 'capture'
                                  ? 'Configure this URL with your provider. Events are stored here and never forwarded anywhere.'
                                  : 'Configure this URL with your provider. The original payload and headers are forwarded as-is.'}
                        </p>
                    </Section>

                    <Section title="Endpoint settings">
                        <Form
                            {...WebhookEndpointController.update.form(
                                webhookEndpoint,
                            )}
                            options={{ preserveScroll: true }}
                            className="space-y-6"
                        >
                            {({ processing, errors }) => (
                                <>
                                    <div className="grid gap-2">
                                        <Label htmlFor="name">Name</Label>
                                        <Input
                                            id="name"
                                            name="name"
                                            required
                                            defaultValue={webhookEndpoint.name}
                                        />
                                        <InputError message={errors.name} />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="mode">Mode</Label>
                                        <Select
                                            name="mode"
                                            value={mode}
                                            onValueChange={(value) =>
                                                setMode(
                                                    value as WebhookEndpointMode,
                                                )
                                            }
                                        >
                                            <SelectTrigger
                                                id="mode"
                                                className="w-full"
                                            >
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="relay">
                                                    Transparent relay
                                                </SelectItem>
                                                <SelectItem value="managed">
                                                    Managed verification
                                                </SelectItem>
                                                <SelectItem value="capture">
                                                    Receive only
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <InputError message={errors.mode} />
                                    </div>

                                    {mode !== 'capture' && (
                                        <div className="grid gap-2">
                                            <Label htmlFor="destination_url">
                                                Destination URL
                                            </Label>
                                            <Input
                                                id="destination_url"
                                                name="destination_url"
                                                required
                                                defaultValue={
                                                    webhookEndpoint.destination_url ??
                                                    ''
                                                }
                                            />
                                            <InputError
                                                message={errors.destination_url}
                                            />
                                        </div>
                                    )}

                                    {mode === 'managed' && (
                                        <>
                                            <div className="grid gap-2">
                                                <Label htmlFor="provider_id">
                                                    Provider
                                                </Label>
                                                <Select
                                                    name="provider_id"
                                                    defaultValue={
                                                        webhookEndpoint.provider_id ??
                                                        undefined
                                                    }
                                                >
                                                    <SelectTrigger
                                                        id="provider_id"
                                                        className="w-full"
                                                    >
                                                        <SelectValue placeholder="Select a provider" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {providers.map(
                                                            (provider) => (
                                                                <SelectItem
                                                                    key={
                                                                        provider.id
                                                                    }
                                                                    value={
                                                                        provider.id
                                                                    }
                                                                >
                                                                    <span className="flex items-center gap-2">
                                                                        <ProviderLogo
                                                                            provider={
                                                                                provider
                                                                            }
                                                                            className="h-6"
                                                                            imageClassName="h-3.5"
                                                                        />
                                                                        {
                                                                            provider.name
                                                                        }
                                                                    </span>
                                                                </SelectItem>
                                                            ),
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                                <InputError
                                                    message={errors.provider_id}
                                                />
                                            </div>

                                            <div className="grid gap-2">
                                                <Label htmlFor="provider_secret">
                                                    Provider webhook secret
                                                </Label>
                                                <Input
                                                    id="provider_secret"
                                                    name="provider_secret"
                                                    type="password"
                                                    autoComplete="off"
                                                    placeholder="Leave blank to keep the current secret"
                                                />
                                                {secretGuidance && (
                                                    <p className="text-sm text-muted-foreground">
                                                        {secretGuidance}
                                                    </p>
                                                )}
                                                <InputError
                                                    message={
                                                        errors.provider_secret
                                                    }
                                                />
                                            </div>
                                        </>
                                    )}

                                    <div className="grid gap-2">
                                        <Label htmlFor="status">Status</Label>
                                        <Select
                                            name="status"
                                            defaultValue={
                                                webhookEndpoint.status
                                            }
                                        >
                                            <SelectTrigger
                                                id="status"
                                                className="w-full"
                                            >
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="active">
                                                    Active
                                                </SelectItem>
                                                <SelectItem value="paused">
                                                    Paused
                                                </SelectItem>
                                                <SelectItem value="disabled">
                                                    Disabled
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <InputError message={errors.status} />
                                    </div>

                                    <Button
                                        disabled={processing}
                                        className="bg-signal text-signal-foreground hover:bg-signal/90"
                                        data-test="update-webhook-endpoint-button"
                                    >
                                        Save
                                    </Button>
                                </>
                            )}
                        </Form>
                    </Section>
                </div>

                {webhookEndpoint.mode === 'managed' && (
                    <Section title="Signing secret">
                        <CopyField value={webhookEndpoint.signing_secret} />
                        <p className="text-sm text-muted-foreground">
                            Kook signs every forwarded request with this secret
                            via the{' '}
                            <code className="rounded bg-muted px-1 py-0.5">
                                X-Kook-Signature
                            </code>{' '}
                            header. Verify it on your server before trusting a
                            request.
                        </p>

                        <Dialog
                            open={regenerateOpen}
                            onOpenChange={setRegenerateOpen}
                        >
                            <DialogTrigger asChild>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    data-test="regenerate-signing-secret-button"
                                >
                                    <HugeiconsIcon
                                        icon={Refresh01Icon}
                                        className="size-4"
                                    />
                                    Regenerate
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogTitle>
                                    Regenerate signing secret
                                </DialogTitle>
                                <DialogDescription>
                                    The current secret will stop working
                                    immediately. Update it on your receiving
                                    server before regenerating, or deliveries
                                    will fail signature checks until you do.
                                </DialogDescription>

                                <Form
                                    {...WebhookEndpointController.regenerateSigningSecret.form(
                                        webhookEndpoint,
                                    )}
                                    options={{ preserveScroll: true }}
                                    onSuccess={() => setRegenerateOpen(false)}
                                >
                                    {({ processing }) => (
                                        <DialogFooter className="gap-2">
                                            <DialogClose asChild>
                                                <Button variant="secondary">
                                                    Cancel
                                                </Button>
                                            </DialogClose>
                                            <Button
                                                variant="destructive"
                                                disabled={processing}
                                                data-test="confirm-regenerate-signing-secret-button"
                                            >
                                                Regenerate
                                            </Button>
                                        </DialogFooter>
                                    )}
                                </Form>
                            </DialogContent>
                        </Dialog>
                    </Section>
                )}

                <div
                    className={cn(
                        selectedEvent !== null &&
                            'grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]',
                    )}
                >
                    <div className="rounded-2xl border border-border bg-card">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
                            <div>
                                <h2 className="font-semibold">Events</h2>
                                <p className="text-sm text-muted-foreground">
                                    {events.total} received in total
                                </p>
                            </div>
                            <ExportEventsDialog
                                webhookEndpoint={webhookEndpoint}
                            />
                        </div>

                        {events.data.length === 0 ? (
                            <EmptyState
                                title="No events yet"
                                description="Once this endpoint receives a webhook, it will show up here."
                            />
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase">
                                            <th className="px-6 py-3 font-medium">
                                                Received
                                            </th>
                                            <th className="px-4 py-3 font-medium">
                                                Event
                                            </th>
                                            <th className="px-6 py-3 font-medium">
                                                Status
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {events.data.map((event) => {
                                            const isSelected =
                                                selectedEvent?.event.id ===
                                                event.id;

                                            return (
                                                <Link
                                                    key={event.id}
                                                    as="tr"
                                                    href={showEvent(event)}
                                                    onClick={(clickEvent) =>
                                                        showEventInPane(
                                                            clickEvent,
                                                            event,
                                                        )
                                                    }
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
                                                    data-test={`event-link-${event.id}`}
                                                >
                                                    <td className="px-6 py-3 whitespace-nowrap">
                                                        {new Date(
                                                            event.received_at,
                                                        ).toLocaleString()}
                                                    </td>
                                                    <td className="max-w-[18rem] truncate px-4 py-3 font-mono text-xs">
                                                        {event.event_name ??
                                                            'n/a'}
                                                    </td>
                                                    <td className="px-6 py-3">
                                                        <StatusChip
                                                            tone={
                                                                eventStatusTone[
                                                                    event.status
                                                                ]
                                                            }
                                                        >
                                                            {event.status}
                                                        </StatusChip>
                                                    </td>
                                                </Link>
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
                            endpointMode={webhookEndpoint.mode}
                            onClose={closeEventPane}
                        />
                    )}
                </div>
            </div>
        </>
    );
}
