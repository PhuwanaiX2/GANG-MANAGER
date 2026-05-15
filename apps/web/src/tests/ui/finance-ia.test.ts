import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const projectRoot = process.cwd();

describe('finance information architecture', () => {
    it('keeps real balance, open dues, pending reviews, and due-only rows clearly separated in UI copy', () => {
        const financePage = readFileSync(join(projectRoot, 'src/app/dashboard/[gangId]/finance/page.tsx'), 'utf8');
        const transactionTable = readFileSync(join(projectRoot, 'src/app/dashboard/[gangId]/finance/TransactionTable.tsx'), 'utf8');

        expect(financePage).toContain('เงินกองกลางจริง');
        expect(financePage).toContain('ค้างเก็บ');
        expect(financePage).toContain('รอตรวจ');
        expect(financePage).toContain('ค้างเก็บจะไม่ถูกนับเป็นเงินเข้าแก๊งจนกว่าจะชำระจริง');
        expect(financePage).toContain('id="finance-pending"');
        expect(financePage).toContain('id="finance-debts"');

        expect(transactionTable).toContain('ตั้งยอดเก็บเงินแก๊ง');
        expect(transactionTable).toContain('ยังไม่เข้ากองกลาง');
    });
});
