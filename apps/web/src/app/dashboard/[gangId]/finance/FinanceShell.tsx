import Link from 'next/link';
import type { ReactNode } from 'react';
import {
    AlertTriangle,
    Banknote,
    Clock,
    Lock,
    Wallet,
    Zap,
} from 'lucide-react';
import { FeatureDisabledBanner } from '@/components/FeatureDisabledBanner';
import { PAYMENT_PAUSED_COPY } from '@/lib/paymentReadiness';
import { FinanceClient } from './FinanceClient';
import { FinanceTabs } from './FinanceTabs';
import type { FinanceContext } from './FinanceData';

export function FinanceFeatureDisabled() {
    return <FeatureDisabledBanner featureName="ระบบการเงิน" />;
}

export function FinanceAccessDenied() {
    return (
        <div className="flex h-[60vh] flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-token-full border border-status-danger bg-status-danger-subtle">
                <AlertTriangle className="h-8 w-8 text-fg-danger" />
            </div>
            <h1 className="mb-2 font-heading text-2xl font-bold tracking-tight text-fg-primary">ไม่มีสิทธิ์เข้าถึง</h1>
            <p className="max-w-md text-sm text-fg-secondary">
                เฉพาะหัวหน้าแก๊งหรือเหรัญญิกเท่านั้นที่จัดการการเงินได้
            </p>
        </div>
    );
}

export function FinanceShell({
    context,
    children,
}: {
    context: FinanceContext;
    children: ReactNode;
}) {
    return (
        <div className="animate-fade-in space-y-6">
            <FinanceCommandHeader context={context} />
            <FinanceLedgerGuide context={context} />
            {children}
        </div>
    );
}

export function FinanceLockedPanel({ context }: { context: FinanceContext }) {
    return (
        <div data-testid="finance-locked-banner" className="flex items-start gap-3 rounded-token-2xl border border-status-warning bg-status-warning-subtle p-4 shadow-token-xs">
            <div className="shrink-0 rounded-token-lg border border-border-subtle bg-bg-elevated p-2">
                <Lock className="h-5 w-5 text-fg-warning" />
            </div>
            <div>
                <h3 className="mb-1 font-semibold text-fg-warning">ฟีเจอร์การเงินอยู่ในแพลน Premium</h3>
                <p className="mb-4 text-sm text-fg-secondary">
                    แพลนปัจจุบัน: <strong className="text-fg-primary">{context.tierName}</strong> - {PAYMENT_PAUSED_COPY.lockedFeature}
                </p>
                <Link
                    href={`/dashboard/${context.gangId}/billing`}
                    className="inline-flex min-h-11 items-center gap-2 rounded-token-lg bg-status-warning px-4 py-2 text-xs font-bold text-fg-inverse transition-colors hover:opacity-90"
                >
                    <Zap className="h-4 w-4" />
                    {PAYMENT_PAUSED_COPY.detailsActionLabel}
                </Link>
            </div>
        </div>
    );
}

export function FinanceSummaryLockedPanel({ context }: { context: FinanceContext }) {
    return (
        <div className="flex flex-col items-center justify-center rounded-token-2xl border border-dashed border-border-accent bg-bg-subtle p-6 text-center shadow-token-xs">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-token-lg border border-border-accent bg-accent-subtle">
                <Lock className="h-6 w-6 text-accent-bright" />
            </div>
            <h3 className="mb-2 font-heading text-base font-bold tracking-tight text-fg-primary">สรุปรายเดือนอยู่ในแพลน Premium</h3>
            <p className="mb-5 max-w-md text-sm text-fg-secondary">
                แพลนปัจจุบัน: <strong className="text-fg-primary">{context.tierName}</strong> - {PAYMENT_PAUSED_COPY.lockedFeature}
            </p>
            <Link
                href={`/dashboard/${context.gangId}/billing`}
                className="inline-flex min-h-11 items-center gap-2 rounded-token-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg transition-colors hover:bg-accent-hover"
            >
                <Zap className="h-4 w-4" />
                {PAYMENT_PAUSED_COPY.detailsActionLabel}
            </Link>
        </div>
    );
}

function FinanceCommandHeader({ context }: { context: FinanceContext }) {
    const statCards = [
        {
            label: 'เงินกองกลางจริง',
            value: `฿${context.balance.toLocaleString()}`,
            hint: 'อนุมัติแล้ว',
            icon: Wallet,
            accent: 'text-fg-success',
            bar: 'bg-status-success',
        },
        {
            label: 'ค้างเก็บ',
            value: `฿${context.openCollectionDueTotal.toLocaleString()}`,
            hint: 'ยังไม่ใช่เงินเข้า',
            icon: Banknote,
            accent: 'text-fg-warning',
            bar: 'bg-status-warning',
        },
        {
            label: 'รอตรวจ',
            value: context.pendingRequestCount.toLocaleString(),
            hint: 'รออนุมัติ',
            icon: Clock,
            accent: context.pendingRequestCount ? 'text-fg-danger' : 'text-fg-tertiary',
            bar: context.pendingRequestCount ? 'bg-status-danger' : 'bg-bg-muted',
        },
    ];

    const quickLinks = [
        {
            href: '#finance-pending',
            label: 'ตรวจคำขอ',
            hint: `${context.pendingRequestCount} รายการ`,
        },
        {
            href: '#finance-debts',
            label: 'คนค้างเงิน',
            hint: `฿${context.openCollectionDueTotal.toLocaleString()}`,
        },
        {
            href: `/dashboard/${context.gangId}/finance/history`,
            label: 'ประวัติ',
            hint: 'รายการที่อนุมัติแล้ว',
        },
        {
            href: `/dashboard/${context.gangId}/finance/summary`,
            label: 'สรุป',
            hint: 'แนวโน้มและคนเสี่ยง',
        },
    ];

    return (
        <section className="ops-surface overflow-hidden rounded-token-2xl border border-border-subtle bg-bg-subtle/95 shadow-token-xs">
            <div className="grid gap-3 p-3.5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:p-4">
                <div className="min-w-0 space-y-2.5 sm:space-y-3">
                    <div className="inline-flex w-fit items-center gap-2 rounded-token-full border border-border-subtle bg-bg-elevated px-3 py-1 text-xs font-bold tracking-normal text-fg-tertiary shadow-token-xs">
                        การเงินแก๊ง
                    </div>
                    <div>
                        <h1 className="font-heading text-xl font-black tracking-tight text-fg-primary sm:text-2xl">การเงินแก๊ง</h1>
                        <p className="sr-only">
                            ดูยอดจริง คำขอรอตรวจ และยอดค้างเก็บโดยไม่ปนกัน ค้างเก็บจะไม่ถูกนับเป็นเงินเข้าแก๊งจนกว่าจะชำระจริง
                        </p>
                    </div>
                    <FinanceTabs />
                </div>

                <FinanceClient
                    gangId={context.gangId}
                    hasFinance={context.hasFinance}
                    hasExportCSV={context.hasExportCSV}
                />
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-border-subtle bg-bg-muted/50 p-2.5 sm:p-3 xl:grid-cols-4">
                {statCards.map((card) => {
                    const Icon = card.icon;
                    return (
                        <div key={card.label} className="ops-card relative min-h-[68px] overflow-hidden rounded-token-xl px-3 py-2.5 sm:min-h-[74px]">
                            <div className={`absolute inset-y-3 left-0 w-0.5 rounded-r-token-full ${card.bar}`} />
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-[11px] font-bold text-fg-tertiary">{card.label}</p>
                                    <p className={`mt-1 truncate text-base font-black tracking-tight tabular-nums sm:text-lg ${card.accent}`}>{card.value}</p>
                                    <p className="mt-0.5 truncate text-[11px] font-semibold text-fg-tertiary">{card.hint}</p>
                                </div>
                                <div className="hidden rounded-token-lg border border-border-subtle bg-bg-muted/80 p-2 text-fg-tertiary sm:flex">
                                    <Icon className="h-4 w-4" />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="hidden gap-2 overflow-x-auto border-t border-border-subtle bg-bg-subtle/82 px-3 py-3 sm:flex">
                {quickLinks.map((link) => (
                    <a
                        key={link.href}
                        href={link.href}
                        className="inline-flex min-h-10 min-w-fit items-center gap-2 rounded-token-lg border border-border-subtle bg-bg-elevated px-3 text-xs font-black text-fg-secondary shadow-token-xs transition-colors hover:border-border hover:bg-bg-muted hover:text-fg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                        <span>{link.label}</span>
                        <span className="hidden rounded-token-full bg-bg-muted px-2 py-0.5 text-[10px] font-black text-fg-tertiary ring-1 ring-border-subtle sm:inline-flex">{link.hint}</span>
                    </a>
                ))}
            </div>
        </section>
    );
}

function FinanceLedgerGuide({ context }: { context: FinanceContext }) {
    return (
        <section className="rounded-token-2xl border border-border-subtle bg-bg-muted/80 px-3 py-3 shadow-token-xs sm:px-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                    <div className="rounded-token-lg border border-border-subtle bg-bg-subtle p-2 text-fg-secondary">
                        <Banknote className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs font-bold text-fg-tertiary">กฎบัญชี</p>
                        <p className="mt-0.5 text-sm font-bold text-fg-primary">กฎหลัก: ค้างเก็บยังไม่ใช่เงินเข้า</p>
                        <p className="mt-1 text-xs leading-5 text-fg-tertiary">
                            ยอดที่ตั้งให้สมาชิกจ่ายเป็นคิวเก็บเงินเท่านั้น เงินกองกลางจริงคือรายการที่อนุมัติและชำระแล้ว
                        </p>
                    </div>
                </div>
                <div className="grid gap-2 text-xs sm:min-w-[520px] sm:grid-cols-3">
                    <LedgerPill label="เงินจริง" value={`฿${context.balance.toLocaleString()}`} tone="text-fg-success" />
                    <LedgerPill label="ค้างเก็บ" value={`฿${context.openCollectionDueTotal.toLocaleString()}`} tone="text-fg-warning" />
                    <LedgerPill label="รอตรวจ" value={context.pendingRequestCount.toLocaleString()} tone="text-fg-primary" />
                </div>
            </div>
        </section>
    );
}

function LedgerPill({ label, value, tone }: { label: string; value: string; tone: string }) {
    return (
        <div className="rounded-token-lg border border-border-subtle bg-bg-subtle px-3 py-2">
            <span className="block text-[11px] font-bold text-fg-tertiary">{label}</span>
            <span className={`mt-1 block truncate font-black tabular-nums ${tone}`}>{value}</span>
        </div>
    );
}
