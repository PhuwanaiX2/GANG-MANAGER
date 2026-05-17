import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/cn';

type OpsTone = 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const toneStyles: Record<OpsTone, { badge: string; icon: string; border: string; value: string }> = {
    accent: {
        badge: 'border-border-accent bg-accent-subtle text-accent-bright',
        icon: 'border-border-accent bg-accent-subtle text-accent-bright',
        border: 'border-l-accent',
        value: 'text-fg-primary',
    },
    success: {
        badge: 'border-status-success bg-status-success-subtle text-fg-success',
        icon: 'border-status-success bg-status-success-subtle text-fg-success',
        border: 'border-l-status-success',
        value: 'text-fg-success',
    },
    warning: {
        badge: 'border-status-warning bg-status-warning-subtle text-fg-warning',
        icon: 'border-status-warning bg-status-warning-subtle text-fg-warning',
        border: 'border-l-status-warning',
        value: 'text-fg-warning',
    },
    danger: {
        badge: 'border-status-danger bg-status-danger-subtle text-fg-danger',
        icon: 'border-status-danger bg-status-danger-subtle text-fg-danger',
        border: 'border-l-status-danger',
        value: 'text-fg-danger',
    },
    info: {
        badge: 'border-status-info bg-status-info-subtle text-fg-info',
        icon: 'border-status-info bg-status-info-subtle text-fg-info',
        border: 'border-l-status-info',
        value: 'text-fg-info',
    },
    neutral: {
        badge: 'border-border-subtle bg-bg-muted text-fg-secondary',
        icon: 'border-border-subtle bg-bg-muted text-fg-secondary',
        border: 'border-l-border',
        value: 'text-fg-primary',
    },
};

interface OpsPageHeaderProps {
    eyebrow: string;
    title: string;
    description?: string;
    icon?: LucideIcon;
    tone?: OpsTone;
    actions?: ReactNode;
    meta?: ReactNode;
    compact?: boolean;
}

export function OpsPageHeader({
    eyebrow,
    title,
    description,
    icon: Icon,
    tone = 'accent',
    actions,
    meta,
    compact = false,
}: OpsPageHeaderProps) {
    const styles = toneStyles[tone];

    return (
        <section className={cn(
            'ops-surface relative overflow-hidden rounded-token-xl border border-border-subtle bg-bg-subtle shadow-token-sm',
            compact ? 'p-3 sm:p-4' : 'p-4 sm:p-5'
        )}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0">
                    <div className={cn('mb-3 inline-flex items-center gap-2 rounded-token-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em]', styles.badge)}>
                        <span className="h-1.5 w-1.5 rounded-token-full bg-current" />
                        {eyebrow}
                    </div>
                    <div className="flex min-w-0 items-start gap-3">
                        {Icon ? (
                            <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-token-lg border shadow-token-xs sm:h-11 sm:w-11', styles.icon)}>
                                <Icon className="h-5 w-5" />
                            </div>
                        ) : null}
                        <div className="min-w-0">
                            <h1 className="truncate font-heading text-2xl font-black tracking-tight text-fg-primary sm:text-3xl">
                                {title}
                            </h1>
                            {description ? (
                                <p className="mt-1.5 max-w-3xl text-sm leading-6 text-fg-secondary">
                                    {description}
                                </p>
                            ) : null}
                            {meta ? <div className="mt-3 flex flex-wrap gap-2">{meta}</div> : null}
                        </div>
                    </div>
                </div>
                {actions ? (
                    <div className="grid gap-2 sm:flex sm:items-center sm:justify-end lg:shrink-0">
                        {actions}
                    </div>
                ) : null}
            </div>
        </section>
    );
}

interface OpsMetricCardProps {
    label: string;
    value: ReactNode;
    helper?: ReactNode;
    icon?: LucideIcon;
    tone?: OpsTone;
    href?: string;
}

export function OpsMetricCard({ label, value, helper, icon: Icon, tone = 'neutral', href }: OpsMetricCardProps) {
    const styles = toneStyles[tone];
    const content = (
        <div className={cn('group min-w-0 rounded-token-xl border border-border-subtle border-l-2 bg-bg-subtle p-3 shadow-token-sm transition-[border-color,box-shadow,transform] hover:border-border hover:shadow-token-md', styles.border, href && 'hover:-translate-y-px')}>
            <div className="mb-3 flex items-center justify-between gap-3">
                <p className="truncate text-[11px] font-black uppercase tracking-[0.15em] text-fg-tertiary">{label}</p>
                {Icon ? (
                    <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-token-lg border', styles.icon)}>
                        <Icon className="h-4 w-4" />
                    </div>
                ) : null}
            </div>
            <div className={cn('font-heading text-2xl font-black tracking-tight tabular-nums', styles.value)}>
                {value}
            </div>
            {helper ? <div className="mt-1 text-xs font-semibold leading-5 text-fg-tertiary">{helper}</div> : null}
        </div>
    );

    if (!href) return content;

    return (
        <Link href={href} className="block min-w-0">
            {content}
        </Link>
    );
}
