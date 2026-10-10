<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('webhook_endpoint_destinations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('webhook_endpoint_id')->constrained('webhook_endpoints')->cascadeOnDelete();
            $table->string('url');
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['webhook_endpoint_id', 'sort_order']);
        });

        // Carry each endpoint's single destination into the new table before
        // the old column goes away.
        DB::statement(<<<'SQL'
            INSERT INTO webhook_endpoint_destinations (id, webhook_endpoint_id, url, sort_order, created_at, updated_at)
            SELECT gen_random_uuid(), id, destination_url, 0, now(), now()
            FROM webhook_endpoints
            WHERE destination_url IS NOT NULL
        SQL);

        Schema::table('webhook_deliveries', function (Blueprint $table) {
            // Nullable: rows written before fan-out do not record where they went.
            $table->foreignUuid('destination_id')
                ->nullable()
                ->after('event_id')
                ->constrained('webhook_endpoint_destinations')
                ->cascadeOnDelete();
        });

        Schema::table('webhook_deliveries', function (Blueprint $table) {
            $table->index(['event_id', 'destination_id']);
        });

        Schema::table('webhook_endpoints', function (Blueprint $table) {
            $table->dropColumn('destination_url');
        });
    }

    public function down(): void
    {
        Schema::table('webhook_endpoints', function (Blueprint $table) {
            $table->string('destination_url')->nullable();
        });

        // Restore the earliest destination per endpoint, matching the single
        // destination world this migration came from.
        DB::statement(<<<'SQL'
            UPDATE webhook_endpoints
            SET destination_url = (
                SELECT url
                FROM webhook_endpoint_destinations d
                WHERE d.webhook_endpoint_id = webhook_endpoints.id
                ORDER BY d.sort_order ASC, d.created_at ASC
                LIMIT 1
            )
        SQL);

        Schema::table('webhook_deliveries', function (Blueprint $table) {
            $table->dropConstrainedForeignId('destination_id');
        });

        Schema::dropIfExists('webhook_endpoint_destinations');
    }
};
