/** Format current time as Thai string for embed footers (replaces .setTimestamp()) */
export function thaiTimestamp(date?: Date): string {
    const d = date || new Date();
    return d.toLocaleString('th-TH', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Bangkok',
    });
}
