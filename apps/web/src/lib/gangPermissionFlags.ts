export type GangPermissionLevel =
    | 'OWNER'
    | 'ADMIN'
    | 'TREASURER'
    | 'ATTENDANCE_OFFICER'
    | 'MEMBER';

export type GangPermissionFlags = {
    level: GangPermissionLevel | 'NONE';
    isOwner: boolean;
    isAdmin: boolean;
    isTreasurer: boolean;
    isAttendanceOfficer: boolean;
    isMember: boolean;
};

const NO_GANG_PERMISSION_FLAGS: GangPermissionFlags = {
    level: 'NONE',
    isOwner: false,
    isAdmin: false,
    isTreasurer: false,
    isAttendanceOfficer: false,
    isMember: false,
};

export function getGangPermissionFlags(role: string | null | undefined): GangPermissionFlags {
    switch (role) {
        case 'OWNER':
            return {
                level: 'OWNER',
                isOwner: true,
                isAdmin: true,
                isTreasurer: true,
                isAttendanceOfficer: true,
                isMember: true,
            };
        case 'ADMIN':
            return {
                level: 'ADMIN',
                isOwner: false,
                isAdmin: true,
                isTreasurer: false,
                isAttendanceOfficer: true,
                isMember: true,
            };
        case 'TREASURER':
            return {
                level: 'TREASURER',
                isOwner: false,
                isAdmin: false,
                isTreasurer: true,
                isAttendanceOfficer: false,
                isMember: true,
            };
        case 'ATTENDANCE_OFFICER':
            return {
                level: 'ATTENDANCE_OFFICER',
                isOwner: false,
                isAdmin: false,
                isTreasurer: false,
                isAttendanceOfficer: true,
                isMember: true,
            };
        case 'MEMBER':
            return {
                level: 'MEMBER',
                isOwner: false,
                isAdmin: false,
                isTreasurer: false,
                isAttendanceOfficer: false,
                isMember: true,
            };
        default:
            return { ...NO_GANG_PERMISSION_FLAGS };
    }
}
