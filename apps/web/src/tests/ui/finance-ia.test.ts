import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const projectRoot = process.cwd();

describe('finance information architecture', () => {
    it('keeps real balance, open dues, pending reviews, and due-only rows clearly separated in UI copy', () => {
        const financePage = readFileSync(join(projectRoot, 'src/app/dashboard/[gangId]/finance/page.tsx'), 'utf8');
        const financeShell = readFileSync(join(projectRoot, 'src/app/dashboard/[gangId]/finance/FinanceShell.tsx'), 'utf8');
        const transactionTable = readFileSync(join(projectRoot, 'src/app/dashboard/[gangId]/finance/TransactionTable.tsx'), 'utf8');

        expect(financeShell).toContain('เงินกองกลางจริง');
        expect(financeShell).toContain('ค้างเก็บ');
        expect(financeShell).toContain('รอตรวจ');
        expect(financeShell).toContain('ค้างเก็บจะไม่ถูกนับเป็นเงินเข้าแก๊งจนกว่าจะชำระจริง');
        expect(financePage).toContain('id="finance-pending"');
        expect(financePage).toContain('id="finance-debts"');

        expect(transactionTable).toContain('ตั้งยอดเก็บเงินแก๊ง');
        expect(transactionTable).toContain('ยังไม่เข้ากองกลาง');
    });
});
