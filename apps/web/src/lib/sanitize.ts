/**
 * Sanitize user input to prevent XSS attacks.
 * Strips HTML tags and encodes special characters.
 */
export function sanitizeInput(input: string): string {
    return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .trim();
}

/**
 * Sanitize and limit length of user input.
 */
export function sanitizeAndLimit(input: string, maxLength: number = 200): string {
    return sanitizeInput(input).slice(0, maxLength);
}

/**
 * Validate that input contains only safe characters (letters, numbers, Thai, spaces, basic punctuation).
 */
export function isSafeInput(input: string): boolean {
    // Allow Thai, alphanumeric, spaces, and basic punctuation
    return /^[\u0E00-\u0E7Fa-zA-Z0-9\s\-_.,!?()@#฿%:;'"\/\n]+$/.test(input);
}
