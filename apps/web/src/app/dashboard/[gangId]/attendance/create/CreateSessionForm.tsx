'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Calendar, Clock, DollarSign, ArrowLeft, Send, RefreshCw, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface Props {
    gangId: string;
}

export function CreateSessionForm({ gangId }: Props) {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Get today's date in YYYY-MM-DD format (local timezone, NOT UTC)
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // Get default times (start: now + 5min rounded, end: start + 30min)
    const getDefaultTimes = () => {
        const now = new Date();
        now.setMinutes(now.getMinutes() + 5);
        now.setMinutes(Math.ceil(now.getMinutes() / 5) * 5); // Round to nearest 5 min
        const startHour = now.getHours().toString().padStart(2, '0');
        const startMin = now.getMinutes().toString().padStart(2, '0');

        now.setMinutes(now.getMinutes() + 30);
        const endHour = now.getHours().toString().padStart(2, '0');
        const endMin = now.getMinutes().toString().padStart(2, '0');

        return {
            start: `${startHour}:${startMin}`,
            end: `${endHour}:${endMin}`,
        };
    };

    const defaultTimes = getDefaultTimes();

    // Generate default session name with Thai date
    const getDefaultSessionName = () => {
        const date = new Date();
        const day = date.getDate();
        const month = date.toLocaleDateString('th-TH', { month: 'long' });
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
            const startDateTime = new Date(`${sessionDate}T${startTime}`);
            const endDateTime = new Date(`${sessionDate}T${endTime}`);

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
                <label className="block text-sm font-medium text-gray-300 mb-2">
                    ชื่อรอบ <span className="text-red-400">*</span>
                </label>
                <input
                    type="text"
                    value={sessionName}
                    onChange={(e) => setSessionName(e.target.value)}
                    placeholder="เช็คชื่อ 5 กุมภาพันธ์"
                    className="w-full bg-black/30 border border-white/10 text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none placeholder:text-gray-600"
                    autoFocus
                />
            </div>


            {/* Time Window */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        <Clock className="w-4 h-4 inline mr-1" />
                        เปิดเช็คชื่อ
                    </label>
                    <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full bg-black/30 border border-white/10 text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <p className="text-xs text-gray-500 mt-1">กดเช็คชื่อได้ตั้งแต่เวลานี้</p>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        <Clock className="w-4 h-4 inline mr-1 text-red-400" />
                        หมดเขต
                    </label>
                    <input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className={`w-full bg-black/30 border text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none ${!isTimeValid ? 'border-red-500' : 'border-white/10'
                            }`}
                    />
                    <p className="text-xs text-gray-500 mt-1">หลังเวลานี้ = ขาด</p>
                    {!isTimeValid && (
                        <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> ต้องมากกว่าเวลาเปิด</p>
                    )}
                </div>
            </div>

            {/* Absent Penalty - Optional */}
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                    <DollarSign className="w-4 h-4 inline mr-1" />
                    ค่าปรับขาด <span className="text-gray-500">(ไม่บังคับ)</span>
                </label>
                <input
                    type="number"
                    value={absentPenalty}
                    onChange={(e) => setAbsentPenalty(Number(e.target.value))}
                    min={0}
                    placeholder="0"
                    className="w-full bg-black/30 border border-white/10 text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none"
                />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
                <Link
                    href={`/dashboard/${gangId}/attendance`}
                    className="flex items-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl font-medium transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    ยกเลิก
                </Link>
                <button
                    type="submit"
                    disabled={isSubmitting || !isTimeValid}
                    className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white rounded-xl font-bold shadow-lg shadow-green-500/20 transition-all disabled:opacity-50"
                >
                    {isSubmitting ? (
                        <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            กำลังสร้าง...
                        </>
                    ) : (
                        <>
                            <Send className="w-4 h-4" />
                            สร้างและส่ง Discord
                        </>
                    )}
                </button>
            </div>
        </form>
    );
}
