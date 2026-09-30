<?php

namespace App\Http\Controllers;

use App\Http\Requests\Projects\DestroyProjectRequest;
use App\Http\Requests\Projects\StoreProjectRequest;
use App\Http\Requests\Projects\UpdateProjectRequest;
use App\Http\Resources\WebhookDeliveryResource;
use App\Http\Resources\WebhookEventResource;
use App\Models\Project;
use App\Models\WebhookEvent;
use App\Services\ApiKeyService;
use App\Services\ProjectService;
use App\Services\ProviderCatalogService;
use App\Services\WebhookEndpointService;
use App\Services\WebhookEventService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class ProjectController extends Controller
{
    public function __construct(
        private readonly ProjectService $projects,
        private readonly WebhookEndpointService $endpoints,
        private readonly ProviderCatalogService $providers,
        private readonly ApiKeyService $apiKeys,
        private readonly WebhookEventService $events,
    ) {}

    public function index(Request $request): Response
    {
        return Inertia::render('projects/index', [
            'projects' => $this->projects->listForUser($request->user()),
        ]);
    }

    public function show(Request $request, Project $project): Response
    {
        abort_unless($request->user()->can('view', $project), 404);

        $tab = $request->query('tab');
        $selectedEvent = $this->selectedEvent($request, $project);

        return Inertia::render('projects/show', [
            'project' => $project,
            'projects' => $this->projects->listForUser($request->user()),
            'webhookEndpoints' => $this->endpoints->listForProject($project),
            'providers' => $this->providers->active(),
            'apiKeys' => $this->apiKeys->listForProject($project),
            'events' => $this->events->listForProject($project),
            'activeTab' => in_array($tab, ['endpoints', 'events', 'api-keys', 'settings'], true) ? $tab : 'endpoints',
            // Drives the side-by-side pane on the events tab. Opening an event
            // is a partial reload of just this prop, so the list beside it
            // never re-renders.
            'selectedEvent' => $selectedEvent === null ? null : [
                'event' => (new WebhookEventResource($selectedEvent))->resolve($request),
                'deliveries' => WebhookDeliveryResource::collection(
                    $this->events->deliveriesFor($selectedEvent)
                )->toArray($request),
            ],
        ]);
    }

    public function store(StoreProjectRequest $request): RedirectResponse
    {
        $project = $this->projects->create($request->user(), $request->validated('name'));

        return to_route('projects.show', $project);
    }

    public function update(UpdateProjectRequest $request, Project $project): RedirectResponse
    {
        $this->projects->update(
            $request->user(),
            $project,
            $request->validated('name'),
            $request->boolean('failure_emails_enabled'),
        );

        return to_route('projects.show', ['project' => $project, 'tab' => 'settings']);
    }

    public function destroy(DestroyProjectRequest $request, Project $project): RedirectResponse
    {
        $this->projects->delete($request->user(), $project);

        return to_route('projects.index');
    }

    /**
     * The event the events tab should show in its pane, scoped to this project
     * so a foreign id resolves to nothing rather than someone else's event. A
     * malformed id is ignored outright - querying a uuid column with it would
     * error. The endpoint comes along because the pane needs its mode to know
     * whether the event can be replayed.
     */
    private function selectedEvent(Request $request, Project $project): ?WebhookEvent
    {
        $eventId = $request->query('event');

        if (! is_string($eventId) || ! Str::isUuid($eventId)) {
            return null;
        }

        return $project->events()
            ->with('webhookEndpoint')
            ->whereKey($eventId)
            ->first();
    }
}
