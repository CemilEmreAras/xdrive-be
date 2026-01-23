const nodemailer = require('nodemailer');

const isProd = process.env.NODE_ENV === 'production';

// Transporter oluştur
const createTransporter = () => {
    // Eğer SMTP ayarları eksikse, ethereal (test) servisi veya console.log fallback kullanılabilir
    // Şimdilik .env'den okuyacak şekilde yapılandırıyoruz
    if (!process.env.SMTP_HOST) {
        console.warn('⚠️ SMTP ayarları eksik! Mailler gönderilmeyecek, sadece loglanacak.');
        return null;
    }

    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || 587,
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
        tls: {
            // Production'da güvenlik için sertifika kontrolünü aç, development'ta kapat
            // GEÇİCİ DEBUG: Production'da da kapatıp deneyelim (sertifika hatası ihtimaline karşı)
            rejectUnauthorized: false // process.env.NODE_ENV === 'production'
        }
    });
};

const transporter = createTransporter();

// Auto-reply templates based on language
const getTexts = (lang) => {
    const language = (lang || 'en').split('-')[0].toLowerCase();

    const texts = {
        tr: {
            contactSubject: 'Mesajınız Alındı - XDrive Mobility',
            contactBody: 'Mesajınız bize ulaştı. Ekibimiz iletişim formunuzu inceleyip en kısa sürede size dönüş yapacaktır.',
            franchiseSubject: 'Bayilik Başvurunuz Alındı - XDrive Mobility',
            franchiseBody: 'Bayilik başvurunuz bize ulaştı. Başvurunuz ilgili departmanımız tarafından değerlendirilecek ve en kısa sürede sizinle iletişime geçilecektir.',
            reservationSubject: (no) => `Rezervasyon Onayı - ${no}`,
            greeting: (name) => `Sayın ${name},`,
            reservationIntro: 'Rezervasyonunuz başarıyla alınmıştır. Aşağıda rezervasyon detaylarınızı bulabilirsiniz.',
            labels: {
                reservationNumber: 'Rezervasyon No:',
                car: 'Araç:',
                pickup: 'Alış:',
                dropoff: 'İade:',
                location: 'Lokasyon:',
                totalPrice: 'Toplam Fiyat:',
                paymentAmount: 'Ödenecek Tutar:',
                footer: 'Bizi tercih ettiğiniz için teşekkür ederiz.',
                team: 'XDrive Mobility Ekibi'
            }
        },
        de: {
            contactSubject: 'Nachricht Erhalten - XDrive Mobility',
            contactBody: 'Wir haben Ihre Nachricht erhalten. Unser Team wird Ihr Kontaktformular prüfen und sich so schnell wie möglich bei Ihnen melden.',
            franchiseSubject: 'Franchise-Antrag Erhalten - XDrive Mobility',
            franchiseBody: 'Wir haben Ihren Franchise-Antrag erhalten. Ihr Antrag wird von unserer Abteilung geprüft und wir werden uns so schnell wie möglich bei Ihnen melden.',
            reservationSubject: (no) => `Buchungsbestätigung - ${no}`,
            greeting: (name) => `Sehr geehrte(r) ${name},`,
            reservationIntro: 'Ihre Reservierung ist erfolgreich eingegangen. Nachfolgend finden Sie Ihre Reservierungsdetails.',
            labels: {
                reservationNumber: 'Reservierungs-Nr:',
                car: 'Auto:',
                pickup: 'Abholung:',
                dropoff: 'Rückgabe:',
                location: 'Standort:',
                totalPrice: 'Gesamtpreis:',
                paymentAmount: 'Zu zahlender Betrag:',
                footer: 'Vielen Dank, dass Sie sich für uns entschieden haben.',
                team: 'XDrive Mobility Team'
            }
        },
        en: {
            contactSubject: 'Message Received - XDrive Mobility',
            contactBody: 'We have received your message. Our team will review your contact form and get back to you as soon as possible.',
            franchiseSubject: 'Franchise Application Received - XDrive Mobility',
            franchiseBody: 'We have received your franchise application. Your application will be reviewed by our department and we will contact you as soon as possible.',
            reservationSubject: (no) => `Reservation Confirmation - ${no}`,
            greeting: (name) => `Dear ${name},`,
            reservationIntro: 'Your reservation has been successfully received. You can find your reservation details below.',
            labels: {
                reservationNumber: 'Reservation No:',
                car: 'Car:',
                pickup: 'Pick-up:',
                dropoff: 'Drop-off:',
                location: 'Location:',
                totalPrice: 'Total Price:',
                paymentAmount: 'Amount to Pay:',
                footer: 'Thank you for choosing us.',
                team: 'XDrive Mobility Team'
            }
        }
    };

    return texts[language] || texts.en;
};

const getAutoReplyContent = (language, type, name) => {
    const t = getTexts(language);

    let subject, body;
    if (type === 'CONTACT') {
        subject = t.contactSubject;
        body = t.contactBody;
    } else if (type === 'FRANCHISE') {
        subject = t.franchiseSubject;
        body = t.franchiseBody;
    } else {
        return null;
    }

    const title = t.greeting(name);
    const footer = t.labels.team;

    return {
        subject,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h2 style="color: #EF4444; margin: 0;">XDrive Mobility</h2>
                </div>
                <p style="font-size: 16px; color: #333;">${title}</p>
                <p style="font-size: 16px; color: #555; line-height: 1.6;">${body}</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                <p style="font-size: 14px; color: #999;">${footer}</p>
            </div>
        `
    };
};

const sendAutoReply = async (email, language, type, name) => {
    if (!transporter) return;

    const content = getAutoReplyContent(language, type, name);
    if (!content) return;

    try {
        await transporter.sendMail({
            from: process.env.SMTP_FROM || '"XDrive Mobility" <noreply@xdrivemobility.com>',
            to: email,
            subject: content.subject,
            html: content.html
        });
        console.log(`✅ Auto-reply sent to ${email} (${language})`);
    } catch (error) {
        console.error('❌ Auto-reply error:', error);
        // Don't throw error to avoid failing the main request
    }
};

/**
 * Send Contact Form Email
 * @param {Object} data - { name, email, subject, message, language }
 */
const sendContactEmail = async (data) => {
    const { name, email, subject, message, language } = data;

    if (!transporter) {
        console.log('📨 [MOCK MAIL] Contact Form:', data);
        return { success: true, mock: true };
    }

    const mailOptions = {
        from: process.env.SMTP_FROM || '"XDrive Contact" <noreply@xdrivemobility.com>',
        to: process.env.SMTP_TO || 'admin@xdrivemobility.com',
        replyTo: email,
        subject: `[Contact Form] ${subject} - ${name}`,
        html: `
      <h2>New Contact Message</h2>
      <p><strong>Sender:</strong> ${name} (${email})</p>
      <p><strong>Subject:</strong> ${subject}</p>
      <hr />
      <h3>Message:</h3>
      <p>${message.replace(/\n/g, '<br>')}</p>
      <hr />
      <p><small>This message was sent from the XDrive website contact form.</small></p>
    `,
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Mail sent:', info.messageId);

        // Send auto-reply
        await sendAutoReply(email, language, 'CONTACT', name);

        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('❌ Mail sending error:', error);
        throw error;
    }
};

/**
 * Send Franchise Application Email
 * @param {Object} data - { fullName, email, companyName, location, fleetSize, language }
 */
const sendFranchiseEmail = async (data) => {
    const { fullName, email, companyName, location, fleetSize, language } = data;

    if (!transporter) {
        console.log('📨 [MOCK MAIL] Franchise Application:', data);
        return { success: true, mock: true };
    }

    const mailOptions = {
        from: process.env.SMTP_FROM || '"XDrive Franchise" <noreply@xdrivemobility.com>',
        to: process.env.SMTP_TO || 'admin@xdrivemobility.com',
        replyTo: email,
        subject: `[Franchise Application] ${companyName} - ${fullName}`,
        html: `
      <h2>New Franchise Application</h2>
      <p><strong>Full Name:</strong> ${fullName}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Company Name:</strong> ${companyName}</p>
      <p><strong>Location:</strong> ${location}</p>
      <p><strong>Fleet Size:</strong> ${fleetSize}</p>
      <hr />
      <p><small>This message was sent from the XDrive website franchise form.</small></p>
    `,
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Franchise mail sent:', info.messageId);

        // Send auto-reply
        await sendAutoReply(email, language, 'FRANCHISE', fullName);

        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('❌ Mail sending error:', error);
        throw error;
    }
};

/**
 * Send Reservation Confirmation Email
 * @param {Object} data - Reservation data
 */
const sendReservationEmail = async (data) => {
    const {
        reservationNumber, car, user, pickupDate, dropoffDate,
        pickupLocation, dropoffLocation, totalPrice, currency,
        language, extras, paymentAmount
    } = data;

    if (!transporter) {
        console.log('📨 [MOCK MAIL] Reservation:', data);
        return { success: true, mock: true };
    }

    const t = getTexts(language);
    const currencySymbol = currency === 'TRY' ? '₺' : (currency === 'USD' ? '$' : '€');
    const langCode = (language || 'en').split('-')[0].toLowerCase();

    // Format dates
    const formatDate = (date) => {
        return new Date(date).toLocaleDateString(langCode === 'tr' ? 'tr-TR' : (langCode === 'de' ? 'de-DE' : 'en-US'), {
            year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    };

    const subject = t.reservationSubject(reservationNumber);
    const title = t.greeting(`${user.firstName} ${user.lastName}`);
    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <div style="text-align: center; margin-bottom: 20px;">
                <h2 style="color: #EF4444; margin: 0;">XDrive Mobility</h2>
            </div>
            
            <p style="font-size: 16px; color: #333;">${title}</p>
            <p style="font-size: 16px; color: #555; line-height: 1.6;">${t.reservationIntro}</p>
            
            <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #333; border-bottom: 1px solid #eee; padding-bottom: 10px;">${subject}</h3>
                
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 8px 0; color: #666;"><strong>${t.labels.reservationNumber}</strong></td>
                        <td style="padding: 8px 0; text-align: right;">${reservationNumber}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; color: #666;"><strong>${t.labels.car}</strong></td>
                        <td style="padding: 8px 0; text-align: right;">${car ? `${car.brand} ${car.model}` : 'Selected Car'}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; color: #666;"><strong>${t.labels.pickup}</strong></td>
                        <td style="padding: 8px 0; text-align: right;">
                            ${formatDate(pickupDate)}<br>
                            <small>${pickupLocation?.city} ${pickupLocation?.address || ''}</small>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; color: #666;"><strong>${t.labels.dropoff}</strong></td>
                        <td style="padding: 8px 0; text-align: right;">
                            ${formatDate(dropoffDate)}<br>
                            <small>${dropoffLocation?.city} ${dropoffLocation?.address || ''}</small>
                        </td>
                    </tr>
                    <tr style="border-top: 1px solid #eee;">
                        <td style="padding: 12px 0; color: #333; font-size: 18px;"><strong>${t.labels.totalPrice}</strong></td>
                        <td style="padding: 12px 0; text-align: right; font-size: 18px; color: #EF4444;"><strong>${currencySymbol}${totalPrice}</strong></td>
                    </tr>
                     <tr>
                        <td style="padding: 5px 0; color: #666;"><strong>${t.labels.paymentAmount}</strong></td>
                        <td style="padding: 5px 0; text-align: right;">${currencySymbol}${paymentAmount}</td>
                    </tr>
                </table>
            </div>

            <p style="text-align: center; margin-top: 30px; font-size: 14px; color: #666;">
                ${t.labels.footer}<br>
                <strong>${t.labels.team}</strong>
            </p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 12px; color: #999; text-align: center;">
                <a href="https://xdrivemobility.com" style="color: #666; text-decoration: none;">www.xdrivemobility.com</a>
            </p>
        </div>
    `;

    try {
        // Send to User
        // Send to User - İPTAL EDİLDİ (Türev sisteminden otomatik gidiyor)
        /*
        await transporter.sendMail({
            from: process.env.SMTP_FROM || '"XDrive Reservations" <noreply@xdrivemobility.com>',
            to: user.email,
            subject: subject,
            html: htmlContent
        });
        console.log(`✅ Reservation email sent to user: ${user.email}`);
        */

        // Send to Admin
        const adminEmail = process.env.SMTP_TO || 'contact@xdrivemobility.com';
        await transporter.sendMail({
            from: process.env.SMTP_FROM || '"XDrive System" <noreply@xdrivemobility.com>',
            to: adminEmail,
            subject: `[New Reservation] ${reservationNumber} - ${user.firstName} ${user.lastName}`,
            html: htmlContent
        });
        console.log(`✅ Reservation notification sent to admin: ${adminEmail}`);

        return { success: true };
    } catch (error) {
        console.error('❌ Reservation email error:', error);
        // Don't throw, just log
        return { success: false, error: error.message };
    }
};

module.exports = {
    sendContactEmail,
    sendFranchiseEmail,
    sendReservationEmail
};
