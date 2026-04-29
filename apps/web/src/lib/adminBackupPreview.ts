export type BackupPreviewIssueLevel = 'error' | 'warning';
export type BackupCollectionStatus = 'ok' | 'missing' | 'invalid';

export interface BackupPreviewIssue {
    level: BackupPreviewIssueLevel;
    code: string;
    message: string;
}

export interface BackupPreviewCollection {
    key: string;
    label: string;
    count: number | null;
    status: BackupCollectionStatus;
}

export interface BackupImpactCollection {
    key: string;
    label: string;
    backupCount: number;
    liveCount: number;
    identifiedCount: number;
    createCount: number;
    overwriteCount: number;
    liveOnlyCount: number;
    rowsWithoutId: number;
}

export interface BackupImpactTotals {
    backupRecords: number;
    liveRecords: number;
    identifiedRecords: number;
    createCount: number;
    overwriteCount: number;
    liveOnlyCount: number;
    rowsWithoutId: number;
}

export interface BackupImpactResult {
    hasExistingData: boolean;
    hasIdCollisions: boolean;
    strategyHint: 'create_only_candidate' | 'review_required';
    totals: BackupImpactTotals;
    collections: BackupImpactCollection[];
    notes: string[];
}

export type RestorePlanMode = 'create_only' | 'upsert_existing';

export interface RestorePlanCollection {
    key: string;
    label: string;
    backupCount: number;
    createCount: number;
    overwriteCount: number;
    skipCount: number;
    liveOnlyCount: number;
    rowsWithoutId: number;
}

export interface RestorePlanSummary {
    backupRecords: number;
    plannedCreates: number;
    plannedOverwrites: number;
    skippedRecords: number;
    liveOnlyCount: number;
    affectedCollections: number;
}

export interface RestorePlanResult {
    fileName: string;
    strategy: RestorePlanMode;
    requiresManualReview: boolean;
    summary: RestorePlanSummary;
    collections: RestorePlanCollection[];
    warnings: string[];
    prerequisites: string[];
    limitations: string[];
}

export interface BackupPreviewResult {
    fileName: string;
    timestamp: string | null;
    isValid: boolean;
    totalRecords: number;
    collections: BackupPreviewCollection[];
    issues: BackupPreviewIssue[];
    impact?: BackupImpactResult;
}

const COLLECTION_CONFIGS = [
    { key: 'gangs', label: 'แก๊ง' },
    { key: 'gangSettings', label: 'Gang Settings' },
    { key: 'gangRoles', label: 'Role Mappings' },
    { key: 'members', label: 'สมาชิก' },
    { key: 'attendanceSessions', label: 'Attendance Sessions' },
    { key: 'attendanceRecords', label: 'Attendance Records' },
    { key: 'leaveRequests', label: 'Leave Requests' },
    { key: 'transactions', label: 'ธุรกรรม' },
    { key: 'auditLogs', label: 'Audit Logs' },
    { key: 'licenses', label: 'License Inventory' },
] as const;

export type BackupCollectionKey = typeof COLLECTION_CONFIGS[number]['key'];
type BackupRow = Record<string, unknown>;
type BackupCollections = Record<BackupCollectionKey, BackupRow[]>;
export type ExistingBackupIds = Record<BackupCollectionKey, string[]>;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function createEmptyCollections(): BackupCollections {
    return {
        gangs: [],
        gangSettings: [],
        gangRoles: [],
        members: [],
        attendanceSessions: [],
        attendanceRecords: [],
        leaveRequests: [],
        transactions: [],
        auditLogs: [],
        licenses: [],
    };
}

function countDuplicateIds(rows: BackupRow[]) {
    const seen = new Set<string>();
    let duplicates = 0;

    for (const row of rows) {
        const id = row.id;
        if (typeof id !== 'string' || id.length === 0) continue;
        if (seen.has(id)) {
            duplicates += 1;
            continue;
        }
        seen.add(id);
    }

    return duplicates;
}

function countMissingReferences(rows: BackupRow[], field: string, validIds: Set<string>) {
    let missing = 0;

    for (const row of rows) {
        const value = row[field];
        if (typeof value !== 'string' || value.length === 0) continue;
        if (!validIds.has(value)) {
            missing += 1;
        }
    }

    return missing;
}

function addReferenceIssue(issues: BackupPreviewIssue[], rows: BackupRow[], field: string, validIds: Set<string>, message: string) {
    const missingCount = countMissingReferences(rows, field, validIds);
    if (missingCount > 0) {
        issues.push({
            level: 'warning',
            code: `broken_ref:${field}`,
            message: `${message} (${missingCount} รายการ)`,
        });
    }
}

function normalizeBackupPayload(payload: unknown, fileName: string) {
    const issues: BackupPreviewIssue[] = [];
    const collections = createEmptyCollections();
    const collectionSummaries: BackupPreviewCollection[] = [];

    if (!isRecord(payload)) {
        return {
            preview: {
                fileName,
                timestamp: null,
                isValid: false,
                totalRecords: 0,
                collections: COLLECTION_CONFIGS.map((config) => ({
                    key: config.key,
                    label: config.label,
                    count: null,
                    status: 'missing' as const,
                })),
                issues: [{
                    level: 'error' as const,
                    code: 'invalid_root',
                    message: 'ไฟล์ Backup ต้องเป็น JSON object ระดับบนสุด',
                }],
            },
            collections,
        };
    }

    const timestamp = typeof payload.timestamp === 'string' ? payload.timestamp : null;
    if (!timestamp) {
        issues.push({
            level: 'warning',
            code: 'missing_timestamp',
            message: 'ไฟล์ไม่มี timestamp จากระบบ export',
        });
    } else if (Number.isNaN(Date.parse(timestamp))) {
        issues.push({
            level: 'warning',
            code: 'invalid_timestamp',
            message: 'timestamp ในไฟล์ไม่อยู่ในรูปแบบวันที่ที่ถูกต้อง',
        });
    }

    const knownKeys = new Set(['timestamp', ...COLLECTION_CONFIGS.map((config) => config.key)]);
    const unknownKeys = Object.keys(payload).filter((key) => !knownKeys.has(key));
    if (unknownKeys.length > 0) {
        issues.push({
            level: 'warning',
            code: 'unknown_keys',
            message: `พบ top-level keys ที่ระบบไม่รู้จัก: ${unknownKeys.join(', ')}`,
        });
    }

    let totalRecords = 0;

    for (const config of COLLECTION_CONFIGS) {
        const rawValue = payload[config.key];

        if (rawValue === undefined) {
            issues.push({
                level: 'error',
                code: `missing_collection:${config.key}`,
                message: `ไม่พบ collection ${config.label} ในไฟล์ Backup`,
            });
            collectionSummaries.push({ key: config.key, label: config.label, count: null, status: 'missing' });
            continue;
        }

        if (!Array.isArray(rawValue)) {
            issues.push({
                level: 'error',
                code: `invalid_collection:${config.key}`,
                message: `collection ${config.label} ต้องเป็น array`,
            });
            collectionSummaries.push({ key: config.key, label: config.label, count: null, status: 'invalid' });
            continue;
        }

        const objectRows = rawValue.filter(isRecord);
        const nonObjectCount = rawValue.length - objectRows.length;
        if (nonObjectCount > 0) {
            issues.push({
                level: 'warning',
                code: `non_object_rows:${config.key}`,
                message: `collection ${config.label} มีข้อมูลที่ไม่ใช่ object ${nonObjectCount} รายการ`,
            });
        }

        const duplicateIds = countDuplicateIds(objectRows);
        if (duplicateIds > 0) {
            issues.push({
                level: 'warning',
                code: `duplicate_ids:${config.key}`,
                message: `collection ${config.label} มี id ซ้ำ ${duplicateIds} รายการ`,
            });
        }

        collections[config.key] = objectRows;
        collectionSummaries.push({ key: config.key, label: config.label, count: rawValue.length, status: 'ok' });
        totalRecords += rawValue.length;
    }

    const gangIds = new Set(collections.gangs.map((row) => typeof row.id === 'string' ? row.id : '').filter(Boolean));
    const memberIds = new Set(collections.members.map((row) => typeof row.id === 'string' ? row.id : '').filter(Boolean));
    const sessionIds = new Set(collections.attendanceSessions.map((row) => typeof row.id === 'string' ? row.id : '').filter(Boolean));

    addReferenceIssue(issues, collections.gangSettings, 'gangId', gangIds, 'Gang Settings อ้างถึง gangId ที่ไม่มีอยู่');
    addReferenceIssue(issues, collections.gangRoles, 'gangId', gangIds, 'Role Mappings อ้างถึง gangId ที่ไม่มีอยู่');
    addReferenceIssue(issues, collections.members, 'gangId', gangIds, 'สมาชิกอ้างถึง gangId ที่ไม่มีอยู่');
    addReferenceIssue(issues, collections.attendanceSessions, 'gangId', gangIds, 'Attendance Sessions อ้างถึง gangId ที่ไม่มีอยู่');
    addReferenceIssue(issues, collections.leaveRequests, 'gangId', gangIds, 'Leave Requests อ้างถึง gangId ที่ไม่มีอยู่');
    addReferenceIssue(issues, collections.transactions, 'gangId', gangIds, 'ธุรกรรมอ้างถึง gangId ที่ไม่มีอยู่');
    addReferenceIssue(issues, collections.auditLogs, 'gangId', gangIds, 'Audit Logs อ้างถึง gangId ที่ไม่มีอยู่');
    addReferenceIssue(issues, collections.attendanceRecords, 'memberId', memberIds, 'Attendance Records อ้างถึง memberId ที่ไม่มีอยู่');
    addReferenceIssue(issues, collections.attendanceRecords, 'sessionId', sessionIds, 'Attendance Records อ้างถึง sessionId ที่ไม่มีอยู่');

    return {
        preview: {
            fileName,
            timestamp,
            isValid: !issues.some((issue) => issue.level === 'error'),
            totalRecords,
            collections: collectionSummaries,
            issues,
        },
        collections,
    };
}

export function analyzeBackupImpact(payload: unknown, existingIds: ExistingBackupIds): BackupImpactResult {
    const { collections } = normalizeBackupPayload(payload, 'backup.json');
    const impactCollections: BackupImpactCollection[] = [];

    let backupRecords = 0;
    let liveRecords = 0;
    let identifiedRecords = 0;
    let createCount = 0;
    let overwriteCount = 0;
    let liveOnlyCount = 0;
    let rowsWithoutId = 0;

    for (const config of COLLECTION_CONFIGS) {
        const backupRows = collections[config.key];
        const liveIds = existingIds[config.key] || [];
        const liveIdSet = new Set(liveIds.filter(Boolean));
        const backupIdSet = new Set<string>();

        let collectionRowsWithoutId = 0;

        for (const row of backupRows) {
            const id = row.id;
            if (typeof id !== 'string' || id.length === 0) {
                collectionRowsWithoutId += 1;
                continue;
            }
            backupIdSet.add(id);
        }

        let collectionOverwriteCount = 0;
        let collectionCreateCount = 0;

        for (const id of Array.from(backupIdSet)) {
            if (liveIdSet.has(id)) {
                collectionOverwriteCount += 1;
            } else {
                collectionCreateCount += 1;
            }
        }

        let collectionLiveOnlyCount = 0;
        for (const id of Array.from(liveIdSet)) {
            if (!backupIdSet.has(id)) {
                collectionLiveOnlyCount += 1;
            }
        }

        impactCollections.push({
            key: config.key,
            label: config.label,
            backupCount: backupRows.length,
            liveCount: liveIds.length,
            identifiedCount: backupIdSet.size,
            createCount: collectionCreateCount,
            overwriteCount: collectionOverwriteCount,
            liveOnlyCount: collectionLiveOnlyCount,
            rowsWithoutId: collectionRowsWithoutId,
        });

        backupRecords += backupRows.length;
        liveRecords += liveIds.length;
        identifiedRecords += backupIdSet.size;
        createCount += collectionCreateCount;
        overwriteCount += collectionOverwriteCount;
        liveOnlyCount += collectionLiveOnlyCount;
        rowsWithoutId += collectionRowsWithoutId;
    }

    const notes: string[] = [];
    if (overwriteCount > 0) {
        notes.push(`ไฟล์นี้มี ${overwriteCount} รายการที่ใช้ id ชนกับข้อมูลปัจจุบัน ถ้ากู้คืนจริงจะต้องมีนโยบาย overwrite ที่ชัดเจน`);
    }
    if (liveOnlyCount > 0) {
        notes.push(`ฐานข้อมูลปัจจุบันมี ${liveOnlyCount} รายการที่ไม่อยู่ในไฟล์ Backup นี้ หากทำ restore แบบแทนที่ทั้งหมดอาจกระทบข้อมูลใหม่ที่เกิดหลัง snapshot`);
    }
    if (rowsWithoutId > 0) {
        notes.push(`มี ${rowsWithoutId} รายการในไฟล์ที่ไม่มี id จึงยังประเมินผลกระทบแบบ create/overwrite ได้ไม่ครบ`);
    }
    if (notes.length === 0) {
        notes.push('ไม่พบ id collision กับข้อมูลปัจจุบันจากการตรวจแบบ dry-run เบื้องต้น');
    }

    return {
        hasExistingData: liveRecords > 0,
        hasIdCollisions: overwriteCount > 0,
        strategyHint: overwriteCount > 0 || liveOnlyCount > 0 || rowsWithoutId > 0 ? 'review_required' : 'create_only_candidate',
        totals: {
            backupRecords,
            liveRecords,
            identifiedRecords,
            createCount,
            overwriteCount,
            liveOnlyCount,
            rowsWithoutId,
        },
        collections: impactCollections,
        notes,
    };
}

export function previewBackupPayload(payload: unknown, fileName = 'backup.json'): BackupPreviewResult {
    return normalizeBackupPayload(payload, fileName).preview;
}

export function buildRestorePlan(preview: BackupPreviewResult, impact: BackupImpactResult, strategy: RestorePlanMode): RestorePlanResult {
    const collections = impact.collections.map((collection) => {
        const skipCount = strategy === 'create_only'
            ? collection.overwriteCount + collection.rowsWithoutId
            : collection.rowsWithoutId;

        return {
            key: collection.key,
            label: collection.label,
            backupCount: collection.backupCount,
            createCount: collection.createCount,
            overwriteCount: strategy === 'upsert_existing' ? collection.overwriteCount : 0,
            skipCount,
            liveOnlyCount: collection.liveOnlyCount,
            rowsWithoutId: collection.rowsWithoutId,
        };
    });

    const plannedCreates = collections.reduce((total, collection) => total + collection.createCount, 0);
    const plannedOverwrites = collections.reduce((total, collection) => total + collection.overwriteCount, 0);
    const skippedRecords = collections.reduce((total, collection) => total + collection.skipCount, 0);
    const liveOnlyCount = collections.reduce((total, collection) => total + collection.liveOnlyCount, 0);
    const affectedCollections = collections.filter((collection) => (collection.createCount + collection.overwriteCount) > 0).length;

    const warnings = [
        ...preview.issues.filter((issue) => issue.level === 'warning').map((issue) => issue.message),
        ...impact.notes,
    ];

    if (strategy === 'create_only' && impact.hasIdCollisions) {
        warnings.push('โหมด create_only จะข้ามรายการที่ id ชนกับข้อมูลปัจจุบันทั้งหมด');
    }

    if (strategy === 'upsert_existing' && impact.hasIdCollisions) {
        warnings.push('โหมด upsert_existing หมายถึงในการ restore จริงอนาคตจะมีรายการที่ถูกเขียนทับตาม id เดิม');
    }

    const prerequisites = [
        'ยืนยันว่าไฟล์ Backup มาจากระบบ export ที่เชื่อถือได้และอยู่ใน environment ที่ถูกต้อง',
        'ดาวน์โหลด Backup ล่าสุดจากข้อมูลปัจจุบันเก็บไว้ก่อนทุกครั้งเผื่อใช้เทียบ diff หรือย้อนตรวจสอบ',
        'กำหนด maintenance window หรือหยุดการเขียนข้อมูลสำคัญก่อนมี restore apply จริงในอนาคต',
        'ให้ admin review id collisions, live-only data และ rows without id ให้ครบก่อนอนุมัติ restore จริง',
    ];

    const limitations = [
        'แผนนี้เป็น plan-only ยังไม่มี endpoint สำหรับ restore apply จริง',
        'การวิเคราะห์นี้เทียบจาก id เป็นหลัก ยังไม่ได้เปรียบเทียบ field-level diff ของแต่ละ row',
        'ยังไม่มี transaction/rollback workflow สำหรับ restore จริง จึงต้อง review ด้วยคนก่อนเสมอ',
    ];

    return {
        fileName: preview.fileName,
        strategy,
        requiresManualReview: strategy === 'upsert_existing' || warnings.length > 0 || liveOnlyCount > 0 || skippedRecords > 0,
        summary: {
            backupRecords: impact.totals.backupRecords,
            plannedCreates,
            plannedOverwrites,
            skippedRecords,
            liveOnlyCount,
            affectedCollections,
        },
        collections,
        warnings,
        prerequisites,
        limitations,
    };
}
