const express = require('express');
const router = express.Router();
const paymentService = require('../services/paymentService');

// POST /api/payments/create-intent
router.post('/create-intent', async (req, res) => {
    try {
        const { amount, currency, reservationReference } = req.body;

        if (!amount) {
            return res.status(400).json({ error: 'Amount is required' });
        }

        const result = await paymentService.createPaymentIntent(amount, currency, reservationReference);

        res.json(result);
    } catch (error) {
        console.error('Payment intent creation failed:', error);
        res.status(500).json({ error: 'Failed to create payment intent', message: error.message });
    }
});


const paytrService = require('../services/paytrService');

// POST /api/payments/paytr-token
router.post('/paytr-token', async (req, res) => {
    try {
        const {
            user,
            amount,
            currency,
            reservationReference,
            items
        } = req.body;

        // User IP detection (basic)
        let user_ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
        if (user_ip.includes(',')) user_ip = user_ip.split(',')[0].trim();
        // PayTR needs IPv4 usually, handling IPv6 mapping
        if (user_ip === '::1') user_ip = '127.0.0.1';

        // Basket default fallback
        const user_basket = items || [['Car Rental Service', amount.toString(), 1]];

        // Amount should be in cents (integer)
        const payment_amount = Math.round(amount * 100);

        const tokenResult = await paytrService.getPaytrToken({
            user_ip,
            merchant_oid: reservationReference || `ORD-${Date.now()}`,
            email: user.email,
            payment_amount,
            user_basket,
            currency: currency,
            user_name: `${user.firstName} ${user.lastName}`,
            user_address: user.address || 'Dijital Teslimat',
            user_phone: user.phone
        });

        res.json(tokenResult);
    } catch (error) {
        console.error('PayTR Token Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/payments/paytr-callback
router.post('/paytr-callback', async (req, res) => {
    try {
        // PayTR Callback verification
        const isValid = paytrService.verifyCallback(req.body);

        if (!isValid) {
            console.error('❌ PayTR Callback Hash Mismatch');
            return res.status(400).send('FAIL');
        }

        const { merchant_oid, status, total_amount } = req.body;

        console.log(`✅ PayTR Callback: ${merchant_oid} - Status: ${status}`);

        if (status === 'success') {
            // Payment successful
            // Here you would typically update the database
            // e.g. Payment.updateStatus(merchant_oid, 'paid');
            // or Reservation.updateStatus(merchant_oid, 'paid');

            // Note: Since we might not have a database connected, 
            // the callback logs usually serve as the verification for now.
        } else {
            // Payment failed
            console.warn(`⚠️ PayTR Payment Failed for ${merchant_oid}`);
        }

        // Return OK to PayTR to acknowledge receipt
        res.send('OK');
    } catch (error) {
        console.error('PayTR Callback Error:', error);
        res.status(500).send('FAIL');
    }
});

module.exports = router;
