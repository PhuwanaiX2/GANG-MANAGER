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
    absentPenalty: z.number().int().min(0).default(0),
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
    type: z.enum(['INCOME', 'EXPENSE', 'LOAN', 'REPAYMENT', 'DEPOSIT', 'PENALTY']),
    amount: z.number().int().positive().max(100000000),
    category: z.string().max(50).optional(),
    description: z.string().min(1).max(500),
    memberId: z.string().optional(),
});

// ==================== FINANCE COLLECTION ====================
export const createCollectionBatchSchema = z.object({
    gangId: z.string().min(1),
    title: z.string().min(1).max(100),
    description: z.string().min(1).max(500),
    amountPerMember: z.number().int().positive().max(100000000),
    memberIds: z.array(z.string().min(1)).min(1),
});

export const waiveCollectionDebtSchema = z.object({
    gangId: z.string().min(1),
    memberId: z.string().min(1),
    batchId: z.string().min(1),
});

// ==================== GANG SETTINGS ====================
export const updateGangSettingsSchema = z.object({
    requirePhotoDefault: z.boolean().optional(),
    defaultAbsentPenalty: z.number().int().min(0).optional(),
    currency: z.string().length(3).optional(),
    registerChannelId: z.string().optional(),
    attendanceChannelId: z.string().optional(),
    financeChannelId: z.string().optional(),
    logChannelId: z.string().optional(),
});

// ==================== GANG ROLES ====================
export const GANG_PERMISSION_LEVELS = ['OWNER', 'ADMIN', 'TREASURER', 'ATTENDANCE_OFFICER', 'MEMBER'] as const;
export const gangPermissionLevelSchema = z.enum(GANG_PERMISSION_LEVELS);

export const setGangRoleSchema = z.object({
    gangId: z.string().min(1),
    discordRoleId: z.string().min(1),
    permissionLevel: gangPermissionLevelSchema,
});

export const updateGangRoleMappingSchema = z.object({
    permission: gangPermissionLevelSchema,
    roleId: z.string().max(64),
});

export const updateGangRoleMappingsSchema = z.array(updateGangRoleMappingSchema)
    .superRefine((mappings, ctx) => {
        const seenPermissions = new Set<string>();
        const seenRoleIds = new Map<string, string>();

        for (const [index, mapping] of mappings.entries()) {
            if (seenPermissions.has(mapping.permission)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: [index, 'permission'],
                    message: 'Each permission can only be mapped once',
                });
            }
            seenPermissions.add(mapping.permission);

            const roleId = mapping.roleId.trim();
            if (!roleId) continue;

            const existingPermission = seenRoleIds.get(roleId);
            if (existingPermission && existingPermission !== mapping.permission) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: [index, 'roleId'],
                    message: 'Each Discord role can only be mapped to one permission',
                });
            }
            seenRoleIds.set(roleId, mapping.permission);
        }
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
export type CreateCollectionBatchInput = z.infer<typeof createCollectionBatchSchema>;
export type WaiveCollectionDebtInput = z.infer<typeof waiveCollectionDebtSchema>;
export type UpdateGangSettingsInput = z.infer<typeof updateGangSettingsSchema>;
export type SetGangRoleInput = z.infer<typeof setGangRoleSchema>;
export type GangPermissionLevel = z.infer<typeof gangPermissionLevelSchema>;
export type UpdateGangRoleMappingInput = z.infer<typeof updateGangRoleMappingSchema>;
