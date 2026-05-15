import { test, expect } from '@playwright/test';

const shouldRunSmoke = process.env.PLAYWRIGHT_RUN_ATTENDANCE_SMOKE === '1';
const gangId = process.env.E2E_GANG_ID;
const shouldUseMobileViewport = process.env.E2E_MOBILE_VIEWPORT === '1';
const attendanceMode = process.env.E2E_ATTENDANCE_MODE === 'MANUAL_ROLL_CALL'
    ? 'MANUAL_ROLL_CALL'
    : 'DISCORD_SELF_CHECKIN';

test.skip(!shouldRunSmoke, 'Set PLAYWRIGHT_RUN_ATTENDANCE_SMOKE=1 to enable attendance smoke tests');
test.skip(!gangId, 'E2E_GANG_ID is required for attendance smoke tests');

if (shouldUseMobileViewport) {
    test.use({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
    });
}

test.describe.serial('attendance smoke', () => {
    test('attendance dashboard renders round list shell', async ({ page }) => {
        await page.goto(`/dashboard/${gangId}/attendance`);

        await expect(page.getByRole('heading', { name: 'เช็คชื่อ', exact: true })).toBeVisible();
        await expect(page.getByText('ประวัติล่าสุด')).toBeVisible();
        await expect(page.getByTestId('attendance-create-link')).toBeVisible();
    });

    test('attendance officer can create, update, close, and verify history', async ({ page }) => {
        test.setTimeout(60_000);
        const sessionName = `PW Attendance ${Date.now()}`;

        await page.goto(`/dashboard/${gangId}/attendance`);
        await page.getByTestId('attendance-create-link').click();

        await expect(page.getByTestId('attendance-create-form')).toBeVisible();
        if (attendanceMode === 'MANUAL_ROLL_CALL') {
            await page.getByTestId('attendance-mode-manual').click();
        }
        await page.getByTestId('attendance-session-name').fill(sessionName);

        const absentPenaltyInput = page.getByTestId('attendance-absent-penalty');
        if (await absentPenaltyInput.count()) {
            await absentPenaltyInput.fill('0');
        }

        await page.getByTestId('attendance-create-submit').click();
        await page.waitForURL(new RegExp(`/dashboard/${gangId}/attendance/(?!create(?:\\?|$))[^/]+(?:\\?.*)?$`));

        await expect(page.getByRole('heading', { name: sessionName })).toBeVisible();
        if (attendanceMode !== 'MANUAL_ROLL_CALL') {
            await expect(page.getByTestId('attendance-history-entry-attendance_create')).toBeVisible();
        } else {
            await expect(page.getByTestId('attendance-history-panel')).toHaveCount(0);
        }

        if (attendanceMode === 'MANUAL_ROLL_CALL') {
            await expect(page.getByTestId('attendance-session-status')).toContainText('เปิดอยู่', { timeout: 10000 });
            await expect(page.getByTestId('attendance-session-mode')).toContainText('เช็คโดยเจ้าหน้าที่');
        } else {
            await expect(page.getByTestId('attendance-session-status')).toContainText('รอเริ่ม');
            await page.getByTestId('attendance-start-session').click();
            await expect(page.getByTestId('attendance-session-status')).toContainText('เปิดอยู่', { timeout: 10000 });
            await expect(page.getByTestId('attendance-history-entry-attendance_start')).toBeVisible();
        }

        const memberSurfacePrefix = shouldUseMobileViewport ? 'attendance-member-mobile-' : 'attendance-member-row-';
        const memberStatusPrefix = shouldUseMobileViewport ? 'attendance-member-mobile-status-' : 'attendance-member-status-';
        const manualStatusPrefix = shouldUseMobileViewport ? 'attendance-manual-mobile-status' : 'attendance-manual-status';
        const actionPrefix = shouldUseMobileViewport ? 'attendance-mobile-action' : 'attendance-action';
        const firstMemberSurface = page.locator(`[data-testid^="${memberSurfacePrefix}"]`).first();
        await expect(firstMemberSurface).toBeVisible();
        const firstMemberSurfaceTestId = await firstMemberSurface.getAttribute('data-testid');
        const firstMemberId = firstMemberSurfaceTestId?.replace(memberSurfacePrefix, '');

        if (!firstMemberId) {
            throw new Error('Unable to resolve first attendance member id from test id');
        }

        if (attendanceMode === 'MANUAL_ROLL_CALL') {
            await page.getByTestId(`${manualStatusPrefix}-leave-${firstMemberId}`).click();
            await expect(page.getByTestId(`${memberStatusPrefix}${firstMemberId}`)).toContainText('ลา', { timeout: 10000 });
            await expect(page.getByTestId('attendance-filter-leave')).toContainText('1');

            await page.getByTestId('attendance-manual-mark-unchecked-present').click();
            await expect(page.getByTestId('attendance-filter-unchecked')).toContainText('0', { timeout: 10000 });
        } else {
            await page.getByTestId(`${actionPrefix}-present-${firstMemberId}`).click();
            await expect(page.getByTestId(`${memberStatusPrefix}${firstMemberId}`)).toContainText('มา', { timeout: 10000 });
            await expect(page.getByTestId('attendance-stat-present-value')).toHaveText('1');
            await expect(firstMemberSurface).toContainText('บันทึกผ่านเว็บโดยเจ้าหน้าที่');

            await page.getByTestId(`${actionPrefix}-reset-${firstMemberId}`).click();
            await expect(page.getByTestId(`${memberStatusPrefix}${firstMemberId}`)).toContainText('ยังไม่เช็ค', { timeout: 10000 });
            await expect(page.getByTestId('attendance-stat-present-value')).toHaveText('0');

            await page.getByTestId(`${actionPrefix}-leave-${firstMemberId}`).click();
            await expect(page.getByTestId(`${memberStatusPrefix}${firstMemberId}`)).toContainText('ลา', { timeout: 10000 });
            await expect(page.getByTestId('attendance-stat-leave-value')).toHaveText('1');
        }

        await page.mouse.move(0, 0);
        await page.getByTestId('attendance-open-close-confirm').click();
        await page.getByRole('button', { name: attendanceMode === 'MANUAL_ROLL_CALL' ? 'ยืนยันบันทึกและปิดรอบ' : 'ยืนยันปิดรอบ' }).click();

        if (attendanceMode === 'MANUAL_ROLL_CALL') {
            await page.waitForURL(new RegExp(`/dashboard/${gangId}/attendance\\?tab=closed$`), { timeout: 10000 });
            await expect(page.getByRole('heading', { name: 'ประวัติการเช็คชื่อทั้งหมด' })).toBeVisible();
            await expect(page.getByRole('link', { name: new RegExp(sessionName) }).first()).toBeVisible();
            return;
        }

        await expect(page.getByTestId('attendance-session-status')).toContainText('ปิดแล้ว', { timeout: 10000 });
        await expect(page.getByTestId(`${memberStatusPrefix}${firstMemberId}`)).toContainText('ลา');

        await page.getByTestId(`${actionPrefix}-present-${firstMemberId}`).click();
        await page.getByRole('button', { name: 'ยืนยันการแก้ไข' }).click();
        await expect(page.getByTestId(`${memberStatusPrefix}${firstMemberId}`)).toContainText('มา', { timeout: 10000 });
        await expect(page.getByTestId('attendance-stat-present-value')).toHaveText(attendanceMode === 'MANUAL_ROLL_CALL' ? /^\d+$/ : '1');
        await expect(page.getByTestId('attendance-stat-leave-value')).toHaveText('0');

        await expect(page.getByTestId('attendance-history-panel')).toBeVisible();
        if (attendanceMode !== 'MANUAL_ROLL_CALL') {
            await expect(page.getByTestId('attendance-history-entry-attendance_close')).toBeVisible();
        }
        await expect(page.getByTestId('attendance-history-entry-attendance_update').first()).toBeVisible();
    });
});
