// Native fetch is available in Node.js 18+

async function verifyPayment() {
    try {
        const response = await fetch('http://localhost:5001/api/payments/create-intent', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                amount: 25.50, // 25.50 EUR
                currency: 'EUR',
                reservationReference: 'TEST-123'
            })
        });

        if (response.ok) {
            const data = await response.json();
            console.log('✅ Payment Intent created successfully!');
            console.log('Client Secret:', data.clientSecret ? 'Received' : 'Missing');
            console.log('ID:', data.id);
        } else {
            console.error('❌ Failed to create payment intent');
            const text = await response.text();
            console.error('Status:', response.status);
            console.error('Response:', text);
        }
    } catch (err) {
        console.error('❌ Error verifying payment:', err.message);
    }
}

verifyPayment();
