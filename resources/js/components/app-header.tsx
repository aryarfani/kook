import { Link, usePage } from '@inertiajs/react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { ThemeToggle } from '@/components/theme-toggle';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserMenuContent } from '@/components/user-menu-content';
import { useInitials } from '@/hooks/use-initials';
import { cn } from '@/lib/utils';
import type { BreadcrumbItem } from '@/types';

const navigation = [
    ['Dashboard', '/dashboard'],
    ['Events', '/events'],
    ['Projects', '/projects'],
    ['Providers', '/providers'],
    ['Audit logs', '/audit-logs'],
    ['Settings', '/settings'],
];

export function AppHeader({
    breadcrumbs = [],
}: {
    breadcrumbs?: BreadcrumbItem[];
}) {
    const {
        props: { auth },
        url,
    } = usePage();
    const initials = useInitials();
    const pathname = url.split('?')[0];

    return (
        <header className="shrink-0 border-b border-border bg-background">
            <div className="flex h-14 items-center gap-6 px-4 lg:px-6">
                <Link
                    href="/dashboard"
                    className="flex shrink-0 items-center gap-2.5 font-bold"
                >
                    <img
                        src="/branding/favicon.png"
                        alt=""
                        className="size-7"
                    />
                    Kook
                </Link>
                <nav
                    aria-label="Main navigation"
                    className="flex h-full min-w-0 flex-1 items-center gap-5 overflow-x-auto text-sm"
                >
                    {navigation.map(([title, href]) => (
                        <Link
                            key={href}
                            href={href}
                            aria-current={
                                pathname === href ||
                                pathname.startsWith(`${href}/`)
                                    ? 'page'
                                    : undefined
                            }
                            className={cn(
                                'flex h-full shrink-0 items-center border-b-2 border-transparent text-muted-foreground hover:text-foreground',
                                (pathname === href ||
                                    pathname.startsWith(`${href}/`)) &&
                                    'border-signal text-signal',
                            )}
                        >
                            {title}
                        </Link>
                    ))}
                </nav>
                <div className="flex shrink-0 items-center gap-2">
                    <ThemeToggle />
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label="User menu"
                            >
                                <Avatar className="size-8">
                                    <AvatarImage
                                        src={auth.user?.avatar}
                                        alt={auth.user?.name}
                                    />
                                    <AvatarFallback>
                                        {initials(auth.user?.name ?? '')}
                                    </AvatarFallback>
                                </Avatar>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            {auth.user && <UserMenuContent user={auth.user} />}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
            {breadcrumbs.length > 1 && (
                <div className="border-t border-border px-6 py-2 text-sm">
                    <Breadcrumbs breadcrumbs={breadcrumbs} />
                </div>
            )}
        </header>
    );
}
