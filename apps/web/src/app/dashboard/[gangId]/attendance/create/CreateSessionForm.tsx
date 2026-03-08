'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Calendar, Clock, DollarSign, ArrowLeft, Send, RefreshCw, AlertCircle, Lock, Zap } from 'lucide-react';
import Link from 'next/link';

interface Props {
    gangId: string;
    hasFinance?: boolean;
}

export function CreateSessionForm({ gangId, hasFinance = true }: Props) {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Get today's date in YYYY-MM-DD format (Bangkok timezone)
    const getBangkokNow = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));

    const now = getBangkokNow();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // Get default times (start: now + 5min rounded, end: start + 30min)
    const getDefaultTimes = () => {
        const d = getBangkokNow();
        d.setMinutes(d.getMinutes() + 5);
        d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5); // Round to nearest 5 min
        const startHour = d.getHours().toString().padStart(2, '0');
        const startMin = d.getMinutes().toString().padStart(2, '0');

        d.setMinutes(d.getMinutes() + 30);
        const endHour = d.getHours().toString().padStart(2, '0');
        const endMin = d.getMinutes().toString().padStart(2, '0');

        return {
            start: `${startHour}:${startMin}`,
            end: `${endHour}:${endMin}`,
        };
    };

    const defaultTimes = getDefaultTimes();

    // Generate default session name with Thai date
    const getDefaultSessionName = () => {
        const date = getBangkokNow();
        const day = date.getDate();
        const month = date.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', month: 'long' });
        return `เช็คชื่อ ${day} ${month}`;
    };

    // Form state with defaults
    const [sessionName, setSessionName] = useState(getDefaultSessionName());
    const [sessionDate, setSessionDate] = useState(today);
    const [startTime, setStartTime] = useState(defaultTimes.start);
    const [endTime, setEndTime] = useState(defaultTimes.end);
    const [absentPenalty, setAbsentPenalty] = useState(0);

    // Validate end time is after start time
    const isTimeValid = endTime > startTime;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!sessionName.trim()) {
            setSessionName(getDefaultSessionName());
        }

        if (!isTimeValid) {
            toast.error('เวลาหมดเขตต้องมากกว่าเวลาเปิด');
            return;
        }

        setIsSubmitting(true);
        try {
            // Force Asia/Bangkok (+07:00) parsing
            const startDateTime = new Date(`${sessionDate}T${startTime}:00+07:00`);
            const endDateTime = new Date(`${sessionDate}T${endTime}:00+07:00`);

            const res = await fetch(`/api/gangs/${gangId}/attendance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionName,
                    sessionDate: new Date(sessionDate),
                    startTime: startDateTime,
                    endTime: endDateTime,
                    absentPenalty,
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to create session');
            }

            toast.success('สร้างรอบเช็คชื่อสำเร็จ! 📋', {
                description: 'ส่งปุ่มเช็คชื่อไป Discord แล้ว',
            });
            router.push(`/dashboard/${gangId}/attendance`);
            router.refresh();
        } catch (error: any) {
            console.error(error);
            toast.error('สร้างรอบไม่สำเร็จ', {
                description: error.message || 'กรุณาลองใหม่อีกครั้ง',
            });
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Session Name */}
            <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-2 tracking-wide">
                    ชื่อรอบ <span className="text-rose-400">*</span>
                </label>
                <input
                    type="text"
                    value={sessionName}
                    onChange={(e) => setSessionName(e.target.value)}
                    placeholder="เช็คชื่อ 5 กุมภาพันธ์"
                    className="w-full bg-[#0A0A0A] border border-white/10 hover:border-white/20 text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 outline-none placeholder:text-zinc-600 transition-all shadow-inner"
                    autoFocus
                />
            </div>

            {/* Time Window */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                    <label className="block text-sm font-semibold text-zinc-300 mb-2 tracking-wide flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-emerald-400" />
                        เปิดเช็คชื่อ
                    </label>
                    <input
                        type="time"
                        lang="th-TH"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full bg-[#0A0A0A] border border-white/10 hover:border-white/20 text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 outline-none transition-all shadow-inner [color-scheme:dark]"
                    />
                    <p className="text-[11px] text-zinc-500 mt-2 font-medium">สมาชิกจะเริ่มกดเช็คชื่อได้ตั้งแต่เวลานี้</p>
                </div>
                <div>
                    <label className="block text-sm font-semibold text-zinc-300 mb-2 tracking-wide flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-rose-400" />
                        หมดเขต
                    </label>
                    <input
                        type="time"
                        lang="th-TH"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className={`w-full bg-[#0A0A0A] border text-white rounded-xl px-4 py-3 focus:ring-2 focus:border-transparent outline-none transition-all shadow-inner [color-scheme:dark] ${!isTimeValid ? 'border-rose-500/50 focus:ring-rose-500/50 bg-rose-500/5' : 'border-white/10 hover:border-white/20 focus:ring-emerald-500/50 focus:border-emerald-500/50'
                            }`}
                    />
                    <p className="text-[11px] text-zinc-500 mt-2 font-medium">หลังเวลานี้ ระบบจะล็อคและถือว่าขาด</p>
                    {!isTimeValid && (
                        <p className="text-[11px] text-rose-400 mt-2 flex items-center gap-1.5 font-medium bg-rose-500/10 w-fit px-2 py-1 rounded-md border border-rose-500/20"><AlertCircle className="w-3 h-3" /> ต้องมากกว่าเวลาเปิด</p>
                    )}
                </div>
            </div>

            {/* Absent Penalty - Optional */}
            <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-2 tracking-wide flex items-center gap-1.5">
                    {hasFinance ? <DollarSign className="w-4 h-4 text-zinc-400" /> : <Lock className="w-4 h-4 text-amber-500" />}
                    ค่าปรับขาด <span className="text-zinc-500 font-normal">(ไม่บังคับ)</span>
                </label>
                {hasFinance ? (
                    <div className="relative">
                        <input
                            type="number"
                            value={absentPenalty || ''}
                            onChange={(e) => setAbsentPenalty(Number(e.target.value))}
                            min={0}
                            placeholder="0"
                            className="w-full bg-[#0A0A0A] border border-white/10 hover:border-white/20 text-white rounded-xl pl-4 pr-12 py-3 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 outline-none transition-all shadow-inner tabular-nums font-medium"
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                            <span className="text-zinc-500 font-medium">฿</span>
                        </div>
                    </div>
                ) : (
                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
                        <p className="text-sm text-amber-500 font-semibold mb-1.5 flex items-center gap-1.5">
                            <Lock className="w-4 h-4" /> ฟีเจอร์ค่าปรับอัตโนมัติต้องใช้แพลน Pro ขึ้นไป
                        </p>
                        <p className="text-xs text-zinc-400 mb-3 font-medium leading-relaxed">แพลนปัจจุบันไม่รองรับการเชื่อมต่อกับระบบการเงิน อัปเกรดเพื่อหักเงินคนที่ตื่นสายหรือขาดงานแบบอัตโนมัติ</p>
                        <a href={`/dashboard/${gangId}/settings?tab=subscription`} className="inline-flex items-center justify-center gap-1.5 text-[11px] font-bold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-1.5 rounded-lg transition-colors uppercase tracking-widest border border-amber-500/20">
                            <Zap className="w-3.5 h-3.5" /> อัปเกรดแพลน
                        </a>
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-6 sm:pt-4 border-t border-white/5">
                <Link
                    href={`/dashboard/${gangId}/attendance`}
                    className="flex justify-center items-center gap-2 px-6 py-2.5 bg-white/5 hover:bg-white/10 text-zinc-300 rounded-xl font-semibold transition-colors border border-white/10 shadow-sm"
                >
                    <ArrowLeft className="w-4 h-4" />
                    ยกเลิก
                </Link>
                <button
                    type="submit"
                    disabled={isSubmitting || !isTimeValid}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:shadow-[0_0_20px_rgba(16,185,129,0.5)] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-[0_0_15px_rgba(16,185,129,0.3)] disabled:hover:-translate-y-0 transform hover:-translate-y-0.5"
                >
                    {isSubmitting ? (
                        <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            กำลังสร้างรอบ...
                        </>
                    ) : (
                        <>
                            <Send className="w-4 h-4" />
                            สร้างและส่งปุ่มไป Discord
                        </>
                    )}
                </button>
            </div>
        </form>
    );
}
