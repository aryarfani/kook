import {
    Activity01Icon,
    AlertCircleIcon,
    Folder02Icon,
    PlugSocketIcon,
} from '@hugeicons/core-free-icons';
import { Head, Link } from '@inertiajs/react';
import { PageHeader } from '@/components/dashboard/page-header';
import { StatCard } from '@/components/dashboard/stat-card';
import { Button } from '@/components/ui/button';
import { dashboard } from '@/routes';

type DashboardStats = {
    projects: number;
    webhookEndpoints: number;
    eventsLast24h: number;
    failedEventsLast24h: number;
};

export default function Dashboard({ stats }: { stats: DashboardStats }) {
    return (
        <>
            <Head title="Dashboard" />
            <div className="flex h-full flex-1 flex-col gap-6 p-4 md:p-6">
                <PageHeader
                    eyebrow="Overview"
                    title="Dashboard"
                    description="A snapshot of every project you're running through Kook."
                />

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                        icon={Folder02Icon}
                        label="Projects"
                        value={stats.projects}
                    />
                    <StatCard
                        icon={PlugSocketIcon}
                        label="Webhook endpoints"
                        value={stats.webhookEndpoints}
                    />
                    <StatCard
                        icon={Activity01Icon}
                        label="Events, last 24h"
                        value={stats.eventsLast24h}
                    />
                    <StatCard
                        icon={AlertCircleIcon}
                        label="Failed, last 24h"
                        value={stats.failedEventsLast24h}
                    />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
                    <p className="text-sm text-muted-foreground">
                        Browse received events and inspect their payloads in
                        Events.
                    </p>
                    <Button variant="outline" asChild>
                        <Link href="/events">View events</Link>
                    </Button>
                </div>
            </div>
        </>
    );
}

Dashboard.layout = {
    breadcrumbs: [
        {
            title: 'Dashboard',
            href: dashboard(),
        },
    ],
};
