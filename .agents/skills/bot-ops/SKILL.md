---
name: bot-ops
description: Tools for managing the Discord bot, including development and deployment tasks.
---

# Bot Operations

Use these commands to manage the Discord bot in `apps/bot`.

## 1. Development

Run these commands from the root or `apps/bot` directory.

- **Start Dev Mode**: detailed logs and auto-reload.
  ```bash
  cd apps/bot
  npm run dev
  ```
- **Build**: compile TypeScript to JavaScript.
  ```bash
  cd apps/bot
  npm run build
  ```

## 2. Registration & Setup

- **Slash Commands**: The bot registers commands on startup. If commands are missing, restart the bot.
- **Environment Variables**: Ensure `.env` in `apps/bot` contains:
  - `DISCORD_TOKEN`
  - `DISCORD_CLIENT_ID`
  - `DISCORD_GUILD_ID` (for dev guild registration)

## 3. Debugging

- **Logs**: Check the terminal output where `npm run dev` is running.
