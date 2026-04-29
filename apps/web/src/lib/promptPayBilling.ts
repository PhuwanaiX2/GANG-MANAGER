const PROMPTPAY_BILLING_PAUSE_MESSAGE =
    'PromptPay billing is not enabled yet. Set ENABLE_PROMPTPAY_BILLING=true after the product is ready to sell.';

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
