/**
 * Lightweight className helper.
 *
 * Accepts strings, numbers, booleans, undefined, null, and arrays
 * (recursively). Truthy values are joined by a single space.
 * Falsy values are ignored so conditional patterns work:
 *
 *   cn('base', isActive && 'active', disabled ? 'disabled' : undefined)
 *
 * Kept tiny and dependency-free on purpose so we don't touch
 * `package.json`. If the project later adds `clsx`/`tailwind-merge`
 * this file can be re-exported from those without changing callers.
 */
export type ClassValue = string | number | boolean | undefined | null | ClassValue[];

export function cn(...inputs: ClassValue[]): string {
    const parts: string[] = [];

    const walk = (value: ClassValue) => {
        if (!value && value !== 0) return;
        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (trimmed) parts.push(trimmed);
            return;
        }
        if (typeof value === 'number') {
            parts.push(String(value));
            return;
        }
        if (Array.isArray(value)) {
            for (const item of value) walk(item);
        }
    };

    for (const input of inputs) walk(input);
    return parts.join(' ');
}
