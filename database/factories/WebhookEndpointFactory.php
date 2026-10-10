<?php

namespace Database\Factories;

use App\Enums\WebhookEndpointStatus;
use App\Models\Project;
use App\Models\WebhookEndpoint;
use App\Models\WebhookEndpointDestination;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<WebhookEndpoint>
 */
class WebhookEndpointFactory extends Factory
{
    public function definition(): array
    {
        return [
            'project_id' => Project::factory(),
            'name' => fake()->company(),
            'mode' => 'relay',
            'ingest_token' => Str::random(40),
            'signing_secret' => Str::random(32),
            'status' => WebhookEndpointStatus::Active,
        ];
    }

    /**
     * Attach the given destination URLs, in order. Endpoints are created
     * with no destinations unless this is called - receive-only endpoints
     * and tests that never forward both rely on that.
     *
     * @param  list<string>  $urls
     */
    public function withDestinationUrls(array $urls): static
    {
        return $this->afterCreating(function (WebhookEndpoint $endpoint) use ($urls): void {
            foreach ($urls as $index => $url) {
                WebhookEndpointDestination::factory()
                    ->for($endpoint, 'webhookEndpoint')
                    ->create(['url' => $url, 'sort_order' => $index]);
            }
        });
    }
}
