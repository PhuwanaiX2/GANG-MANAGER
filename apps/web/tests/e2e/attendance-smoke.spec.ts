import { test, expect } from '@playwright/test';

const shouldRunSmoke = process.env.PLAYWRIGHT_RUN_ATTENDANCE_SMOKE === '1';
const gangId = process.env.E2E_GANG_ID;

test.skip(!shouldRunSmoke, 'Set PLAYWRIGHT_RUN_ATTENDANCE_SMOKE=1 to enable attendance smoke tests');
test.skip(!gangId, 'E2E_GANG_ID is required for attendance smoke tests');

test.describe.serial('attendance smoke', () => {
    test('attendance dashboard renders analytics shell', async ({ page }) => {
        await page.goto(`/dashboard/${gangId}/attendance`);

        await expect(page.getByRole('heading', { name: 'เช็คชื่อ', exact: true })).toBeVisible();
        await expect(page.getByText('เฉลี่ยเข้าร่วม')).toBeVisible();
        await expect(page.getByTestId('attendance-create-link')).toBeVisible();
    });

    test('attendance officer can create, start, close, and verify history', async ({ page }) => {
        test.setTimeout(60_000);
        const sessionName = `PW Attendance ${Date.now()}`;

        await page.goto(`/dashboard/${gangId}/attendance`);
        await page.getByTestId('attendance-create-link').click();

        await expect(page.getByTestId('attendance-create-form')).toBeVisible();
        await page.getByTestId('attendance-session-name').fill(sessionName);

        const absentPenaltyInput = page.getByTestId('attendance-absent-penalty');
        if (await absentPenaltyInput.count()) {
            await absentPenaltyInput.fill('0');
        }

        await page.getByTestId('attendance-create-submit').click();
        await page.waitForURL(new RegExp(`/dashboard/${gangId}/attendance/[^/]+(?:\\?.*)?$`));

        await expect(page.getByRole('heading', { name: sessionName })).toBeVisible();
        await expect(page.getByTestId('attendance-session-status')).toContainText('รอเริ่ม');
        await expect(page.getByTestId('attendance-history-entry-attendance_create')).toBeVisible();

        await page.getByTestId('attendance-start-session').click();
        await expect(page.getByTestId('attendance-session-status')).toContainText('เปิดอยู่', { timeout: 10000 });
        await expect(page.getByTestId('attendance-history-entry-attendance_start')).toBeVisible();

        const firstMemberRow = page.locator('[data-testid^="attendance-member-row-"]').first();
        await expect(firstMemberRow).toBeVisible();
        const firstMemberRowTestId = await firstMemberRow.getAttribute('data-testid');
        const firstMemberId = firstMemberRowTestId?.replace('attendance-member-row-', '');

        if (!firstMemberId) {
            throw new Error('Unable to resolve first attendance member id from test id');
        }

        await page.getByTestId(`attendance-action-present-${firstMemberId}`).click();
        await expect(page.getByTestId(`attendance-member-status-${firstMemberId}`)).toContainText('มา', { timeout: 10000 });
        await expect(page.getByTestId('attendance-stat-present-value')).toHaveText('1');
        await expect(page.getByTestId('attendance-history-entry-attendance_update')).toBeVisible();

        await page.getByTestId(`attendance-action-reset-${firstMemberId}`).click();
        await expect(page.getByTestId(`attendance-member-status-${firstMemberId}`)).toContainText('ยังไม่เข้า', { timeout: 10000 });
        await expect(page.getByTestId('attendance-stat-present-value')).toHaveText('0');

        await page.getByTestId(`attendance-action-leave-${firstMemberId}`).click();
        await expect(page.getByTestId(`attendance-member-status-${firstMemberId}`)).toContainText('ลา', { timeout: 10000 });
        await expect(page.getByTestId('attendance-stat-leave-value')).toHaveText('1');

        await page.mouse.move(0, 0);
        await page.getByTestId('attendance-open-close-confirm').press('Enter');
        await page.getByRole('button', { name: 'ยืนยันปิดรอบ' }).click();

        await expect(page.getByTestId('attendance-session-status')).toContainText('ปิดแล้ว', { timeout: 10000 });
        await expect(page.getByTestId(`attendance-member-status-${firstMemberId}`)).toContainText('ลา');

        await page.getByTestId(`attendance-action-present-${firstMemberId}`).click();
        await expect(page.getByTestId(`attendance-member-status-${firstMemberId}`)).toContainText('มา', { timeout: 10000 });
        await expect(page.getByTestId('attendance-stat-present-value')).toHaveText('1');
        await expect(page.getByTestId('attendance-stat-leave-value')).toHaveText('0');

        await expect(page.getByTestId('attendance-history-panel')).toBeVisible();
        await expect(page.getByTestId('attendance-history-entry-attendance_close')).toBeVisible();
        await expect(page.getByTestId('attendance-history-entry-attendance_update').first()).toBeVisible();
    });
});
