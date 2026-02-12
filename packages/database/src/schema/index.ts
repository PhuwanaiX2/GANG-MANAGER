import { sqliteTable, text, integer, real, index, unique } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// ==================== GANG ====================
export const gangs = sqliteTable('gangs', {
    id: text('id').primaryKey(),
    discordGuildId: text('discord_guild_id').notNull().unique(),
    name: text('name').notNull(),
    logoUrl: text('logo_url'),
    // Subscription
    subscriptionTier: text('subscription_tier', { enum: ['FREE', 'TRIAL', 'PRO'] }).notNull().default('FREE'),
    stripeCustomerId: text('stripe_customer_id'),
    subscriptionExpiresAt: integer('subscription_expires_at', { mode: 'timestamp' }),

    // Dissolve Status
    dissolvedAt: integer('dissolved_at', { mode: 'timestamp' }),
    dissolvedBy: text('dissolved_by'),

    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    balance: real('balance').notNull().default(0), // เงินกองกลาง
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// ==================== GANG SETTINGS ====================
export const gangSettings = sqliteTable('gang_settings', {
    id: text('id').primaryKey(),
    gangId: text('gang_id').notNull().unique().references(() => gangs.id, { onDelete: 'cascade' }),

    // Attendance settings
    requirePhotoDefault: integer('require_photo_default', { mode: 'boolean' }).notNull().default(false),
    lateThresholdMinutes: integer('late_threshold_minutes').notNull().default(15),
    defaultLatePenalty: real('default_late_penalty').notNull().default(0),
    defaultAbsentPenalty: real('default_absent_penalty').notNull().default(0),

    // Finance settings
    currency: text('currency').notNull().default('THB'),

    // Discord channel IDs
    registerChannelId: text('register_channel_id'),
    attendanceChannelId: text('attendance_channel_id'),
    financeChannelId: text('finance_channel_id'),
    logChannelId: text('log_channel_id'),
    announcementChannelId: text('announcement_channel_id'),
    leaveChannelId: text('leave_channel_id'), // ช่องแจ้งลา
    requestsChannelId: text('requests_channel_id'), // ช่องรับคำขอเข้าแก๊ง (Admin Only)

    // Bot Message IDs (for delete-before-resend)
    registerMessageId: text('register_message_id'),
    leaveMessageId: text('leave_message_id'),
    financeMessageId: text('finance_message_id'),
    adminPanelMessageId: text('admin_panel_message_id'),
});

// ==================== GANG ROLES (Custom Role Mapping) ====================
export const gangRoles = sqliteTable('gang_roles', {
    id: text('id').primaryKey(),
    gangId: text('gang_id').notNull().references(() => gangs.id, { onDelete: 'cascade' }),
    discordRoleId: text('discord_role_id').notNull(),
    permissionLevel: text('permission_level').notNull(), // OWNER, ADMIN, TREASURER, MEMBER
});

// ==================== ANNOUNCEMENTS ====================
export const announcements = sqliteTable('announcements', {
    id: text('id').primaryKey(),
    gangId: text('gang_id').notNull().references(() => gangs.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    content: text('content').notNull(),
    authorId: text('author_id').notNull(),
    authorName: text('author_name').notNull(),
    discordMessageId: text('discord_message_id'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// ==================== MEMBERS ====================
export const members = sqliteTable('members', {
    id: text('id').primaryKey(),
    gangId: text('gang_id').notNull().references(() => gangs.id, { onDelete: 'cascade' }),
    discordId: text('discord_id'),
    name: text('name').notNull(),
    discordUsername: text('discord_username'),
    discordAvatar: text('discord_avatar'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    status: text('status').notNull().default('APPROVED'), // PENDING, APPROVED, REJECTED
    gangRole: text('gang_role').notNull().default('MEMBER'), // MEMBER, ADMIN, TREASURER (Owner is determined by gangRoles mapping)
    balance: real('balance').notNull().default(0), // ยอดเงินสมาชิกในแก๊ง
    joinedAt: integer('joined_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
    gangIdIdx: index('members_gang_id_idx').on(table.gangId),
    discordIdIdx: index('members_discord_id_idx').on(table.discordId),
    gangDiscordUnique: unique('members_gang_discord_unique').on(table.gangId, table.discordId),
}));

// ==================== ATTENDANCE SESSIONS ====================
export const attendanceSessions = sqliteTable('attendance_sessions', {
    id: text('id').primaryKey(),
    gangId: text('gang_id').notNull().references(() => gangs.id, { onDelete: 'cascade' }),
    sessionName: text('session_name').notNull(),
    sessionDate: integer('session_date', { mode: 'timestamp' }).notNull(),
    startTime: integer('start_time', { mode: 'timestamp' }).notNull(),
    endTime: integer('end_time', { mode: 'timestamp' }).notNull(),

    allowLate: integer('allow_late', { mode: 'boolean' }).notNull().default(true),
    lateThreshold: integer('late_threshold').notNull().default(15), // minutes
    latePenalty: real('late_penalty').notNull().default(0),
    absentPenalty: real('absent_penalty').notNull().default(0),

    status: text('status').notNull().default('SCHEDULED'), // SCHEDULED, ACTIVE, CLOSED
    discordChannelId: text('discord_channel_id'),
    discordMessageId: text('discord_message_id'),

    createdById: text('created_by_id').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
    closedAt: integer('closed_at', { mode: 'timestamp' }),
});

// ==================== ATTENDANCE RECORDS ====================
export const attendanceRecords = sqliteTable('attendance_records', {
    id: text('id').primaryKey(),
    sessionId: text('session_id').notNull().references(() => attendanceSessions.id, { onDelete: 'cascade' }),
    memberId: text('member_id').notNull().references(() => members.id, { onDelete: 'cascade' }),

    status: text('status').notNull(), // PRESENT, LATE, ABSENT, LEAVE
    checkedInAt: integer('checked_in_at', { mode: 'timestamp' }),
    penaltyAmount: real('penalty_amount').notNull().default(0),
    notes: text('notes'),

    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
    sessionIdIdx: index('records_session_id_idx').on(table.sessionId),
    memberIdIdx: index('records_member_id_idx').on(table.memberId),
    // Unique constraint: ป้องกัน Double Check-in ใน Session เดียวกัน
    sessionMemberUnique: unique('records_session_member_unique').on(table.sessionId, table.memberId),
}));

// ==================== LEAVE REQUESTS ====================
export const leaveRequests = sqliteTable('leave_requests', {
    id: text('id').primaryKey(),
    memberId: text('member_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
    gangId: text('gang_id').notNull().references(() => gangs.id, { onDelete: 'cascade' }),

    type: text('type').notNull().default('FULL'), // FULL (ลาหยุด), LATE (เข้าช้า)
    startDate: integer('start_date', { mode: 'timestamp' }).notNull(),
    endDate: integer('end_date', { mode: 'timestamp' }).notNull(),
    reason: text('reason').notNull(),
    status: text('status').notNull().default('PENDING'), // PENDING, APPROVED, REJECTED

    requestedAt: integer('requested_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
    reviewedAt: integer('reviewed_at', { mode: 'timestamp' }),
    reviewedById: text('reviewed_by_id'),
    reviewNotes: text('review_notes'),
}, (table) => ({
    gangIdIdx: index('leaves_gang_id_idx').on(table.gangId),
    memberIdIdx: index('leaves_member_id_idx').on(table.memberId),
    statusIdx: index('leaves_status_idx').on(table.status),
    memberIdStatusIdx: index('leaves_member_id_status_idx').on(table.memberId, table.status),
}));

// ==================== TRANSACTIONS ====================
export const transactions = sqliteTable('transactions', {
    id: text('id').primaryKey(),
    gangId: text('gang_id').notNull().references(() => gangs.id, { onDelete: 'cascade' }),

    type: text('type').notNull(), // INCOME, EXPENSE, LOAN, REPAYMENT
    amount: real('amount').notNull(),
    category: text('category'),
    description: text('description').notNull(),

    memberId: text('member_id').references(() => members.id),

    status: text('status').notNull().default('APPROVED'), // PENDING, APPROVED, REJECTED
    approvedById: text('approved_by_id'),
    approvedAt: integer('approved_at', { mode: 'timestamp' }),

    balanceBefore: real('balance_before').notNull(),
    balanceAfter: real('balance_after').notNull(),

    createdById: text('created_by_id').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
    gangIdIdx: index('transactions_gang_id_idx').on(table.gangId),
    memberIdIdx: index('transactions_member_id_idx').on(table.memberId),
    createdByIdIdx: index('transactions_created_by_id_idx').on(table.createdById),
    createdAtIdx: index('transactions_created_at_idx').on(table.createdAt),
}));

// ==================== AUDIT LOGS (Immutable) ====================
export const auditLogs = sqliteTable('audit_logs', {
    id: text('id').primaryKey(),
    gangId: text('gang_id').notNull().references(() => gangs.id, { onDelete: 'cascade' }),

    actorId: text('actor_id').notNull(), // ใครทำ
    actorName: text('actor_name').notNull(),
    action: text('action').notNull(), // CREATE, UPDATE, DELETE, CHECK_IN, APPROVE, etc.

    targetType: text('target_type'), // member, transaction, attendance, etc.
    targetId: text('target_id'),

    oldValue: text('old_value'), // JSON string
    newValue: text('new_value'), // JSON string
    details: text('details'), // JSON string for extra info

    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
    gangIdIdx: index('audit_gang_id_idx').on(table.gangId),
    actorIdIdx: index('audit_actor_id_idx').on(table.actorId),
    targetIdIdx: index('audit_target_id_idx').on(table.targetId),
    createdAtIdx: index('audit_created_at_idx').on(table.createdAt),
}));

// ==================== LICENSES ====================
export const licenses = sqliteTable('licenses', {
    id: text('id').primaryKey(),
    key: text('key').notNull().unique(),
    tier: text('tier').notNull(), // TRIAL, PRO
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    maxMembers: integer('max_members').notNull().default(20),
    expiresAt: integer('expires_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// ==================== RELATIONS ====================
export const gangsRelations = relations(gangs, ({ one, many }) => ({
    settings: one(gangSettings, {
        fields: [gangs.id],
        references: [gangSettings.gangId],
    }),
    roles: many(gangRoles),
    members: many(members),
    attendanceSessions: many(attendanceSessions),
    transactions: many(transactions),
    auditLogs: many(auditLogs),
}));

export const gangRolesRelations = relations(gangRoles, ({ one }) => ({
    gang: one(gangs, { fields: [gangRoles.gangId], references: [gangs.id] }),
}));

export const gangSettingsRelations = relations(gangSettings, ({ one }) => ({
    gang: one(gangs, { fields: [gangSettings.gangId], references: [gangs.id] }),
}));

export const membersRelations = relations(members, ({ one, many }) => ({
    gang: one(gangs, { fields: [members.gangId], references: [gangs.id] }),
    attendanceRecords: many(attendanceRecords),
    leaveRequests: many(leaveRequests),
    transactions: many(transactions),
}));

export const attendanceSessionsRelations = relations(attendanceSessions, ({ one, many }) => ({
    gang: one(gangs, { fields: [attendanceSessions.gangId], references: [gangs.id] }),
    records: many(attendanceRecords),
}));

export const attendanceRecordsRelations = relations(attendanceRecords, ({ one }) => ({
    session: one(attendanceSessions, { fields: [attendanceRecords.sessionId], references: [attendanceSessions.id] }),
    member: one(members, { fields: [attendanceRecords.memberId], references: [members.id] }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
    gang: one(gangs, { fields: [transactions.gangId], references: [gangs.id] }),
    member: one(members, { fields: [transactions.memberId], references: [members.id] }),
    approvedBy: one(members, { fields: [transactions.approvedById], references: [members.id] }),
    createdBy: one(members, { fields: [transactions.createdById], references: [members.id] }),
}));

export const leaveRequestsRelations = relations(leaveRequests, ({ one }) => ({
    member: one(members, { fields: [leaveRequests.memberId], references: [members.id] }),
    gang: one(gangs, { fields: [leaveRequests.gangId], references: [gangs.id] }),
}));
