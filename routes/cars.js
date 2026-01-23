const express = require('express');
const router = express.Router();
const { fetchCarsFromExternalAPI, fetchLocations, fetchGroups } = require('../services/carService');
const { getReservedCarsForDateRange } = require('../services/reservationCache');

// Tüm araçları getir - Gerçek API'den çeker
router.get('/', async (req, res) => {
  try {
    const {
      pickupId,
      dropoffId,
      pickupDate,
      dropoffDate,
      pickupHour = 10,
      pickupMin = 0,
      dropoffHour = 10,
      dropoffMin = 0,
      currency = 'EURO',
      category,
      transmission,
      minPrice,
      maxPrice,
      sortBy = 'pricePerDay',
      order = 'asc'
    } = req.query;

    // Gerçek API için gerekli parametreler
    if (!pickupId || !dropoffId || !pickupDate || !dropoffDate) {
      // Eğer parametreler yoksa ve MongoDB varsa, veritabanından çek (cache)
      // MongoDB kaldırıldı
      // console.log('MongoDB cache kullanılamıyor, direkt API kullanılacak');
      // Parametreler yoksa ve cache'de veri yoksa, boş dizi döndür
      return res.json([]);
    }

    // Gerçek API'den araçları çek
    let cars = [];
    try {
      cars = await fetchCarsFromExternalAPI({
        pickupId,
        dropoffId,
        pickupDate,
        dropoffDate,
        pickupHour: parseInt(pickupHour),
        pickupMin: parseInt(pickupMin),
        dropoffHour: parseInt(dropoffHour),
        dropoffMin: parseInt(dropoffMin),
        currency
      });
    } catch (apiError) {
      // API hatasını kullanıcıya döndür
      return res.status(400).json({
        error: apiError.message || 'Araç sorgulama sırasında bir hata oluştu',
        details: 'Lütfen API sağlayıcısı ile iletişime geçin: 0312 870 10 35'
      });
    }

    // Rezerve edilmiş araçları filtrele - Aktif (User request: API anlık güncellemediği için lokal filtre gerekli)
    const reservedCars = getReservedCarsForDateRange(pickupDate, dropoffDate);
    // RezId ve CarsParkId kombinasyonu ile anahtar oluştur
    const reservedCarKeys = new Set(reservedCars.map(c => `${c.rezId}_${c.carsParkId}`));

    // Debug için log
    // console.log(`Lokasyon bazlı rezerve araçlar (${reservedCars.length}):`, reservedCars);

    // Filtreleme - Hem API filtreleri hem de lokal cache kullan
    let filteredCars = cars.filter(car => {
      // Rezerve edilmiş araçları çıkar
      // API'den gelen araçların ID'lerini kontrol et
      // Not: API'den gelen araçlarda rezId ve carsParkId değerleri carService içinde normalize edildi
      const carKey = `${car.rezId}_${car.carsParkId}`;

      // Eğer araç rezerve edilmişse, listeden çıkar
      if (reservedCarKeys.has(carKey)) {
        // console.log(`🚫 Lokal cache filtresi: Araç gizleniyor (${carKey})`);
        return false;
      }
      return true;
    });

    if (category) {
      filteredCars = filteredCars.filter(car =>
        car.category.toLowerCase().includes(category.toLowerCase())
      );
    }

    if (transmission) {
      filteredCars = filteredCars.filter(car =>
        car.transmission.toLowerCase() === transmission.toLowerCase()
      );
    }

    if (minPrice) {
      filteredCars = filteredCars.filter(car => car.pricePerDay >= Number(minPrice));
    }

    if (maxPrice) {
      filteredCars = filteredCars.filter(car => car.pricePerDay <= Number(maxPrice));
    }

    // Sıralama
    if (sortBy === 'price') {
      filteredCars.sort((a, b) => {
        return order === 'desc'
          ? b.pricePerDay - a.pricePerDay
          : a.pricePerDay - b.pricePerDay;
      });
    } else if (sortBy === 'rating') {
      filteredCars.sort((a, b) => {
        return order === 'desc'
          ? b.rating - a.rating
          : a.rating - b.rating;
      });
    }

    // Cache'i devre dışı bırak (gerçek zamanlı müsaitlik için)
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');

    res.json(filteredCars);
  } catch (error) {
    console.error('Araç listeleme hatası:', error);
    console.error('Hata detayları:', error.stack);
    res.status(500).json({
      error: error.message || 'Araç listesi alınırken bir hata oluştu',
      details: 'Lütfen tekrar deneyin veya API sağlayıcısı ile iletişime geçin: 0312 870 10 35'
    });
  }
});

// Lokasyonları getir (/:id'den ÖNCE olmalı)
router.get('/meta/locations', async (req, res) => {
  try {
    const locations = await fetchLocations();

    // Vercel edge cache için HTTP header'ları ekle
    // Bu sayede Vercel response'u edge'de cache'ler ve sonraki istekler çok daha hızlı olur
    res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=3600'); // 30 dakika cache, 1 saat stale-while-revalidate
    res.setHeader('CDN-Cache-Control', 'public, s-maxage=1800');
    res.setHeader('Vercel-CDN-Cache-Control', 'public, s-maxage=1800');

    res.json(locations);
  } catch (error) {
    console.error('Lokasyon getirme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// Grupları getir (araç kategorileri) (/:id'den ÖNCE olmalı)
router.get('/meta/groups', async (req, res) => {
  try {
    const groups = await fetchGroups();

    // Vercel edge cache için HTTP header'ları ekle
    res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=3600'); // 30 dakika cache
    res.setHeader('CDN-Cache-Control', 'public, s-maxage=1800');
    res.setHeader('Vercel-CDN-Cache-Control', 'public, s-maxage=1800');

    res.json(groups);
  } catch (error) {
    console.error('Grup getirme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// Kategorileri getir (veritabanından - opsiyonel) (/:id'den ÖNCE olmalı)
router.get('/meta/categories', async (req, res) => {
  // MongoDB kaldırıldığı için boş dizi
  res.json([]);
});

// Belirli bir araç getir (EN SONA - çünkü /:id her şeyi yakalar)
router.get('/:id', async (req, res) => {
  try {
    const carId = req.params.id;

    // MongoDB kaldırıldı
    // try { ... } catch (dbError) { ... }

    // Eğer ID rezId formatındaysa (XML- ile başlıyorsa) ve query parametrelerinde tarih/lokasyon varsa,
    // external API'den araç listesini çekip rezId'ye göre filtrele
    if (carId.startsWith('XML-') && req.query.pickupId && req.query.dropoffId && req.query.pickupDate && req.query.dropoffDate) {
      try {
        if (process.env.NODE_ENV !== 'production') {
          console.log(`🔍 RezId ile araç aranıyor: ${carId}`);
        }
        console.log('Query parametreleri:', req.query);

        const cars = await fetchCarsFromExternalAPI({
          pickupId: req.query.pickupId,
          dropoffId: req.query.dropoffId,
          pickupDate: req.query.pickupDate,
          dropoffDate: req.query.dropoffDate,
          pickupHour: parseInt(req.query.pickupHour) || 10,
          pickupMin: parseInt(req.query.pickupMin) || 0,
          dropoffHour: parseInt(req.query.dropoffHour) || 10,
          dropoffMin: parseInt(req.query.dropoffMin) || 0,
          currency: req.query.currency || 'EURO'
        });

        // RezId'ye göre araç bul
        const foundCar = cars.find(car => {
          const carRezId = car.rezId || car.Rez_ID || car.rez_ID || car.RezID || car.rezID;
          return carRezId === carId || String(carRezId) === String(carId);
        });

        if (foundCar) {
          console.log(`✅ Araç bulundu: ${carId}`);
          return res.json(foundCar);
        } else {
          console.warn(`⚠️ RezId ile araç bulunamadı: ${carId}`);
          console.warn(`Toplam ${cars.length} araç kontrol edildi`);
        }
      } catch (apiError) {
        console.error('❌ External API hatası:', apiError.message);
        // API hatası olsa bile devam et, 404 döndür
      }
    }

    // Veritabanında bulunamazsa ve rezId ile de bulunamazsa, 404 döndür
    console.warn(`⚠️ Araç bulunamadı: ID=${carId}`);
    console.warn('Not: Car objesi state ile geçirilmeli (CarList -> CarDetail -> Reservation)');
    console.warn('Veya query parametrelerinde pickupId, dropoffId, pickupDate, dropoffDate olmalı');
    return res.status(404).json({
      error: 'Araç bulunamadı',
      details: 'Lütfen araç listesinden seçin. Car objesi state ile geçirilmeli.',
      hint: carId.startsWith('XML-')
        ? 'RezId ile araç getirmek için query parametrelerinde pickupId, dropoffId, pickupDate, dropoffDate gerekli.'
        : 'MongoDB kullanılmıyorsa, car objesi frontend state ile geçirilmelidir.'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
