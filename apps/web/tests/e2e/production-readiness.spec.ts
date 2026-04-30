import path from 'node:path';
import { test, expect } from '@playwright/test';

const shouldRunProductionSmoke = process.env.PLAYWRIGHT_RUN_PRODUCTION_SMOKE === '1';
const gangId = process.env.E2E_GANG_ID;
const financeLockedGangId = process.env.E2E_FINANCE_LOCKED_GANG_ID;
const adminSmokeEnabled = process.env.E2E_EXPECT_ADMIN === '1';
const projectDir = path.resolve(__dirname, '..', '..');
const financeLockedStorageState = process.env.PLAYWRIGHT_FINANCE_LOCKED_STORAGE_STATE || path.join(projectDir, '.playwright/auth/finance-locked.json');
const adminStorageState = process.env.PLAYWRIGHT_ADMIN_STORAGE_STATE || path.join(projectDir, '.playwright/auth/admin.json');

test.skip(!shouldRunProductionSmoke, 'Set PLAYWRIGHT_RUN_PRODUCTION_SMOKE=1 to enable production readiness smoke tests');

test.describe('production readiness smoke', () => {
    test('public landing uses customer-facing copy and Discord CTA', async ({ browser, baseURL }) => {
        const context = await browser.newContext({
            baseURL,
            storageState: { cookies: [], origins: [] },
        });
        const page = await context.newPage();

        await page.goto('/');

        await expect(page.getByRole('heading', { name: 'คุมทีมใน Discord', exact: false })).toBeVisible();
        await expect(page.getByRole('button', { name: 'เข้าสู่ระบบด้วย Discord' })).toHaveCount(2);
        await expect(page.getByRole('link', { name: 'เพิ่มบอทลงเซิร์ฟเวอร์', exact: false })).not.toHaveCount(0);
        await expect(page.getByText('soft launch', { exact: false })).toHaveCount(0);
        await expect(page.getByText('readiness', { exact: false })).toHaveCount(0);
        await expect(page.getByText('Production checks', { exact: false })).toHaveCount(0);
        await expect(page.getByText('Launch posture', { exact: false })).toHaveCount(0);
        await expect(page.getByText('Trial 7 วัน', { exact: false })).toHaveCount(0);
        await expect(page.getByText('หลังหมด Trial', { exact: false })).toHaveCount(0);
        await expect(page.getByText('ทดลองใช้ฟรี', { exact: false })).toHaveCount(0);

        await context.close();
    });

    test('public legal and support pages are accessible without login', async ({ browser, baseURL }) => {
        const context = await browser.newContext({
            baseURL,
            storageState: { cookies: [], origins: [] },
        });
        const page = await context.newPage();

        for (const [path, expectedHeading] of [
            ['/terms', 'เงื่อนไขการใช้งาน'],
            ['/privacy', 'นโยบายความเป็นส่วนตัว'],
            ['/support', 'ศูนย์ช่วยเหลือ'],
        ] as const) {
            await page.goto(path);
            await expect(page).toHaveURL(new RegExp(`${path}$`));
            await expect(page.getByRole('heading', { name: expectedHeading, exact: false })).toBeVisible();
            await expect(page.getByText('เข้าสู่ระบบ', { exact: false })).toHaveCount(0);
        }

        await context.close();
    });

    test('public 404 page stays user-safe and links to support', async ({ browser, baseURL }) => {
        const context = await browser.newContext({
            baseURL,
            storageState: { cookies: [], origins: [] },
        });
        const page = await context.newPage();

        await page.goto('/this-page-should-not-exist');

        await expect(page.getByTestId('safe-not-found')).toBeVisible();
        await expect(page.getByRole('link', { name: 'ขอความช่วยเหลือ' })).toHaveAttribute('href', '/support');
        await expect(page.getByText('Error:', { exact: false })).toHaveCount(0);
        await expect(page.getByText('Stack', { exact: false })).toHaveCount(0);

        await context.close();
    });

    test('public health endpoint is ready and does not expose raw internals', async ({ request }) => {
        const response = await request.get('/api/health', {
            headers: { accept: 'application/json' },
        });
        const payload = await response.json();
        const serializedPayload = JSON.stringify(payload);

        expect(response.ok()).toBeTruthy();
        expect(payload).toMatchObject({
            status: 'ok',
            app: 'web',
            database: 'up',
        });
        expect(serializedPayload).not.toContain('TURSO');
        expect(serializedPayload).not.toContain('TOKEN');
        expect(serializedPayload).not.toContain('SECRET');
        expect(serializedPayload).not.toContain('ECONN');
    });

    test('settings exposes role and channel mapping panels for owners', async ({ page }) => {
        test.skip(!gangId, 'E2E_GANG_ID is required for settings smoke');

        await page.goto(`/dashboard/${gangId}/settings?tab=roles-channels`);

        await expect(page.getByTestId('settings-role-mapping-panel')).toBeVisible();
        await expect(page.getByTestId('settings-channel-mapping-panel')).toBeVisible();
        await expect(page.getByText('ตั้งค่ายศและสิทธิ์')).toBeVisible();
        await expect(page.getByText('ตั้งค่า Channels')).toBeVisible();
    });

    test('free-tier finance page clearly locks premium finance actions', async ({ browser, baseURL }) => {
        test.skip(!financeLockedGangId, 'E2E_FINANCE_LOCKED_GANG_ID is required for finance locked smoke');

        const context = await browser.newContext({
            baseURL,
            storageState: financeLockedStorageState,
        });
        const page = await context.newPage();

        await page.goto(`/dashboard/${financeLockedGangId}/finance`);

        await expect(page.getByTestId('finance-locked-banner')).toBeVisible();
        await expect(page.getByText('ฟีเจอร์การเงินอยู่ในแพลน Premium')).toBeVisible();
        await expect(page.getByText('ดูเงื่อนไขแพลน')).toBeVisible();
    });

    test('admin sales review shell renders manual review surface', async ({ browser, baseURL }) => {
        test.skip(!adminSmokeEnabled, 'Set E2E_EXPECT_ADMIN=1 with an admin Discord session to check admin sales');

        const context = await browser.newContext({
            baseURL,
            storageState: adminStorageState,
        });
        const page = await context.newPage();

        await page.goto('/admin/sales');

        await expect(page.getByTestId('admin-sales-readiness-panel')).toBeVisible();
        await expect(page.getByTestId('admin-sales-dashboard')).toBeVisible();
        await expect(page.getByTestId('admin-sales-payment-table')).toBeVisible();
        await expect(page.getByText('รายการชำระเงิน PromptPay / SlipOK')).toBeVisible();
    });
});
