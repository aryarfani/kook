<?php

namespace App\Services;

use App\Models\Project;
use App\Models\User;
use App\Models\WebhookEndpoint;
use App\Models\WebhookEvent;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;

class EventBrowserService
{
    public function __construct(private readonly AuditLogService $auditLog) {}

    /**
     * @param  array{project: string, endpoint: string, status: string, from: string, to: string}  $filters
     * @return Builder<WebhookEvent>
     */
    public function query(User $user, array $filters): Builder
    {
        if ($filters['project'] !== '') {
            $user->projects()->whereKey($filters['project'])->firstOrFail();
        }

        if ($filters['endpoint'] !== '') {
            $endpoint = WebhookEndpoint::query()
                ->whereIn('project_id', $user->projects()->select('id'))
                ->findOrFail($filters['endpoint']);

            abort_if($filters['project'] !== '' && $endpoint->project_id !== $filters['project'], 404);
        }

        $query = WebhookEvent::query()->whereIn('webhook_events.project_id', $user->projects()->select('id'));

        if ($filters['project'] !== '') {
            $query->where('webhook_events.project_id', $filters['project']);
        }

        if ($filters['endpoint'] !== '') {
            $query->where('webhook_events.webhook_endpoint_id', $filters['endpoint']);
        }

        if ($filters['status'] !== '') {
            $query->where('webhook_events.status', $filters['status']);
        }

        if ($filters['from'] !== '') {
            $query->where('webhook_events.received_at', '>=', CarbonImmutable::parse($filters['from'])->utc());
        }

        if ($filters['to'] !== '') {
            $query->where('webhook_events.received_at', '<=', CarbonImmutable::parse($filters['to'])->utc());
        }

        return $query->orderByDesc('webhook_events.received_at')->orderByDesc('webhook_events.id');
    }

    /**
     * @return array<string, mixed>
     */
    public function row(WebhookEvent $event): array
    {
        $delivery = $event->latestDelivery;

        return [
            ...$this->eventFields($event),
            'latest_delivery' => $delivery === null ? null : [
                'status' => $delivery->status->value,
                'http_status_code' => $delivery->http_status_code,
            ],
            'project' => ['id' => $event->project->id, 'name' => $event->project->name],
            'endpoint' => [
                'id' => $event->webhookEndpoint->id,
                'name' => $event->webhookEndpoint->name,
                'project_id' => $event->webhookEndpoint->project_id,
                'mode' => $event->webhookEndpoint->mode->value,
            ],
        ];
    }

    /**
     * @param  Builder<WebhookEvent>  $query
     * @return Builder<WebhookEvent>
     */
    public function exportQuery(Builder $query): Builder
    {
        // A single cursor query sees a stable database snapshot. Joining only
        // metadata avoids per-event relation queries without loading secrets.
        return $query
            ->join('projects', 'projects.id', '=', 'webhook_events.project_id')
            ->join('webhook_endpoints', 'webhook_endpoints.id', '=', 'webhook_events.webhook_endpoint_id')
            ->select([
                'webhook_events.id', 'webhook_events.project_id', 'webhook_events.webhook_endpoint_id',
                'webhook_events.event_name', 'webhook_events.status', 'webhook_events.received_at',
                'webhook_events.signature_valid', 'webhook_events.idempotency_key',
                'webhook_events.headers', 'webhook_events.payload',
                'projects.name as export_project_name',
                'webhook_endpoints.name as export_endpoint_name',
                'webhook_endpoints.project_id as export_endpoint_project_id',
                'webhook_endpoints.mode as export_endpoint_mode',
            ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function exportRow(WebhookEvent $event): array
    {
        return [
            ...$this->eventFields($event),
            'project' => ['id' => $event->project_id, 'name' => $event->getAttribute('export_project_name')],
            'endpoint' => [
                'id' => $event->webhook_endpoint_id,
                'name' => $event->getAttribute('export_endpoint_name'),
                'project_id' => $event->getAttribute('export_endpoint_project_id'),
                'mode' => $event->getAttribute('export_endpoint_mode'),
            ],
            'idempotency_key' => $event->idempotency_key,
            'headers' => $event->headers,
            'payload' => $event->payload,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function eventFields(WebhookEvent $event): array
    {
        return [
            'id' => $event->id,
            'event_name' => $event->event_name,
            'status' => $event->status->value,
            'received_at' => $event->received_at->toIso8601String(),
            'signature_valid' => $event->signature_valid,
        ];
    }

    /**
     * @param  Builder<WebhookEvent>  $query
     * @param  array{project: string, endpoint: string, status: string, from: string, to: string}  $filters
     */
    public function recordExport(User $user, Builder $query, array $filters): void
    {
        // One audit entry per project represented in the download. An empty
        // download is still recorded, against its requested project if any.
        $projectIds = (clone $query)->reorder()->select('project_id')->distinct()->pluck('project_id');
        $projects = Project::query()->whereIn('id', $projectIds)->get();

        if ($projects->isEmpty()) {
            $project = $filters['project'] !== '' ? $user->projects()->find($filters['project']) : null;

            if ($project === null && $filters['endpoint'] !== '') {
                $project = WebhookEndpoint::query()
                    ->whereIn('project_id', $user->projects()->select('id'))
                    ->findOrFail($filters['endpoint'])->project;
            }

            $this->auditLog->record($user, $project, 'events.exported', $project, $filters);

            return;
        }

        foreach ($projects as $project) {
            $this->auditLog->record($user, $project, 'events.exported', $project, $filters);
        }
    }
}
