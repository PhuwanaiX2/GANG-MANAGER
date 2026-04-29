import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    mockCheckInteractionRateLimit,
    mockHandleButton,
    mockHandleModal,
    mockHandleSelectMenu,
    mockLogWarn,
    mockLogError,
    mockLogErrorToDiscord,
} = vi.hoisted(() => ({
    mockCheckInteractionRateLimit: vi.fn(),
    mockHandleButton: vi.fn(),
    mockHandleModal: vi.fn(),
    mockHandleSelectMenu: vi.fn(),
    mockLogWarn: vi.fn(),
    mockLogError: vi.fn(),
    mockLogErrorToDiscord: vi.fn(),
}));

vi.mock('../src/utils/interactionRateLimit', () => ({
    checkInteractionRateLimit: mockCheckInteractionRateLimit,
}));

vi.mock('../src/handlers/buttons', () => ({
    handleButton: mockHandleButton,
}));

vi.mock('../src/handlers/modals', () => ({
    handleModal: mockHandleModal,
}));

vi.mock('../src/handlers/selectMenus', () => ({
    handleSelectMenu: mockHandleSelectMenu,
}));

vi.mock('../src/utils/logger', () => ({
    logWarn: mockLogWarn,
    logError: mockLogError,
}));

vi.mock('../src/utils/errorLogger', () => ({
    logErrorToDiscord: mockLogErrorToDiscord,
}));

import { commandHandlers } from '../src/handlers/commands';
import { handleInteraction } from '../src/handlers/interactions';

function createBaseInteraction(overrides?: Partial<any>) {
    return {
        user: {
            id: 'discord-1',
        },
        type: 2,
        replied: false,
        deferred: false,
        reply: vi.fn().mockResolvedValue(undefined),
        followUp: vi.fn().mockResolvedValue(undefined),
        isRepliable: vi.fn(() => true),
        isChatInputCommand: vi.fn(() => false),
        isButton: vi.fn(() => false),
        isModalSubmit: vi.fn(() => false),
        isAnySelectMenu: vi.fn(() => false),
        ...overrides,
    };
}

describe('handleInteraction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCheckInteractionRateLimit.mockResolvedValue({
            allowed: true,
            retryAfterSeconds: 0,
            remaining: 4,
        });
    });

    it('replies and stops when the user is rate limited', async () => {
        mockCheckInteractionRateLimit.mockResolvedValueOnce({
            allowed: false,
            retryAfterSeconds: 8,
            remaining: 0,
        });
        const interaction = createBaseInteraction();

        await handleInteraction(interaction as any);

        expect(mockLogWarn).toHaveBeenCalledWith(
            'bot.interaction.rate_limited',
            expect.objectContaining({
                userId: 'discord-1',
                retryAfterSeconds: 8,
                remaining: 0,
            })
        );
        expect(interaction.reply).toHaveBeenCalledTimes(1);
        expect(interaction.reply.mock.calls[0][0].content).toContain('เร็วเกินไป');
        expect(mockHandleButton).not.toHaveBeenCalled();
    });

    it('dispatches button interactions to the registered button handler', async () => {
        const interaction = createBaseInteraction({
            type: 3,
            isButton: vi.fn(() => true),
        });

        await handleInteraction(interaction as any);

        expect(mockHandleButton).toHaveBeenCalledWith(interaction);
        expect(mockHandleModal).not.toHaveBeenCalled();
        expect(mockHandleSelectMenu).not.toHaveBeenCalled();
    });

    it('logs and replies with a generic message when a command handler throws before replying', async () => {
        const originalHandler = commandHandlers.get('setup');
        const handler = vi.fn().mockRejectedValue(new Error('boom'));
        commandHandlers.set('setup', handler);

        const interaction = createBaseInteraction({
            commandName: 'setup',
            isChatInputCommand: vi.fn(() => true),
        });

        try {
            await handleInteraction(interaction as any);
        } finally {
            if (originalHandler) {
                commandHandlers.set('setup', originalHandler);
            } else {
                commandHandlers.delete('setup');
            }
        }

        expect(mockLogErrorToDiscord).toHaveBeenCalledWith(
            expect.any(Error),
            expect.objectContaining({
                source: 'handleInteraction',
                interaction,
            })
        );
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.stringContaining('เกิดข้อผิดพลาด'),
                ephemeral: true,
            })
        );
    });

    it('falls back to followUp when the interaction was already deferred', async () => {
        const originalHandler = commandHandlers.get('setup');
        const handler = vi.fn().mockRejectedValue(new Error('boom'));
        commandHandlers.set('setup', handler);

        const interaction = createBaseInteraction({
            commandName: 'setup',
            deferred: true,
            isChatInputCommand: vi.fn(() => true),
        });

        try {
            await handleInteraction(interaction as any);
        } finally {
            if (originalHandler) {
                commandHandlers.set('setup', originalHandler);
            } else {
                commandHandlers.delete('setup');
            }
        }

        expect(interaction.reply).not.toHaveBeenCalled();
        expect(interaction.followUp).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.stringContaining('เกิดข้อผิดพลาด'),
                ephemeral: true,
            })
        );
    });

    it('replies with a readable Thai message when a command is unknown', async () => {
        const interaction = createBaseInteraction({
            commandName: 'missing-command',
            isChatInputCommand: vi.fn(() => true),
        });

        await handleInteraction(interaction as any);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.stringContaining('ไม่พบคำสั่งนี้'),
                ephemeral: true,
            })
        );
    });
});
