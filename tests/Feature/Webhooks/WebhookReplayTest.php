<?php

use App\Enums\WebhookDeliveryStatus;
use App\Enums\WebhookEndpointMode;
use App\Enums\WebhookEventStatus;
use App\Models\AuditLog;
use App\Models\Project;
use App\Models\User;
use App\Models\WebhookDelivery;
use App\Models\WebhookEndpoint;
use App\Models\WebhookEvent;
use Illuminate\Support\Facades\Http;

test('a user can replay their own successful event', function () {
    Http::fake(['example.com/*' => Http::response('ok', 200)]);

    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();
    $endpoint = WebhookEndpoint::factory()
        ->withDestinationUrls(['https://example.com/hooks'])
        ->for($project)
        ->create();
    $event = WebhookEvent::factory()->create([
        'webhook_endpoint_id' => $endpoint->id,
        'project_id' => $project->id,
        'status' => WebhookEventStatus::Success,
    ]);
    WebhookDelivery::factory()->for($event, 'event')->create([
        'destination_id' => $endpoint->destinations[0]->id,
        'attempt_number' => 1,
    ]);

    $this->actingAs($user)
        ->post("/events/{$event->id}/replay")
        ->assertRedirect();

    expect(WebhookDelivery::where('event_id', $event->id)->count())->toBe(2);
    $newDelivery = WebhookDelivery::where('event_id', $event->id)->where('attempt_number', 2)->first();
    expect($newDelivery)->not->toBeNull();

    $log = AuditLog::where('action', 'webhook_event.replayed')->first();
    expect($log)->not->toBeNull();
});

test('replaying an event dispatches a delivery per destination, each continuing its own attempt sequence', function () {
    Http::fake(['example.com/*' => Http::response('ok', 200)]);

    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();
    $endpoint = WebhookEndpoint::factory()
        ->withDestinationUrls(['https://example.com/hooks', 'https://example.com/mirror'])
        ->for($project)
        ->create();
    $event = WebhookEvent::factory()->create([
        'webhook_endpoint_id' => $endpoint->id,
        'project_id' => $project->id,
        'status' => WebhookEventStatus::Success,
    ]);

    // One prior attempt each: destination A delivered, destination B failed.
    WebhookDelivery::factory()->for($event, 'event')->create([
        'destination_id' => $endpoint->destinations[0]->id,
        'attempt_number' => 1,
        'status' => WebhookDeliveryStatus::Delivered,
    ]);
    WebhookDelivery::factory()->for($event, 'event')->create([
        'destination_id' => $endpoint->destinations[1]->id,
        'attempt_number' => 3,
        'status' => WebhookDeliveryStatus::Failed,
    ]);

    $this->actingAs($user)
        ->post("/events/{$event->id}/replay")
        ->assertRedirect();

    expect(WebhookDelivery::where('event_id', $event->id)->where('destination_id', $endpoint->destinations[0]->id)->count())->toBe(2);
    expect(WebhookDelivery::where('event_id', $event->id)->where('destination_id', $endpoint->destinations[1]->id)->count())->toBe(2);
    expect(WebhookDelivery::where('event_id', $event->id)->where('attempt_number', 2)->count())->toBe(2);
});

test('a user cannot replay another users event', function () {
    $owner = User::factory()->create();
    $intruder = User::factory()->create();
    $project = Project::factory()->for($owner)->create();
    $endpoint = WebhookEndpoint::factory()->for($project)->create();
    $event = WebhookEvent::factory()->create([
        'webhook_endpoint_id' => $endpoint->id,
        'project_id' => $project->id,
        'status' => WebhookEventStatus::Success,
    ]);

    $this->actingAs($intruder)
        ->post("/events/{$event->id}/replay")
        ->assertForbidden();
});

test('a failed event cannot be replayed', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();
    $endpoint = WebhookEndpoint::factory()->for($project)->create();
    $event = WebhookEvent::factory()->create([
        'webhook_endpoint_id' => $endpoint->id,
        'project_id' => $project->id,
        'status' => WebhookEventStatus::Failed,
    ]);

    $this->actingAs($user)->post("/events/{$event->id}/replay")->assertRedirect();

    expect(WebhookDelivery::where('event_id', $event->id)->count())->toBe(0);
});

test('an event from a receive-only endpoint cannot be replayed', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();
    $endpoint = WebhookEndpoint::factory()->for($project)->create([
        'mode' => WebhookEndpointMode::Capture,
    ]);
    $event = WebhookEvent::factory()->create([
        'webhook_endpoint_id' => $endpoint->id,
        'project_id' => $project->id,
        'status' => WebhookEventStatus::Success,
    ]);

    $this->actingAs($user)
        ->post("/events/{$event->id}/replay")
        ->assertRedirect();

    expect(WebhookDelivery::where('event_id', $event->id)->count())->toBe(0);
    expect(AuditLog::where('action', 'webhook_event.replayed')->count())->toBe(0);
});

test('replay is rate limited', function () {
    Http::fake(['*' => Http::response('ok', 200)]);

    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();
    $endpoint = WebhookEndpoint::factory()
        ->withDestinationUrls(['https://example.com/hooks'])
        ->for($project)
        ->create();
    $event = WebhookEvent::factory()->create([
        'webhook_endpoint_id' => $endpoint->id,
        'project_id' => $project->id,
        'status' => WebhookEventStatus::Success,
    ]);

    $this->actingAs($user);

    for ($i = 0; $i < 20; $i++) {
        $this->post("/events/{$event->id}/replay");
    }

    $this->post("/events/{$event->id}/replay")->assertStatus(429);
});
