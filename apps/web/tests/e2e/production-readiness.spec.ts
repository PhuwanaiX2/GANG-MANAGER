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
    test('public landing uses customer-facing shell and Discord CTA', async ({ browser, baseURL }) => {
        const context = await browser.newContext({
            baseURL,
            storageState: { cookies: [], origins: [] },
        });
        const page = await context.newPage();

        await page.goto('/');

        await expect(page.getByTestId('landing-page')).toBeVisible();
        await expect(page.getByRole('heading', { name: 'GangManager', exact: true })).toBeVisible();
        await expect(page.locator('a[href*="discord.com/oauth2/authorize"]')).not.toHaveCount(0);
        await expect(page.locator('button').filter({ hasText: /Discord/i })).not.toHaveCount(0);
        await expect(page.getByText('soft launch', { exact: false })).toHaveCount(0);
        await expect(page.getByText('readiness', { exact: false })).toHaveCount(0);
        await expect(page.getByText('Production checks', { exact: false })).toHaveCount(0);
        await expect(page.getByText('Launch posture', { exact: false })).toHaveCount(0);

        await context.close();
    });

    test('public legal and support pages are accessible without login', async ({ browser, baseURL }) => {
        const context = await browser.newContext({
            baseURL,
            storageState: { cookies: [], origins: [] },
        });
        const page = await context.newPage();

        for (const [routePath, testId] of [
            ['/terms', 'terms-page'],
            ['/privacy', 'privacy-page'],
            ['/support', 'support-page'],
        ] as const) {
            await page.goto(routePath);
            await expect(page).toHaveURL(new RegExp(`${routePath}$`));
            await expect(page.getByTestId(testId)).toBeVisible();
            await expect(page.locator('button').filter({ hasText: /Discord/i })).toHaveCount(0);
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
        await expect(page.locator('a[href="/support"]')).toBeVisible();
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
    });

    test('subscription payment surface explains an in-progress PromptPay request', async ({ page }) => {
        test.skip(!gangId, 'E2E_GANG_ID is required for subscription payment smoke');

        await page.route(`**/api/gangs/${gangId}/subscription/payment-requests`, async (route) => {
            if (route.request().method() !== 'GET') {
                await route.continue();
                return;
            }

            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    paymentRequests: [
                        {
                            id: 'pw-payment-request',
                            requestRef: 'PW-PROMPTPAY-REF',
                            tier: 'PREMIUM',
                            billingPeriod: 'monthly',
                            amount: 179,
                            currency: 'THB',
                            provider: 'PROMPTPAY_MANUAL',
                            status: 'PENDING',
                            slipImageUrl: null,
                            verificationError: null,
                            submittedAt: null,
                            verifiedAt: null,
                            approvedAt: null,
                            rejectedAt: null,
                            reviewNotes: null,
                            expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                            createdAt: new Date().toISOString(),
                        },
                    ],
                    promptPay: {
                        receiverName: 'Playwright PromptPay',
                        identifier: '0812345678',
                        qrPayload: '00020101021229370016A000000677010111011300668123456785802TH53037645406179.006304ABCD',
                        qrDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
                        instructions: 'Transfer the exact amount and submit the slip before the request expires.',
                    },
                }),
            });
        });

        await page.goto(`/dashboard/${gangId}/billing`);

        await expect(page.getByTestId('subscription-settings-panel')).toBeVisible();
        await expect(page.getByTestId('subscription-payment-status-card')).toBeVisible();
        await expect(page.getByTestId('subscription-payment-history')).toBeVisible();
        await expect(page.getByTestId('subscription-payment-status-card').getByText('PW-PROMPTPAY-REF')).toBeVisible();
        await expect(page.getByTestId('subscription-slip-submit')).toBeVisible();
        await page.getByRole('button', { name: /แปะลิงก์รูป/ }).click();
        await page.getByTestId('subscription-slip-url-input').fill('https://cdn.discordapp.com/attachments/123/456/slip.png');
        await expect(page.getByTestId('subscription-slip-submit')).toBeEnabled();
        await expect(page.getByText('Stripe', { exact: false })).toHaveCount(0);
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
        await expect(page.getByText('Premium', { exact: false })).toBeVisible();

        await context.close();
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

        await context.close();
    });
});
