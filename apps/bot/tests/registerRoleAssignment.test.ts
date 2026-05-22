import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    mockGangRoleFindFirst,
    mockEq,
    mockAnd,
} = vi.hoisted(() => ({
    mockGangRoleFindFirst: vi.fn(),
    mockEq: vi.fn((left, right) => ({ left, right })),
    mockAnd: vi.fn((...conditions: unknown[]) => conditions),
}));

vi.mock('@gang/database', () => ({
    db: {
        query: {
            gangs: { findFirst: vi.fn() },
            members: { findFirst: vi.fn() },
            gangSettings: { findFirst: vi.fn() },
            gangRoles: { findFirst: mockGangRoleFindFirst, findMany: vi.fn() },
        },
        insert: vi.fn(),
        update: vi.fn(),
    },
    gangs: { id: 'gangs.id' },
    members: { id: 'members.id', gangId: 'members.gang_id', discordId: 'members.discord_id' },
    gangSettings: { gangId: 'gang_settings.gang_id' },
    gangRoles: {
        gangId: 'gang_roles.gang_id',
        permissionLevel: 'gang_roles.permission_level',
    },
}));

vi.mock('drizzle-orm', () => ({
    eq: mockEq,
    and: mockAnd,
}));

vi.mock('../src/utils/auditLog', () => ({
    createAuditLog: vi.fn(),
}));

vi.mock('../src/utils/logger', () => ({
    logError: vi.fn(),
    logWarn: vi.fn(),
}));

vi.mock('../src/utils/thaiTime', () => ({
    thaiTimestamp: vi.fn(() => '2026-05-22 12:00'),
}));

vi.mock('nanoid', () => ({
    nanoid: vi.fn(() => 'member-1'),
}));

import { validateMemberRoleAssignment } from '../src/features/registerModal';

function createTargetMember(role: { editable: boolean; managed?: boolean } = { editable: true }) {
    const memberRole = {
        id: 'role-member',
        name: 'Gang Member',
        managed: role.managed ?? false,
        editable: role.editable,
    };

    return {
        id: 'discord-member',
        manageable: false,
        guild: {
            ownerId: 'discord-owner',
            roles: {
                cache: {
                    get: vi.fn(() => memberRole),
                },
            },
        },
    };
}

describe('registration role assignment preflight', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGangRoleFindFirst.mockResolvedValue({
            discordRoleId: 'role-member',
            permissionLevel: 'MEMBER',
        });
    });

    it('allows assigning a mapped gang role even when the member has an unrelated higher Discord role', async () => {
        const plan = await validateMemberRoleAssignment('gang-1', createTargetMember() as any);

        expect(plan.canAssign).toBe(true);
        expect(plan.issues).toEqual([]);
        expect(plan.roles).toEqual([
            expect.objectContaining({
                permission: 'MEMBER',
                role: expect.objectContaining({ id: 'role-member' }),
            }),
        ]);
    });

    it('blocks only when the mapped gang role itself is not assignable by the bot', async () => {
        const plan = await validateMemberRoleAssignment('gang-1', createTargetMember({ editable: false }) as any);

        expect(plan.canAssign).toBe(false);
        expect(plan.issues).toEqual([
            expect.objectContaining({
                code: 'ROLE_UNMANAGEABLE',
                roleId: 'role-member',
            }),
        ]);
    });
});
