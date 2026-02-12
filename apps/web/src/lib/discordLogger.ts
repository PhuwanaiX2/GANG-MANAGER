/**
 * Simple Discord Logger
 * Sends logs to a Discord channel via Webhook.
 * Useful for monitoring critical errors in production without expensive tools.
 */
export async function logToDiscord(message: string, error?: any) {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

    // Always log to server console
    if (error) {
        console.error(message, error);
    } else {
        console.log(message);
    }

    if (!webhookUrl) return;

    try {
        const payload: any = {
            content: `🚨 **ERROR ALERT**\nMessage: ${message}`,
        };

        if (error) {
            const errorMsg = error instanceof Error ? error.stack || error.message : JSON.stringify(error, null, 2);
            // Discord limits content to 2000 chars, truncate if needed
            const truncatedError = errorMsg.length > 1800 ? errorMsg.substring(0, 1800) + '...' : errorMsg;

            payload.embeds = [{
                title: 'Error Details',
                description: `\`\`\`js\n${truncatedError}\n\`\`\``,
                color: 0xFF0000, // Red
                timestamp: new Date().toISOString()
            }];
        }

        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

    } catch (err) {
        console.error('Failed to send log to Discord:', err);
    }
}
