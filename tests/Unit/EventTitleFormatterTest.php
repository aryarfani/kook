<?php

use App\Services\Webhooks\EventTitleFormatter;

test('title formats traverse arrays without mutating the payload', function () {
    $formatter = new EventTitleFormatter;
    $payload = ['entry' => [['changes' => [['field' => 'messages']]]], 'zero' => 0, 'flag' => false];
    expect($formatter->format('{{entry.0.changes.0.field}}', $payload, null))->toBe('messages');
    expect($formatter->format('{{zero}}/{{flag}}', $payload, null))->toBe('0/false');
    expect($formatter->format('0', $payload, null))->toBe('0');
    expect($formatter->format('{{missing}}', $payload, 'original'))->toBe('original');
    expect($formatter->format('{{entry}}', $payload, null))->toBe('Unnamed event');
    expect($formatter->valid('{{entry[0]}}'))->toBeFalse();
    expect($formatter->valid('{{constructor}}'))->toBeFalse();
    expect($formatter->valid('{{object'))->toBeFalse();
});
