const axios = require('axios');

// Basit in-memory cache
let ratesCache = {
    data: null,
    timestamp: null,
    ttl: 60 * 60 * 1000 // 1 saat
};

const BASE_URL = 'https://api.exchangerate-api.com/v4/latest';

const getExchangeRates = async (baseCurrency = 'EUR') => {
    try {
        // Cache kontrol
        const now = Date.now();
        if (ratesCache.data && ratesCache.timestamp && (now - ratesCache.timestamp) < ratesCache.ttl) {
            // Base currency değişirse cache geçersiz olur ama şimdilik sadece EUR kullanıyoruz
            if (ratesCache.data.base === baseCurrency) {
                return ratesCache.data.rates;
            }
        }

        console.log(`💱 Döviz kurları çekiliyor (${baseCurrency})...`);
        const response = await axios.get(`${BASE_URL}/${baseCurrency}`);

        if (response.data && response.data.rates) {
            ratesCache.data = {
                base: baseCurrency,
                rates: response.data.rates
            };
            ratesCache.timestamp = now;
            console.log('✅ Döviz kurları güncellendi ve cachelendi.');
            return response.data.rates;
        }

        throw new Error('API yanıtı geçersiz');
    } catch (error) {
        console.error('❌ Döviz kuru çekme hatası:', error.message);
        // Hata durumunda cache varsa onu kullan
        if (ratesCache.data && ratesCache.data.rates) {
            console.warn('⚠️ Cache\'deki eski kurlar kullanılıyor.');
            return ratesCache.data.rates;
        }

        // Hiç veri yoksa fallback değerler (yaklaşık)
        console.warn('⚠️ Fallback döviz kurları kullanılıyor.');
        return {
            EUR: 1,
            USD: 1.05,
            GBP: 0.85,
            TRY: 35.0
        };
    }
};

const convertPrice = (amount, fromCurrency, toCurrency, rates) => {
    if (!amount || isNaN(amount)) return 0;
    if (fromCurrency === toCurrency) return amount;

    // Rates objesi base currency'ye göre (örn: EUR)
    // Eğer fromCurrency base ise (EUR), direkt toCurrency rate ile çarp
    // Eğer fromCurrency base değilse, önce base'e çevir, sonra toCurrency'ye

    // Basitleştirme: Bizim durumumuzda hep EUR'dan dönüştüreceğiz
    // Rates objesi EUR bazlı gelirse (getExchangeRates('EUR'))

    if (!rates[toCurrency]) {
        console.warn(`⚠️ Kur bulunamadı: ${toCurrency}, orijinal fiyat dönüyor`);
        return amount;
    }

    const rate = rates[toCurrency];
    return amount * rate;
};

module.exports = {
    getExchangeRates,
    convertPrice
};
