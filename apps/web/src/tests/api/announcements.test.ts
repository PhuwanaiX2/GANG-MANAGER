import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/gangs/[gangId]/announcements/route';

vi.mock('next-auth');
vi.mock('@gang/database');
vi.mock('@/lib/permissions');
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

import { getServerSession } from 'next-auth';
import { db } from '@gang/database';
import { getGangPermissions } from '@/lib/permissions';

global.fetch = vi.fn();

describe('POST /api/gangs/[gangId]/announcements', () => {
    const mockGangId = 'gang-123';
    const insertReturning = vi.fn();
    const insertValues = vi.fn(() => ({ returning: insertReturning }));

    beforeEach(() => {
        vi.clearAllMocks();
        process.env.DISCORD_BOT_TOKEN = 'mock-token';

        (getServerSession as any).mockResolvedValue({
            user: { discordId: 'user-123', name: 'Admin User' },
        });
        (getGangPermissions as any).mockResolvedValue({ isAdmin: true, isOwner: false });
        (db as any).query = {
            gangs: {
                findFirst: vi.fn().mockResolvedValue({
                    id: mockGangId,
                    settings: { announcementChannelId: 'channel-123' },
                }),
            },
        };
        (db as any).insert = vi.fn(() => ({ values: insertValues }));
        insertReturning.mockResolvedValue([{ id: 'ann-1', content: 'แจ้งเตือน', discordMessageId: 'discord-msg-1' }]);
        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({ id: 'discord-msg-1' }),
        });
    });

    const createRequest = (body: Record<string, unknown>) => new NextRequest('http://localhost:3000/api', {
        method: 'POST',
        body: JSON.stringify(body),
    });

    it('returns 403 when user lacks announcement permission', async () => {
        (getGangPermissions as any).mockResolvedValue({ isAdmin: false, isOwner: false });

        const res = await POST(createRequest({ content: 'แจ้งเตือน' }), { params: { gangId: mockGangId } });

        expect(res.status).toBe(403);
    });

    it('does not append @everyone unless explicitly requested', async () => {
        const res = await POST(createRequest({ content: 'แจ้งเตือนสำคัญ', mentionEveryone: false }), { params: { gangId: mockGangId } });
        const [, init] = (global.fetch as any).mock.calls[0];
        const body = JSON.parse(init.body);

        expect(res.status).toBe(200);
        expect(body.content).toBe('# แจ้งเตือนสำคัญ');
        expect(body.content).not.toContain('@everyone');
    });

    it('appends @everyone when explicitly requested', async () => {
        const res = await POST(createRequest({ content: 'แจ้งเตือนสำคัญ', mentionEveryone: true }), { params: { gangId: mockGangId } });
        const [, init] = (global.fetch as any).mock.calls[0];
        const body = JSON.parse(init.body);

        expect(res.status).toBe(200);
        expect(body.content).toContain('@everyone');
    });
});
