'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowRightLeft, Loader2, AlertTriangle, Check, CalendarClock, Zap, ShieldAlert, Users, UserCheck, UserX, Clock, X, Square, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmModal } from '@/components/ConfirmModal';

interface TransferMember {
    id: string;
    name: string;
    transferStatus: 'PENDING' | 'CONFIRMED' | 'LEFT';
    gangRole: string;
}

interface TransferStatus {
    transferStatus: string;
    deadline?: string;
    startedAt?: string;
    deadlinePassed?: boolean;
    counts?: { total: number; confirmed: number; left: number; pending: number };
    members?: TransferMember[];
}

interface Props {
    gangId: string;
    gangName: string;
    initialTransferStatus?: string;
}

export function ServerTransferClient({ gangId, gangName, initialTransferStatus = 'NONE' }: Props) {
    const [showConfirm, setShowConfirm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [deadlineMode, setDeadlineMode] = useState<'hours' | 'days'>('days');
    const [deadlineValue, setDeadlineValue] = useState(3);
    const [status, setStatus] = useState<TransferStatus | null>(null);
    const [isActive, setIsActive] = useState(initialTransferStatus === 'ACTIVE');
    const [confirmCancel, setConfirmCancel] = useState(false);
    const [confirmStop, setConfirmStop] = useState(false);
    const [confirmText, setConfirmText] = useState('');
    const canStartTransfer = confirmText.trim() === gangName.trim();

    // Poll transfer status
    const fetchStatus = useCallback(async () => {
        try {
            const res = await fetch(`/api/gangs/${gangId}/server-transfer`);
            if (!res.ok) return;
            const data = await res.json();
            setStatus(data);
            setIsActive(data.transferStatus === 'ACTIVE');
        } catch { }
    }, [gangId]);

    useEffect(() => {
        if (initialTransferStatus === 'ACTIVE' || isActive) {
            fetchStatus();
            const interval = setInterval(fetchStatus, 8000);
            return () => clearInterval(interval);
        }
    }, [isActive, fetchStatus, initialTransferStatus]);

    // Start transfer
    const handleTransfer = async () => {
        setLoading(true);
        try {
            const payload: any = {};
            if (deadlineMode === 'hours') {
                payload.deadlineHours = deadlineValue;
            } else {
                payload.deadlineDays = deadlineValue;
            }
            payload.confirmationText = confirmText;

            const res = await fetch(`/api/gangs/${gangId}/server-transfer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const err = await res.json();
                toast.error(err.error || 'เกิดข้อผิดพลาด');
                return;
            }

            toast.success('เริ่มกระบวนการย้ายเซิร์ฟสำเร็จ — ส่งแจ้งเตือนไป Discord แล้ว');
            setShowConfirm(false);
            setConfirmText('');
            setIsActive(true);
            fetchStatus();
        } catch {
            toast.error('ไม่สามารถเชื่อมต่อได้');
        } finally {
            setLoading(false);
        }
    };

    // Cancel transfer
    const handleCancel = async () => {
        setConfirmCancel(false);
        setActionLoading('cancel');
        try {
            const res = await fetch(`/api/gangs/${gangId}/server-transfer`, { method: 'DELETE' });
            if (!res.ok) {
                const err = await res.json();
                toast.error(err.error || 'เกิดข้อผิดพลาด');
                return;
            }
            toast.success('ยกเลิกการย้ายเซิร์ฟแล้ว');
            setIsActive(false);
            setStatus(null);
        } catch {
            toast.error('ไม่สามารถเชื่อมต่อได้');
        } finally {
            setActionLoading(null);
        }
    };

    // Force complete
    const handleForceComplete = async () => {
        setConfirmStop(false);
        setActionLoading('complete');
        try {
            const res = await fetch(`/api/gangs/${gangId}/server-transfer`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            });
            if (!res.ok) {
                const err = await res.json();
                toast.error(err.error || 'เกิดข้อผิดพลาด');
                return;
            }
            const data = await res.json();
            toast.success(`ย้ายเซิร์ฟเสร็จสิ้น — deactivate ${data.deactivatedCount} คน`);
            setIsActive(false);
            setStatus(null);
        } catch {
            toast.error('ไม่สามารถเชื่อมต่อได้');
        } finally {
            setActionLoading(null);
        }
    };

    // ─── ACTIVE TRANSFER VIEW ───
    if (isActive && status?.transferStatus === 'ACTIVE') {
        const counts = status.counts || { total: 0, confirmed: 0, left: 0, pending: 0 };
        const deadline = status.deadline ? new Date(status.deadline) : null;
        const startedAt = status.startedAt ? new Date(status.startedAt) : null;

        // Countdown
        const getTimeLeft = () => {
            if (!deadline) return '';
            const diff = deadline.getTime() - Date.now();
            if (diff <= 0) return 'หมดเวลาแล้ว';
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            if (hours > 24) return `${Math.floor(hours / 24)} วัน ${hours % 24} ชม.`;
            return `${hours} ชม. ${mins} นาที`;
        };

        const confirmedPct = counts.total > 0 ? Math.round((counts.confirmed / counts.total) * 100) : 0;

        return (
            <div className="bg-status-warning-subtle border border-status-warning rounded-token-2xl p-6 shadow-token-sm space-y-5">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-status-warning-subtle rounded-token-xl">
                            <ArrowRightLeft className="w-5 h-5 text-fg-warning animate-pulse" />
                        </div>
                        <div>
                            <h3 className="font-bold text-fg-warning">กำลังย้ายเซิร์ฟ...</h3>
                            {startedAt && (
                                <p className="text-[10px] text-fg-tertiary">
                                    เริ่มเมื่อ {startedAt.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok',  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </p>
                            )}
                        </div>
                    </div>
                    <button onClick={fetchStatus} className="p-1.5 rounded-token-lg hover:bg-bg-muted transition-colors text-fg-tertiary hover:text-fg-primary">
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>

                {/* Deadline countdown */}
                <div className="flex items-center gap-3 p-3 rounded-token-xl bg-bg-muted border border-border-subtle">
                    <Clock className="w-4 h-4 text-fg-info shrink-0" />
                    <div className="flex-1">
                        <span className="text-xs text-fg-secondary">เหลือเวลา</span>
                        <p className={`text-sm font-bold ${status.deadlinePassed ? 'text-fg-danger' : 'text-fg-primary'}`}>
                            {getTimeLeft()}
                        </p>
                    </div>
                    {deadline && (
                        <span className="text-[10px] text-fg-tertiary">
                            {deadline.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                    )}
                </div>

                {/* Progress stats */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-token-xl bg-status-success-subtle border border-status-success text-center">
                        <UserCheck className="w-4 h-4 text-fg-success mx-auto mb-1" />
                        <p className="text-lg font-black text-fg-success">{counts.confirmed}</p>
                        <p className="text-[10px] text-fg-tertiary">ยืนยัน</p>
                    </div>
                    <div className="p-3 rounded-token-xl bg-status-warning-subtle border border-status-warning text-center">
                        <Users className="w-4 h-4 text-fg-warning mx-auto mb-1" />
                        <p className="text-lg font-black text-fg-warning">{counts.pending}</p>
                        <p className="text-[10px] text-fg-tertiary">รอยืนยัน</p>
                    </div>
                    <div className="p-3 rounded-token-xl bg-status-danger-subtle border border-status-danger text-center">
                        <UserX className="w-4 h-4 text-fg-danger mx-auto mb-1" />
                        <p className="text-lg font-black text-fg-danger">{counts.left}</p>
                        <p className="text-[10px] text-fg-tertiary">ออกจากแก๊ง</p>
                    </div>
                </div>

                {/* Progress bar */}
                <div>
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] text-fg-secondary">ยืนยันแล้ว</span>
                        <span className="text-[11px] text-fg-secondary font-bold">{confirmedPct}%</span>
                    </div>
                    <div className="h-2 bg-bg-muted rounded-token-full overflow-hidden">
                        <div
                            className="h-full bg-status-success rounded-token-full transition-all duration-500"
                            style={{ width: `${confirmedPct}%` }}
                        />
                    </div>
                </div>

                {/* Member list */}
                {status.members && status.members.length > 0 && (
                    <div className="max-h-48 overflow-auto rounded-token-xl bg-bg-muted border border-border-subtle">
                        <table className="min-w-[420px] w-full text-left">
                            <thead className="sticky top-0 z-10 bg-bg-muted border-b border-border-subtle">
                                <tr>
                                    <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">สมาชิก</th>
                                    <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-fg-tertiary text-right">สถานะ</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-subtle">
                                {status.members.map(m => (
                                    <tr key={m.id} className="hover:bg-bg-elevated transition-colors">
                                        <td className="px-3 py-2 text-xs text-fg-secondary truncate">
                                            {m.gangRole === 'OWNER' && '👑 '}{m.name}
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                            <span className={`inline-flex text-[10px] font-bold px-2 py-0.5 rounded-token-full ${m.transferStatus === 'CONFIRMED' ? 'bg-status-success-subtle text-fg-success' :
                                                    m.transferStatus === 'LEFT' ? 'bg-status-danger-subtle text-fg-danger' :
                                                        'bg-status-warning-subtle text-fg-warning'
                                                }`}>
                                                {m.transferStatus === 'CONFIRMED' ? 'ยืนยัน' : m.transferStatus === 'LEFT' ? 'ออก' : 'รอ'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-3 pt-1">
                    <button
                        onClick={() => setConfirmCancel(true)}
                        disabled={!!actionLoading}
                        className="flex-1 py-2.5 rounded-token-xl text-sm font-bold text-fg-secondary bg-bg-muted border border-border-subtle hover:bg-bg-elevated transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {actionLoading === 'cancel' ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                        ยกเลิก
                    </button>
                    <button
                        onClick={() => setConfirmStop(true)}
                        disabled={!!actionLoading}
                        className="flex-1 py-2.5 rounded-token-xl text-sm font-bold text-fg-inverse bg-status-danger hover:brightness-110 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {actionLoading === 'complete' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}
                        หยุดทันที
                    </button>
                </div>
                <p className="text-[10px] text-fg-tertiary text-center">
                    หยุดทันที = deactivate สมาชิกที่ยังไม่ยืนยัน | ยกเลิก = ยกเลิกการย้ายเซิร์ฟ
                </p>

                {/* Cancel Confirm Modal */}
                <ConfirmModal
                    isOpen={confirmCancel}
                    onClose={() => setConfirmCancel(false)}
                    onConfirm={handleCancel}
                    title="ยกเลิกการย้ายเซิร์ฟ"
                    description="ต้องการยกเลิกการย้ายเซิร์ฟใช่ไหม? ข้อมูลที่ลบไปแล้วจะไม่กลับมา แต่สมาชิกจะไม่ถูก deactivate เพิ่ม"
                    confirmText="ยืนยันยกเลิก"
                    cancelText="ไม่ใช่"
                    variant="warning"
                    icon={<X className="w-6 h-6 text-fg-warning" />}
                />

                {/* Force Stop Confirm Modal */}
                <ConfirmModal
                    isOpen={confirmStop}
                    onClose={() => setConfirmStop(false)}
                    onConfirm={handleForceComplete}
                    title="หยุดทันที"
                    description="สมาชิกที่ยังไม่กดยืนยันจะถูก deactivate ทันที ต้องการดำเนินการต่อใช่ไหม?"
                    confirmText="หยุดทันที"
                    cancelText="ยังก่อน"
                    variant="danger"
                    icon={<Square className="w-6 h-6 text-fg-danger" />}
                />
            </div>
        );
    }

    // ─── DEFAULT: Start transfer form ───
    return (
        <div className="bg-bg-subtle border border-border-subtle rounded-token-2xl p-6 shadow-token-sm">
            <h3 className="font-bold text-lg mb-2 flex items-center gap-2 text-fg-primary">
                <ArrowRightLeft className="w-5 h-5 text-fg-warning" />
                ย้ายเซิร์ฟเกม
            </h3>
            <p className="text-xs text-fg-tertiary mb-6">
                ใช้เมื่อแก๊งย้ายไปเล่นเซิร์ฟเวอร์ใหม่ — ข้อมูลทั้งหมดจะถูกลบ, Bot แจ้งสมาชิกให้ยืนยัน, และติดตามสถานะ real-time
            </p>

            {!showConfirm ? (
                <button
                    onClick={() => setShowConfirm(true)}
                    className="w-full py-3 rounded-token-xl text-sm font-bold text-fg-warning bg-status-warning-subtle border border-status-warning hover:brightness-110 transition-colors flex items-center justify-center gap-2"
                >
                    <ArrowRightLeft className="w-4 h-4" />
                    เริ่มกระบวนการย้ายเซิร์ฟ
                </button>
            ) : (
                <div className="space-y-4">
                    {/* Force Delete Warning */}
                    <div className="bg-status-danger-subtle border border-status-danger rounded-token-xl p-4">
                        <div className="flex items-start gap-2.5">
                            <ShieldAlert className="w-5 h-5 text-fg-danger mt-0.5 shrink-0" />
                            <div>
                                <p className="text-sm font-bold text-fg-danger mb-2">ข้อมูลทั้งหมดต่อไปนี้จะถูกลบถาวร:</p>
                                <ul className="space-y-1 text-xs text-fg-danger">
                                    <li>• ธุรกรรมและยอดเงินกองกลางทั้งหมด + ยอดสุทธิสมาชิกทุกคน reset เป็น 0</li>
                                    <li>• ประวัติเช็คชื่อ, session, และบันทึกการเข้างานทั้งหมด</li>
                                    <li>• คำขอลาและประวัติการลาทั้งหมด</li>
                                </ul>
                                <p className="text-[10px] text-fg-danger mt-2 font-bold">⚠️ ไม่สามารถกู้คืนได้หลังดำเนินการ</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-status-warning-subtle border border-status-warning rounded-token-xl p-3">
                        <div className="flex items-start gap-2">
                            <AlertTriangle className="w-3.5 h-3.5 text-fg-warning mt-0.5 shrink-0" />
                            <p className="text-[11px] text-fg-warning">
                                Bot จะส่งประกาศไป Discord — สมาชิกกดยืนยัน/ออก ได้ทันที — สมาชิกที่ไม่ยืนยันภายใน deadline จะถูก deactivate
                            </p>
                        </div>
                    </div>

                    <div className="rounded-token-xl border border-border-subtle bg-bg-muted p-3">
                        <label htmlFor="server-transfer-confirm" className="block text-xs font-bold text-fg-secondary mb-1.5">
                            พิมพ์ชื่อแก๊งเพื่อยืนยัน
                        </label>
                        <input
                            id="server-transfer-confirm"
                            value={confirmText}
                            onChange={e => setConfirmText(e.target.value)}
                            placeholder={gangName}
                            className="w-full rounded-token-lg border border-border-subtle bg-bg-subtle px-3 py-2 text-sm text-fg-primary outline-none focus:border-status-danger"
                        />
                        <p className="mt-1.5 text-[10px] text-fg-tertiary">
                            ต้องพิมพ์ให้ตรงกับ <span className="font-bold text-fg-secondary">{gangName}</span> ก่อนระบบจะเริ่มลบข้อมูลและประกาศย้ายเซิร์ฟเวอร์
                        </p>
                    </div>

                    {/* Deadline */}
                    <div className="flex items-center gap-3 p-3 rounded-token-xl bg-bg-muted border border-border-subtle">
                        <CalendarClock className="w-4 h-4 text-fg-info shrink-0" />
                        <span className="text-xs text-fg-secondary font-bold">Deadline</span>
                        <select
                            value={`${deadlineMode}_${deadlineValue}`}
                            onChange={e => {
                                const [mode, val] = e.target.value.split('_');
                                setDeadlineMode(mode as 'hours' | 'days');
                                setDeadlineValue(Number(val));
                            }}
                            className="bg-bg-subtle border border-border-subtle text-fg-primary text-xs rounded-token-lg px-3 py-1.5 outline-none flex-1"
                        >
                            <option value="hours_12">12 ชั่วโมง</option>
                            <option value="days_1">1 วัน</option>
                            <option value="days_3">3 วัน</option>
                            <option value="days_5">5 วัน</option>
                            <option value="days_7">7 วัน</option>
                            <option value="days_14">14 วัน</option>
                        </select>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                        <button
                            onClick={() => {
                                setShowConfirm(false);
                                setConfirmText('');
                            }}
                            className="flex-1 py-2.5 rounded-token-xl text-sm font-bold text-fg-secondary bg-bg-muted border border-border-subtle hover:bg-bg-elevated transition-colors"
                        >
                            ยกเลิก
                        </button>
                        <button
                            onClick={handleTransfer}
                            disabled={loading || !canStartTransfer}
                            className="flex-1 py-2.5 rounded-token-xl text-sm font-bold text-fg-inverse bg-status-danger hover:brightness-110 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {loading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Zap className="w-4 h-4" />
                            )}
                            {loading ? 'กำลังดำเนินการ...' : 'ยืนยันย้ายเซิร์ฟทันที'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
