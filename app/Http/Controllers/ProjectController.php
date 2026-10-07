<?php

namespace App\Http\Controllers;

use App\Http\Requests\Projects\DestroyProjectRequest;
use App\Http\Requests\Projects\StoreProjectRequest;
use App\Http\Requests\Projects\UpdateProjectRequest;
use App\Models\Project;
use App\Services\ApiKeyService;
use App\Services\ProjectService;
use App\Services\ProviderCatalogService;
use App\Services\WebhookEndpointService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ProjectController extends Controller
{
    public function __construct(
        private readonly ProjectService $projects,
        private readonly WebhookEndpointService $endpoints,
        private readonly ProviderCatalogService $providers,
        private readonly ApiKeyService $apiKeys,
    ) {}

    public function index(Request $request): Response
    {
        return Inertia::render('projects/index', [
            'projects' => $this->projects->listForUser($request->user()),
        ]);
    }

    public function show(Request $request, Project $project): Response|RedirectResponse
    {
        abort_unless($request->user()->can('view', $project), 404);

        $tab = $request->query('tab');

        if ($tab === 'events' || $request->has('event')) {
            $parameters = ['project' => $project->id];

            if ($request->has('event')) {
                $parameters['event'] = $request->query('event');
            }

            return to_route('webhook-events.index', $parameters);
        }

        return Inertia::render('projects/show', [
            'project' => $project,
            'projects' => $this->projects->listForUser($request->user()),
            'webhookEndpoints' => $this->endpoints->listForProject($project),
            'providers' => $this->providers->active(),
            'apiKeys' => $this->apiKeys->listForProject($project),
            'activeTab' => in_array($tab, ['endpoints', 'api-keys', 'settings'], true) ? $tab : 'endpoints',
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
}
