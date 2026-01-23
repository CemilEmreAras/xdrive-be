const express = require('express');
const router = express.Router();
const mailService = require('../services/mailService');

// @route   POST /api/contact
// @desc    İletişim formu verilerini işle ve mail gönder
// @access  Public
router.post('/', async (req, res) => {
    try {
        const { name, email, subject, message, privacyAccepted, language } = req.body;

        // Basit validasyon
        if (!name || !email || !subject || !message || !privacyAccepted) {
            return res.status(400).json({ error: 'Lütfen tüm alanları doldurun ve gizlilik politikasını kabul edin.' });
        }

        // Mail gönder
        const result = await mailService.sendContactEmail({ name, email, subject, message, language });

        res.status(200).json({
            success: true,
            message: 'Mesajınız başarıyla gönderildi.',
            details: result
        });
    } catch (error) {
        console.error('Contact error:', error);
        res.status(500).json({ error: 'Mesaj gönderilirken bir hata oluştu. Lütfen daha sonra tekrar deneyin.' });
    }
});

// @route   POST /api/contact/franchise
// @desc    Bayilik başvuru verilerini işle ve mail gönder
// @access  Public
router.post('/franchise', async (req, res) => {
    try {
        const { fullName, email, companyName, location, fleetSize, privacyAccepted, language } = req.body;

        // Basit validasyon
        if (!fullName || !email || !companyName || !location || !fleetSize || !privacyAccepted) {
            return res.status(400).json({ error: 'Lütfen tüm zorunlu alanları doldurun ve gizlilik politikasını kabul edin.' });
        }

        // Mail gönder
        const result = await mailService.sendFranchiseEmail({ fullName, email, companyName, location, fleetSize, language });

        res.status(200).json({
            success: true,
            message: 'Bayilik başvurunuz başarıyla alındı. En kısa sürede sizinle iletişime geçeceğiz.',
            details: result
        });
    } catch (error) {
        console.error('Franchise error:', error);
        res.status(500).json({ error: 'Başvuru gönderilirken bir hata oluştu. Lütfen daha sonra tekrar deneyin.' });
    }
});

module.exports = router;
