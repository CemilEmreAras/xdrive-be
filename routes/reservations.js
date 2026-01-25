const express = require('express');
const router = express.Router();
const { saveReservation, cancelReservation } = require('../services/externalApiService');
const { addReservedCar, removeReservedCar } = require('../services/reservationCache');

// Rezervasyon oluştur
router.post('/', async (req, res) => {
  try {
    const {
      carId,
      user,
      pickupDate,
      dropoffDate,
      pickupLocation,
      dropoffLocation,
      pickupId, // API için lokasyon ID
      dropoffId, // API için lokasyon ID
      rezId: initialRezId, // API'den gelen Rez_ID
      carsParkId: initialCarsParkId, // API'den gelen Cars_Park_ID
      groupId: initialGroupId, // API'den gelen Group_ID
      extras: initialExtras = {}, // CDW, SCDW, LCF, Baby_Seat, Navigation, Additional_Driver
      basePrice, // Frontend'den gelen temel fiyat
      commission,
      totalPrice: frontendTotalPrice,
      paymentAmount,
      currency, // Para birimi
      days: frontendDays // Frontend'den gelen gün sayısı
    } = req.body;

    // Extras objesini parse et - frontend'den gelen format: { selected: {...}, totalExtrasPrice: ..., config: [...] }
    // Backend'de beklenen format: { babySeat: true/false, navigation: true/false, ... }
    let extras = {};
    if (initialExtras.selected) {
      // Frontend'den gelen yeni format
      const selected = initialExtras.selected;
      extras = {
        babySeat: !!selected.babySeat,
        navigation: !!selected.navigation,
        additionalDriver: !!selected.additionalDriver,
        cdw: !!selected.cdw,
        scdw: !!selected.scdw,
        lcf: !!selected.lcf,
        youngDriver: !!selected.youngDriver, // Young driver desteği
        extendedCancellation: !!selected.extendedCancellation, // Extended cancellation status
        totalExtraPrice: initialExtras.totalExtrasPrice || initialExtras.totalExtraPrice || 0
      };

      // Extended Free Cancellation varsa, totalExtraPrice'dan düş (Türev'e gönderilmemeli)
      if (selected.extendedCancellation && initialExtras.config) {
        const extCancelConfig = initialExtras.config.find(c => c.key === 'extendedCancellation');
        if (extCancelConfig) {
          const extCancelPrice = extCancelConfig.pricePerDay * (frontendDays || 1); // Gün sayısını kullan
          extras.totalExtraPrice = Math.max(0, extras.totalExtraPrice - extCancelPrice);
          console.log(`✅ Extended Free Cancellation removed from external extras: -${extCancelPrice} EUR`);
        }
      }
      // console.log('✅ Extras parsed from frontend format:', extras);
    } else {
      // Eski format veya direkt extras objesi
      extras = {
        babySeat: !!initialExtras.babySeat,
        navigation: !!initialExtras.navigation,
        additionalDriver: !!initialExtras.additionalDriver,
        cdw: !!initialExtras.cdw,
        scdw: !!initialExtras.scdw,
        lcf: !!initialExtras.lcf,
        youngDriver: !!initialExtras.youngDriver,
        extendedCancellation: !!initialExtras.extendedCancellation,
        totalExtraPrice: initialExtras.totalExtrasPrice || initialExtras.totalExtraPrice || 0
      };
      // console.log('✅ Extras used directly:', extras);
    }

    // Araç kontrolü (MongoDB varsa, yoksa carId'yi direkt kullan)
    let car = null;
    // MongoDB yoksa, carId'yi direkt kullan (external API'den gelen veri)
    // console.log('MongoDB yok, carId direkt kullanılıyor');

    // Eğer car yoksa, request body'den car bilgilerini al
    if (!car && req.body.carData) {
      car = req.body.carData;
    }

    // Tarih kontrolü
    const pickup = new Date(pickupDate);
    const dropoff = new Date(dropoffDate);

    if (dropoff <= pickup) {
      return res.status(400).json({ error: 'Bitiş tarihi başlangıç tarihinden sonra olmalıdır' });
    }

    // Gün sayısını hesapla
    const days = frontendDays || Math.ceil((dropoff - pickup) / (1000 * 60 * 60 * 24));

    // Fiyat hesaplama - Frontend'den gelen değerleri kullan, yoksa hesapla
    let calculatedBasePrice = basePrice;
    if (!calculatedBasePrice) {
      // Toplam fiyatı kontrol et
      const possibleTotalPrices = [
        car?.totalPrice,
        car?.Total_Rental,
        car?.total_Rental
      ];

      for (const price of possibleTotalPrices) {
        if (price !== undefined && price !== null && price !== '') {
          const priceNum = typeof price === 'string' ? parseFloat(price) : price;
          if (!isNaN(priceNum) && priceNum > 0) {
            calculatedBasePrice = priceNum;
            break;
          }
        }
      }

      // Eğer toplam fiyat yoksa, günlük fiyat × gün sayısı
      if (!calculatedBasePrice || calculatedBasePrice === 0) {
        const dailyPrice = car?.pricePerDay || car?.Daily_Rental || car?.daily_Rental || 0;
        calculatedBasePrice = dailyPrice * days;
      }
    }

    // Extras toplam fiyatı (EUR cinsinden) - frontend'den gelen totalExtrasPrice alanı
    const extrasTotalPrice = extras.totalExtraPrice || 0;

    // Komisyon: SADECE araç kiralama bedeli üzerinden %10 (extralar hariç)
    const calculatedCommission = commission || (calculatedBasePrice * 0.10);

    // Total price: base + extras + commission
    const totalPrice = frontendTotalPrice || (calculatedBasePrice + extrasTotalPrice + calculatedCommission);

    // Payment amount: Frontend'den geliyorsa onu kullan (basePrice'in %10'u + Extended Free Cancellation)
    // Yoksa fallback olarak komisyon kadar tahsil et
    const calculatedPaymentAmount = paymentAmount || calculatedCommission;

    // Gerçek API'ye rezervasyon gönder (PDF formatına göre - ZORUNLU)
    let externalReservation = null;
    let externalRezId = null;
    let externalId = null;

    // Tüm gerekli parametrelerin varlığını kontrol et
    // Önce car objesinden alanları kontrol et
    let rezId = initialRezId;
    let carsParkId = initialCarsParkId;
    let groupId = initialGroupId;

    // Car objesinden alanları kontrol et
    const carData = req.body.carData || {};
    if (!rezId) {
      rezId = carData.rezId || carData.Rez_ID || carData.rez_ID || carData.RezID;
      if (rezId) console.log('✅ rezId car objesinden alındı:', rezId);
    }
    if (!carsParkId) {
      carsParkId = carData.carsParkId || carData.Cars_Park_ID || carData.cars_Park_ID || carData.CarsParkID;
      if (carsParkId) console.log('✅ carsParkId car objesinden alındı:', carsParkId);
    }
    if (!groupId) {
      groupId = carData.groupId || carData.Group_ID || carData.group_ID || carData.GroupID;
      if (groupId) console.log('✅ groupId car objesinden alındı:', groupId);
    }

    const missingParams = [];
    if (!pickupId) missingParams.push('pickupId');
    if (!dropoffId) missingParams.push('dropoffId');
    if (!rezId) missingParams.push('rezId');
    if (!carsParkId) missingParams.push('carsParkId');
    if (!groupId) missingParams.push('groupId');

    if (missingParams.length > 0) {
      console.error('❌ Rezervasyon için eksik parametreler:', missingParams);
      console.error('Gelen request body:', JSON.stringify(req.body, null, 2));
      console.error('Car objesi:', req.body.carData);

      return res.status(400).json({
        error: 'Rezervasyon için gerekli parametreler eksik',
        details: `Eksik parametreler: ${missingParams.join(', ')}`,
        required: ['pickupId', 'dropoffId', 'rezId', 'carsParkId', 'groupId'],
        received: {
          pickupId: !!pickupId,
          dropoffId: !!dropoffId,
          rezId: !!rezId,
          carsParkId: !!carsParkId,
          groupId: !!groupId
        },
        carData: carData,
        suggestion: 'Car objesinde rezId, carsParkId, groupId alanları eksik. Lütfen araç listesinden tekrar seçin.'
      });
    }

    try {
      // Saat ve dakika değerlerini al (varsayılan 10:00)
      let pickupHour = pickup.getHours();
      let pickupMin = pickup.getMinutes();
      let dropoffHour = dropoff.getHours();
      let dropoffMin = dropoff.getMinutes();

      // Eğer saat 0-5 arasındaysa, 10:00'a ayarla (API çok erken saatleri kabul etmeyebilir)
      if (pickupHour < 5) {
        console.warn(`⚠️ Pickup saat çok erken (${pickupHour}:${pickupMin}), 10:00'a ayarlanıyor`);
        pickupHour = 10;
        pickupMin = 0;
      }
      if (dropoffHour < 5) {
        console.warn(`⚠️ Dropoff saat çok erken (${dropoffHour}:${dropoffMin}), 10:00'a ayarlanıyor`);
        dropoffHour = 10;
        dropoffMin = 0;
      }

      // External API'ye rezervasyon gönder (PDF formatına göre)
      // Debug log (Sadece development'ta)
      if (process.env.NODE_ENV !== 'production') {
        console.log('📤 External API\'ye rezervasyon gönderiliyor...', {
          pickupId, dropoffId, rezId, carsParkId, groupId,
          name: user.firstName, surname: user.lastName,
          rentPrice: calculatedBasePrice
        });
      }

      externalReservation = await saveReservation({
        pickupId,
        dropoffId,
        name: user.firstName,
        surname: user.lastName,
        mobilePhone: user.phone,
        mailAddress: user.email,
        rentalId: user.licenseNumber, // Pasaport ID veya Ehliyet No
        carsParkId,
        groupId,
        rezId,
        pickupDate,
        dropoffDate,
        pickupHour,
        pickupMin,
        dropoffHour,
        dropoffMin,
        address: pickupLocation?.address || '',
        district: pickupLocation?.district || '',
        city: pickupLocation?.city || '',
        country: user.country || '',
        flightNumber: user.flightNumber || '',
        currency: currency || car?.currency || 'EURO', // Para birimi EURO olmalı
        babySeat: extras.babySeat ? 'ON' : 'OFF',
        navigation: extras.navigation ? 'ON' : 'OFF',
        additionalDriver: extras.additionalDriver ? 'ON' : 'OFF',
        cdw: extras.cdw ? 'ON' : 'OFF',
        scdw: extras.scdw ? 'ON' : 'OFF',
        lcf: extras.lcf ? 'ON' : 'OFF',
        youngDriver: extras.youngDriver ? 'ON' : 'OFF',
        yourRezId: `XDRIVE-${Date.now()}`, // Kendi rezervasyon numaramız
        yourRentPrice: calculatedBasePrice, // Araç kiralama fiyatı (komisyon hariç)
        yourExtraPrice: extras.totalExtraPrice || 0,
        yourDropPrice: dropoffLocation?.sameLocation ? 0 : (car?.drop || 0),
        paymentType: 0 // 0 = ödeme alınmadı, 1 = ödeme alındı (ödeme entegrasyonu sonrası 1 yapılacak)
      });

      if (process.env.NODE_ENV !== 'production') {
        console.log('✅ Rezervasyon external API\'ye gönderildi:', {
          rezId: externalReservation?.rez_id,
          status: externalReservation?.Status,
          success: externalReservation ? true : false
        });
      }

      // External API yanıtını kontrol et
      let externalRezIdFromResponse = null;
      let externalIdFromResponse = null;

      if (Array.isArray(externalReservation) && externalReservation.length > 0) {
        const firstItem = externalReservation[0];
        externalRezIdFromResponse = firstItem.rez_id || firstItem.Rez_ID || firstItem.rezId;
        externalIdFromResponse = firstItem.ID || firstItem.id;

        // rez_kayit_no kontrolü
        const rezKayitNo = firstItem.rez_kayit_no || firstItem.Rez_Kayit_No || firstItem.rezKayitNo;
        if (rezKayitNo === '0' || rezKayitNo === 0) {
          if (externalRezIdFromResponse) {
            console.warn('⚠️ External API uyarısı: success: False ve rez_kayit_no: 0, ancak rez_id döndü.');
            console.warn('⚠️ Rezervasyonun External API tarafında onay bekliyor olabilir.');
          } else {
            console.error('❌ External API rezervasyon kaydedilemedi (rez_kayit_no: 0)');
            console.error('❌ Rezervasyon türevde görünmeyecek!');
            throw new Error('Rezervasyon external API\'de kaydedilemedi. Lütfen API sağlayıcısı ile iletişime geçin: 0312 870 10 35');
          }
        }

        console.log('✅ External API rezervasyon yanıtı:', {
          rez_id: externalRezIdFromResponse,
          rez_kayit_no: rezKayitNo,
          ID: externalIdFromResponse,
          success: firstItem.success,
          Status: firstItem.Status
        });
      } else if (typeof externalReservation === 'object' && externalReservation !== null) {
        externalRezIdFromResponse = externalReservation.rez_id || externalReservation.Rez_ID || externalReservation.rezId;
        externalIdFromResponse = externalReservation.ID || externalReservation.id;
      }

      if (externalRezIdFromResponse) {
        externalRezId = externalRezIdFromResponse;
        externalId = externalIdFromResponse;

        // Rezervasyon başarılı olduysa, aracı cache'e ekle
        if (rezId && carsParkId) {
          addReservedCar(rezId, carsParkId, pickupDate, dropoffDate);
          console.log(`✅ Araç rezerve edildi: rezId=${rezId}, carsParkId=${carsParkId}`);
          console.log(`✅ External rez_id: ${externalRezId}, ID: ${externalId}`);
        }
      } else {
        // Boş yanıt veya beklenmedik format
        if (!externalReservation ||
          (typeof externalReservation === 'string' && externalReservation.trim() === '') ||
          (Array.isArray(externalReservation) && externalReservation.length === 0)) {
          console.warn('⚠️ External API boş yanıt döndü');
          console.warn('⚠️ Rezervasyon gönderildi ama onay yanıtı alınamadı');
          console.warn('⚠️ Rezervasyon türevde görünmeyebilir, ancak yerel rezervasyon kaydedilecek');
          externalReservation = null;
          externalRezId = null;
        } else {
          console.warn('⚠️ External API rezervasyon yanıtı beklenmedik format:', externalReservation);
          console.warn('⚠️ Rezervasyon türevde görünmeyebilir, ancak yerel rezervasyon kaydedilecek');
          externalReservation = null;
          externalRezId = null;
        }
      }
    } catch (apiError) {
      console.error('⚠️ External API rezervasyon hatası:', apiError.message);
      if (apiError.response) {
        console.error('API yanıt detayları:', apiError.response.data);
      }
      console.error('API Error Stack:', apiError.stack);

      // External API hatası - rezervasyon türevde görünmeyebilir
      // Ama rezervasyon yine de kaydedilecek (local ve cache)
      // Hata fırlatma, sadece warning olarak işaretle
      externalReservation = null;
      externalRezId = null;
      console.warn('⚠️ External API hatası nedeniyle rezervasyon türevde görünmeyebilir, ancak yerel rezervasyon kaydedilecek');
    }

    // MongoDB kaldırıldığı için local kayıt yapılmıyor.
    // console.log('MongoDB yok, rezervasyon sadece external API\'ye kaydedildi');

    // Rezervasyon numarası oluştur
    const reservationNumber = `RES-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Rezervasyon bilgilerini hazırla
    const reservationResponse = {
      reservationNumber,
      car: car || { _id: carId },
      user,
      pickupDate: pickup,
      dropoffDate: dropoff,
      pickupLocation,
      dropoffLocation: dropoffLocation || { ...pickupLocation, sameLocation: true },
      basePrice: calculatedBasePrice,
      commission: calculatedCommission,
      totalPrice,
      paymentAmount: calculatedPaymentAmount,
      currency: currency || car?.currency || 'EURO',
      status: externalReservation?.Status === 'True' ? 'confirmed' : 'pending',
      paymentStatus: 'pending',
      externalRezId: externalRezId,
      externalId: externalReservation?.ID || null,
      rezId: rezId, // Cache için gerekli
      carsParkId: carsParkId, // Cache için gerekli
      externalApiResponse: externalReservation,
      extras: extras, // Include parsed extras in response
      createdAt: new Date(),
      updatedAt: new Date(),
      // ...(localReservation ? localReservation.toObject() : {})
    };


    // Rezervasyon yapıldığında cache'e ekle (external API başarılı olsa da olmasa da)
    if (rezId && carsParkId) {
      addReservedCar(rezId, carsParkId, pickupDate, dropoffDate);
      if (process.env.NODE_ENV !== 'production') {
        console.log(`Araç rezerve edildi: rezId=${rezId}, carsParkId=${carsParkId}`);
      }
    }

    // Rezervasyon onay maili gönder (Hata oluşursa rezervasyonu etkilememeli)
    try {
      const { language } = req.body;
      const mailData = {
        reservationNumber,
        car,
        user,
        pickupDate: pickup,
        dropoffDate: dropoff,
        pickupLocation,
        dropoffLocation,
        totalPrice,
        currency: currency || car?.currency || 'EURO',
        language: language || 'en',
        extras: extras,  // Parsed extras
        extrasTotalPrice: extrasTotalPrice,
        paymentType: calculatedPaymentAmount < totalPrice ? 'PAR' : 'FULL', // Tahmini
        paymentAmount: calculatedPaymentAmount
      };

      const mailService = require('../services/mailService');
      // Mail işlemini arka planda yap, response'u bekletme
      // await mailService.sendReservationEmail(mailData); 
      mailService.sendReservationEmail(mailData).catch(e => console.error('Background mail error:', e));

      // console.log('✅ Rezervasyon maili arka plana atıldı');
    } catch (mailError) {
      console.error('❌ Rezervasyon maili ön hazırlık hatası:', mailError);
    }

    res.status(201).json(reservationResponse);
  } catch (error) {
    console.error('❌ Rezervasyon oluşturma hatası:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error name:', error.name);
    console.error('❌ Error message:', error.message);

    // Detaylı hata mesajı
    let errorMessage = error.message || 'Rezervasyon oluşturulurken bir hata oluştu';
    let statusCode = 500;

    // Eğer external API hatası ise, 400 döndür (client error)
    if (error.message && error.message.includes('External API')) {
      statusCode = 400;
    }

    res.status(statusCode).json({
      error: errorMessage,
      details: error.stack ? error.stack.split('\n').slice(0, 3).join('\n') : undefined
    });
  }
});

// Rezervasyon getir
router.get('/:reservationNumber', async (req, res) => {
  try {
    // MongoDB kaldırıldı
    // try { ... } catch (dbError) { ... }

    // MongoDB'de bulunamazsa, external API'den sorgula (şimdilik 404)
    return res.status(404).json({
      error: 'Rezervasyon bulunamadı. MongoDB olmadan rezervasyon sorgulama yapılamıyor.'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Email ile rezervasyonları getir
router.get('/email/:email', async (req, res) => {
  try {
    // MongoDB kaldırıldı, boş dizi döndür
    return res.json([]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rezervasyon iptal et
router.put('/:reservationNumber/cancel', async (req, res) => {
  try {
    // MongoDB kaldırıldı
    // try { ... } catch (dbError) { ... }

    if (!reservation) {
      // MongoDB'de yoksa, sadece external API'den iptal et
      // Not: externalRezId ve externalId gerekli
      if (req.body.externalRezId && req.body.externalId) {
        try {
          await cancelReservation(req.body.externalRezId, req.body.externalId);

          // Cache'den çıkar (eğer rezId ve carsParkId varsa)
          if (req.body.rezId && req.body.carsParkId && req.body.pickupDate && req.body.dropoffDate) {
            removeReservedCar(req.body.rezId, req.body.carsParkId, req.body.pickupDate, req.body.dropoffDate);
          }

          return res.json({
            message: 'Rezervasyon external API\'de iptal edildi',
            status: 'cancelled'
          });
        } catch (apiError) {
          return res.status(400).json({ error: 'Rezervasyon iptal edilemedi' });
        }
      }
      return res.status(404).json({ error: 'Rezervasyon bulunamadı' });
    }

    // 72 saat kontrolü
    const pickupDate = new Date(reservation.pickupDate);
    const now = new Date();
    const hoursUntilPickup = (pickupDate - now) / (1000 * 60 * 60);

    if (hoursUntilPickup < 72) {
      return res.status(400).json({ error: 'Rezervasyon sadece 72 saat öncesine kadar iptal edilebilir' });
    }

    // Eğer external API'de rezervasyon varsa, orada da iptal et
    if (reservation.externalRezId && reservation.externalId) {
      try {
        await cancelReservation(reservation.externalRezId, reservation.externalId);
      } catch (apiError) {
        console.error('External API iptal hatası:', apiError);
        // API hatası olsa bile yerel iptali yapabiliriz
      }
    }

    // Cache'den çıkar
    if (reservation.rezId && reservation.carsParkId) {
      const pickupDateStr = reservation.pickupDate instanceof Date
        ? reservation.pickupDate.toISOString().split('T')[0]
        : reservation.pickupDate;
      const dropoffDateStr = reservation.dropoffDate instanceof Date
        ? reservation.dropoffDate.toISOString().split('T')[0]
        : reservation.dropoffDate;
      removeReservedCar(reservation.rezId, reservation.carsParkId, pickupDateStr, dropoffDateStr);
    }

    reservation.status = 'cancelled';
    reservation.paymentStatus = 'refunded';
    await reservation.save();

    res.json({ message: 'Rezervasyon iptal edildi', reservation });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rezervasyon onayla
router.put('/:reservationNumber/confirm', async (req, res) => {
  try {
    // MongoDB kaldırıldı
    // try { ... } catch (dbError) { ... }

    // MongoDB'de yoksa
    return res.status(404).json({
      error: 'Rezervasyon bulunamadı. MongoDB olmadan rezervasyon onaylama yapılamıyor.'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
