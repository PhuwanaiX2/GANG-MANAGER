import { logError, logWarn } from './logger';

export interface DiscordRole {
    id: string;
    name: string;
    color: number;
    position: number;
    managed: boolean;
}

export interface DiscordChannel {
    id: string;
    name: string;
    type: number;
    position: number;
    parentId?: string | null;
}

export interface DiscordGuildMember {
    id: string;
    username: string;
    displayName: string;
    globalName: string | null;
    avatarUrl: string | null;
    isBot: boolean;
}

function buildDiscordAvatarUrl(user: { id?: string; avatar?: string | null } | undefined) {
    if (!user?.id || !user.avatar) return null;
    const extension = user.avatar.startsWith('a_') ? 'gif' : 'png';
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${extension}?size=128`;
}

function normalizeDiscordGuildMember(member: any): DiscordGuildMember | null {
    if (!member?.user?.id || !member.user.username) return null;

    const globalName = member.user.global_name || null;
    const displayName = member.nick || globalName || member.user.username;

    return {
        id: member.user.id,
        username: member.user.username,
        displayName,
        globalName,
        avatarUrl: buildDiscordAvatarUrl(member.user),
        isBot: Boolean(member.user.bot),
    };
}

export async function getDiscordRoles(guildId: string): Promise<DiscordRole[]> {
    if (!process.env.DISCORD_BOT_TOKEN) {
        logWarn('lib.discord.roles.token_missing', { guildId });
        return [];
    }

    try {
        const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
            headers: {
                Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
            },
            next: { revalidate: 300 } // Cache for 5 minutes
        });

        if (!response.ok) {
            logWarn('lib.discord.roles.fetch_failed', {
                guildId,
                statusCode: response.status,
                statusText: response.statusText,
            });
            return [];
        }

        const roles = await response.json();

        return roles.map((r: any) => ({
            id: r.id,
            name: r.name,
            color: r.color,
            position: r.position,
            managed: r.managed
        })).sort((a: any, b: any) => b.position - a.position);

    } catch (error) {
        logError('lib.discord.roles.fetch_error', error, { guildId });
        return [];
    }
}

export async function getDiscordGuildMembers(guildId: string): Promise<DiscordGuildMember[]> {
    if (!process.env.DISCORD_BOT_TOKEN) {
        logWarn('lib.discord.guild_members.token_missing', { guildId });
        return [];
    }

    const allMembers: DiscordGuildMember[] = [];
    let after = '0';

    try {
        for (let page = 0; page < 10; page += 1) {
            const url = new URL(`https://discord.com/api/v10/guilds/${guildId}/members`);
            url.searchParams.set('limit', '1000');
            url.searchParams.set('after', after);

            const response = await fetch(url.toString(), {
                headers: {
                    Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
                },
                next: { revalidate: 60 },
            });

            if (!response.ok) {
                logWarn('lib.discord.guild_members.fetch_failed', {
                    guildId,
                    statusCode: response.status,
                    statusText: response.statusText,
                });
                return allMembers;
            }

            const pageMembers = await response.json();
            if (!Array.isArray(pageMembers) || pageMembers.length === 0) break;

            for (const member of pageMembers) {
                const normalized = normalizeDiscordGuildMember(member);
                if (normalized && !normalized.isBot) {
                    allMembers.push(normalized);
                }
            }

            const lastMember = pageMembers[pageMembers.length - 1];
            const nextAfter = lastMember?.user?.id;
            if (!nextAfter || pageMembers.length < 1000) break;
            after = nextAfter;
        }

        return allMembers.sort((a, b) => a.displayName.localeCompare(b.displayName, 'th'));
    } catch (error) {
        logError('lib.discord.guild_members.fetch_error', error, { guildId });
        return allMembers;
    }
}

export async function getDiscordGuildMember(guildId: string, discordId: string): Promise<DiscordGuildMember | null> {
    if (!process.env.DISCORD_BOT_TOKEN) {
        logWarn('lib.discord.guild_member.token_missing', { guildId, discordId });
        return null;
    }

    try {
        const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${discordId}`, {
            headers: {
                Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
            },
            next: { revalidate: 60 },
        });

        if (response.status === 404) {
            return null;
        }

        if (!response.ok) {
            logWarn('lib.discord.guild_member.fetch_failed', {
                guildId,
                discordId,
                statusCode: response.status,
                statusText: response.statusText,
            });
            return null;
        }

        return normalizeDiscordGuildMember(await response.json());
    } catch (error) {
        logError('lib.discord.guild_member.fetch_error', error, { guildId, discordId });
        return null;
    }
}

export async function getDiscordChannels(guildId: string): Promise<DiscordChannel[]> {
    if (!process.env.DISCORD_BOT_TOKEN) {
        logWarn('lib.discord.channels.token_missing', { guildId });
        return [];
    }

    try {
        const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
            headers: {
                Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
            },
            next: { revalidate: 300 } // Cache for 5 minutes
        });

        if (!response.ok) {
            logWarn('lib.discord.channels.fetch_failed', {
                guildId,
                statusCode: response.status,
                statusText: response.statusText,
            });
            return [];
        }

        const channels = await response.json();

        return channels
            .filter((c: any) => c.type === 0) // Only text channels for now
            .map((c: any) => ({
                id: c.id,
                name: c.name,
                type: c.type,
                position: c.position,
                parentId: c.parent_id,
            }))
            .sort((a: any, b: any) => a.position - b.position);

    } catch (error) {
        logError('lib.discord.channels.fetch_error', error, { guildId });
        return [];
    }
}
