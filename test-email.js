require('dotenv').config();
const mailService = require('./services/mailService');

async function testEmail() {
    console.log('Testing SMTP connection...');
    console.log('Host:', process.env.SMTP_HOST);
    console.log('User:', process.env.SMTP_USER);

    try {
        const result = await mailService.sendContactEmail({
            name: 'Test User',
            email: 'test@example.com',
            subject: 'SMTP Test',
            message: 'This is a test email from the backend integration verification step.'
        });
        console.log('Test result:', result);
    } catch (error) {
        console.error('Test failed:', error);
    }
}

testEmail();
