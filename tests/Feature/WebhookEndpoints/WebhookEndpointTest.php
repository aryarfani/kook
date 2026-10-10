<?php

use App\Enums\WebhookDeliveryStatus;
use App\Enums\WebhookEndpointMode;
use App\Enums\WebhookEndpointStatus;
use App\Enums\WebhookEventStatus;
use App\Models\AuditLog;
use App\Models\Project;
use App\Models\Provider;
use App\Models\User;
use App\Models\WebhookDelivery;
use App\Models\WebhookEndpoint;
use App\Models\WebhookEvent;
use Database\Seeders\ProviderSeeder;

test('a user can create a relay webhook endpoint for their own project', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();

    $response = $this->actingAs($user)->post("/projects/{$project->id}/webhook-endpoints", [
        'name' => 'Payments relay',
        'destination_urls' => ['https://example.com/hooks'],
        'mode' => 'relay',
    ]);

    $endpoint = WebhookEndpoint::first();

    $response->assertRedirect("/webhook-endpoints/{$endpoint->id}");
    expect($endpoint)
        ->name->toBe('Payments relay')
        ->project_id->toBe($project->id)
        ->status->toBe(WebhookEndpointStatus::Active)
        ->ingest_token->not->toBeEmpty()
        ->signing_secret->not->toBeEmpty();
});

test('a relay endpoint can be created with several destination urls stored in order', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();

    $this->actingAs($user)->post("/projects/{$project->id}/webhook-endpoints", [
        'name' => 'Payments relay',
        'destination_urls' => [
            'https://example.com/first',
            'https://example.com/second',
        ],
        'mode' => 'relay',
    ]);

    $endpoint = WebhookEndpoint::first();

    expect($endpoint->destinationUrls())->toBe([
        'https://example.com/first',
        'https://example.com/second',
    ]);
});

test('creating a webhook endpoint requires a valid destination url', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();

    $this->actingAs($user)
        ->post("/projects/{$project->id}/webhook-endpoints", [
            'name' => 'Bad endpoint',
            'destination_urls' => ['not-a-url'],
            'mode' => 'relay',
        ])
        ->assertSessionHasErrors('destination_urls.0');

    expect(WebhookEndpoint::count())->toBe(0);
});

test('creating a webhook endpoint rejects an invalid url among several destinations', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();

    $this->actingAs($user)
        ->post("/projects/{$project->id}/webhook-endpoints", [
            'name' => 'Mixed endpoint',
            'destination_urls' => ['https://example.com/ok', 'not-a-url'],
            'mode' => 'relay',
        ])
        ->assertSessionHasErrors('destination_urls.1');

    expect(WebhookEndpoint::count())->toBe(0);
});

test('creating a webhook endpoint rejects duplicate destination urls', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();

    $this->actingAs($user)
        ->post("/projects/{$project->id}/webhook-endpoints", [
            'name' => 'Duplicate endpoint',
            'destination_urls' => [
                'https://example.com/hooks',
                'https://example.com/hooks',
            ],
            'mode' => 'relay',
        ])
        ->assertSessionHasErrors('destination_urls.1');

    expect(WebhookEndpoint::count())->toBe(0);
});

test('creating a webhook endpoint rejects destinations that resolve to private networks', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();

    $this->actingAs($user)
        ->post("/projects/{$project->id}/webhook-endpoints", [
            'name' => 'SSRF attempt',
            'destination_urls' => ['http://127.0.0.1/secret'],
            'mode' => 'relay',
        ])
        ->assertSessionHasErrors('destination_urls.0');

    expect(WebhookEndpoint::count())->toBe(0);
});

test('managed mode requires a provider and secret', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();

    $this->actingAs($user)
        ->post("/projects/{$project->id}/webhook-endpoints", [
            'name' => 'Managed endpoint',
            'destination_urls' => ['https://example.com/hooks'],
            'mode' => 'managed',
        ])
        ->assertSessionHasErrors(['provider_id', 'provider_secret']);
});

test('a user cannot create a webhook endpoint on another users project', function () {
    $owner = User::factory()->create();
    $intruder = User::factory()->create();
    $project = Project::factory()->for($owner)->create();

    $this->actingAs($intruder)
        ->post("/projects/{$project->id}/webhook-endpoints", [
            'name' => 'Intruding endpoint',
            'destination_urls' => ['https://example.com/hooks'],
            'mode' => 'relay',
        ])
        ->assertForbidden();

    expect(WebhookEndpoint::count())->toBe(0);
});

test('a user can view their own webhook endpoint', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();
    $endpoint = WebhookEndpoint::factory()->for($project)->create();

    $this->actingAs($user)
        ->get("/webhook-endpoints/{$endpoint->id}")
        ->assertInertia(fn ($page) => $page
            ->component('webhook-endpoints/show')
            ->where('webhookEndpoint.id', $endpoint->id)
            ->where('webhookEndpoint.latest_event', null)
            ->missing('events')
            ->has('projects', 1)
            ->where('projects.0.id', $project->id)
        );
});

test('a webhook endpoint shows the status of its most recent event', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();
    $endpoint = WebhookEndpoint::factory()->for($project)->create();
    WebhookEvent::factory()->create([
        'webhook_endpoint_id' => $endpoint->id,
        'project_id' => $project->id,
        'status' => WebhookEventStatus::Success,
        'received_at' => now()->subDay(),
    ]);
    $latest = WebhookEvent::factory()->create([
        'webhook_endpoint_id' => $endpoint->id,
        'project_id' => $project->id,
        'status' => WebhookEventStatus::Failed,
        'received_at' => now(),
    ]);

    $this->actingAs($user)
        ->get("/webhook-endpoints/{$endpoint->id}")
        ->assertInertia(fn ($page) => $page
            ->where('webhookEndpoint.latest_event.id', $latest->id)
            ->where('webhookEndpoint.latest_event.status', 'failed')
            ->where('webhookEndpoint.latest_event.latest_delivery', null)
        );
});

test('a webhook endpoint shows the status of its most recent delivery attempt when one exists', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();
    $endpoint = WebhookEndpoint::factory()->for($project)->create();
    $event = WebhookEvent::factory()->create([
        'webhook_endpoint_id' => $endpoint->id,
        'project_id' => $project->id,
        'status' => WebhookEventStatus::Processing,
    ]);
    WebhookDelivery::factory()->for($event, 'event')->create([
        'attempt_number' => 1,
        'status' => WebhookDeliveryStatus::Retrying,
    ]);
    $latestDelivery = WebhookDelivery::factory()->for($event, 'event')->create([
        'attempt_number' => 2,
        'status' => WebhookDeliveryStatus::Retrying,
    ]);

    $this->actingAs($user)
        ->get("/webhook-endpoints/{$endpoint->id}")
        ->assertInertia(fn ($page) => $page
            ->where('webhookEndpoint.latest_event.latest_delivery.id', $latestDelivery->id)
            ->where('webhookEndpoint.latest_event.latest_delivery.status', 'retrying')
        );
});

test('a user cannot view another users webhook endpoint', function () {
    $owner = User::factory()->create();
    $intruder = User::factory()->create();
    $project = Project::factory()->for($owner)->create();
    $endpoint = WebhookEndpoint::factory()->for($project)->create();

    $this->actingAs($intruder)
        ->get("/webhook-endpoints/{$endpoint->id}")
        ->assertNotFound();
});

test('a webhook endpoint response exposes the signing secret to its owner but never the provider secret', function () {
    // signing_secret is Kook's own outgoing signature for managed-mode
    // forwarding: the owner needs it to verify requests on their server.
    // provider_secret is write-only input and should never be redisplayed.
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();
    $endpoint = WebhookEndpoint::factory()->for($project)->create();

    $response = $this->actingAs($user)->get("/webhook-endpoints/{$endpoint->id}");

    $response->assertInertia(fn ($page) => $page
        ->component('webhook-endpoints/show')
        ->where('webhookEndpoint.signing_secret', $endpoint->signing_secret)
        ->missing('webhookEndpoint.provider_secret')
    );
});

test('a user cannot see another users webhook endpoint signing secret', function () {
    $owner = User::factory()->create();
    $intruder = User::factory()->create();
    $project = Project::factory()->for($owner)->create();
    $endpoint = WebhookEndpoint::factory()->for($project)->create();

    $this->actingAs($intruder)
        ->get("/webhook-endpoints/{$endpoint->id}")
        ->assertNotFound();
});

test('a user can update their own webhook endpoint', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();
    $endpoint = WebhookEndpoint::factory()->for($project)->create(['name' => 'Old name']);

    $this->actingAs($user)
        ->put("/webhook-endpoints/{$endpoint->id}", [
            'name' => 'New name',
            'mode' => 'relay',
            'destination_urls' => ['https://example.com/new'],
            'status' => 'paused',
        ])
        ->assertRedirect("/webhook-endpoints/{$endpoint->id}");

    expect($endpoint->fresh())
        ->name->toBe('New name')
        ->status->toBe(WebhookEndpointStatus::Paused);
});

test('updating destination urls removes removed rows, keeps kept rows, and appends new ones', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();
    $endpoint = WebhookEndpoint::factory()
        ->withDestinationUrls(['https://example.com/keep', 'https://example.com/drop'])
        ->for($project)
        ->create();
    $keptId = $endpoint->destinations[0]->id;

    $this->actingAs($user)->put("/webhook-endpoints/{$endpoint->id}", [
        'name' => $endpoint->name,
        'mode' => 'relay',
        'destination_urls' => ['https://example.com/keep', 'https://example.com/added'],
        'status' => 'active',
    ]);

    $endpoint->refresh();

    expect($endpoint->destinationUrls())->toBe([
        'https://example.com/keep',
        'https://example.com/added',
    ]);
    // The surviving URL keeps its id so queued delivery jobs still resolve.
    expect($endpoint->destinations[0]->id)->toBe($keptId);
});

test('a relay endpoint cannot be updated to have no destination urls', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();
    $endpoint = WebhookEndpoint::factory()->for($project)
        ->withDestinationUrls(['https://example.com/hooks'])
        ->create();

    $this->actingAs($user)
        ->put("/webhook-endpoints/{$endpoint->id}", [
            'name' => $endpoint->name,
            'mode' => 'relay',
            'destination_urls' => [],
            'status' => 'active',
        ])
        ->assertSessionHasErrors('destination_urls');

    expect($endpoint->fresh()->destinations()->count())->toBe(1);
});

test('a user cannot update another users webhook endpoint', function () {
    $owner = User::factory()->create();
    $intruder = User::factory()->create();
    $project = Project::factory()->for($owner)->create();
    $endpoint = WebhookEndpoint::factory()->for($project)->create();

    $this->actingAs($intruder)
        ->put("/webhook-endpoints/{$endpoint->id}", [
            'name' => 'Hacked',
            'destination_urls' => ['https://example.com/hacked'],
            'status' => 'active',
        ])
        ->assertForbidden();
});

test('a user can delete their own webhook endpoint', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();
    $endpoint = WebhookEndpoint::factory()->for($project)->create();

    $this->actingAs($user)
        ->delete("/webhook-endpoints/{$endpoint->id}")
        ->assertRedirect("/projects/{$project->id}");

    expect(WebhookEndpoint::find($endpoint->id))->toBeNull();
});

test('a user cannot delete another users webhook endpoint', function () {
    $owner = User::factory()->create();
    $intruder = User::factory()->create();
    $project = Project::factory()->for($owner)->create();
    $endpoint = WebhookEndpoint::factory()->for($project)->create();

    $this->actingAs($intruder)
        ->delete("/webhook-endpoints/{$endpoint->id}")
        ->assertForbidden();

    expect(WebhookEndpoint::find($endpoint->id))->not->toBeNull();
});

test('a user can regenerate their own webhook endpoint signing secret', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();
    $endpoint = WebhookEndpoint::factory()->for($project)->create([
        'mode' => WebhookEndpointMode::Managed,
    ]);
    $originalSecret = $endpoint->signing_secret;

    $this->actingAs($user)
        ->post("/webhook-endpoints/{$endpoint->id}/regenerate-signing-secret")
        ->assertRedirect("/webhook-endpoints/{$endpoint->id}");

    expect($endpoint->fresh()->signing_secret)->not->toBe($originalSecret);

    $log = AuditLog::where('action', 'webhook_endpoint.signing_secret_regenerated')->first();
    expect($log)->not->toBeNull();
});

test('a user cannot regenerate another users webhook endpoint signing secret', function () {
    $owner = User::factory()->create();
    $intruder = User::factory()->create();
    $project = Project::factory()->for($owner)->create();
    $endpoint = WebhookEndpoint::factory()->for($project)->create([
        'mode' => WebhookEndpointMode::Managed,
    ]);
    $originalSecret = $endpoint->signing_secret;

    $this->actingAs($intruder)
        ->post("/webhook-endpoints/{$endpoint->id}/regenerate-signing-secret")
        ->assertForbidden();

    expect($endpoint->fresh()->signing_secret)->toBe($originalSecret);
});

test('leaving the provider secret blank on update keeps the existing secret', function () {
    $this->seed(ProviderSeeder::class);
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();
    $provider = Provider::query()->where('key', 'generic_hmac')->firstOrFail();
    $endpoint = WebhookEndpoint::factory()->for($project)
        ->withDestinationUrls(['https://example.com/hooks'])
        ->create([
            'mode' => WebhookEndpointMode::Managed,
            'provider_id' => $provider->id,
            'provider_secret' => 'original-secret',
        ]);

    $this->actingAs($user)->put("/webhook-endpoints/{$endpoint->id}", [
        'name' => $endpoint->name,
        'mode' => 'managed',
        'destination_urls' => ['https://example.com/hooks'],
        'status' => 'active',
        'provider_id' => $provider->id,
        'provider_secret' => '',
    ]);

    expect($endpoint->fresh()->provider_secret)->toBe('original-secret');
});

test('providing a new provider secret on update rotates it', function () {
    $this->seed(ProviderSeeder::class);
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();
    $provider = Provider::query()->where('key', 'generic_hmac')->firstOrFail();
    $endpoint = WebhookEndpoint::factory()->for($project)
        ->withDestinationUrls(['https://example.com/hooks'])
        ->create([
            'mode' => WebhookEndpointMode::Managed,
            'provider_id' => $provider->id,
            'provider_secret' => 'original-secret',
        ]);

    $this->actingAs($user)->put("/webhook-endpoints/{$endpoint->id}", [
        'name' => $endpoint->name,
        'mode' => 'managed',
        'destination_urls' => ['https://example.com/hooks'],
        'status' => 'active',
        'provider_id' => $provider->id,
        'provider_secret' => 'rotated-secret',
    ]);

    expect($endpoint->fresh()->provider_secret)->toBe('rotated-secret');
});

test('a managed endpoint can be created against a seeded provider', function () {
    $this->seed(ProviderSeeder::class);

    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();
    $provider = Provider::query()->where('key', 'generic_hmac')->firstOrFail();

    $response = $this->actingAs($user)->post("/projects/{$project->id}/webhook-endpoints", [
        'name' => 'Managed endpoint',
        'destination_urls' => ['https://example.com/hooks'],
        'mode' => 'managed',
        'provider_id' => $provider->id,
        'provider_secret' => 'super-secret',
    ]);

    $endpoint = WebhookEndpoint::first();
    $response->assertRedirect("/webhook-endpoints/{$endpoint->id}");
    expect($endpoint->provider_id)->toBe($provider->id);
});

test('a receive-only endpoint can be created without a destination url', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();

    $response = $this->actingAs($user)->post("/projects/{$project->id}/webhook-endpoints", [
        'name' => 'Barantum inbox',
        'mode' => 'capture',
    ]);

    $endpoint = WebhookEndpoint::first();

    $response->assertRedirect("/webhook-endpoints/{$endpoint->id}");
    expect($endpoint)
        ->mode->toBe(WebhookEndpointMode::Capture)
        ->status->toBe(WebhookEndpointStatus::Active);
    expect($endpoint->destinations()->count())->toBe(0);
});

test('a receive-only endpoint drops destination urls it was sent anyway', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();

    $this->actingAs($user)->post("/projects/{$project->id}/webhook-endpoints", [
        'name' => 'Barantum inbox',
        'mode' => 'capture',
        'destination_urls' => ['https://example.com/hooks'],
    ]);

    expect(WebhookEndpoint::first()->destinations()->count())->toBe(0);
});

test('a relay endpoint cannot be created without a destination url', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();

    $this->actingAs($user)
        ->post("/projects/{$project->id}/webhook-endpoints", [
            'name' => 'Nowhere to go',
            'mode' => 'relay',
        ])
        ->assertSessionHasErrors('destination_urls');

    expect(WebhookEndpoint::count())->toBe(0);
});

test('switching an endpoint to receive only clears its destination urls', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();
    $endpoint = WebhookEndpoint::factory()->for($project)
        ->withDestinationUrls(['https://example.com/hooks'])
        ->create();

    $this->actingAs($user)->put("/webhook-endpoints/{$endpoint->id}", [
        'name' => $endpoint->name,
        'mode' => 'capture',
        'status' => 'active',
    ]);

    expect($endpoint->fresh())
        ->mode->toBe(WebhookEndpointMode::Capture);
    expect($endpoint->fresh()->destinations()->count())->toBe(0);
});

test('switching a receive-only endpoint to relay requires a destination url', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();
    $endpoint = WebhookEndpoint::factory()->for($project)->create([
        'mode' => WebhookEndpointMode::Capture,
    ]);

    $this->actingAs($user)
        ->put("/webhook-endpoints/{$endpoint->id}", [
            'name' => $endpoint->name,
            'mode' => 'relay',
            'status' => 'active',
        ])
        ->assertSessionHasErrors('destination_urls');

    expect($endpoint->fresh())
        ->mode->toBe(WebhookEndpointMode::Capture);
    expect($endpoint->fresh()->destinations()->count())->toBe(0);
});

test('switching a receive-only endpoint to relay stores the destination url', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();
    $endpoint = WebhookEndpoint::factory()->for($project)->create([
        'mode' => WebhookEndpointMode::Capture,
    ]);

    $this->actingAs($user)->put("/webhook-endpoints/{$endpoint->id}", [
        'name' => $endpoint->name,
        'mode' => 'relay',
        'destination_urls' => ['https://example.com/hooks'],
        'status' => 'active',
    ]);

    $endpoint->refresh();

    expect($endpoint)
        ->mode->toBe(WebhookEndpointMode::Relay);
    expect($endpoint->destinationUrls())->toBe(['https://example.com/hooks']);
});

test('switching an endpoint to managed requires a provider and a secret', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();
    $endpoint = WebhookEndpoint::factory()->for($project)->create([
        'mode' => WebhookEndpointMode::Capture,
    ]);

    $this->actingAs($user)
        ->put("/webhook-endpoints/{$endpoint->id}", [
            'name' => $endpoint->name,
            'mode' => 'managed',
            'destination_urls' => ['https://example.com/hooks'],
            'status' => 'active',
        ])
        ->assertSessionHasErrors(['provider_id', 'provider_secret']);

    expect($endpoint->fresh()->mode)->toBe(WebhookEndpointMode::Capture);
});

test('switching an endpoint to managed stores the provider and secret', function () {
    $this->seed(ProviderSeeder::class);

    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();
    $provider = Provider::query()->where('key', 'generic_hmac')->firstOrFail();
    $endpoint = WebhookEndpoint::factory()->for($project)->create([
        'mode' => WebhookEndpointMode::Capture,
    ]);

    $this->actingAs($user)->put("/webhook-endpoints/{$endpoint->id}", [
        'name' => $endpoint->name,
        'mode' => 'managed',
        'destination_urls' => ['https://example.com/hooks'],
        'status' => 'active',
        'provider_id' => $provider->id,
        'provider_secret' => 'fresh-secret',
    ]);

    expect($endpoint->fresh())
        ->mode->toBe(WebhookEndpointMode::Managed)
        ->provider_id->toBe($provider->id)
        ->provider_secret->toBe('fresh-secret');
});
