FROM node:18-alpine AS base

FROM base AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY . .
RUN npm ci

# Build the bot
RUN npm run build -w apps/bot

FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 botuser

# Copy built bot files
# Copy built bot files
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/bot/src ./apps/bot/src
COPY --from=builder /app/apps/bot/tsconfig.json ./apps/bot/tsconfig.json
COPY --from=builder /app/apps/bot/package.json ./apps/bot/package.json

COPY --from=builder --chown=botuser:nodejs /app/package.json ./package.json
COPY --from=builder --chown=botuser:nodejs /app/packages ./packages

USER botuser

CMD ["npm", "run", "start", "-w", "apps/bot"]
