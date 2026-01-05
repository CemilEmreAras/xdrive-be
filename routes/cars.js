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
      try {
        const Car = require('../models/Car');
        let query = { available: true };

        if (category) {
          query.category = category;
        }

        if (transmission) {
          query.transmission = transmission;
        }

        if (minPrice || maxPrice) {
          query.pricePerDay = {};
          if (minPrice) query.pricePerDay.$gte = Number(minPrice);
          if (maxPrice) query.pricePerDay.$lte = Number(maxPrice);
        }

        let sortOptions = {};
        if (sortBy === 'price') {
          sortOptions.pricePerDay = order === 'desc' ? -1 : 1;
        } else if (sortBy === 'rating') {
          sortOptions.rating = order === 'desc' ? -1 : 1;
        } else {
          sortOptions.pricePerDay = 1;
        }

        const cars = await Car.find(query).sort(sortOptions);
        if (cars && cars.length > 0) {
          return res.json(cars);
        }
      } catch (error) {
        // MongoDB yoksa veya hata varsa, boş dizi döndür
        console.log('MongoDB cache kullanılamıyor, direkt API kullanılacak');
      }
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

    // Rezerve edilmiş araçları filtrele
    const reservedCars = getReservedCarsForDateRange(pickupDate, dropoffDate);
    const reservedCarKeys = new Set(reservedCars.map(c => `${c.rezId}_${c.carsParkId}`));
    
    // Filtreleme
    let filteredCars = cars.filter(car => {
      // Rezerve edilmiş araçları çıkar
      const carKey = `${car.rezId}_${car.carsParkId}`;
      return !reservedCarKeys.has(carKey);
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
    res.json(groups);
  } catch (error) {
    console.error('Grup getirme hatası:', error);
    res.status(500).json({ error: error.message });
  }
});

// Kategorileri getir (veritabanından - opsiyonel) (/:id'den ÖNCE olmalı)
router.get('/meta/categories', async (req, res) => {
  try {
    const Car = require('../models/Car');
    const categories = await Car.distinct('category');
    res.json(categories);
  } catch (error) {
    // MongoDB yoksa boş dizi döndür
    res.json([]);
  }
});

// Belirli bir araç getir (EN SONA - çünkü /:id her şeyi yakalar)
router.get('/:id', async (req, res) => {
  try {
    // Önce veritabanından kontrol et (MongoDB varsa)
    try {
      const Car = require('../models/Car');
      let car = await Car.findById(req.params.id);
      
      // Eğer bulunamazsa, externalId ile ara
      if (!car) {
        car = await Car.findOne({ externalId: req.params.id });
      }
      
      if (car) {
        return res.json(car);
      }
    } catch (dbError) {
      // MongoDB yoksa veya hata varsa devam et
    }
    
    // Veritabanında bulunamazsa, external API'den çek (bu durumda ID'yi rezId olarak kullan)
    // Not: Bu endpoint için external API'de direkt araç getirme yok, 
    // bu yüzden 404 döndürüyoruz
    // Ancak daha açıklayıcı bir mesaj verelim
    console.warn(`⚠️ Araç bulunamadı: ID=${req.params.id}`);
    console.warn('Not: Car objesi state ile geçirilmeli (CarList -> CarDetail -> Reservation)');
    return res.status(404).json({ 
      error: 'Araç bulunamadı',
      details: 'Lütfen araç listesinden seçin. Car objesi state ile geçirilmeli.',
      hint: 'MongoDB kullanılmıyorsa, car objesi frontend state ile geçirilmelidir.'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
