// Rezervasyon yapılmış araçları tutmak için in-memory cache
// Key format: `${rezId}_${carsParkId}_${pickupDate}_${dropoffDate}`

const fs = require('fs');
const path = require('path');

const CACHE_FILE = path.join(__dirname, '../data/reservedCars.json');
const reservedCars = new Set();

// Cache klasörünü oluştur
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Cache'i diskten yükle
const loadCache = () => {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = fs.readFileSync(CACHE_FILE, 'utf8');
      const json = JSON.parse(data);
      json.forEach(item => reservedCars.add(item));
      console.log(`✅ Rezervasyon cache diskten yüklendi (${reservedCars.size} öge)`);
    }
  } catch (error) {
    console.error('Cache yükleme hatası:', error);
  }
};

// Cache'i diske kaydet
const saveCache = () => {
  try {
    const data = JSON.stringify([...reservedCars]);
    fs.writeFileSync(CACHE_FILE, data, 'utf8');
  } catch (error) {
    console.error('Cache kaydetme hatası:', error);
  }
};

// Başlangıçta yükle
loadCache();

// Rezervasyon yapılmış araçları ekle
const addReservedCar = (rezId, carsParkId, pickupDate, dropoffDate) => {
  const key = `${rezId}_${carsParkId}_${pickupDate}_${dropoffDate}`;
  reservedCars.add(key);
  saveCache(); // Değişikliği kaydet
  console.log(`Rezervasyon cache'e eklendi: ${key}`);
};

// Rezervasyon iptal edilmiş araçları çıkar
const removeReservedCar = (rezId, carsParkId, pickupDate, dropoffDate) => {
  if (!rezId || !carsParkId) {
    console.warn('Rezervasyon cache: rezId veya carsParkId eksik');
    return;
  }
  // normalizeDate kaldırıldı, addReservedCar ile tutarlı olması için direkt kullanılıyor
  const key = `${rezId}_${carsParkId}_${pickupDate}_${dropoffDate}`;
  reservedCars.delete(key);
  saveCache(); // Değişikliği kaydet
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
  saveCache(); // Değişikliği kaydet
  console.log('Rezervasyon cache temizlendi');
};

module.exports = {
  addReservedCar,
  removeReservedCar,
  isCarReserved,
  getReservedCarsForDateRange,
  clearCache
};
