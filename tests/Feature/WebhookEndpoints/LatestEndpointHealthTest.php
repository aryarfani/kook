<?php

use App\Models\Project;
use App\Models\User;
use App\Models\WebhookDelivery;
use App\Models\WebhookEndpoint;
use App\Models\WebhookEvent;
use Illuminate\Support\Facades\Event;

test('endpoint health pages load only the latest event and attempt per endpoint', function (string $page) {
    $this->freezeTime();
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();
    $expected = [];
    foreach (range(1, 2) as $number) {
        $endpoint = WebhookEndpoint::factory()->for($project)->create();
        foreach (range(1, 3) as $eventNumber) {
            $event = WebhookEvent::factory()->create([
                'id' => sprintf('30000000-0000-4000-8000-%012d', $number * 10 + $eventNumber),
                'webhook_endpoint_id' => $endpoint->id,
                'project_id' => $project->id,
                'received_at' => $eventNumber === 1 ? now()->subDay() : now()->startOfSecond(),
            ]);
            foreach (range(1, 3) as $attempt) {
                $delivery = WebhookDelivery::factory()->for($event, 'event')->create([
                    'attempt_number' => $attempt,
                    'status' => $attempt === 3 ? 'delivered' : 'failed',
                ]);
            }
        }
        $expected[$endpoint->id] = [$event->id, $delivery->id];
    }
    WebhookEndpoint::factory()->for($project)->create();

    $loaded = ['events' => 0, 'deliveries' => 0];
    Event::listen('eloquent.retrieved: '.WebhookEvent::class, function () use (&$loaded) {
        $loaded['events']++;
    });
    Event::listen('eloquent.retrieved: '.WebhookDelivery::class, function () use (&$loaded) {
        $loaded['deliveries']++;
    });
    try {
        $id = array_key_first($expected);
        $url = $page === 'project' ? "/projects/{$project->id}" : "/webhook-endpoints/{$id}";
        $response = $this->actingAs($user)->get($url)->assertOk();
        $count = $page === 'project' ? 2 : 1;
        expect($loaded)->toBe(['events' => $count, 'deliveries' => $count]);
        $response->assertInertia(function ($assert) use ($page, $expected, $id) {
            if ($page === 'endpoint') {
                $assert->where('webhookEndpoint.latest_event.id', $expected[$id][0])
                    ->where('webhookEndpoint.latest_event.latest_delivery.id', $expected[$id][1]);
            } else {
                $assert->has('webhookEndpoints', 3)
                    ->where('webhookEndpoints', function ($endpoints) use ($expected) {
                        foreach ($endpoints as $endpoint) {
                            $latest = $endpoint['latest_event'];
                            if (isset($expected[$endpoint['id']])) {
                                expect([$latest['id'], $latest['latest_delivery']['id']])->toBe($expected[$endpoint['id']]);
                            } else {
                                expect($latest)->toBeNull();
                            }
                        }

                        return true;
                    });
            }
        });
    } finally {
        Event::forget('eloquent.retrieved: '.WebhookEvent::class);
        Event::forget('eloquent.retrieved: '.WebhookDelivery::class);
    }
})->with(['project', 'endpoint']);
