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

export async function getDiscordRoles(guildId: string): Promise<DiscordRole[]> {
    if (!process.env.DISCORD_BOT_TOKEN) {
        console.error('DISCORD_BOT_TOKEN is not defined');
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
            console.error(`Failed to fetch roles for guild ${guildId}: ${response.status} ${response.statusText}`);
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
        console.error('Error fetching Discord roles:', error);
        return [];
    }
}

export async function getDiscordChannels(guildId: string): Promise<DiscordChannel[]> {
    if (!process.env.DISCORD_BOT_TOKEN) {
        console.error('DISCORD_BOT_TOKEN is not defined');
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
            console.error(`Failed to fetch channels for guild ${guildId}: ${response.status} ${response.statusText}`);
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
        console.error('Error fetching Discord channels:', error);
        return [];
    }
}
