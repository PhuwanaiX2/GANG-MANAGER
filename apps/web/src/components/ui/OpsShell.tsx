import type { ReactNode } from 'react';
import type { MouseEventHandler } from 'react';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/cn';

export type OpsTone = 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const friendlyLabels: Record<string, string> = {
    'Attendance Ops': 'เช็คชื่อ',
    'Leave Desk': 'คำขอลา',
    'Roster Command': 'สมาชิก',
    'Operations Insight': 'สถิติ',
    'Setup Hub': 'ตั้งค่า',
    Billing: 'แพลนและการชำระเงิน',
    'Finance Control': 'การเงิน',
    'Command Center': 'ภาพรวม',
    'Command Selector': 'เลือกแก๊ง',
};

function getFriendlyLabel(value: string) {
    return friendlyLabels[value] || value;
}

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
    const label = getFriendlyLabel(eyebrow);

    return (
        <section className={cn(
            'ops-surface relative overflow-hidden rounded-token-xl border border-border-subtle bg-bg-subtle shadow-token-xs',
            compact ? 'p-3.5 sm:p-4' : 'p-4 sm:p-5'
        )}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                    <div className={cn('mb-3 inline-flex items-center gap-2 rounded-token-full border px-3 py-1 text-xs font-bold tracking-normal', styles.badge)}>
                        <span className="h-1.5 w-1.5 rounded-token-full bg-current" />
                        {label}
                    </div>
                    <div className="flex min-w-0 items-start gap-3">
                        {Icon ? (
                            <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-token-xl border shadow-token-xs', styles.icon)}>
                                <Icon className="h-[18px] w-[18px]" />
                            </div>
                        ) : null}
                        <div className="min-w-0">
                            <h1 className="truncate font-heading text-xl font-black tracking-tight text-fg-primary sm:text-2xl">
                                {title}
                            </h1>
                            {description ? (
                                <p className="mt-1.5 max-w-2xl text-[13px] leading-6 text-fg-secondary sm:text-sm">
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
    const displayLabel = getFriendlyLabel(label);
    const content = (
        <div className={cn('group min-w-0 rounded-token-xl border border-border-subtle border-l-2 bg-bg-subtle p-3.5 shadow-token-xs transition-[border-color,box-shadow] hover:border-border hover:shadow-token-sm', styles.border)}>
            <div className="mb-3 flex items-center justify-between gap-3">
                <p className="truncate text-xs font-bold tracking-normal text-fg-tertiary">{displayLabel}</p>
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

export interface OpsSubNavItem {
    id: string;
    label: string;
    href: string;
    description?: string;
    badge?: ReactNode;
    icon?: LucideIcon;
    active?: boolean;
    pending?: boolean;
    disabled?: boolean;
    tone?: OpsTone;
    onClick?: MouseEventHandler<HTMLAnchorElement>;
}

interface OpsSubNavProps {
    items: OpsSubNavItem[];
    ariaLabel: string;
    className?: string;
}

export function OpsSubNav({ items, ariaLabel, className }: OpsSubNavProps) {
    return (
        <nav
            className={cn('rounded-token-xl border border-border-subtle bg-bg-subtle p-1.5 shadow-token-xs', className)}
            aria-label={ariaLabel}
        >
            <div className="flex gap-1.5 overflow-x-auto md:grid md:auto-cols-fr md:grid-flow-col md:overflow-visible">
                {items.map((item) => {
                    const Icon = item.icon;
                    const tone = toneStyles[item.tone || 'neutral'];
                    const isActive = Boolean(item.active);

                    return (
                        <Link
                            key={item.id}
                            href={item.href}
                            aria-current={isActive ? 'page' : undefined}
                            aria-disabled={item.disabled || undefined}
                            onClick={item.disabled ? (event) => event.preventDefault() : item.onClick}
                            className={cn(
                                'group relative min-h-11 min-w-[156px] rounded-token-lg border px-3 py-2 text-left transition-[background-color,border-color,color,box-shadow,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:min-w-0',
                                isActive
                                    ? cn('bg-bg-elevated text-fg-primary shadow-token-sm ring-1', tone.badge)
                                    : 'border-border-subtle bg-bg-muted/55 text-fg-secondary hover:-translate-y-0.5 hover:bg-bg-elevated hover:text-fg-primary',
                                item.disabled && 'pointer-events-none opacity-50'
                            )}
                        >
                            <div className="flex min-w-0 items-center gap-2">
                                {Icon ? (
                                    <Icon className={cn('h-4 w-4 shrink-0', isActive ? tone.value : 'text-fg-tertiary group-hover:text-fg-secondary')} />
                                ) : null}
                                <span className="truncate text-sm font-black tracking-tight">{item.label}</span>
                                {item.badge ? (
                                    <span className="ml-auto shrink-0 rounded-token-full border border-border-subtle bg-bg-subtle px-2 py-0.5 text-[10px] font-black text-fg-tertiary">
                                        {item.badge}
                                    </span>
                                ) : null}
                                {item.pending ? (
                                    <span className="ml-auto h-3.5 w-3.5 shrink-0 animate-spin rounded-token-full border-2 border-border-subtle border-t-accent" />
                                ) : null}
                            </div>
                            {item.description ? (
                                <p className="mt-1 line-clamp-1 text-xs leading-5 text-fg-tertiary md:line-clamp-2">
                                    {item.description}
                                </p>
                            ) : null}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
