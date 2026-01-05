// Rezervasyon yapılmış araçları tutmak için in-memory cache
// Key format: `${rezId}_${carsParkId}_${pickupDate}_${dropoffDate}`

const reservedCars = new Set();

// Rezervasyon yapılmış araçları ekle
const addReservedCar = (rezId, carsParkId, pickupDate, dropoffDate) => {
  const key = `${rezId}_${carsParkId}_${pickupDate}_${dropoffDate}`;
  reservedCars.add(key);
  console.log(`Rezervasyon cache'e eklendi: ${key}`);
};

// Rezervasyon iptal edilmiş araçları çıkar
const removeReservedCar = (rezId, carsParkId, pickupDate, dropoffDate) => {
  if (!rezId || !carsParkId) {
    console.warn('Rezervasyon cache: rezId veya carsParkId eksik');
    return;
  }
  const normalizedPickup = normalizeDate(pickupDate);
  const normalizedDropoff = normalizeDate(dropoffDate);
  const key = `${rezId}_${carsParkId}_${normalizedPickup}_${normalizedDropoff}`;
  reservedCars.delete(key);
  console.log(`Rezervasyon cache'den çıkarıldı: ${key}`);
};

// Araç rezerve edilmiş mi kontrol et
const isCarReserved = (rezId, carsParkId, pickupDate, dropoffDate) => {
  const key = `${rezId}_${carsParkId}_${pickupDate}_${dropoffDate}`;
  return reservedCars.has(key);
};

// Belirli bir tarih aralığında rezerve edilmiş araçları kontrol et
const getReservedCarsForDateRange = (pickupDate, dropoffDate) => {
  const reserved = [];
  reservedCars.forEach(key => {
    const parts = key.split('_');
    if (parts.length >= 4) {
      const carPickupDate = parts[2];
      const carDropoffDate = parts[3];
      
      // Tarih çakışması kontrolü
      const carPickup = new Date(carPickupDate);
      const carDropoff = new Date(carDropoffDate);
      const checkPickup = new Date(pickupDate);
      const checkDropoff = new Date(dropoffDate);
      
      // Tarih aralıkları çakışıyor mu?
      if (!(carDropoff <= checkPickup || carPickup >= checkDropoff)) {
        reserved.push({
          rezId: parts[0],
          carsParkId: parts[1]
        });
      }
    }
  });
  return reserved;
};

// Cache'i temizle (opsiyonel - test için)
const clearCache = () => {
  reservedCars.clear();
  console.log('Rezervasyon cache temizlendi');
};

module.exports = {
  addReservedCar,
  removeReservedCar,
  isCarReserved,
  getReservedCarsForDateRange,
  clearCache
};

