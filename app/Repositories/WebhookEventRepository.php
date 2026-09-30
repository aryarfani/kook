<?php

namespace App\Repositories;

use App\Models\Project;
use App\Models\WebhookEndpoint;
use App\Models\WebhookEvent;
use Carbon\CarbonImmutable;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\LazyCollection;

class WebhookEventRepository
{
    public function findByIdempotencyKey(WebhookEndpoint $endpoint, string $idempotencyKey): ?WebhookEvent
    {
        return $endpoint->events()
            ->where('idempotency_key', $idempotencyKey)
            ->first();
    }

    /**
     * @return LengthAwarePaginator<int, WebhookEvent>
     */
    public function paginateForEndpoint(WebhookEndpoint $endpoint, int $perPage = 25): LengthAwarePaginator
    {
        return $endpoint->events()
            ->latest()
            ->paginate($perPage)
            ->withQueryString();
    }

    /**
     * @return LengthAwarePaginator<int, WebhookEvent>
     */
    public function paginateForProject(Project $project, int $perPage = 25): LengthAwarePaginator
    {
        // Column-limited eager load: avoids decrypting/serializing the
        // endpoint's signing_secret on every row of a list view.
        return $project->events()
            ->with('webhookEndpoint:id,name')
            ->latest()
            ->paginate($perPage)
            ->withQueryString();
    }

    /**
     * Lazy cursor over an endpoint's events, optionally bounded by
     * received_at. A cursor rather than chunkById: the primary key is a UUID,
     * so chunkById's ordering assumption does not hold (same reason as
     * WebhookEvent::latestDelivery()).
     *
     * @return LazyCollection<int, WebhookEvent>
     */
    public function cursorForEndpoint(
        WebhookEndpoint $endpoint,
        ?CarbonImmutable $from,
        ?CarbonImmutable $to,
    ): LazyCollection {
        return $endpoint->events()
            ->when($from !== null, fn ($query) => $query->where('received_at', '>=', $from))
            ->when($to !== null, fn ($query) => $query->where('received_at', '<=', $to))
            ->orderBy('received_at')
            ->cursor();
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function create(WebhookEndpoint $endpoint, array $data): WebhookEvent
    {
        /** @var WebhookEvent */
        return $endpoint->events()->create($data);
    }
}
