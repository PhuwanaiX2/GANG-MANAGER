import { db, FeatureFlagService } from '@gang/database';
import { isPromptPayBillingEnabled } from './promptPayBilling';
import { isSlipOkAutoVerifyEnabled } from './slipOk';

export const PROMPTPAY_BILLING_FEATURE_KEY = 'promptpay_billing';
export const SLIPOK_AUTO_VERIFY_FEATURE_KEY = 'slipok_auto_verify';

export async function isPromptPayBillingRuntimeEnabled() {
    if (!isPromptPayBillingEnabled()) {
        return false;
    }

    return FeatureFlagService.isEnabled(db, PROMPTPAY_BILLING_FEATURE_KEY);
}

export async function isSlipOkAutoVerifyRuntimeEnabled() {
    if (!isSlipOkAutoVerifyEnabled()) {
        return false;
    }

    return FeatureFlagService.isEnabled(db, SLIPOK_AUTO_VERIFY_FEATURE_KEY);
}
