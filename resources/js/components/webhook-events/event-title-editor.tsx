import { router } from '@inertiajs/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
    formatEventTitle,
    payloadFields,
    validTitleFormat,
} from '@/lib/event-title';
import type { EventEndpoint } from '@/types/event-workspace';

export function EventTitleEditor({
    endpoints,
    defaultEndpointId,
}: {
    endpoints: EventEndpoint[];
    defaultEndpointId?: string;
}) {
    const [open, setOpen] = useState(false);
    const [endpointId, setEndpointId] = useState('');
    const [format, setFormat] = useState('');
    const [sample, setSample] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    let parsed: unknown;
    let parseError = '';

    if (sample.trim()) {
        try {
            parsed = JSON.parse(sample);

            if (!parsed || typeof parsed !== 'object') {
                parseError = 'Paste a JSON object or array.';
            }
        } catch {
            parseError = 'Invalid JSON. Check quotes, commas, and brackets.';
        }
    }

    const fields = parseError ? [] : payloadFields(parsed);
    const valid = validTitleFormat(format);
    function chooseEndpoint(id: string) {
        setEndpointId(id);
        setFormat(
            endpoints.find((endpoint) => endpoint.id === id)
                ?.event_title_format ?? '',
        );
        setError('');
    }

    return (
        <>
            <Button
                variant="ghost"
                size="sm"
                className="h-6 px-0 text-xs"
                disabled={!endpoints.length}
                onClick={() => {
                    chooseEndpoint(defaultEndpointId || endpoints[0]?.id || '');
                    setOpen(true);
                }}
            >
                Title format
            </Button>
            <Dialog
                open={open}
                onOpenChange={(next) => {
                    if (!saving) {
                        setOpen(next);
                    }
                }}
            >
                <DialogContent className="block max-h-[90vh] space-y-4 overflow-y-auto sm:max-w-4xl">
                    <DialogTitle>Event title format</DialogTitle>
                    <DialogDescription>
                        Pick fields from an example payload to name events.
                        Changes apply to existing and new events for this
                        endpoint.
                    </DialogDescription>
                    <label className="grid gap-2 text-sm">
                        Endpoint
                        <select
                            aria-label="Title format endpoint"
                            className="h-9 rounded-md border border-input bg-background px-3"
                            value={endpointId}
                            disabled={saving}
                            onChange={(e) => chooseEndpoint(e.target.value)}
                        >
                            {endpoints.map((endpoint) => (
                                <option key={endpoint.id} value={endpoint.id}>
                                    {endpoint.name}
                                </option>
                            ))}
                        </select>
                    </label>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="grid content-start gap-2">
                            <label
                                htmlFor="title-example"
                                className="text-sm font-medium"
                            >
                                Example JSON
                            </label>
                            <textarea
                                id="title-example"
                                aria-describedby="title-example-help"
                                maxLength={500000}
                                className="h-64 w-full resize-y rounded-md border border-input bg-background p-3 font-mono text-xs focus-visible:outline-ring"
                                placeholder={
                                    '{"object": "whatsapp_business_account", "entry": [{"changes": [{"field": "messages"}]}]}'
                                }
                                value={sample}
                                onChange={(e) => setSample(e.target.value)}
                            />
                            <p
                                id="title-example-help"
                                className="text-xs text-muted-foreground"
                            >
                                Your example stays in this browser. Only the
                                format is saved.
                            </p>
                            {parseError && (
                                <p
                                    role="alert"
                                    className="text-sm text-destructive"
                                >
                                    {parseError}
                                </p>
                            )}
                        </div>
                        <div className="grid content-start gap-2">
                            <p className="text-sm font-medium">
                                Choose a value
                            </p>
                            <div className="h-64 overflow-auto rounded-md border border-border">
                                {fields.map((field) => (
                                    <button
                                        key={field.path}
                                        aria-label={`Insert ${field.path}: ${field.value}`}
                                        type="button"
                                        className="grid w-full gap-1 border-b border-border px-3 py-2 text-left hover:bg-muted focus-visible:outline-ring"
                                        disabled={saving}
                                        onClick={() =>
                                            setFormat((previous) =>
                                                `${previous}${previous ? ' · ' : ''}{{${field.path}}}`.slice(
                                                    0,
                                                    500,
                                                ),
                                            )
                                        }
                                    >
                                        <span className="font-mono text-xs break-all">
                                            {field.path}
                                        </span>
                                        <span className="truncate text-sm text-muted-foreground">
                                            {field.value}
                                        </span>
                                    </button>
                                ))}
                                {!fields.length && (
                                    <p className="p-3 text-sm text-muted-foreground">
                                        Paste JSON to choose its values. Use
                                        numeric array indexes, such as
                                        entry.0.changes.0.field.
                                    </p>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Showing up to 300 scalar fields. Keys containing
                                dots or special characters are skipped.
                            </p>
                        </div>
                    </div>
                    <label className="grid gap-2 text-sm">
                        Format
                        <Input
                            aria-label="Event title format"
                            value={format}
                            maxLength={500}
                            disabled={saving}
                            placeholder="{{entry.0.changes.0.field}} · {{object}}"
                            onChange={(e) => {
                                setFormat(e.target.value);
                                setError('');
                            }}
                        />
                    </label>
                    {!valid && (
                        <p role="alert" className="text-sm text-destructive">
                            Use text and {'{{dot.paths}}'} with numeric array
                            indexes. Maximum 32 fields.
                        </p>
                    )}
                    <div className="border-y border-border py-3">
                        <p className="text-xs text-muted-foreground">
                            Title preview
                        </p>
                        <p className="mt-1 text-base font-medium break-words">
                            {valid
                                ? formatEventTitle(format, parsed, null)
                                : 'Invalid format'}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            If any chosen field is missing or empty, the
                            detected event name is used, then “Unnamed event”.
                        </p>
                    </div>
                    {error && (
                        <p role="alert" className="text-sm text-destructive">
                            {error}
                        </p>
                    )}
                    <div className="flex justify-between gap-2">
                        <Button
                            variant="ghost"
                            disabled={saving}
                            onClick={() => setFormat('')}
                        >
                            Clear format
                        </Button>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                disabled={saving}
                                onClick={() => setOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                disabled={saving || !valid || !endpointId}
                                onClick={() => {
                                    setSaving(true);
                                    setError('');
                                    router.patch(
                                        `/webhook-endpoints/${endpointId}/title-format`,
                                        { event_title_format: format },
                                        {
                                            preserveScroll: true,
                                            onSuccess: () => setOpen(false),
                                            onError: (errors) =>
                                                setError(
                                                    errors.event_title_format ||
                                                        'Could not save the format. Try again.',
                                                ),
                                            onFinish: () => setSaving(false),
                                        },
                                    );
                                }}
                            >
                                {saving ? 'Saving…' : 'Save format'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
