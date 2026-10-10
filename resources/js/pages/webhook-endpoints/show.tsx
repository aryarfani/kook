import { ArrowLeft01Icon, Refresh01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { Form, Head, Link } from '@inertiajs/react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import WebhookEndpointController from '@/actions/App/Http/Controllers/WebhookEndpointController';
import { CopyField } from '@/components/copy-field';
import { PageHeader } from '@/components/dashboard/page-header';
import { StatusChip } from '@/components/dashboard/status-chip';
import InputError from '@/components/input-error';
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
import { endpointHealth } from '@/lib/endpoint-health';
import { providerSecretGuidance } from '@/lib/provider-secret-guidance';
import { endpointStatusTone } from '@/lib/status-tones';
import { show as showProject } from '@/routes/projects';
import type {
    Project,
    Provider,
    WebhookEndpoint,
    WebhookEndpointMode,
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
}: {
    project: Project;
    projects: Project[];
    providers: Provider[];
    webhookEndpoint: WebhookEndpoint;
}) {
    const [ingestUrl] = useState(
        () =>
            `${window.location.origin}/webhooks/${webhookEndpoint.ingest_token}`,
    );
    const [mode, setMode] = useState<WebhookEndpointMode>(webhookEndpoint.mode);
    const [destinationUrls, setDestinationUrls] = useState<string[]>(() =>
        webhookEndpoint.destination_urls.length > 0
            ? [...webhookEndpoint.destination_urls]
            : [''],
    );
    const [regenerateOpen, setRegenerateOpen] = useState(false);
    const health = endpointHealth(webhookEndpoint);
    const secretGuidance = providerSecretGuidance(
        webhookEndpoint.provider?.key,
    );

    const setDestinationUrl = (index: number, value: string) =>
        setDestinationUrls((urls) =>
            urls.map((url, i) => (i === index ? value : url)),
        );
    const addDestinationUrl = () => setDestinationUrls((urls) => [...urls, '']);
    const removeDestinationUrl = (index: number) =>
        setDestinationUrls((urls) =>
            urls.length > 1 ? urls.filter((_, i) => i !== index) : urls,
        );

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
                                            <Label>Destination URLs</Label>
                                            <p className="text-sm text-muted-foreground">
                                                Every event is forwarded to each
                                                URL listed here.
                                            </p>
                                            {destinationUrls.map(
                                                (url, index) => (
                                                    <div
                                                        key={index}
                                                        className="grid gap-1"
                                                    >
                                                        <div className="flex gap-2">
                                                            <Input
                                                                name="destination_urls[]"
                                                                value={url}
                                                                onChange={(
                                                                    event,
                                                                ) =>
                                                                    setDestinationUrl(
                                                                        index,
                                                                        event
                                                                            .target
                                                                            .value,
                                                                    )
                                                                }
                                                                placeholder="https://your-app.com/webhooks"
                                                                aria-label={`Destination URL ${index + 1}`}
                                                            />
                                                            <Button
                                                                type="button"
                                                                variant="secondary"
                                                                onClick={() =>
                                                                    removeDestinationUrl(
                                                                        index,
                                                                    )
                                                                }
                                                                disabled={
                                                                    destinationUrls.length ===
                                                                    1
                                                                }
                                                                data-test={`remove-destination-url-${index}`}
                                                            >
                                                                Remove
                                                            </Button>
                                                        </div>
                                                        <InputError
                                                            message={
                                                                errors[
                                                                    `destination_urls.${index}`
                                                                ]
                                                            }
                                                        />
                                                    </div>
                                                ),
                                            )}
                                            <div>
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    onClick={addDestinationUrl}
                                                    data-test="add-destination-url-button"
                                                >
                                                    Add destination
                                                </Button>
                                            </div>
                                            <InputError
                                                message={
                                                    errors.destination_urls
                                                }
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

                <div className="flex items-center justify-between gap-4 border-t border-border pt-5">
                    <p className="text-sm text-muted-foreground">
                        Browse this endpoint's activity in Events.
                    </p>
                    <Button variant="outline" asChild>
                        <Link
                            href={`/events?endpoint=${encodeURIComponent(webhookEndpoint.id)}`}
                        >
                            View events
                        </Link>
                    </Button>
                </div>
            </div>
        </>
    );
}
