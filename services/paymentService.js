const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');

/**
 * Create a payment intent for the commission amount
 * @param {number} commissionAmount - The amount to charge (in main currency unit, e.g. EUR)
 * @param {string} currency - The currency code (e.g., 'eur')
 * @param {string} reservationReference - Reference to the reservation (e.g. car ID or temp ID)
 * @returns {Promise<Object>} Stripe PaymentIntent object
 */
const createPaymentIntent = async (commissionAmount, currency = 'eur', reservationReference) => {
    try {
        // Check for placeholder key to avoid API errors during development/test without real keys
        if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_placeholder') {
            console.warn('⚠️ Using Mock Payment Intent (Placeholder Key)');
            return {
                clientSecret: 'pi_mock_secret_' + Math.random().toString(36).substring(7),
                id: 'pi_mock_' + Math.random().toString(36).substring(7)
            };
        }

        // Stripe expects amount in cents/lowest denomination
        const amountInCents = Math.round(commissionAmount * 100);

        const paymentIntent = await stripe.paymentIntents.create({
            amount: amountInCents,
            currency: currency.toLowerCase(),
            automatic_payment_methods: {
                enabled: true,
            },
            metadata: {
                reservationReference: reservationReference || 'N/A'
            }
        });

        return {
            clientSecret: paymentIntent.client_secret,
            id: paymentIntent.id
        };
    } catch (error) {
        console.error('Error creating payment intent:', error);
        throw error;
    }
};

module.exports = {
    createPaymentIntent
};
