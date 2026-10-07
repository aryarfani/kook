<?php

use App\Enums\WebhookEndpointMode;
use App\Models\Project;
use App\Models\User;
use App\Models\WebhookDelivery;
use App\Models\WebhookEndpoint;
use App\Models\WebhookEvent;
use App\Services\EventBrowserService;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Support\Facades\DB;

beforeEach(function () {
    $this->user = User::factory()->create();
    $this->project = Project::factory()->for($this->user)->create();
    $this->endpoint = WebhookEndpoint::factory()->for($this->project)->create(['mode' => WebhookEndpointMode::Capture]);
    $this->event = WebhookEvent::factory()->create([
        'webhook_endpoint_id' => $this->endpoint->id,
        'project_id' => $this->project->id,
        'raw_body' => '{"z":1,"a":2}',
    ]);
});

test('payload search is literal case-insensitive and shared by list and export', function () {
    $this->event->update(['payload' => ['nested' => ['message' => 'Customer 50%_OFF']], 'event_name' => 'not searched']);
    WebhookEvent::factory()->create(['webhook_endpoint_id' => $this->endpoint->id, 'project_id' => $this->project->id, 'payload' => ['message' => '50xxOFF']]);
    WebhookEvent::factory()->create(['payload' => ['message' => 'Customer 50%_OFF']]);
    $query = http_build_query(['search' => '50%_off']);
    $this->actingAs($this->user)->get('/events?'.$query)->assertInertia(fn ($page) => $page->has('events.data', 1)->where('events.data.0.id', $this->event->id)->missing('events.data.0.payload'));
    $export = json_decode($this->get('/events/export?'.$query)->streamedContent(), true, flags: JSON_THROW_ON_ERROR);
    expect(array_column($export, 'id'))->toBe([$this->event->id]);
});

test('endpoint title formats apply to historical inbox and inspector without replacing event names', function () {
    $this->event->update(['payload' => ['entry' => [['changes' => [['field' => 'messages']]]]], 'event_name' => null]);
    $this->actingAs($this->user)->patch('/webhook-endpoints/'.$this->endpoint->id.'/title-format', ['event_title_format' => '{{entry.0.changes.0.field}}'])->assertRedirect();
    $this->get('/events?event='.$this->event->id)->assertInertia(fn ($page) => $page->where('events.data.0.display_title', 'messages')->where('selectedEvent.event.display_title', 'messages')->where('selectedEvent.event.event_name', null));
    $foreign = WebhookEndpoint::factory()->create();
    $this->patch('/webhook-endpoints/'.$foreign->id.'/title-format', ['event_title_format' => '{{object}}'])->assertForbidden();
    $this->patchJson('/webhook-endpoints/'.$this->endpoint->id.'/title-format', ['event_title_format' => '{{bad[0]}}'])->assertUnprocessable();
    $this->patch('/webhook-endpoints/'.$this->endpoint->id.'/title-format', ['event_title_format' => ''])->assertRedirect();
    expect($this->endpoint->fresh()->event_title_format)->toBeNull();
});

test('events requires authentication', function () {
    $this->get('/events')->assertRedirect('/login');
    $this->get('/events/export')->assertRedirect('/login');
});

test('event list includes the latest relay attempt rather than ingestion status', function () {
    $this->endpoint->update(['mode' => WebhookEndpointMode::Relay]);
    $this->event->update(['status' => 'success']);
    WebhookDelivery::factory()->create([
        'event_id' => $this->event->id, 'attempt_number' => 1,
        'status' => 'failed', 'http_status_code' => 502,
    ]);
    WebhookDelivery::factory()->create([
        'event_id' => $this->event->id, 'attempt_number' => 2,
        'status' => 'delivered', 'http_status_code' => 200,
    ]);
    $this->actingAs($this->user)->get('/events')->assertInertia(fn ($page) => $page
        ->where('events.data.0.status', 'success')
        ->where('events.data.0.latest_delivery.status', 'delivered')
        ->where('events.data.0.latest_delivery.http_status_code', 200)
        ->missing('events.data.0.latest_delivery.response_body'));
});

test('events lists only owned lightweight rows with deterministic pagination', function () {
    WebhookEvent::factory()->create();
    WebhookEvent::factory()->count(26)->create([
        'webhook_endpoint_id' => $this->endpoint->id, 'project_id' => $this->project->id,
        'received_at' => $this->event->received_at,
    ]);
    $ids = WebhookEvent::where('project_id', $this->project->id)->orderByDesc('received_at')->orderByDesc('id')->pluck('id');
    $this->actingAs($this->user)->get('/events')->assertInertia(fn ($page) => $page
        ->component('events/index')->has('events.data', 25)->where('events.total', 27)
        ->where('events.data.0.id', $ids[0])->where('events.data.24.id', $ids[24])
        ->where('events.data.0.project.id', $this->project->id)->where('events.data.0.endpoint.mode', 'capture')
        ->missing('events.data.0.payload')->missing('events.data.0.raw_body')->missing('events.data.0.headers')
        ->missing('events.data.0.endpoint.signing_secret')->has('projects', 1)->has('endpoints', 1)
        ->where('filters.project', '')->where('selectedEvent', null));
});

test('selection retains exact raw body endpoint mode and ordered deliveries', function () {
    WebhookDelivery::factory()->for($this->event, 'event')->create(['attempt_number' => 1]);
    WebhookDelivery::factory()->for($this->event, 'event')->create(['attempt_number' => 2]);
    $this->actingAs($this->user)->get('/events?event='.$this->event->id)->assertInertia(fn ($page) => $page
        ->component('events/index')->where('selectedEvent.event.id', $this->event->id)
        ->where('selectedEvent.event.raw_body', '{"z":1,"a":2}')
        ->where('selectedEvent.event.webhookEndpoint.mode', 'capture')
        ->missing('selectedEvent.event.webhookEndpoint.signing_secret')->missing('selectedEvent.event.webhookEndpoint.provider_secret')
        ->where('selectedEvent.deliveries.0.attempt_number', 2)->where('selectedEvent.deliveries.1.attempt_number', 1));
});

test('selection is scoped to the visible filters and owner', function () {
    $foreign = WebhookEvent::factory()->create();
    $this->actingAs($this->user)->get('/events?event='.$foreign->id)
        ->assertInertia(fn ($page) => $page->where('selectedEvent', null));
    $this->get('/events?status=failed&event='.$this->event->id)
        ->assertInertia(fn ($page) => $page->where('selectedEvent', null)->has('events.data', 0));
});

test('legacy event links redirect to the canonical page after ownership checks', function () {
    $this->actingAs($this->user)->get('/events/'.$this->event->id)
        ->assertRedirect(route('webhook-events.index', ['event' => $this->event->id]));
    $this->get('/webhook-endpoints/'.$this->endpoint->id.'?event='.$this->event->id)
        ->assertRedirect(route('webhook-events.index', ['endpoint' => $this->endpoint->id, 'event' => $this->event->id]));
    $this->get('/projects/'.$this->project->id.'?tab=events&event='.$this->event->id)
        ->assertRedirect(route('webhook-events.index', ['project' => $this->project->id, 'event' => $this->event->id]));
    $this->get('/projects/'.$this->project->id.'?event='.$this->event->id)
        ->assertRedirect(route('webhook-events.index', ['project' => $this->project->id, 'event' => $this->event->id]));
    $foreign = WebhookEvent::factory()->create();
    $this->get('/events/'.$foreign->id)->assertNotFound();
});

test('project and endpoint pages no longer include event list or selection props', function () {
    $this->actingAs($this->user)->get('/projects/'.$this->project->id)
        ->assertInertia(fn ($page) => $page->missing('events')->missing('selectedEvent'));
    $this->get('/webhook-endpoints/'.$this->endpoint->id)
        ->assertInertia(fn ($page) => $page->missing('events')->missing('selectedEvent'));
});

test('foreign filters and incompatible project endpoint combinations return not found', function () {
    $foreign = WebhookEndpoint::factory()->create();
    $otherProject = Project::factory()->for($this->user)->create();
    $this->actingAs($this->user)->get('/events?project='.$foreign->project_id)->assertNotFound();
    $this->get('/events/export?endpoint='.$foreign->id)->assertNotFound();
    $this->get('/events?project='.$otherProject->id.'&endpoint='.$this->endpoint->id)->assertNotFound();
});

test('invalid event filters fail validation', function (array $filters, string $field) {
    $this->actingAs($this->user)->getJson('/events?'.http_build_query($filters))
        ->assertUnprocessable()->assertJsonValidationErrors($field);
    $this->getJson('/events/export?'.http_build_query($filters))
        ->assertUnprocessable()->assertJsonValidationErrors($field);
})->with([
    [['project' => 'invalid'], 'project'],
    [['endpoint' => 'invalid'], 'endpoint'],
    [['status' => 'invalid'], 'status'],
    [['event' => 'invalid'], 'event'],
    [['from' => 'invalid'], 'from'],
    [['from' => '2026-10-07T00:00:00.000T+07:00'], 'from'],
    [['from' => '2026-10-08T00:00:00+07:00', 'to' => '2026-10-07T00:00:00+07:00'], 'to'],
]);

test('list and export share inclusive UTC bounds status and project filters', function () {
    $this->event->update(['received_at' => '2026-10-06 17:00:00', 'status' => 'success']);
    WebhookEvent::factory()->count(26)->create([
        'webhook_endpoint_id' => $this->endpoint->id, 'project_id' => $this->project->id,
        'received_at' => '2026-10-07 16:59:59', 'status' => 'success',
    ]);
    foreach (['2026-10-06 16:59:59', '2026-10-07 17:00:00'] as $received) {
        WebhookEvent::factory()->create([
            'webhook_endpoint_id' => $this->endpoint->id, 'project_id' => $this->project->id,
            'received_at' => $received, 'status' => 'success',
        ]);
    }
    WebhookEvent::factory()->create([
        'webhook_endpoint_id' => $this->endpoint->id, 'project_id' => $this->project->id,
        'received_at' => '2026-10-07 10:00:00', 'status' => 'failed',
    ]);
    WebhookEvent::factory()->create(['received_at' => '2026-10-07 10:00:00', 'status' => 'success']);
    $otherEndpoint = WebhookEndpoint::factory()->for($this->project)->create();
    WebhookEvent::factory()->create([
        'webhook_endpoint_id' => $otherEndpoint->id, 'project_id' => $this->project->id,
        'received_at' => '2026-10-07 10:00:00', 'status' => 'success',
    ]);
    $otherProject = Project::factory()->for($this->user)->create();
    $otherProjectEndpoint = WebhookEndpoint::factory()->for($otherProject)->create();
    WebhookEvent::factory()->create([
        'webhook_endpoint_id' => $otherProjectEndpoint->id, 'project_id' => $otherProject->id,
        'received_at' => '2026-10-07 10:00:00', 'status' => 'success',
    ]);
    $query = http_build_query([
        'project' => $this->project->id, 'endpoint' => $this->endpoint->id, 'status' => 'success',
        'from' => '2026-10-07T00:00:00+07:00', 'to' => '2026-10-07T23:59:59+07:00',
    ]);
    $this->actingAs($this->user)->get('/events?'.$query)
        ->assertInertia(fn ($page) => $page->has('events.data', 25)->where('events.total', 27));
    $response = $this->get('/events/export?'.$query.'&page=2')->assertOk();
    $export = json_decode($response->streamedContent(), true, flags: JSON_THROW_ON_ERROR);
    expect($export)->toHaveCount(27);
    expect(array_column($export, 'id'))->toContain($this->event->id);
    expect($export[0])->toHaveKeys(['project', 'endpoint', 'payload', 'headers'])->not->toHaveKey('raw_body');
    $this->assertDatabaseHas('audit_logs', ['project_id' => $this->project->id, 'action' => 'events.exported']);
});

test('upper bound alone works and empty endpoint downloads are audited for that project', function () {
    $this->event->update(['received_at' => '2026-10-07 17:00:00']);
    $query = http_build_query(['endpoint' => $this->endpoint->id, 'to' => '2026-10-07T23:59:59+07:00']);
    $this->actingAs($this->user)->get('/events?'.$query)
        ->assertInertia(fn ($page) => $page->has('events.data', 0));
    $response = $this->get('/events/export?'.$query)->assertOk();
    expect(json_decode($response->streamedContent(), true, flags: JSON_THROW_ON_ERROR))->toBe([]);
    $this->assertDatabaseHas('audit_logs', ['project_id' => $this->project->id, 'action' => 'events.exported']);
});

test('unfiltered exports include every owned project with one audit entry each', function () {
    $project = Project::factory()->for($this->user)->create();
    $endpoint = WebhookEndpoint::factory()->for($project)->create();
    $event = WebhookEvent::factory()->create(['project_id' => $project->id, 'webhook_endpoint_id' => $endpoint->id]);
    $foreign = WebhookEvent::factory()->create();
    $response = $this->actingAs($this->user)->get('/events/export')->assertOk();
    $export = json_decode($response->streamedContent(), true, flags: JSON_THROW_ON_ERROR);
    expect($export)->toHaveCount(2);
    expect(array_column($export, 'id'))->toContain($event->id, $this->event->id)->not->toContain($foreign->id);
    $this->assertDatabaseHas('audit_logs', ['project_id' => $this->project->id, 'action' => 'events.exported']);
    $this->assertDatabaseHas('audit_logs', ['project_id' => $project->id, 'action' => 'events.exported']);
    $this->assertDatabaseCount('audit_logs', 2);
});

test('export has no shared throttle with regular page views', function () {
    $this->actingAs($this->user);
    for ($i = 0; $i < 25; $i++) {
        $this->get('/dashboard')->assertOk();
    }
    $this->get('/events/export')->assertOk();
});

test('exports do not duplicate or skip records when a newer webhook arrives during iteration', function () {
    WebhookEvent::factory()->count(501)->create([
        'webhook_endpoint_id' => $this->endpoint->id,
        'project_id' => $this->project->id,
        'received_at' => $this->event->received_at,
    ]);
    $expectedIds = WebhookEvent::where('project_id', $this->project->id)
        ->orderByDesc('received_at')->orderByDesc('id')->pluck('id')->all();
    $browser = app(EventBrowserService::class);
    $query = $browser->query($this->user, ['project' => '', 'endpoint' => '', 'status' => '', 'from' => '', 'to' => '']);
    $selects = 0;
    DB::listen(function (QueryExecuted $query) use (&$selects) {
        if (str_starts_with(strtolower($query->sql), 'select')) {
            $selects++;
        }
    });
    $exportedIds = [];
    foreach ($browser->exportQuery($query)->cursor() as $event) {
        $row = $browser->exportRow($event);
        $exportedIds[] = $row['id'];
        expect($row['endpoint'])->not->toHaveKeys(['signing_secret', 'provider_secret']);
        expect($row)->not->toHaveKey('raw_body');

        if (count($exportedIds) === 500) {
            // This insertion shifts every offset in the former batched query.
            WebhookEvent::factory()->create([
                'webhook_endpoint_id' => $this->endpoint->id,
                'project_id' => $this->project->id,
                'received_at' => $this->event->received_at->copy()->addMinute(),
            ]);
        }
    }

    expect($exportedIds)->toBe($expectedIds);
    expect($selects)->toBe(1);
});

test('pagination links retain filters without stale selection query parameters', function () {
    WebhookEvent::factory()->count(25)->create([
        'webhook_endpoint_id' => $this->endpoint->id,
        'project_id' => $this->project->id,
    ]);
    $this->actingAs($this->user)->get('/events?project='.$this->project->id.'&event='.$this->event->id)
        ->assertInertia(fn ($page) => $page->where('events.next_page_url', function ($url) {
            parse_str(parse_url($url, PHP_URL_QUERY), $parameters);

            return ($parameters['project'] ?? null) === $this->project->id
                && ($parameters['page'] ?? null) === '2'
                && ! array_key_exists('event', $parameters);
        }));
});
