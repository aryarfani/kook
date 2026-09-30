<?php

namespace App\Services;

use App\Models\Project;
use App\Models\User;
use App\Models\WebhookDelivery;
use App\Models\WebhookEndpoint;
use App\Models\WebhookEvent;
use App\Repositories\WebhookDeliveryRepository;
use App\Repositories\WebhookEventRepository;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\LazyCollection;

class WebhookEventService
{
    public function __construct(
        private readonly WebhookEventRepository $events,
        private readonly WebhookDeliveryRepository $deliveries,
        private readonly AuditLogService $auditLog,
    ) {}

    /**
     * @return LengthAwarePaginator<int, WebhookEvent>
     */
    public function listForEndpoint(WebhookEndpoint $endpoint): LengthAwarePaginator
    {
        return $this->events->paginateForEndpoint($endpoint);
    }

    /**
     * @return LengthAwarePaginator<int, WebhookEvent>
     */
    public function listForProject(Project $project): LengthAwarePaginator
    {
        return $this->events->paginateForProject($project);
    }

    /**
     * @return Collection<int, WebhookDelivery>
     */
    public function deliveriesFor(WebhookEvent $event): Collection
    {
        return $this->deliveries->forEvent($event);
    }

    /**
     * Lazy stream of an endpoint's events for export, so a large export never
     * has to be held in memory at once.
     *
     * @return LazyCollection<int, WebhookEvent>
     */
    public function exportForEndpoint(
        WebhookEndpoint $endpoint,
        ?CarbonImmutable $from,
        ?CarbonImmutable $to,
    ): LazyCollection {
        return $this->events->cursorForEndpoint($endpoint, $from, $to);
    }

    /**
     * Exporting an endpoint's payloads in bulk is security-relevant, so it is
     * recorded like any other state-changing action.
     */
    public function recordExport(
        User $user,
        WebhookEndpoint $endpoint,
        ?CarbonImmutable $from,
        ?CarbonImmutable $to,
    ): void {
        $this->auditLog->record($user, $endpoint->project, 'webhook_endpoint.events_exported', $endpoint, [
            'from' => $from?->toIso8601String(),
            'to' => $to?->toIso8601String(),
        ]);
    }
}
