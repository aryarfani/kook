<?php

use App\Enums\WebhookDeliveryStatus;
use App\Enums\WebhookEventStatus;
use App\Exceptions\WebhookDeliveryFailedException;
use App\Jobs\ForwardWebhookDeliveryJob;
use App\Mail\WebhookDeliveryFailedMail;
use App\Models\AuditLog;
use App\Models\Project;
use App\Models\User;
use App\Models\WebhookDelivery;
use App\Models\WebhookEndpoint;
use App\Models\WebhookEvent;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;

function retryEndpoint(): WebhookEndpoint
{
    return WebhookEndpoint::factory()
        ->withDestinationUrls(['https://example.com/hooks'])
        ->create();
}

function retryEvent(WebhookEndpoint $endpoint): WebhookEvent
{
    return WebhookEvent::factory()->create([
        'webhook_endpoint_id' => $endpoint->id,
        'project_id' => $endpoint->project_id,
        'status' => WebhookEventStatus::Success,
    ]);
}

test('the job is configured with the documented retry and backoff schedule', function () {
    $job = new ForwardWebhookDeliveryJob('irrelevant', 'irrelevant');

    expect($job->tries)->toBe(6);
    expect($job->backoff())->toBe([30, 120, 600, 1800, 3600]);
});

test('a failed non-final delivery attempt is recorded as retrying', function () {
    Http::fake(['example.com/*' => Http::response('server error', 500)]);

    $endpoint = retryEndpoint();
    $event = retryEvent($endpoint);

    $job = new ForwardWebhookDeliveryJob($event->id, $endpoint->destinations[0]->id);

    expect(fn () => app()->call([$job, 'handle']))
        ->toThrow(WebhookDeliveryFailedException::class);

    $delivery = WebhookDelivery::first();
    expect($delivery)
        ->attempt_number->toBe(1)
        ->status->toBe(WebhookDeliveryStatus::Retrying)
        ->http_status_code->toBe(500);
    expect($delivery->next_retry_at)->not->toBeNull();
});

test('a delivery row records the destination it went to', function () {
    Http::fake(['example.com/*' => Http::response('ok', 200)]);

    $endpoint = retryEndpoint();
    $event = retryEvent($endpoint);

    $job = new ForwardWebhookDeliveryJob($event->id, $endpoint->destinations[0]->id);
    app()->call([$job, 'handle']);

    expect(WebhookDelivery::first()->destination_id)->toBe($endpoint->destinations[0]->id);
});

test('the final delivery attempt is marked failed without scheduling another retry', function () {
    Http::fake(['example.com/*' => Http::response('server error', 500)]);

    $endpoint = retryEndpoint();
    $event = retryEvent($endpoint);

    $job = new ForwardWebhookDeliveryJob($event->id, $endpoint->destinations[0]->id);
    $job->tries = 1;

    expect(fn () => app()->call([$job, 'handle']))
        ->toThrow(WebhookDeliveryFailedException::class);

    $delivery = WebhookDelivery::first();
    expect($delivery)
        ->status->toBe(WebhookDeliveryStatus::Failed)
        ->next_retry_at->toBeNull();
});

test('a job whose destination was removed from the endpoint does nothing', function () {
    Http::fake(['example.com/*' => Http::response('ok', 200)]);

    $endpoint = retryEndpoint();
    $event = retryEvent($endpoint);

    $removedDestinationId = $endpoint->destinations[0]->id;
    $endpoint->destinations[0]->delete();

    $job = new ForwardWebhookDeliveryJob($event->id, $removedDestinationId);
    app()->call([$job, 'handle']);

    Http::assertNothingSent();
    expect(WebhookDelivery::count())->toBe(0);
});

test('exhausting all retries writes an audit log via the failed hook', function () {
    $endpoint = retryEndpoint();
    $event = retryEvent($endpoint);

    $job = new ForwardWebhookDeliveryJob($event->id, 'irrelevant');
    $job->failed(new WebhookDeliveryFailedException('destination unreachable'));

    $log = AuditLog::where('action', 'webhook_delivery.exhausted')->first();

    expect($log)
        ->not->toBeNull()
        ->project_id->toBe($endpoint->project_id)
        ->auditable_id->toBe($event->id);
});

test('exhausting all retries emails the project owner when failure emails are enabled', function () {
    Mail::fake();

    $user = User::factory()->create(['email' => 'owner@example.com']);
    $project = Project::factory()->for($user)->create(['failure_emails_enabled' => true]);
    $endpoint = WebhookEndpoint::factory()
        ->withDestinationUrls(['https://example.com/hooks'])
        ->for($project)
        ->create(['name' => 'Payments hook']);
    $event = WebhookEvent::factory()->create([
        'webhook_endpoint_id' => $endpoint->id,
        'project_id' => $project->id,
        'event_name' => 'payment.succeeded',
    ]);

    $job = new ForwardWebhookDeliveryJob($event->id, $endpoint->destinations[0]->id);
    $job->failed(new WebhookDeliveryFailedException('destination unreachable'));

    Mail::assertQueued(
        WebhookDeliveryFailedMail::class,
        fn (WebhookDeliveryFailedMail $mail) => $mail->hasTo('owner@example.com')
            && $mail->endpointName === 'Payments hook'
            && $mail->destinationUrl === 'https://example.com/hooks'
            && $mail->eventName === 'payment.succeeded'
    );
});

test('exhausting all retries does not email when the project has disabled failure emails', function () {
    Mail::fake();

    $user = User::factory()->create(['email' => 'owner@example.com']);
    $project = Project::factory()->for($user)->create(['failure_emails_enabled' => false]);
    $endpoint = WebhookEndpoint::factory()->for($project)->create();
    $event = WebhookEvent::factory()->create([
        'webhook_endpoint_id' => $endpoint->id,
        'project_id' => $project->id,
    ]);

    $job = new ForwardWebhookDeliveryJob($event->id, 'irrelevant');
    $job->failed(new WebhookDeliveryFailedException('destination unreachable'));

    Mail::assertNothingQueued();
});

test('exhausting all retries does not email when the project owner has no email set', function () {
    Mail::fake();

    $user = User::factory()->create(['email' => '']);
    $project = Project::factory()->for($user)->create(['failure_emails_enabled' => true]);
    $endpoint = WebhookEndpoint::factory()->for($project)->create();
    $event = WebhookEvent::factory()->create([
        'webhook_endpoint_id' => $endpoint->id,
        'project_id' => $project->id,
    ]);

    $job = new ForwardWebhookDeliveryJob($event->id, 'irrelevant');
    $job->failed(new WebhookDeliveryFailedException('destination unreachable'));

    Mail::assertNothingQueued();
});

test('the automatic retry chain stands down once the event was delivered to the same destination', function () {
    Http::fake(['example.com/*' => Http::response('ok', 200)]);

    $endpoint = retryEndpoint();
    $event = retryEvent($endpoint);
    $destination = $endpoint->destinations[0];

    // A manual replay already delivered this event to this destination while
    // the retry was pending.
    WebhookDelivery::factory()->for($event, 'event')->create([
        'destination_id' => $destination->id,
        'attempt_number' => 2,
        'status' => WebhookDeliveryStatus::Delivered,
        'http_status_code' => 200,
    ]);

    $job = new ForwardWebhookDeliveryJob($event->id, $destination->id);
    app()->call([$job, 'handle']);

    Http::assertNothingSent();
    expect(WebhookDelivery::where('event_id', $event->id)->count())->toBe(1);
});

test('a delivery to one destination does not stand down delivery to another', function () {
    Http::fake(['example.com/*' => Http::response('ok', 200)]);

    $endpoint = WebhookEndpoint::factory()
        ->withDestinationUrls(['https://example.com/hooks', 'https://example.com/mirror'])
        ->create();
    $event = retryEvent($endpoint);
    [$first, $second] = $endpoint->destinations;

    // The first destination was already delivered to by its own job.
    WebhookDelivery::factory()->for($event, 'event')->create([
        'destination_id' => $first->id,
        'attempt_number' => 1,
        'status' => WebhookDeliveryStatus::Delivered,
        'http_status_code' => 200,
    ]);

    $job = new ForwardWebhookDeliveryJob($event->id, $second->id);
    app()->call([$job, 'handle']);

    Http::assertSentCount(1);
    expect(WebhookDelivery::where('event_id', $event->id)->where('destination_id', $second->id)->count())->toBe(1);
});

test('an explicit replay still forwards even when the event was already delivered', function () {
    Http::fake(['example.com/*' => Http::response('ok', 200)]);

    $endpoint = retryEndpoint();
    $event = retryEvent($endpoint);
    $destination = $endpoint->destinations[0];

    WebhookDelivery::factory()->for($event, 'event')->create([
        'destination_id' => $destination->id,
        'attempt_number' => 1,
        'status' => WebhookDeliveryStatus::Delivered,
        'http_status_code' => 200,
    ]);

    // attemptOffset > 0 marks this as a user-triggered replay.
    $job = new ForwardWebhookDeliveryJob($event->id, $destination->id, 1);
    app()->call([$job, 'handle']);

    Http::assertSentCount(1);
    expect(WebhookDelivery::where('event_id', $event->id)->count())->toBe(2);
});

test('a successful delivery does not throw and requires no retry', function () {
    Http::fake(['example.com/*' => Http::response('ok', 200)]);

    $endpoint = retryEndpoint();
    $event = retryEvent($endpoint);

    $job = new ForwardWebhookDeliveryJob($event->id, $endpoint->destinations[0]->id);

    app()->call([$job, 'handle']);

    $delivery = WebhookDelivery::first();
    expect($delivery)
        ->status->toBe(WebhookDeliveryStatus::Delivered)
        ->next_retry_at->toBeNull();
    expect($delivery->delivered_at)->not->toBeNull();
});
