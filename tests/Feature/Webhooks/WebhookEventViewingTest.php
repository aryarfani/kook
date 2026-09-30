<?php

use App\Enums\WebhookEndpointMode;
use App\Models\Project;
use App\Models\User;
use App\Models\WebhookDelivery;
use App\Models\WebhookEndpoint;
use App\Models\WebhookEvent;

test('a user can see their own webhook endpoints events on its show page', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();
    $endpoint = WebhookEndpoint::factory()->for($project)->create();
    WebhookEvent::factory()->count(3)->create([
        'webhook_endpoint_id' => $endpoint->id,
        'project_id' => $project->id,
    ]);

    $this->actingAs($user)
        ->get("/webhook-endpoints/{$endpoint->id}")
        ->assertInertia(fn ($page) => $page
            ->component('webhook-endpoints/show')
            ->has('events.data', 3)
        );
});

test('a user cannot see another users webhook endpoint events', function () {
    $owner = User::factory()->create();
    $intruder = User::factory()->create();
    $project = Project::factory()->for($owner)->create();
    $endpoint = WebhookEndpoint::factory()->for($project)->create();

    $this->actingAs($intruder)
        ->get("/webhook-endpoints/{$endpoint->id}")
        ->assertNotFound();
});

test('a user can view their own event with its deliveries', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();
    $endpoint = WebhookEndpoint::factory()->for($project)->create();
    $event = WebhookEvent::factory()->create([
        'webhook_endpoint_id' => $endpoint->id,
        'project_id' => $project->id,
    ]);
    WebhookDelivery::factory()->for($event, 'event')->create(['attempt_number' => 1]);

    $this->actingAs($user)
        ->get("/events/{$event->id}")
        ->assertInertia(fn ($page) => $page
            ->component('events/show')
            ->where('event.id', $event->id)
            ->where('event.webhookEndpoint.id', $endpoint->id)
            ->where('event.webhookEndpoint.name', $endpoint->name)
            ->missing('event.data')
            ->has('deliveries', 1)
        );
});

test('delivery attempts are listed with the latest attempt first', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();
    $endpoint = WebhookEndpoint::factory()->for($project)->create();
    $event = WebhookEvent::factory()->create([
        'webhook_endpoint_id' => $endpoint->id,
        'project_id' => $project->id,
    ]);
    WebhookDelivery::factory()->for($event, 'event')->create(['attempt_number' => 1]);
    WebhookDelivery::factory()->for($event, 'event')->create(['attempt_number' => 2]);
    WebhookDelivery::factory()->for($event, 'event')->create(['attempt_number' => 3]);

    $this->actingAs($user)
        ->get("/events/{$event->id}")
        ->assertInertia(fn ($page) => $page
            ->where('deliveries.0.attempt_number', 3)
            ->where('deliveries.1.attempt_number', 2)
            ->where('deliveries.2.attempt_number', 1)
        );
});

test('a user can view an event that has no delivery attempts yet', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();
    $endpoint = WebhookEndpoint::factory()->for($project)->create();
    $event = WebhookEvent::factory()->create([
        'webhook_endpoint_id' => $endpoint->id,
        'project_id' => $project->id,
    ]);

    $this->actingAs($user)
        ->get("/events/{$event->id}")
        ->assertInertia(fn ($page) => $page
            ->component('events/show')
            ->where('event.id', $event->id)
            ->has('deliveries', 0)
        );
});

test('a user cannot view another users event', function () {
    $owner = User::factory()->create();
    $intruder = User::factory()->create();
    $project = Project::factory()->for($owner)->create();
    $endpoint = WebhookEndpoint::factory()->for($project)->create();
    $event = WebhookEvent::factory()->create([
        'webhook_endpoint_id' => $endpoint->id,
        'project_id' => $project->id,
    ]);

    $this->actingAs($intruder)
        ->get("/events/{$event->id}")
        ->assertNotFound();
});

test('the event show page receives the body exactly as it was received', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();
    $endpoint = WebhookEndpoint::factory()->for($project)->create();

    // Keys deliberately out of alphabetical / insertion-friendly order.
    $rawBody = '{"z_last":1,"1":"numeric key","a_first":{"nested":true}}';
    $event = WebhookEvent::factory()->create([
        'webhook_endpoint_id' => $endpoint->id,
        'project_id' => $project->id,
        'payload' => json_decode($rawBody, true),
        'raw_body' => $rawBody,
    ]);

    $this->actingAs($user)
        ->get("/events/{$event->id}")
        ->assertInertia(fn ($page) => $page
            ->component('events/show')
            ->where('event.raw_body', $rawBody)
        );
});

test('an event response never exposes the raw signing material of its endpoint', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();
    $endpoint = WebhookEndpoint::factory()->for($project)->create();
    $event = WebhookEvent::factory()->create([
        'webhook_endpoint_id' => $endpoint->id,
        'project_id' => $project->id,
    ]);

    $response = $this->actingAs($user)->get("/events/{$event->id}");

    $response->assertInertia(fn ($page) => $page
        ->component('events/show')
        ->missing('event.webhookEndpoint.signing_secret')
        ->missing('event.webhookEndpoint.provider_secret')
    );
});

test('the endpoint page exposes the event named in the query string for its pane', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();
    $endpoint = WebhookEndpoint::factory()->for($project)->create();
    $event = WebhookEvent::factory()->create([
        'webhook_endpoint_id' => $endpoint->id,
        'project_id' => $project->id,
    ]);
    WebhookDelivery::factory()->for($event, 'event')->create(['attempt_number' => 1]);

    $this->actingAs($user)
        ->get("/webhook-endpoints/{$endpoint->id}?event={$event->id}")
        ->assertInertia(fn ($page) => $page
            ->component('webhook-endpoints/show')
            ->where('selectedEvent.event.id', $event->id)
            ->where('selectedEvent.event.raw_body', $event->raw_body)
            ->has('selectedEvent.deliveries', 1)
        );
});

test('the endpoint page ignores an event that belongs to another endpoint', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();
    $endpoint = WebhookEndpoint::factory()->for($project)->create();
    $otherEndpoint = WebhookEndpoint::factory()->for($project)->create();
    $otherEvent = WebhookEvent::factory()->create([
        'webhook_endpoint_id' => $otherEndpoint->id,
        'project_id' => $project->id,
    ]);

    $this->actingAs($user)
        ->get("/webhook-endpoints/{$endpoint->id}?event={$otherEvent->id}")
        ->assertInertia(fn ($page) => $page
            ->component('webhook-endpoints/show')
            ->where('selectedEvent', null)
        );
});

test('the endpoint page ignores a malformed event id', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();
    $endpoint = WebhookEndpoint::factory()->for($project)->create();

    $this->actingAs($user)
        ->get("/webhook-endpoints/{$endpoint->id}?event=not-a-uuid")
        ->assertInertia(fn ($page) => $page
            ->component('webhook-endpoints/show')
            ->where('selectedEvent', null)
        );
});

test('the project events tab exposes the event named in the query string for its pane', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();
    $endpoint = WebhookEndpoint::factory()->for($project)->create();
    $event = WebhookEvent::factory()->create([
        'webhook_endpoint_id' => $endpoint->id,
        'project_id' => $project->id,
    ]);
    WebhookDelivery::factory()->for($event, 'event')->create(['attempt_number' => 1]);

    $this->actingAs($user)
        ->get("/projects/{$project->id}?tab=events&event={$event->id}")
        ->assertInertia(fn ($page) => $page
            ->component('projects/show')
            ->where('selectedEvent.event.id', $event->id)
            ->where('selectedEvent.event.raw_body', $event->raw_body)
            ->has('selectedEvent.deliveries', 1)
        );
});

test('the project events tab carries the mode of the event endpoint', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();
    $captureEndpoint = WebhookEndpoint::factory()->for($project)->create([
        'mode' => WebhookEndpointMode::Capture,
    ]);
    $event = WebhookEvent::factory()->create([
        'webhook_endpoint_id' => $captureEndpoint->id,
        'project_id' => $project->id,
    ]);

    $this->actingAs($user)
        ->get("/projects/{$project->id}?tab=events&event={$event->id}")
        ->assertInertia(fn ($page) => $page
            ->component('projects/show')
            ->where('selectedEvent.event.webhookEndpoint.id', $captureEndpoint->id)
            ->where('selectedEvent.event.webhookEndpoint.mode', WebhookEndpointMode::Capture->value)
        );
});

test('the project events tab ignores an event that belongs to another project', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();
    $otherProject = Project::factory()->for($user)->create();
    $otherEndpoint = WebhookEndpoint::factory()->for($otherProject)->create();
    $otherEvent = WebhookEvent::factory()->create([
        'webhook_endpoint_id' => $otherEndpoint->id,
        'project_id' => $otherProject->id,
    ]);

    $this->actingAs($user)
        ->get("/projects/{$project->id}?tab=events&event={$otherEvent->id}")
        ->assertInertia(fn ($page) => $page
            ->component('projects/show')
            ->where('selectedEvent', null)
        );
});

test('the project events tab ignores a malformed event id', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();

    $this->actingAs($user)
        ->get("/projects/{$project->id}?tab=events&event=not-a-uuid")
        ->assertInertia(fn ($page) => $page
            ->component('projects/show')
            ->where('selectedEvent', null)
        );
});
