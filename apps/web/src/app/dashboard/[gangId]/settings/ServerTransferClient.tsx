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
            <div className="bg-orange-500/5 border border-orange-500/20 rounded-2xl p-6 shadow-xl space-y-5">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-orange-500/10 rounded-xl">
                            <ArrowRightLeft className="w-5 h-5 text-orange-400 animate-pulse" />
                        </div>
                        <div>
                            <h3 className="font-bold text-orange-400">กำลังย้ายเซิร์ฟ...</h3>
                            {startedAt && (
                                <p className="text-[10px] text-gray-500">
                                    เริ่มเมื่อ {startedAt.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok',  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </p>
                            )}
                        </div>
                    </div>
                    <button onClick={fetchStatus} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors text-gray-500 hover:text-white">
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>

                {/* Deadline countdown */}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-black/20 border border-white/5">
                    <Clock className="w-4 h-4 text-blue-400 shrink-0" />
                    <div className="flex-1">
                        <span className="text-xs text-gray-400">เหลือเวลา</span>
                        <p className={`text-sm font-bold ${status.deadlinePassed ? 'text-red-400' : 'text-white'}`}>
                            {getTimeLeft()}
                        </p>
                    </div>
                    {deadline && (
                        <span className="text-[10px] text-gray-600">
                            {deadline.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                    )}
                </div>

                {/* Progress stats */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-center">
                        <UserCheck className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
                        <p className="text-lg font-black text-emerald-400">{counts.confirmed}</p>
                        <p className="text-[10px] text-gray-500">ยืนยัน</p>
                    </div>
                    <div className="p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/20 text-center">
                        <Users className="w-4 h-4 text-yellow-400 mx-auto mb-1" />
                        <p className="text-lg font-black text-yellow-400">{counts.pending}</p>
                        <p className="text-[10px] text-gray-500">รอยืนยัน</p>
                    </div>
                    <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/20 text-center">
                        <UserX className="w-4 h-4 text-red-400 mx-auto mb-1" />
                        <p className="text-lg font-black text-red-400">{counts.left}</p>
                        <p className="text-[10px] text-gray-500">ออกจากแก๊ง</p>
                    </div>
                </div>

                {/* Progress bar */}
                <div>
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] text-gray-400">ยืนยันแล้ว</span>
                        <span className="text-[11px] text-gray-400 font-bold">{confirmedPct}%</span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                            style={{ width: `${confirmedPct}%` }}
                        />
                    </div>
                </div>

                {/* Member list */}
                {status.members && status.members.length > 0 && (
                    <div className="max-h-48 overflow-y-auto space-y-1 rounded-xl bg-black/20 border border-white/5 p-2">
                        {status.members.map(m => (
                            <div key={m.id} className="flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-white/[0.02]">
                                <span className="text-xs text-gray-300 truncate">
                                    {m.gangRole === 'OWNER' && '👑 '}{m.name}
                                </span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${m.transferStatus === 'CONFIRMED' ? 'bg-emerald-500/10 text-emerald-400' :
                                        m.transferStatus === 'LEFT' ? 'bg-red-500/10 text-red-400' :
                                            'bg-yellow-500/10 text-yellow-400'
                                    }`}>
                                    {m.transferStatus === 'CONFIRMED' ? 'ยืนยัน' : m.transferStatus === 'LEFT' ? 'ออก' : 'รอ'}
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-3 pt-1">
                    <button
                        onClick={() => setConfirmCancel(true)}
                        disabled={!!actionLoading}
                        className="flex-1 py-2.5 rounded-xl text-sm font-bold text-gray-400 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {actionLoading === 'cancel' ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                        ยกเลิก
                    </button>
                    <button
                        onClick={() => setConfirmStop(true)}
                        disabled={!!actionLoading}
                        className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {actionLoading === 'complete' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}
                        หยุดทันที
                    </button>
                </div>
                <p className="text-[10px] text-gray-600 text-center">
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
                    icon={<X className="w-6 h-6 text-yellow-500" />}
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
                    icon={<Square className="w-6 h-6 text-red-500" />}
                />
            </div>
        );
    }

    // ─── DEFAULT: Start transfer form ───
    return (
        <div className="bg-[#151515] border border-white/5 rounded-2xl p-6 shadow-xl">
            <h3 className="font-bold text-lg mb-2 flex items-center gap-2 text-white">
                <ArrowRightLeft className="w-5 h-5 text-orange-400" />
                ย้ายเซิร์ฟเกม
            </h3>
            <p className="text-xs text-gray-500 mb-6">
                ใช้เมื่อแก๊งย้ายไปเล่นเซิร์ฟเวอร์ใหม่ — ข้อมูลทั้งหมดจะถูกลบ, Bot แจ้งสมาชิกให้ยืนยัน, และติดตามสถานะ real-time
            </p>

            {!showConfirm ? (
                <button
                    onClick={() => setShowConfirm(true)}
                    className="w-full py-3 rounded-xl text-sm font-bold text-orange-400 bg-orange-500/5 border border-orange-500/20 hover:bg-orange-500/10 transition-colors flex items-center justify-center gap-2"
                >
                    <ArrowRightLeft className="w-4 h-4" />
                    เริ่มกระบวนการย้ายเซิร์ฟ
                </button>
            ) : (
                <div className="space-y-4">
                    {/* Force Delete Warning */}
                    <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4">
                        <div className="flex items-start gap-2.5">
                            <ShieldAlert className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                            <div>
                                <p className="text-sm font-bold text-red-400 mb-2">ข้อมูลทั้งหมดต่อไปนี้จะถูกลบถาวร:</p>
                                <ul className="space-y-1 text-xs text-red-300/80">
                                    <li>• ธุรกรรมและยอดเงินกองกลางทั้งหมด + ยอดสุทธิสมาชิกทุกคน reset เป็น 0</li>
                                    <li>• ประวัติเช็คชื่อ, session, และบันทึกการเข้างานทั้งหมด</li>
                                    <li>• คำขอลาและประวัติการลาทั้งหมด</li>
                                </ul>
                                <p className="text-[10px] text-red-500/60 mt-2 font-bold">⚠️ ไม่สามารถกู้คืนได้หลังดำเนินการ</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-orange-500/5 border border-orange-500/20 rounded-xl p-3">
                        <div className="flex items-start gap-2">
                            <AlertTriangle className="w-3.5 h-3.5 text-orange-400 mt-0.5 shrink-0" />
                            <p className="text-[11px] text-orange-300">
                                Bot จะส่งประกาศไป Discord — สมาชิกกดยืนยัน/ออก ได้ทันที — สมาชิกที่ไม่ยืนยันภายใน deadline จะถูก deactivate
                            </p>
                        </div>
                    </div>

                    {/* Deadline */}
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                        <CalendarClock className="w-4 h-4 text-blue-400 shrink-0" />
                        <span className="text-xs text-gray-400 font-bold">Deadline</span>
                        <select
                            value={`${deadlineMode}_${deadlineValue}`}
                            onChange={e => {
                                const [mode, val] = e.target.value.split('_');
                                setDeadlineMode(mode as 'hours' | 'days');
                                setDeadlineValue(Number(val));
                            }}
                            className="bg-black/40 border border-white/10 text-white text-xs rounded-lg px-3 py-1.5 outline-none flex-1"
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
                            onClick={() => setShowConfirm(false)}
                            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-gray-400 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                        >
                            ยกเลิก
                        </button>
                        <button
                            onClick={handleTransfer}
                            disabled={loading}
                            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
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
