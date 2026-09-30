<?php

namespace App\Http\Controllers;

use App\Http\Requests\WebhookEndpoints\DestroyWebhookEndpointRequest;
use App\Http\Requests\WebhookEndpoints\RegenerateSigningSecretRequest;
use App\Http\Requests\WebhookEndpoints\StoreWebhookEndpointRequest;
use App\Http\Requests\WebhookEndpoints\UpdateWebhookEndpointRequest;
use App\Http\Resources\WebhookDeliveryResource;
use App\Http\Resources\WebhookEventResource;
use App\Models\Project;
use App\Models\WebhookEndpoint;
use App\Models\WebhookEvent;
use App\Services\ProjectService;
use App\Services\ProviderCatalogService;
use App\Services\WebhookEndpointService;
use App\Services\WebhookEventService;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class WebhookEndpointController extends Controller
{
    public function __construct(
        private readonly WebhookEndpointService $endpoints,
        private readonly WebhookEventService $events,
        private readonly ProjectService $projects,
        private readonly ProviderCatalogService $providers,
    ) {}

    public function show(Request $request, WebhookEndpoint $webhookEndpoint): Response
    {
        abort_unless($request->user()->can('view', $webhookEndpoint), 404);

        $selectedEvent = $this->selectedEvent($request, $webhookEndpoint);

        return Inertia::render('webhook-endpoints/show', [
            'project' => $webhookEndpoint->project,
            'projects' => $this->projects->listForUser($request->user()),
            'providers' => $this->providers->active(),
            'webhookEndpoint' => $webhookEndpoint->load([
                'provider',
                'latestEvent:id,webhook_endpoint_id,status,received_at',
                'latestEvent.latestDelivery:id,event_id,status,attempt_number',
            ]),
            'events' => $this->events->listForEndpoint($webhookEndpoint),
            // Drives the side-by-side pane. Opening an event is a partial
            // reload of just this prop, so the list below it never re-renders.
            'selectedEvent' => $selectedEvent === null ? null : [
                'event' => (new WebhookEventResource($selectedEvent))->resolve($request),
                'deliveries' => WebhookDeliveryResource::collection(
                    $this->events->deliveriesFor($selectedEvent)
                )->toArray($request),
            ],
        ]);
    }

    public function exportEvents(Request $request, WebhookEndpoint $webhookEndpoint): StreamedResponse
    {
        abort_unless($request->user()->can('view', $webhookEndpoint), 404);

        $validated = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => [
                'nullable',
                'date',
                // Only comparable when a start was given, so an upper bound on
                // its own stays valid.
                Rule::when($request->filled('from'), ['after_or_equal:from']),
            ],
        ]);

        // received_at is a `timestamp without time zone` column holding UTC,
        // while the browser sends the viewer's own offset. Both bounds are
        // resolved to UTC before comparing - without this the range would
        // silently shift by the viewer's offset.
        $fromInput = is_string($validated['from'] ?? null)
            ? CarbonImmutable::parse($validated['from'])
            : null;
        $toInput = is_string($validated['to'] ?? null)
            ? CarbonImmutable::parse($validated['to'])
            : null;

        $from = $fromInput?->utc();
        $to = $toInput?->utc();

        $this->events->recordExport($request->user(), $webhookEndpoint, $from, $to);

        return response()->streamDownload(
            function () use ($webhookEndpoint, $from, $to): void {
                $stream = fopen('php://output', 'w');

                if ($stream === false) {
                    return;
                }

                fwrite($stream, '[');

                $first = true;

                foreach ($this->events->exportForEndpoint($webhookEndpoint, $from, $to) as $event) {
                    if (! $first) {
                        fwrite($stream, ',');
                    }

                    fwrite($stream, "\n    ".json_encode([
                        'id' => $event->id,
                        'received_at' => $event->received_at->toIso8601String(),
                        'event_name' => $event->event_name,
                        'status' => $event->status->value,
                        'signature_valid' => $event->signature_valid,
                        'idempotency_key' => $event->idempotency_key,
                        'headers' => $event->headers,
                        'payload' => $event->payload,
                        'raw_body' => $event->raw_body,
                    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE));

                    $first = false;
                }

                fwrite($stream, $first ? "]\n" : "\n]\n");

                fclose($stream);
            },
            $this->exportFilename($webhookEndpoint, $fromInput, $toInput),
            ['Content-Type' => 'application/json'],
        );
    }

    public function store(StoreWebhookEndpointRequest $request, Project $project): RedirectResponse
    {
        $endpoint = $this->endpoints->create($request->user(), $project, $request->validated());

        return to_route('webhook-endpoints.show', $endpoint);
    }

    public function update(UpdateWebhookEndpointRequest $request, WebhookEndpoint $webhookEndpoint): RedirectResponse
    {
        $this->endpoints->update($request->user(), $webhookEndpoint, $request->validated());

        return to_route('webhook-endpoints.show', $webhookEndpoint);
    }

    public function destroy(DestroyWebhookEndpointRequest $request, WebhookEndpoint $webhookEndpoint): RedirectResponse
    {
        $project = $webhookEndpoint->project;

        $this->endpoints->delete($request->user(), $webhookEndpoint);

        return to_route('projects.show', $project);
    }

    public function regenerateSigningSecret(
        RegenerateSigningSecretRequest $request,
        WebhookEndpoint $webhookEndpoint,
    ): RedirectResponse {
        $this->endpoints->regenerateSigningSecret($request->user(), $webhookEndpoint);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Signing secret regenerated. Update it on your receiving server.',
        ]);

        return to_route('webhook-endpoints.show', $webhookEndpoint);
    }

    /**
     * The event the pane should show, scoped to this endpoint so a foreign id
     * resolves to nothing rather than someone else's event. A malformed id is
     * ignored outright - querying a uuid column with it would error.
     */
    private function selectedEvent(Request $request, WebhookEndpoint $webhookEndpoint): ?WebhookEvent
    {
        $eventId = $request->query('event');

        if (! is_string($eventId) || ! Str::isUuid($eventId)) {
            return null;
        }

        return $webhookEndpoint->events()->whereKey($eventId)->first();
    }

    /**
     * Named from the viewer's own dates rather than the UTC-converted bounds,
     * so the filename matches the range they picked.
     */
    private function exportFilename(
        WebhookEndpoint $endpoint,
        ?CarbonImmutable $from,
        ?CarbonImmutable $to,
    ): string {
        $slug = Str::slug($endpoint->name) ?: 'endpoint';

        return match (true) {
            $from !== null && $to !== null => "{$slug}-events-{$from->toDateString()}-to-{$to->toDateString()}.json",
            $from !== null => "{$slug}-events-from-{$from->toDateString()}.json",
            $to !== null => "{$slug}-events-until-{$to->toDateString()}.json",
            default => "{$slug}-events-all.json",
        };
    }
}
