<?php

namespace Database\Factories;

use App\Models\WebhookEndpoint;
use App\Models\WebhookEndpointDestination;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<WebhookEndpointDestination>
 */
class WebhookEndpointDestinationFactory extends Factory
{
    public function definition(): array
    {
        return [
            'webhook_endpoint_id' => WebhookEndpoint::factory(),
            'url' => fake()->url(),
            'sort_order' => 0,
        ];
    }
}
