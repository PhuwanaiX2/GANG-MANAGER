import { z } from 'zod';

// ==================== GANG ====================
export const createGangSchema = z.object({
    discordGuildId: z.string().min(1),
    name: z.string().min(1).max(100),
    licenseKey: z.string().min(1),
});

export const updateGangSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    logoUrl: z.string().url().optional(),
});

// ==================== MEMBER ====================
export const createMemberSchema = z.object({
    gangId: z.string().min(1),
    discordId: z.string().optional(),
    name: z.string().min(1).max(100),
    nickname: z.string().max(50).optional(),
});

export const updateMemberSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    nickname: z.string().max(50).optional(),
    isActive: z.boolean().optional(),
});

// ==================== ATTENDANCE ====================
export const createAttendanceSessionSchema = z.object({
    gangId: z.string().min(1),
    sessionName: z.string().min(1).max(100),
    sessionDate: z.date(),
    startTime: z.date(),
    endTime: z.date(),
    allowLate: z.boolean().default(true),
    lateThreshold: z.number().int().min(0).max(60).default(15),
    latePenalty: z.number().min(0).default(0),
    absentPenalty: z.number().min(0).default(0),
});

export const checkInSchema = z.object({
    sessionId: z.string().min(1),
    memberId: z.string().min(1),
});

// ==================== LEAVE REQUEST ====================
export const createLeaveRequestSchema = z.object({
    memberId: z.string().min(1),
    gangId: z.string().min(1),
    startDate: z.date(),
    endDate: z.date(),
    reason: z.string().min(1).max(500),
});

export const reviewLeaveRequestSchema = z.object({
    status: z.enum(['APPROVED', 'REJECTED']),
    reviewNotes: z.string().max(500).optional(),
});

// ==================== TRANSACTION ====================
export const createTransactionSchema = z.object({
    gangId: z.string().min(1),
    type: z.enum(['INCOME', 'EXPENSE', 'LOAN', 'REPAYMENT']),
    amount: z.number().positive().max(100000000),
    category: z.string().max(50).optional(),
    description: z.string().min(1).max(500),
    memberId: z.string().optional(),
});

// ==================== GANG SETTINGS ====================
export const updateGangSettingsSchema = z.object({
    requirePhotoDefault: z.boolean().optional(),
    lateThresholdMinutes: z.number().int().min(0).max(60).optional(),
    defaultLatePenalty: z.number().min(0).optional(),
    defaultAbsentPenalty: z.number().min(0).optional(),
    currency: z.string().length(3).optional(),
    registerChannelId: z.string().optional(),
    attendanceChannelId: z.string().optional(),
    financeChannelId: z.string().optional(),
    logChannelId: z.string().optional(),
});

// ==================== GANG ROLES ====================
export const setGangRoleSchema = z.object({
    gangId: z.string().min(1),
    discordRoleId: z.string().min(1),
    permissionLevel: z.enum(['OWNER', 'ADMIN', 'TREASURER', 'MEMBER']),
});

// Export types
export type CreateGangInput = z.infer<typeof createGangSchema>;
export type UpdateGangInput = z.infer<typeof updateGangSchema>;
export type CreateMemberInput = z.infer<typeof createMemberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
export type CreateAttendanceSessionInput = z.infer<typeof createAttendanceSessionSchema>;
export type CheckInInput = z.infer<typeof checkInSchema>;
export type CreateLeaveRequestInput = z.infer<typeof createLeaveRequestSchema>;
export type ReviewLeaveRequestInput = z.infer<typeof reviewLeaveRequestSchema>;
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateGangSettingsInput = z.infer<typeof updateGangSettingsSchema>;
export type SetGangRoleInput = z.infer<typeof setGangRoleSchema>;
