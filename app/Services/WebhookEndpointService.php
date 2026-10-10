<?php

namespace App\Services;

use App\Enums\WebhookEndpointMode;
use App\Enums\WebhookEndpointStatus;
use App\Models\Project;
use App\Models\User;
use App\Models\WebhookEndpoint;
use App\Models\WebhookEndpointDestination;
use App\Repositories\WebhookEndpointRepository;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class WebhookEndpointService
{
    public function __construct(
        private readonly WebhookEndpointRepository $endpoints,
        private readonly AuditLogService $auditLog,
    ) {}

    /**
     * @return Collection<int, WebhookEndpoint>
     */
    public function listForProject(Project $project): Collection
    {
        return $this->endpoints->forProject($project);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function create(User $user, Project $project, array $data): WebhookEndpoint
    {
        return DB::transaction(function () use ($user, $project, $data) {
            $data = $this->withoutDestinationsForCapture($data);

            $endpoint = $this->endpoints->make($project, $data);

            // Never mass-assignable: these are system-generated, not client input.
            $endpoint->forceFill([
                'ingest_token' => $this->uniqueIngestToken(),
                'signing_secret' => Str::random(48),
                'status' => WebhookEndpointStatus::Active,
            ]);

            $endpoint->save();

            $this->syncDestinations($endpoint, $data['destination_urls'] ?? []);

            $this->auditLog->record($user, $project, 'webhook_endpoint.created', $endpoint, [
                'name' => $endpoint->name,
                'mode' => $endpoint->mode->value,
            ]);

            return $endpoint;
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function update(User $user, WebhookEndpoint $endpoint, array $data): WebhookEndpoint
    {
        // Blank means "leave the current provider secret alone" - the field
        // is optional on update since the existing value is never displayed
        // back for the user to re-paste.
        if (array_key_exists('provider_secret', $data) && ! $data['provider_secret']) {
            unset($data['provider_secret']);
        }

        return DB::transaction(function () use ($user, $endpoint, $data) {
            $endpoint = $this->endpoints->update($endpoint, $this->withoutDestinationsForCapture($data));

            // Only partial updates that speak the destination list touch it;
            // e.g. the title-format action updates other attributes and must
            // leave the destinations alone.
            $destinations = match (true) {
                ($data['mode'] ?? null) === WebhookEndpointMode::Capture->value => [],
                array_key_exists('destination_urls', $data) => $data['destination_urls'],
                default => null,
            };

            if ($destinations !== null) {
                $this->syncDestinations($endpoint, $destinations);
            }

            $this->auditLog->record($user, $endpoint->project, 'webhook_endpoint.updated', $endpoint);

            return $endpoint;
        });
    }

    public function regenerateSigningSecret(User $user, WebhookEndpoint $endpoint): WebhookEndpoint
    {
        return DB::transaction(function () use ($user, $endpoint) {
            $endpoint->forceFill(['signing_secret' => Str::random(48)])->save();

            $this->auditLog->record($user, $endpoint->project, 'webhook_endpoint.signing_secret_regenerated', $endpoint);

            return $endpoint;
        });
    }

    public function delete(User $user, WebhookEndpoint $endpoint): void
    {
        DB::transaction(function () use ($user, $endpoint) {
            $this->auditLog->record($user, $endpoint->project, 'webhook_endpoint.deleted', null, [
                'webhook_endpoint_id' => $endpoint->id,
                'name' => $endpoint->name,
            ]);

            $this->endpoints->delete($endpoint);
        });
    }

    /**
     * A receive-only endpoint has nowhere to forward to, so any destination
     * list is dropped on the way in - the form hides the field for that mode,
     * which means an update would otherwise leave stale URLs behind.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function withoutDestinationsForCapture(array $data): array
    {
        if (($data['mode'] ?? null) !== WebhookEndpointMode::Capture->value) {
            return $data;
        }

        unset($data['destination_urls']);

        return $data;
    }

    /**
     * Reconcile the destination list. Existing rows whose URL survives keep
     * their id, so queued delivery jobs referencing them still resolve; rows
     * whose URL was removed are deleted and new URLs are appended in the
     * submitted order.
     *
     * @param  list<string>  $urls
     */
    private function syncDestinations(WebhookEndpoint $endpoint, array $urls): void
    {
        $existing = $endpoint->destinations()->get()->keyBy('url');

        foreach ($existing as $destination) {
            if (! in_array($destination->url, $urls, true)) {
                $destination->delete();
            }
        }

        foreach ($urls as $order => $url) {
            $destination = $existing->get($url) ?? new WebhookEndpointDestination(['url' => $url]);
            $destination->sort_order = $order;
            $endpoint->destinations()->save($destination);
        }
    }

    private function uniqueIngestToken(): string
    {
        do {
            $token = Str::random(40);
        } while ($this->endpoints->findByIngestToken($token) !== null);

        return $token;
    }
}
