<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    // CREATE INDEX CONCURRENTLY cannot run inside a transaction.
    public $withinTransaction = false;

    public function up(): void
    {
        DB::statement('CREATE EXTENSION IF NOT EXISTS pg_trgm');

        // Payload search matches a literal substring of the parsed JSON.
        // Without a matching index each page load scans every stored payload.
        DB::statement(<<<'SQL'
            CREATE INDEX CONCURRENTLY IF NOT EXISTS webhook_events_payload_trgm_index
            ON webhook_events USING gin (lower(cast(payload as text)) gin_trgm_ops)
        SQL);
    }

    public function down(): void
    {
        DB::statement('DROP INDEX CONCURRENTLY IF EXISTS webhook_events_payload_trgm_index');
    }
};
