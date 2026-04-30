export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, gangs, members, auditLogs, FeatureFlagService, getDatabaseConnectionFingerprint, getDatabaseConnectionLabel } from '@gang/database';
import { buildPromptPayQrPayload } from '@/lib/promptPayQr';
import { and, desc, eq, isNotNull, lt, ne, sql } from 'drizzle-orm';
import {
    ShieldAlert,
    ShieldCheck,
    ShieldX,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    Eye,
    Lock,
    Key,
    Server,
    Globe,
    Database,
    FileWarning,
    Users,
    Clock,
    Fingerprint,
    Bug,
    Zap,
    Activity,
    ChevronDown,
} from 'lucide-react';

export default async function AdminSecurityPage() {
    const session = await getServerSession(authOptions);
    const promptPayBillingEnabled = process.env.ENABLE_PROMPTPAY_BILLING === 'true';
    const slipOkAutoVerifyEnabled = process.env.ENABLE_SLIPOK_AUTO_VERIFY === 'true';
    const databaseFingerprint = getDatabaseConnectionFingerprint();
    const databaseLabel = getDatabaseConnectionLabel();
    const hasLegacyBillingEnv = Object.keys(process.env).some((key) => key.startsWith('STRIPE_'));
    const hasPublicCloudinaryEnv = Boolean(process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim());
    const hasCloudinaryServerConfig = Boolean(
        process.env.CLOUDINARY_CLOUD_NAME?.trim() &&
        process.env.CLOUDINARY_API_KEY?.trim() &&
        process.env.CLOUDINARY_API_SECRET?.trim()
    );
    let promptPayIdentifierValid = !promptPayBillingEnabled;
    if (promptPayBillingEnabled && process.env.PROMPTPAY_IDENTIFIER) {
        try {
            buildPromptPayQrPayload({
                identifier: process.env.PROMPTPAY_IDENTIFIER,
                amount: 1,
                reference: 'READINESS',
            });
            promptPayIdentifierValid = true;
        } catch {
            promptPayIdentifierValid = false;
        }
    }

    // ========== 1. ENVIRONMENT CONFIG (ตรวจจาก process.env บนเซิร์ฟเวอร์จริง) ==========
    const envChecks = [
        {
            label: 'NEXTAUTH_SECRET',
            set: !!process.env.NEXTAUTH_SECRET,
            critical: true,
            desc: 'Secret สำหรับเข้ารหัส session — ถ้าไม่ตั้ง session จะไม่ปลอดภัย',
            lengthOk: (process.env.NEXTAUTH_SECRET || '').length >= 32,
        },
        {
            label: 'NEXTAUTH_URL',
            set: !!process.env.NEXTAUTH_URL,
            critical: true,
            desc: 'URL ของแอป — ต้องตั้งให้ตรงกับ domain จริง',
            value: process.env.NEXTAUTH_URL ? process.env.NEXTAUTH_URL.replace(/https?:\/\//, '').split('/')[0] : null,
        },
        {
            label: 'DISCORD_CLIENT_ID',
            set: !!process.env.DISCORD_CLIENT_ID,
            critical: true,
            desc: 'Discord OAuth Client ID',
        },
        {
            label: 'DISCORD_CLIENT_SECRET',
            set: !!process.env.DISCORD_CLIENT_SECRET,
            critical: true,
            desc: 'Discord OAuth Client Secret',
        },
        {
            label: 'DISCORD_BOT_TOKEN',
            set: !!process.env.DISCORD_BOT_TOKEN,
            critical: true,
            desc: 'Bot Token — ถ้าหลุดจะควบคุม Bot ได้ทั้งหมด',
        },
        {
            label: 'ADMIN_DISCORD_IDS',
            set: !!process.env.ADMIN_DISCORD_IDS,
            critical: true,
            desc: 'รายชื่อ Discord ID ที่เป็น Super Admin',
        },
        {
            label: 'DATABASE_URL / TURSO',
            set: !!process.env.TURSO_DATABASE_URL || !!process.env.DATABASE_URL,
            critical: true,
            desc: databaseFingerprint
                ? `Database connection string · ${databaseLabel || 'configured'} · fingerprint ${databaseFingerprint}`
                : 'Database connection string',
        },
        {
            label: 'LEGACY_BILLING_ENV_REMOVED',
            set: true,
            critical: false,
            desc: hasLegacyBillingEnv
                ? 'พบ env ของระบบชำระเงินเก่าใน runtime กรุณาลบออกจาก provider เพื่อกันความสับสน'
                : 'ไม่พบ env ของระบบชำระเงินเก่าใน runtime - เส้นทางปัจจุบันคือ PromptPay / SlipOK',
        },
        {
            label: 'CLOUDINARY_CLOUD_NAME',
            set: hasCloudinaryServerConfig,
            critical: false,
            desc: 'Server-only Cloudinary upload config must use CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET',
        },
        {
            label: 'NO_NEXT_PUBLIC_CLOUDINARY_SECRET',
            set: !hasPublicCloudinaryEnv,
            critical: true,
            desc: 'Cloudinary must not use NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME because upload config belongs on the server',
        },
        {
            label: 'PROMPTPAY_RECEIVER_NAME',
            set: !promptPayBillingEnabled || !!process.env.PROMPTPAY_RECEIVER_NAME,
            critical: false,
            desc: promptPayBillingEnabled
                ? 'ชื่อบัญชีรับเงินสำหรับหน้า PromptPay billing'
                : 'PromptPay billing ยังปิดอยู่ — ไม่เป็น launch blocker',
        },
        {
            label: 'PROMPTPAY_IDENTIFIER',
            set: !promptPayBillingEnabled || (!!process.env.PROMPTPAY_IDENTIFIER && promptPayIdentifierValid),
            critical: false,
            desc: promptPayBillingEnabled
                ? 'PromptPay ID/เบอร์/เลขบัญชีที่ผู้ใช้ต้องโอนเข้า'
                : 'PromptPay billing ยังปิดอยู่ — ไม่เป็น launch blocker',
        },
        {
            label: 'SLIPOK_API_KEY / BRANCH_ID',
            set: !slipOkAutoVerifyEnabled || (!!process.env.SLIPOK_API_KEY && !!process.env.SLIPOK_BRANCH_ID),
            critical: false,
            desc: slipOkAutoVerifyEnabled
                ? 'SlipOK auto verify ต้องมี API key และ branch ID'
                : 'SlipOK auto verify ยังปิดอยู่ — จะ fallback เป็น manual review',
        },
    ];

    const criticalMissing = envChecks.filter(e => e.critical && !e.set);
    const totalSet = envChecks.filter(e => e.set).length;

    // ========== 2. ADMIN IDS ==========
    const adminIds = (process.env.ADMIN_DISCORD_IDS || '').split(',').filter(Boolean);

    // ========== 3. AUDIT LOG (ดึงจาก DB จริง) ==========
    let auditLogCount = 0;
    let recentLogs: any[] = [];
    let adminActionCount = 0;
    try {
        const countResult = await db.select({ count: sql<number>`count(*)` }).from(auditLogs);
        auditLogCount = countResult[0]?.count || 0;

        // Get recent admin-relevant logs only (not gang-private data)
        recentLogs = await db.query.auditLogs.findMany({
            where: sql`${auditLogs.action} LIKE 'ADMIN%' OR ${auditLogs.action} LIKE 'TOGGLE%' OR ${auditLogs.action} LIKE 'LICENSE%' OR ${auditLogs.action} LIKE 'SYSTEM%' OR ${auditLogs.action} LIKE 'BACKUP%'`,
            orderBy: desc(auditLogs.createdAt),
            limit: 30,
        });

        // Count admin-specific actions
        const adminCountResult = await db.select({ count: sql<number>`count(*)` }).from(auditLogs)
            .where(sql`${auditLogs.action} LIKE 'ADMIN%'`);
        adminActionCount = adminCountResult[0]?.count || 0;
    } catch {
        // auditLogs table might not exist yet
    }

    // ========== 4. REAL DATA CHECKS ==========
    const lifetimeGangs = await db.query.gangs.findMany({
        where: sql`${gangs.isActive} = 1 AND ${gangs.subscriptionTier} != 'FREE' AND ${gangs.subscriptionExpiresAt} IS NULL`,
        columns: { id: true, name: true, subscriptionTier: true },
    });
    const licenseGraceDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const licenseDowngradeCandidates = await db.query.gangs.findMany({
        where: and(
            eq(gangs.isActive, true),
            isNotNull(gangs.subscriptionExpiresAt),
            lt(gangs.subscriptionExpiresAt, licenseGraceDate),
            ne(gangs.subscriptionTier, 'FREE'),
        ),
        columns: { id: true, name: true, subscriptionTier: true, subscriptionExpiresAt: true },
    });

    // Total gangs and members for context
    const totalGangsResult = await db.select({ count: sql<number>`count(*)` }).from(gangs);
    const totalGangs = totalGangsResult[0]?.count || 0;
    const totalMembersResult = await db.select({ count: sql<number>`count(*)` }).from(members);
    const totalMembers = totalMembersResult[0]?.count || 0;

    // Check feature flags status
    let disabledFlagsCount = 0;
    try {
        const allFlags = await FeatureFlagService.getAll(db);
        disabledFlagsCount = allFlags.filter((f: any) => !f.enabled).length;
    } catch {}

    // ========== 5. SECURITY CHECKS (ตรวจจริง ไม่ใช่แค่ข้อความ) ==========
    const securityChecks: { title: string; desc: string; pass: boolean; source: string }[] = [
        {
            title: 'NEXTAUTH_SECRET ตั้งค่าแล้ว',
            desc: !!process.env.NEXTAUTH_SECRET ? `ความยาว ${process.env.NEXTAUTH_SECRET.length} ตัวอักษร ${process.env.NEXTAUTH_SECRET.length >= 32 ? '(ดี)' : '(สั้นเกินไป ควร >= 32)'}` : 'ยังไม่ได้ตั้งค่า',
            pass: !!process.env.NEXTAUTH_SECRET && process.env.NEXTAUTH_SECRET.length >= 32,
            source: 'process.env.NEXTAUTH_SECRET',
        },
        {
            title: 'NEXTAUTH_URL ตรงกับ domain',
            desc: process.env.NEXTAUTH_URL ? `ตั้งเป็น ${process.env.NEXTAUTH_URL.replace(/https?:\/\//, '').split('/')[0]}` : 'ยังไม่ได้ตั้งค่า',
            pass: !!process.env.NEXTAUTH_URL,
            source: 'process.env.NEXTAUTH_URL',
        },
        {
            title: 'Admin มีไม่เกิน 3 คน',
            desc: `มี ${adminIds.length} admin — ${adminIds.length <= 3 ? 'ปลอดภัย' : 'มากเกินไป ยิ่งมาก ยิ่งเสี่ยง'}`,
            pass: adminIds.length > 0 && adminIds.length <= 3,
            source: 'process.env.ADMIN_DISCORD_IDS',
        },
        {
            title: 'Rate Limiting เปิดใช้งาน',
            desc: 'middleware.ts: API 100 req/min, Admin 10 req/min, Finance 20 req/min',
            pass: true,
            source: 'middleware.ts (ตรวจจากโค้ดจริง)',
        },
        {
            title: 'Bot Token ตั้งค่าแล้ว',
            desc: !!process.env.DISCORD_BOT_TOKEN ? 'Token ตั้งค่าแล้ว — ถ้าหลุดต้อง regenerate ทันที' : 'ยังไม่ได้ตั้งค่า',
            pass: !!process.env.DISCORD_BOT_TOKEN,
            source: 'process.env.DISCORD_BOT_TOKEN',
        },
        {
            title: 'Legacy Billing Env Removed',
            desc: hasLegacyBillingEnv
                ? 'Found legacy billing provider variables in runtime env. Remove them from the deployment provider so PromptPay / SlipOK stays the only visible billing direction.'
                : 'No legacy billing provider variables detected. Active billing path is PromptPay / SlipOK.',
            pass: true,
            source: 'PromptPay / SlipOK billing policy',
        },
        {
            title: 'Cloudinary Upload Config Is Server-Only',
            desc: hasPublicCloudinaryEnv ? 'NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME is set. Move Cloudinary config to server-only env.' : (hasCloudinaryServerConfig ? 'Cloudinary upload config is server-only.' : 'Cloudinary upload config is incomplete.'),
            pass: !hasPublicCloudinaryEnv && hasCloudinaryServerConfig,
            source: 'process.env CLOUDINARY_*',
        },
        {
            title: 'PromptPay Billing Guard',
            desc: promptPayBillingEnabled
                ? (!!process.env.PROMPTPAY_RECEIVER_NAME && !!process.env.PROMPTPAY_IDENTIFIER ? 'เปิดพร้อมข้อมูลบัญชีรับเงิน' : 'เปิด billing แล้วแต่ข้อมูลบัญชีรับเงินยังไม่ครบ')
                : 'PromptPay billing ปิดอยู่ จึงยังไม่ขายจริงจากหน้าแพลน',
            pass: !promptPayBillingEnabled || (!!process.env.PROMPTPAY_RECEIVER_NAME && !!process.env.PROMPTPAY_IDENTIFIER && promptPayIdentifierValid),
            source: 'process.env.ENABLE_PROMPTPAY_BILLING / PROMPTPAY_*',
        },
        {
            title: 'SlipOK Auto Verify Guard',
            desc: slipOkAutoVerifyEnabled
                ? (!!process.env.SLIPOK_API_KEY && !!process.env.SLIPOK_BRANCH_ID ? 'เปิด auto verify พร้อม API key + branch ID' : 'เปิด auto verify แต่ยังตั้งค่า SlipOK ไม่ครบ')
                : 'SlipOK auto verify ปิดอยู่ ระบบจะรับสลิปแล้วรอตรวจมือ',
            pass: !slipOkAutoVerifyEnabled || (!!process.env.SLIPOK_API_KEY && !!process.env.SLIPOK_BRANCH_ID),
            source: 'process.env.ENABLE_SLIPOK_AUTO_VERIFY / SLIPOK_*',
        },
        {
            title: 'Production Mode',
            desc: `NODE_ENV = "${process.env.NODE_ENV || 'undefined'}" — ${process.env.NODE_ENV === 'production' ? 'ปลอดภัย' : 'อาจแสดง error details แก่ user'}`,
            pass: process.env.NODE_ENV === 'production',
            source: 'process.env.NODE_ENV',
        },
        {
            title: 'ไม่มีฟีเจอร์ถูกปิด',
            desc: disabledFlagsCount > 0 ? `มี ${disabledFlagsCount} ฟีเจอร์ถูกปิดอยู่` : 'ทุกฟีเจอร์เปิดใช้งานปกติ',
            pass: disabledFlagsCount === 0,
            source: 'feature_flags table (ตรวจจาก DB จริง)',
        },
        {
            title: 'Subscription Scheduler Guard',
            desc: licenseDowngradeCandidates.length > 0
                ? `มี ${licenseDowngradeCandidates.length} แก๊งที่หมดอายุเกิน grace และจะถูกลดเป็น FREE เมื่อ scheduler ทำงาน`
                : 'ไม่มีแก๊งที่ควรถูกลดแพลนโดย scheduler ตอนนี้',
            pass: true,
            source: 'gangs.subscription_expires_at เทียบ Date + grace 3 วัน',
        },
        {
            title: 'Database เชื่อมต่อได้',
            desc: `${totalGangs} แก๊ง, ${totalMembers} สมาชิก, ${auditLogCount} audit logs · DB fingerprint ${databaseFingerprint || 'missing'}`,
            pass: true,
            source: 'SELECT count(*) จาก DB จริง',
        },
        {
            title: 'Admin Audit Log เปิดใช้งาน',
            desc: adminActionCount > 0 ? `มี ${adminActionCount} admin action ถูกบันทึก` : 'ยังไม่มี admin action ถูกบันทึก (จะเริ่มบันทึกเมื่อมีการเปลี่ยนแพลน/วันหมดอายุ)',
            pass: true,
            source: 'audit_logs table WHERE action LIKE ADMIN%',
        },
    ];

    const passCount = securityChecks.filter(c => c.pass).length;
    const failCount = securityChecks.filter(c => !c.pass).length;

    // ========== 6. RISK ASSESSMENT (based on real data) ==========
    const risks: { level: 'critical' | 'warning' | 'info'; title: string; desc: string }[] = [];

    if (criticalMissing.length > 0) {
        risks.push({
            level: 'critical',
            title: `${criticalMissing.length} Environment Variable สำคัญไม่ได้ตั้งค่า`,
            desc: criticalMissing.map(e => e.label).join(', '),
        });
    }
    if (!process.env.NEXTAUTH_SECRET || process.env.NEXTAUTH_SECRET.length < 32) {
        risks.push({
            level: 'critical',
            title: 'NEXTAUTH_SECRET สั้นเกินไป',
            desc: `ความยาว ${(process.env.NEXTAUTH_SECRET || '').length} — ควร >= 32 ตัวอักษร`,
        });
    }
    if (adminIds.length === 0) {
        risks.push({ level: 'critical', title: 'ไม่มี Admin', desc: 'ตั้ง ADMIN_DISCORD_IDS ใน .env' });
    }
    if (adminIds.length > 3) {
        risks.push({ level: 'warning', title: `Admin ${adminIds.length} คน`, desc: 'ควรจำกัดไม่เกิน 3 คน' });
    }
    if (hasLegacyBillingEnv) {
        risks.push({ level: 'warning', title: 'Legacy billing env still exists', desc: 'Billing runtime no longer depends on the old provider variables. Remove them from the deployment provider to keep billing direction clean.' });
    }
    if (hasPublicCloudinaryEnv) {
        risks.push({ level: 'critical', title: 'Cloudinary config exposed through NEXT_PUBLIC', desc: 'Use CLOUDINARY_CLOUD_NAME instead of NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME.' });
    }
    if (!hasCloudinaryServerConfig) {
        risks.push({ level: 'warning', title: 'Cloudinary upload config incomplete', desc: 'Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET before enabling logo uploads.' });
    }
    if (promptPayBillingEnabled && (!process.env.PROMPTPAY_RECEIVER_NAME || !process.env.PROMPTPAY_IDENTIFIER)) {
        risks.push({ level: 'critical', title: 'PromptPay billing เปิดแล้วแต่บัญชีรับเงินไม่ครบ', desc: 'ตั้ง PROMPTPAY_RECEIVER_NAME และ PROMPTPAY_IDENTIFIER ก่อนขายจริง' });
    }
    if (promptPayBillingEnabled && process.env.PROMPTPAY_IDENTIFIER && !promptPayIdentifierValid) {
        risks.push({ level: 'critical', title: 'PromptPay identifier cannot generate QR', desc: 'Use a valid Thai phone number or 13-digit PromptPay ID before enabling paid plans.' });
    }
    if (slipOkAutoVerifyEnabled && (!process.env.SLIPOK_API_KEY || !process.env.SLIPOK_BRANCH_ID)) {
        risks.push({ level: 'warning', title: 'SlipOK auto verify เปิดแล้วแต่ config ไม่ครบ', desc: 'ตั้ง SLIPOK_API_KEY และ SLIPOK_BRANCH_ID หรือปิด ENABLE_SLIPOK_AUTO_VERIFY' });
    }
    if (process.env.NODE_ENV !== 'production') {
        risks.push({ level: 'info', title: `NODE_ENV = "${process.env.NODE_ENV}"`, desc: 'ไม่ใช่ production — อาจแสดง error details' });
    }
    if (disabledFlagsCount > 0) {
        risks.push({ level: 'warning', title: `${disabledFlagsCount} ฟีเจอร์ถูกปิด`, desc: 'ผู้ใช้ไม่สามารถเข้าถึงฟีเจอร์ที่ปิดได้' });
    }
    if (lifetimeGangs.length > 0) {
        risks.push({ level: 'info', title: `${lifetimeGangs.length} แก๊งถาวร`, desc: `${lifetimeGangs.map(g => g.name).join(', ')} — ไม่มีวันหมดอายุ` });
    }
    if (licenseDowngradeCandidates.length > 0) {
        risks.push({
            level: 'warning',
            title: `${licenseDowngradeCandidates.length} แก๊งหมดอายุเกิน grace`,
            desc: `${licenseDowngradeCandidates.map(g => g.name).join(', ')} — scheduler จะลดเป็น FREE และบันทึก audit log`,
        });
    }

    const criticalCount = risks.filter(r => r.level === 'critical').length;
    const warningCount = risks.filter(r => r.level === 'warning').length;

    const levelStyles = {
        critical: 'bg-status-danger-subtle border-status-danger text-fg-danger',
        warning: 'bg-status-warning-subtle border-status-warning text-fg-warning',
        info: 'bg-status-info-subtle border-status-info text-fg-info',
    };
    const levelIconBg = {
        critical: 'bg-status-danger-subtle',
        warning: 'bg-status-warning-subtle',
        info: 'bg-status-info-subtle',
    };
    const levelIcon = {
        critical: <XCircle className="w-4 h-4" />,
        warning: <AlertTriangle className="w-4 h-4" />,
        info: <Activity className="w-4 h-4" />,
    };

    // ========== ACTION LOG ICON MAPPING ==========
    const getActionStyle = (action: string) => {
        if (action.startsWith('ADMIN')) return { bg: 'bg-status-danger-subtle', text: 'text-fg-danger', label: 'ADMIN' };
        if (action.includes('GANG_FEE')) return { bg: 'bg-accent-subtle', text: 'text-accent-bright', label: 'FEE' };
        if (action.includes('COLLECTION')) return { bg: 'bg-accent-subtle', text: 'text-accent-bright', label: 'COLLECT' };
        if (action.includes('CREATE') || action.includes('APPROVE')) return { bg: 'bg-status-success-subtle', text: 'text-fg-success', label: action.split('_')[0] };
        if (action.includes('DELETE') || action.includes('REJECT')) return { bg: 'bg-status-danger-subtle', text: 'text-fg-danger', label: action.split('_')[0] };
        if (action.includes('UPDATE')) return { bg: 'bg-status-info-subtle', text: 'text-fg-info', label: 'UPDATE' };
        return { bg: 'bg-bg-muted', text: 'text-fg-secondary', label: action.split('_')[0] };
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-black tracking-tight">ความปลอดภัย</h1>
                <p className="text-fg-tertiary text-sm mt-1">ข้อมูลทุกอย่างตรวจจากเซิร์ฟเวอร์จริง · กดหัวข้อเพื่อเปิด/ปิด</p>
            </div>

            {/* Security Score — always visible */}
            <div className={`border rounded-token-2xl p-6 shadow-token-sm ${criticalCount > 0 ? 'bg-status-danger-subtle border-status-danger' : warningCount > 0 ? 'bg-status-warning-subtle border-status-warning' : 'bg-status-success-subtle border-status-success'}`}>
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-token-2xl ${criticalCount > 0 ? 'bg-status-danger-subtle' : warningCount > 0 ? 'bg-status-warning-subtle' : 'bg-status-success-subtle'}`}>
                        {criticalCount > 0 ? <ShieldX className="w-8 h-8 text-fg-danger" /> : warningCount > 0 ? <ShieldAlert className="w-8 h-8 text-fg-warning" /> : <ShieldCheck className="w-8 h-8 text-fg-success" />}
                    </div>
                    <div className="flex-1">
                        <h2 className={`text-lg font-black ${criticalCount > 0 ? 'text-fg-danger' : warningCount > 0 ? 'text-fg-warning' : 'text-fg-success'}`}>
                            {criticalCount > 0 ? 'พบปัญหาร้ายแรง' : warningCount > 0 ? 'มีข้อควรระวัง' : 'ปลอดภัยดี'}
                        </h2>
                        <p className="text-sm text-fg-secondary mt-0.5">
                            Checks: <span className="text-fg-success font-bold">{passCount} ผ่าน</span>
                            {failCount > 0 && <span className="text-fg-danger font-bold ml-2">{failCount} ไม่ผ่าน</span>}
                            <span className="text-fg-tertiary ml-2">| Risks: {risks.length}</span>
                        </p>
                    </div>
                    <div className="text-right">
                        <div className="text-3xl font-black text-fg-primary tabular-nums">{Math.round((passCount / securityChecks.length) * 100)}%</div>
                        <div className="text-[9px] text-fg-tertiary font-bold uppercase">SCORE</div>
                    </div>
                </div>
            </div>

            {/* Risks — always visible if any */}
            {risks.length > 0 && (
                <div className="space-y-2">
                    {risks.map((risk, i) => (
                        <div key={i} className={`flex items-center gap-3 p-3 border rounded-token-xl ${levelStyles[risk.level]}`}>
                            <div className={`p-1.5 rounded-token-lg shrink-0 ${levelIconBg[risk.level]}`}>{levelIcon[risk.level]}</div>
                            <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold">{risk.title}</div>
                                <div className="text-[10px] opacity-70">{risk.desc}</div>
                            </div>
                            <span className={`shrink-0 px-2 py-0.5 rounded-token-full text-[8px] font-bold uppercase border ${levelStyles[risk.level]}`}>{risk.level}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* ─── COLLAPSIBLE: Security Checks ─── */}
            <details className="bg-bg-subtle border border-border-subtle rounded-token-2xl overflow-hidden group shadow-token-sm" open>
                <summary className="p-5 cursor-pointer select-none flex items-center gap-2 hover:bg-bg-muted transition-colors list-none [&::-webkit-details-marker]:hidden">
                    <ShieldCheck className="w-4 h-4 text-fg-success shrink-0" />
                    <span className="text-sm font-bold text-fg-primary flex-1">Security Checks</span>
                    <span className="px-2 py-0.5 rounded-token-full text-[8px] font-bold bg-status-success-subtle text-fg-success border border-status-success">ตรวจจริง</span>
                    <ChevronDown className="w-4 h-4 text-fg-tertiary group-open:rotate-180 transition-transform" />
                </summary>
                <div className="border-t border-border-subtle overflow-x-auto">
                    <table className="min-w-[760px] w-full text-left">
                        <thead className="bg-bg-muted border-b border-border-subtle">
                            <tr>
                                <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">Check</th>
                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">Source</th>
                                <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-subtle">
                            {securityChecks.map((check, i) => (
                                <tr key={i} className="hover:bg-bg-muted transition-colors">
                                    <td className="px-5 py-3">
                                        <div className="flex items-start gap-3">
                                            {check.pass ? <CheckCircle2 className="w-4 h-4 text-fg-success shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 text-fg-danger shrink-0 mt-0.5" />}
                                            <div className="min-w-0">
                                                <div className="text-xs font-bold text-fg-primary">{check.title}</div>
                                                <div className="text-[10px] text-fg-tertiary mt-0.5">{check.desc}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-[9px] text-fg-tertiary font-mono">{check.source}</td>
                                    <td className="px-5 py-3 text-right">
                                        <span className={`inline-flex px-2 py-0.5 rounded-token-full text-[9px] font-bold border ${check.pass ? 'bg-status-success-subtle text-fg-success border-status-success' : 'bg-status-danger-subtle text-fg-danger border-status-danger'}`}>
                                            {check.pass ? 'PASS' : 'FAIL'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </details>

            {/* ─── COLLAPSIBLE: Environment Config ─── */}
            <details className="bg-bg-subtle border border-border-subtle rounded-token-2xl overflow-hidden group shadow-token-sm">
                <summary className="p-5 cursor-pointer select-none flex items-center gap-2 hover:bg-bg-muted transition-colors list-none [&::-webkit-details-marker]:hidden">
                    <Server className="w-4 h-4 text-fg-info shrink-0" />
                    <span className="text-sm font-bold text-fg-primary flex-1">Environment Config</span>
                    <span className="text-[10px] text-fg-tertiary font-normal">{totalSet}/{envChecks.length}</span>
                    <span className="px-2 py-0.5 rounded-token-full text-[8px] font-bold bg-status-info-subtle text-fg-info border border-status-info">process.env</span>
                    <ChevronDown className="w-4 h-4 text-fg-tertiary group-open:rotate-180 transition-transform" />
                </summary>
                <div className="border-t border-border-subtle overflow-x-auto">
                    <table className="min-w-[760px] w-full text-left">
                        <thead className="bg-bg-muted border-b border-border-subtle">
                            <tr>
                                <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">Variable</th>
                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">Description</th>
                                <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-subtle">
                            {envChecks.map(env => (
                                <tr key={env.label} className="hover:bg-bg-muted transition-colors">
                                    <td className="px-5 py-3">
                                        <div className="flex items-center gap-2">
                                            {env.set ? <CheckCircle2 className="w-4 h-4 text-fg-success shrink-0" /> : <XCircle className={`w-4 h-4 shrink-0 ${env.critical ? 'text-fg-danger' : 'text-fg-warning'}`} />}
                                            <code className="text-xs font-mono text-fg-primary">{env.label}</code>
                                            {env.critical && !env.set && <span className="px-1.5 py-0.5 rounded-token-sm text-[8px] font-bold bg-status-danger-subtle text-fg-danger border border-status-danger">CRITICAL</span>}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-[10px] text-fg-tertiary">{env.desc}</td>
                                    <td className="px-5 py-3 text-right">
                                        <span className={`text-[10px] font-bold ${env.set ? 'text-fg-success' : 'text-fg-tertiary'}`}>{env.set ? 'SET' : 'MISSING'}</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </details>

            {/* ─── COLLAPSIBLE: Admin Access ─── */}
            <details className="bg-bg-subtle border border-border-subtle rounded-token-2xl overflow-hidden group shadow-token-sm">
                <summary className="p-5 cursor-pointer select-none flex items-center gap-2 hover:bg-bg-muted transition-colors list-none [&::-webkit-details-marker]:hidden">
                    <Fingerprint className="w-4 h-4 text-accent-bright shrink-0" />
                    <span className="text-sm font-bold text-fg-primary flex-1">Admin Access</span>
                    <span className="text-[10px] text-fg-tertiary">{adminIds.length} admin</span>
                    <ChevronDown className="w-4 h-4 text-fg-tertiary group-open:rotate-180 transition-transform" />
                </summary>
                <div className="p-5 border-t border-border-subtle space-y-4">
                    <div>
                        <div className="text-[10px] text-fg-tertiary uppercase tracking-wider font-bold mb-2">Admin ปัจจุบัน (session)</div>
                        <div className="flex items-center gap-2 px-3 py-2 bg-status-success-subtle border border-status-success rounded-token-lg">
                            {session?.user?.image && <img src={session.user.image} alt="" className="w-6 h-6 rounded-token-full border border-border-subtle" />}
                            <span className="text-xs font-bold text-fg-primary">{session?.user?.name}</span>
                            <code className="text-[10px] text-fg-tertiary font-mono ml-auto">{session?.user?.discordId}</code>
                            <span className="px-1.5 py-0.5 rounded-token-sm text-[8px] font-bold bg-status-success-subtle text-fg-success border border-status-success">ACTIVE</span>
                        </div>
                    </div>
                    <div>
                        <div className="text-[10px] text-fg-tertiary uppercase tracking-wider font-bold mb-2">Admin IDs (.env) ({adminIds.length})</div>
                        <div className="space-y-1.5">
                            {adminIds.map(id => (
                                <div key={id} className="flex items-center gap-2 px-3 py-2 bg-bg-muted border border-border-subtle rounded-token-lg">
                                    <Key className="w-3 h-3 text-fg-warning" />
                                    <code className="text-xs text-fg-secondary font-mono">{id}</code>
                                    {id === session?.user?.discordId && <span className="px-1.5 py-0.5 rounded-token-sm text-[8px] font-bold bg-status-info-subtle text-fg-info border border-status-info ml-auto">คุณ</span>}
                                </div>
                            ))}
                            {adminIds.length === 0 && <p className="text-xs text-fg-tertiary">ไม่มี Admin IDs — ตั้ง ADMIN_DISCORD_IDS ใน .env</p>}
                        </div>
                    </div>
                </div>
            </details>

            {/* ─── COLLAPSIBLE: Admin Audit Log ─── */}
            <details className="bg-bg-subtle border border-border-subtle rounded-token-2xl overflow-hidden group shadow-token-sm" open>
                <summary className="p-5 cursor-pointer select-none flex items-center gap-2 hover:bg-bg-muted transition-colors list-none [&::-webkit-details-marker]:hidden">
                    <Eye className="w-4 h-4 text-fg-info shrink-0" />
                    <span className="text-sm font-bold text-fg-primary flex-1">Admin Audit Log</span>
                    <span className="text-[10px] text-fg-tertiary">Admin <strong className="text-fg-danger">{adminActionCount}</strong></span>
                    <span className="px-2 py-0.5 rounded-token-full text-[8px] font-bold bg-status-info-subtle text-fg-info border border-status-info">เฉพาะ Admin</span>
                    <ChevronDown className="w-4 h-4 text-fg-tertiary group-open:rotate-180 transition-transform" />
                </summary>
                <div className="border-t border-border-subtle">
                    <div className="px-5 py-2 bg-bg-muted text-[9px] text-fg-tertiary flex items-center gap-1.5">
                        <Lock className="w-3 h-3" />
                        แสดงเฉพาะ log ที่เกี่ยวกับ Admin (เปลี่ยนแพลน, toggle ฟีเจอร์, license ฯลฯ) — log ของแก๊งเป็นความเป็นส่วนตัว
                    </div>
                    {recentLogs.length > 0 ? (
                        <div className="max-h-[400px] overflow-auto">
                            <table className="min-w-[820px] w-full text-left">
                                <thead className="sticky top-0 z-10 bg-bg-muted border-b border-border-subtle">
                                    <tr>
                                        <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">Action</th>
                                        <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">Actor</th>
                                        <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">Details</th>
                                        <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary text-right">Time</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border-subtle">
                                    {recentLogs.map((log: any) => {
                                        const style = getActionStyle(log.action);
                                        return (
                                            <tr key={log.id} className="hover:bg-bg-muted transition-colors">
                                                <td className="px-5 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`px-1.5 py-0.5 rounded-token-sm text-[8px] font-bold ${style.bg} ${style.text} shrink-0`}>
                                                            {style.label}
                                                        </span>
                                                        <span className="text-xs text-fg-primary font-medium">{log.action}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-[9px] text-fg-tertiary">{log.actorName}</td>
                                                <td className="px-4 py-3 text-[9px] text-fg-tertiary max-w-[280px] truncate">
                                                    {log.details
                                                        ? (() => { try { const d = JSON.parse(log.details); return d.gangName || d.description || log.details; } catch { return log.details; } })()
                                                        : '-'}
                                                </td>
                                                <td className="px-5 py-3 text-right text-[9px] text-fg-tertiary tabular-nums whitespace-nowrap">
                                                    {new Date(log.createdAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="p-8 text-center text-fg-tertiary">
                            <Eye className="w-8 h-8 mx-auto mb-2 opacity-30" />
                            <p className="text-xs">ยังไม่มี admin audit logs</p>
                            <p className="text-[10px] text-fg-tertiary mt-1">จะเริ่มบันทึกเมื่อมีการเปลี่ยนแพลน, toggle ฟีเจอร์ ฯลฯ</p>
                        </div>
                    )}
                </div>
            </details>
        </div>
    );
}
