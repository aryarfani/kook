<?php

use App\Enums\WebhookEventStatus;
use App\Models\AuditLog;
use App\Models\Project;
use App\Models\User;
use App\Models\WebhookEndpoint;
use App\Models\WebhookEvent;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;

/**
 * @param  array<string, string>  $query
 */
function exportUri(WebhookEndpoint $endpoint, array $query = []): string
{
    $uri = "/webhook-endpoints/{$endpoint->id}/events/export";

    return $query === [] ? $uri : $uri.'?'.http_build_query($query);
}

/**
 * @return array<int, array<string, mixed>>
 */
function exportedEvents(TestResponse $response): array
{
    return json_decode($response->streamedContent(), true, flags: JSON_THROW_ON_ERROR);
}

test('an owner can export every event for their endpoint as json', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();
    $endpoint = WebhookEndpoint::factory()->for($project)->create();
    WebhookEvent::factory()->count(3)->create([
        'webhook_endpoint_id' => $endpoint->id,
        'project_id' => $project->id,
    ]);

    $response = $this->actingAs($user)->get(exportUri($endpoint));

    $response->assertOk();

    $exported = exportedEvents($response);

    expect($exported)->toHaveCount(3)
        ->and($exported[0])->toHaveKeys([
            'id',
            'received_at',
            'event_name',
            'status',
            'signature_valid',
            'idempotency_key',
            'headers',
            'payload',
        ]);
});

test('the export contains payload and headers but omits the raw body', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();
    $endpoint = WebhookEndpoint::factory()->for($project)->create();

    $rawBody = '{"z_last":1,"a_first":{"nested":true}}';
    WebhookEvent::factory()->create([
        'webhook_endpoint_id' => $endpoint->id,
        'project_id' => $project->id,
        'headers' => ['content-type' => 'application/json', 'x-custom' => 'yes'],
        'payload' => json_decode($rawBody, true),
        'raw_body' => $rawBody,
        'status' => WebhookEventStatus::Success,
    ]);

    $exported = exportedEvents($this->actingAs($user)->get(exportUri($endpoint)));

    expect($exported)->toHaveCount(1)
        ->and($exported[0])->not->toHaveKey('raw_body')
        ->and($exported[0]['payload'])->toBe(['z_last' => 1, 'a_first' => ['nested' => true]])
        ->and($exported[0]['status'])->toBe('success')
        ->and($exported[0]['headers']['x-custom'])->toBe('yes');
});

test('browsing does not block downloads and repeated exports are not throttled', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();
    $endpoint = WebhookEndpoint::factory()->for($project)->create();

    $this->actingAs($user);

    for ($i = 0; $i < 10; $i++) {
        $this->get("/webhook-endpoints/{$endpoint->id}")->assertOk();
    }

    for ($i = 0; $i < 12; $i++) {
        $this->get(exportUri($endpoint))->assertOk();
    }
});

test('an owner cannot export events belonging to another endpoint', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();
    $endpoint = WebhookEndpoint::factory()->for($project)->create();
    $other = WebhookEndpoint::factory()->for($project)->create();

    WebhookEvent::factory()->create([
        'webhook_endpoint_id' => $endpoint->id,
        'project_id' => $project->id,
    ]);
    WebhookEvent::factory()->count(2)->create([
        'webhook_endpoint_id' => $other->id,
        'project_id' => $project->id,
    ]);

    $exported = exportedEvents($this->actingAs($user)->get(exportUri($endpoint)));

    expect($exported)->toHaveCount(1);
});

test('a user cannot export another users endpoint', function () {
    $owner = User::factory()->create();
    $intruder = User::factory()->create();
    $project = Project::factory()->for($owner)->create();
    $endpoint = WebhookEndpoint::factory()->for($project)->create();

    $this->actingAs($intruder)
        ->get(exportUri($endpoint))
        ->assertNotFound();
});

test('the export excludes events outside the given range', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();
    $endpoint = WebhookEndpoint::factory()->for($project)->create();

    foreach ([
        ['2026-09-29 23:00:00', 'before'],
        ['2026-09-30 12:00:00', 'inside'],
        ['2026-10-01 01:00:00', 'after'],
    ] as [$receivedAt, $name]) {
        WebhookEvent::factory()->create([
            'webhook_endpoint_id' => $endpoint->id,
            'project_id' => $project->id,
            'received_at' => $receivedAt,
            'event_name' => $name,
        ]);
    }

    $exported = exportedEvents($this->actingAs($user)->get(exportUri($endpoint, [
        'from' => '2026-09-30T00:00:00.000+00:00',
        'to' => '2026-09-30T23:59:59.999+00:00',
    ])));

    expect($exported)->toHaveCount(1)
        ->and($exported[0]['event_name'])->toBe('inside');
});

test('the range is resolved from the viewer offset rather than read as utc', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();
    $endpoint = WebhookEndpoint::factory()->for($project)->create();

    // In +07:00, 2026-09-30 spans 2026-09-29 17:00 UTC to 2026-09-30 16:59 UTC.
    // The first event sits inside that window only when the offset is honoured;
    // the second sits outside it even though its UTC date is also 30 September.
    foreach ([
        ['2026-09-30 02:00:00', 'local-morning'],
        ['2026-09-30 20:00:00', 'local-next-day'],
    ] as [$receivedAt, $name]) {
        WebhookEvent::factory()->create([
            'webhook_endpoint_id' => $endpoint->id,
            'project_id' => $project->id,
            'received_at' => $receivedAt,
            'event_name' => $name,
        ]);
    }

    $exported = exportedEvents($this->actingAs($user)->get(exportUri($endpoint, [
        'from' => '2026-09-30T00:00:00.000+07:00',
        'to' => '2026-09-30T23:59:59.999+07:00',
    ])));

    expect($exported)->toHaveCount(1)
        ->and($exported[0]['event_name'])->toBe('local-morning');
});

test('a range that ends before it starts is rejected', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();
    $endpoint = WebhookEndpoint::factory()->for($project)->create();

    $this->actingAs($user)
        ->get(exportUri($endpoint, [
            'from' => '2026-09-30T00:00:00.000+00:00',
            'to' => '2026-09-01T00:00:00.000+00:00',
        ]))
        ->assertSessionHasErrors('to');
});

test('the download is served as an attachment named after the endpoint and range', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();
    $endpoint = WebhookEndpoint::factory()->for($project)->create();
    $slug = Str::slug($endpoint->name);

    $all = $this->actingAs($user)->get(exportUri($endpoint));
    expect($all->headers->get('content-disposition'))
        ->toContain('attachment')
        ->toContain("{$slug}-events-all.json");

    $ranged = $this->actingAs($user)->get(exportUri($endpoint, [
        'from' => '2026-09-30T00:00:00.000+07:00',
        'to' => '2026-10-02T23:59:59.999+07:00',
    ]));

    // Named from the viewer's own dates, not the UTC-converted bounds.
    expect($ranged->headers->get('content-disposition'))
        ->toContain("{$slug}-events-2026-09-30-to-2026-10-02.json");
});

test('an export is recorded in the audit log', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();
    $endpoint = WebhookEndpoint::factory()->for($project)->create();

    $this->actingAs($user)->get(exportUri($endpoint));

    $log = AuditLog::query()->where('action', 'webhook_endpoint.events_exported')->sole();

    expect($log->user_id)->toBe($user->id)
        ->and($log->project_id)->toBe($project->id)
        ->and($log->auditable_id)->toBe($endpoint->id);
});

test('an export with no events still returns an empty json array', function () {
    $user = User::factory()->create();
    $project = Project::factory()->for($user)->create();
    $endpoint = WebhookEndpoint::factory()->for($project)->create();

    $exported = exportedEvents($this->actingAs($user)->get(exportUri($endpoint)));

    expect($exported)->toBe([]);
});
