require('dotenv').config();
const mailService = require('./services/mailService');

const mockReservation = {
    reservationNumber: 'TEST-REZ-' + Date.now(),
    car: {
        brand: 'Test Brand',
        model: 'Test Model',
        currency: 'EURO'
    },
    user: {
        firstName: 'Test',
        lastName: 'User',
        email: 'emre@example.com' // Using a dummy email for user, but we care about admin email
    },
    pickupDate: new Date(),
    dropoffDate: new Date(Date.now() + 86400000),
    pickupLocation: { city: 'Antalya', address: 'Airport' },
    dropoffLocation: { city: 'Antalya', address: 'Airport' },
    totalPrice: 100,
    currency: 'EURO',
    language: 'tr',
    paymentAmount: 20
};

async function test() {
    console.log('Testing reservation email for multiple languages...');
    const languages = ['tr', 'en', 'de', 'tr-TR']; // Added tr-TR to test normalization

    for (const lang of languages) {
        console.log(`\n--- Testing Language: ${lang} ---`);
        const reservation = { ...mockReservation, language: lang, reservationNumber: `TEST-${lang.toUpperCase()}-${Date.now()}` };
        try {
            const result = await mailService.sendReservationEmail(reservation);
            console.log(`Result for ${lang}:`, result.success ? 'Success' : 'Failed');
        } catch (error) {
            console.error(`Error for ${lang}:`, error);
        }
    }
}

test();
