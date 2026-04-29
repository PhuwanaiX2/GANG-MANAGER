const PROMPTPAY_BILLING_PAUSE_MESSAGE =
    'PromptPay billing is temporarily disabled. Please contact support before trying again.';

export function isPromptPayBillingEnabled() {
    return process.env.ENABLE_PROMPTPAY_BILLING === 'true';
}

export function getPromptPayBillingPauseMessage() {
    return PROMPTPAY_BILLING_PAUSE_MESSAGE;
}

export function getPromptPayReceiverConfig() {
    const displayName = process.env.PROMPTPAY_RECEIVER_NAME?.trim() || '';
    const identifier = process.env.PROMPTPAY_IDENTIFIER?.trim() || '';

    return {
        displayName,
        identifier,
        isConfigured: Boolean(displayName && identifier),
    };
}
