const axios = require('axios');
const crypto = require('crypto');

/**
 * Get PayTR Payment Token
 * @param {Object} params - Payment parameters
 * @returns {Promise<Object>} PayTR token response
 */
const getPaytrToken = async (params) => {
    const {
        user_ip,
        merchant_oid,
        email,
        payment_amount,
        user_basket,
        currency = 'EUR',
        user_name,
        user_address,
        user_phone
    } = params;

    const merchant_id = process.env.PAYTR_MERCHANT_ID;
    const merchant_key = process.env.PAYTR_MERCHANT_KEY;
    const merchant_salt = process.env.PAYTR_MERCHANT_SALT;

    // Validate credentials
    if (!merchant_id || !merchant_key || !merchant_salt) {
        console.error('❌ PayTR credentials missing!');
        throw new Error('PayTR credentials missing in environment variables');
    }

    // Default parameters
    const no_installment = 1; // No installments
    const max_installment = 0; // No installments
    const debug_on = 1; // Debug mode
    const test_mode = process.env.NODE_ENV === 'production' ? 0 : 1;
    const timeout_limit = 30; // 30 minutes
    const lang = 'tr';

    // URLs (Frontend URL needs to be correct)
    const baseUrl = process.env.BASE_URL || 'https://xdrive-fe.vercel.app'; // Or localhost for dev
    const ok_url = `${baseUrl}/payment-success`;
    const fail_url = `${baseUrl}/payment-fail`;

    // Process user_basket
    // user_basket must be JSON string of array [['Name', 'Price', quantity], ...]
    const user_basket_json = JSON.stringify(user_basket);

    // Generate Hash
    // Concatenate exactly: merchant_id + user_ip + merchant_oid + email + payment_amount + user_basket + no_installment + max_installment + currency + test_mode
    const concat_str = merchant_id + user_ip + merchant_oid + email + payment_amount + user_basket_json + no_installment + max_installment + currency + test_mode;

    const paytr_token = crypto.createHmac('sha256', merchant_key)
        .update(concat_str + merchant_salt)
        .digest('base64');

    // Prepare request data
    const formData = new URLSearchParams();
    formData.append('merchant_id', merchant_id);
    formData.append('user_ip', user_ip);
    formData.append('merchant_oid', merchant_oid);
    formData.append('email', email);
    formData.append('payment_amount', payment_amount);
    formData.append('paytr_token', paytr_token);
    formData.append('user_basket', user_basket_json);
    formData.append('debug_on', debug_on);
    formData.append('no_installment', no_installment);
    formData.append('max_installment', max_installment);
    formData.append('user_name', user_name);
    formData.append('user_address', user_address);
    formData.append('user_phone', user_phone);
    formData.append('merchant_ok_url', ok_url);
    formData.append('merchant_fail_url', fail_url);
    formData.append('timeout_limit', timeout_limit);
    formData.append('currency', currency);
    formData.append('test_mode', test_mode);
    formData.append('lang', lang);

    try {
        const response = await axios.post('https://www.paytr.com/odeme/api/get-token', formData, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        if (response.data.status === 'success') {
            return { token: response.data.token };
        } else {
            console.error('PayTR Get Token Error:', response.data.reason);
            throw new Error(response.data.reason);
        }
    } catch (error) {
        console.error('PayTR API Request Failed:', error.message);
        throw error;
    }
};

/**
 * Verify PayTR Callback
 * @param {Object} reqBody - Request body from PayTR callback
 * @returns {Boolean} Is valid
 */
const verifyCallback = (reqBody) => {
    const merchant_key = process.env.PAYTR_MERCHANT_KEY;
    const merchant_salt = process.env.PAYTR_MERCHANT_SALT;

    const { hash, merchant_oid, status, total_amount } = reqBody;

    // Generate expected hash
    // merchant_oid + salt + status + total_amount
    const expected_hash = crypto.createHmac('sha256', merchant_key)
        .update(merchant_oid + merchant_salt + status + total_amount)
        .digest('base64');

    return hash === expected_hash;
};

module.exports = {
    getPaytrToken,
    verifyCallback
};
