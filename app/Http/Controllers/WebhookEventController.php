<?php

namespace App\Http\Controllers;

use App\Exceptions\EventNotReplayableException;
use App\Http\Requests\WebhookEvents\ListWebhookEventsRequest;
use App\Http\Requests\WebhookEvents\ReplayWebhookEventRequest;
use App\Http\Resources\WebhookDeliveryResource;
use App\Http\Resources\WebhookEventResource;
use App\Models\WebhookEndpoint;
use App\Models\WebhookEvent;
use App\Services\EventBrowserService;
use App\Services\WebhookEventService;
use App\Services\Webhooks\ReplayService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class WebhookEventController extends Controller
{
    public function __construct(
        private readonly WebhookEventService $events,
        private readonly ReplayService $replay,
        private readonly EventBrowserService $browser,
    ) {}

    public function index(ListWebhookEventsRequest $request): Response
    {
        $filters = $request->filters();
        $user = $request->user();
        $query = $this->browser->query($user, $filters);
        $eventId = $request->validated('event');
        $selectedEvent = is_string($eventId) && $eventId !== ''
            ? (clone $query)->with('webhookEndpoint')->whereKey($eventId)->first()
            : null;

        return Inertia::render('events/index', [
            'events' => (clone $query)
                ->select(['id', 'project_id', 'webhook_endpoint_id', 'event_name', 'status', 'received_at', 'signature_valid'])
                ->with(['project:id,name', 'webhookEndpoint:id,name,project_id,mode', 'latestDelivery:id,event_id,attempt_number,status,http_status_code'])
                ->paginate(25)->appends($filters)
                ->through(fn (WebhookEvent $event) => $this->browser->row($event)),
            'projects' => $user->projects()->select(['id', 'name'])->orderBy('name')->get(),
            'endpoints' => WebhookEndpoint::query()->whereIn('project_id', $user->projects()->select('id'))
                ->select(['id', 'name', 'project_id', 'mode'])->orderBy('name')->get(),
            'filters' => $filters,
            'selectedEvent' => $selectedEvent === null ? null : [
                'event' => (new WebhookEventResource($selectedEvent))->resolve($request),
                'deliveries' => WebhookDeliveryResource::collection($this->events->deliveriesFor($selectedEvent))->toArray($request),
            ],
        ]);
    }

    public function export(ListWebhookEventsRequest $request): StreamedResponse
    {
        $filters = $request->filters();
        $query = $this->browser->query($request->user(), $filters);
        $this->browser->recordExport($request->user(), $query, $filters);

        return response()->streamDownload(function () use ($query): void {
            $stream = fopen('php://output', 'w');

            if ($stream === false) {
                return;
            }

            fwrite($stream, '[');
            $first = true;

            foreach ($this->browser->exportQuery($query)->cursor() as $event) {
                if (! $first) {
                    fwrite($stream, ',');
                }

                fwrite($stream, "\n    ".json_encode(
                    $this->browser->exportRow($event),
                    JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE | JSON_THROW_ON_ERROR,
                ));
                $first = false;
            }

            fwrite($stream, $first ? "]\n" : "\n]\n");
            fclose($stream);
        }, 'events.json', ['Content-Type' => 'application/json']);
    }

    public function show(Request $request, WebhookEvent $webhookEvent): RedirectResponse
    {
        abort_unless($request->user()->can('view', $webhookEvent), 404);

        return to_route('webhook-events.index', ['event' => $webhookEvent->id]);
    }

    public function replay(ReplayWebhookEventRequest $request, WebhookEvent $webhookEvent): RedirectResponse
    {
        try {
            $this->replay->replay($request->user(), $webhookEvent);
        } catch (EventNotReplayableException $e) {
            Inertia::flash('toast', ['type' => 'error', 'message' => $e->getMessage()]);

            return back();
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Replay queued.']);

        return back();
    }
}
