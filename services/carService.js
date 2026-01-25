const axios = require('axios');

const { getAvailableCars, getLocations, getGroups } = require('./externalApiService');
const { convertPrice, getExchangeRates } = require('./currencyService');

// Location cache (memory cache)
let locationCache = {
  data: null,
  timestamp: null,
  ttl: 30 * 60 * 1000 // 30 dakika (milisaniye cinsinden)
};

// Group cache (memory cache)
let groupCache = {
  data: null,
  timestamp: null,
  ttl: 30 * 60 * 1000 // 30 dakika
};

// Dış API'den araçları çekme - gerçek API kullanımı
const parsePrice = (val) => {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return val;
  try {
    return parseFloat(String(val).replace(',', '.'));
  } catch (e) {
    return 0;
  }
};

const fetchCarsFromExternalAPI = async (params = {}) => {
  try {
    // Eğer parametreler verilmişse (tarih ve lokasyon), müsait araçları getir
    if (params.pickupId && params.dropoffId && params.pickupDate && params.dropoffDate) {
      // Önce grup verilerini çek (marka ve model bilgileri için)
      let groupsMap = {};
      try {
        const groups = await getGroups();
        if (Array.isArray(groups) && groups.length > 0) {
          groups.forEach(group => {
            try {
              const groupId = group.group_id || group.Group_ID || group.group_ID;
              if (groupId !== undefined && groupId !== null) {
                // Hem string hem number olarak kaydet (eşleştirme için)
                const groupIdStr = String(groupId);
                const groupIdNum = Number(groupId);

                const groupData = {
                  brand: group.brand || group.Brand || '',
                  type: group.type || group.Type || '',
                  groupName: group.group_name || group.Group_Name || '',
                  imagePath: group.image_path || group.Image_Path || group.image_Path || ''
                };

                // Hem string hem number key ile kaydet
                groupsMap[groupIdStr] = groupData;
                if (!isNaN(groupIdNum)) {
                  groupsMap[groupIdNum] = groupData;
                }
              }
            } catch (groupItemError) {
              // Tek bir grup öğesi hatası, devam et
              console.warn('Grup öğesi işlenirken hata:', groupItemError.message);
            }
          });
          console.log(`Grup verileri yüklendi: ${Object.keys(groupsMap).length} grup`);
        }
      } catch (groupError) {
        // Grup verileri çekilemezse, sadece araç verileri kullanılacak
        console.warn('Grup verileri çekilemedi, sadece araç verileri kullanılacak:', groupError.message);
      }

      const availableCars = await getAvailableCars({
        pickupId: params.pickupId,
        dropoffId: params.dropoffId,
        pickupDate: params.pickupDate,
        dropoffDate: params.dropoffDate,
        pickupHour: params.pickupHour || 10,
        pickupMin: params.pickupMin || 0,
        dropoffHour: params.dropoffHour || 10,
        dropoffMin: params.dropoffMin || 0,
        currency: 'EURO' // External API sadece EURO destekliyor
      });

      // İstenen para birimi EURO değilse, döviz kurlarını getir
      let exchangeRates = null;
      const targetCurrency = params.currency || 'EURO';

      if (targetCurrency !== 'EURO') {
        try {
          exchangeRates = await getExchangeRates('EUR');
        } catch (rateError) {
          console.error('Döviz kuru alınamadı:', rateError);
        }
      }

      // API'den gelen veriyi Car modeline uygun formata dönüştür
      if (Array.isArray(availableCars)) {
        // Hata kontrolü
        if (availableCars.length > 0 && availableCars[0].success === 'False') {
          const errorMsg = availableCars[0].error || 'Bilinmeyen hata';
          throw new Error(`API Hatası: ${errorMsg}. Lütfen API sağlayıcısı ile iletişime geçin.`);
        }

        return availableCars.map(car => {
          // API'den gelen veriyi normalize et (hem küçük hem büyük harf desteği)
          const apiCar = car;

          // İlk araç için API'den gelen TÜM veriyi logla
          if (availableCars.indexOf(car) === 0) {
            console.log('🔍 API\'den gelen İLK ARAÇ VERİSİ (TÜM ALANLAR):');
            console.log(JSON.stringify(apiCar, null, 2));
            console.log('API\'den gelen key\'ler:', Object.keys(apiCar));
          }

          // Filtreleme mantığı:
          // 1. Fiyat kontrolü: Daily_Rental veya Total_Rental 0'dan büyük olmalı
          // 2. Status kontrolü: Status, Available, Is_Available 'False' veya '0' olmamalı
          // 3. Quota kontrolü: Quota varsa ve 0 ise listenmemeli (opsiyonel, bazen -1 sınırsız demek olabilir)



          const possibleDailyPrices = [
            apiCar.Daily_Rental, apiCar.daily_Rental, apiCar.DailyRental, apiCar.dailyRental, apiCar.DAILY_RENTAL,
            apiCar.daily_rental, // Added snake_case
            apiCar.Price, apiCar.price, apiCar.PRICE,
            apiCar.Daily_Price, apiCar.daily_price
          ];
          const hasDailyPrice = possibleDailyPrices.some(p => parsePrice(p) > 0);

          const possibleTotalPrices = [
            apiCar.Total_Rental, apiCar.total_Rental, apiCar.TotalRental, apiCar.totalRental, apiCar.TOTAL_RENTAL,
            apiCar.total_rental, // Added snake_case
            apiCar.Total, apiCar.total, apiCar.TOTAL,
            apiCar.Total_Price, apiCar.total_price
          ];
          const hasTotalPrice = possibleTotalPrices.some(p => parsePrice(p) > 0);

          if (!hasDailyPrice && !hasTotalPrice) {
            console.log('❌ Filtrelendi: Fiyat 0 veya geçersiz', {
              brand: apiCar.Brand || apiCar.brand,
              model: apiCar.Model || apiCar.model || apiCar.type || apiCar.car_name,
              daily: possibleDailyPrices.find(p => p),
              total: possibleTotalPrices.find(p => p),
              keys: Object.keys(apiCar).filter(k => k.includes('rental') || k.includes('Rental'))
            });
            return null;
          }

          // Status kontrolü
          const status = apiCar.Status || apiCar.status || apiCar.STATUS;
          const available = apiCar.Available || apiCar.available || apiCar.AVAILABLE;

          if (status === 'False' || status === false || status === '0' || status === 0) {
            if (availableCars.indexOf(car) === 0) console.log('❌ Filtrelendi: Status False/0');
            return null;
          }
          if (available === 'False' || available === false || available === '0' || available === 0) {
            if (availableCars.indexOf(car) === 0) console.log('❌ Filtrelendi: Available False/0');
            return null;
          }
          // Quota kontrolü (Quota = 0 ise müsait değil)
          const quota = apiCar.Quota || apiCar.quota || apiCar.QUOTA;
          if (quota !== undefined && quota !== null && (quota === 0 || quota === '0')) {
            if (availableCars.indexOf(car) === 0) console.log('❌ Filtrelendi: Quota 0');
            return null;
          }

          return car;
        }).filter(car => car !== null).map(car => {
          // API'den gelen veriyi normalize et (hem küçük hem büyük harf desteği)
          const apiCar = car;

          // GroupId'yi API verisinden çek
          const groupId = apiCar.group_id || apiCar.Group_ID || apiCar.group_ID || apiCar.GroupID || apiCar.groupID || apiCar.GROUP_ID || apiCar.groupId;

          // Hem string hem number olarak kontrol et
          const groupInfo = groupsMap[String(groupId)] || groupsMap[Number(groupId)] || groupsMap[groupId] || {};

          // Debug: İlk araç için detaylı log (production'da kaldırılabilir)
          if (availableCars.indexOf(car) === 0) {
            console.log('🔍 Debug - İlk araç bilgileri:');
            console.log('  Group_ID:', groupId, '(tip:', typeof groupId + ')');
            console.log('  Grup bilgisi bulundu:', Object.keys(groupInfo).length > 0);
            if (Object.keys(groupInfo).length > 0) {
              console.log('  Grup bilgisi:', groupInfo);
            }
            console.log('  API\'den gelen fiyat alanları:', {
              Daily_Rental: apiCar.Daily_Rental,
              daily_Rental: apiCar.daily_Rental,
              Total_Rental: apiCar.Total_Rental,
              total_Rental: apiCar.total_Rental
            });
          }

          // Grup bilgilerinden marka ve model al, yoksa API'den gelen veriyi kullan
          const brand = groupInfo.brand || apiCar.Brand || apiCar.brand || apiCar.BRAND || 'Bilinmiyor';
          const model = groupInfo.type || apiCar.Car_Name || apiCar.car_Name || apiCar.CAR_NAME || apiCar.Model || apiCar.model || apiCar.MODEL || apiCar.Type || apiCar.type || 'Bilinmiyor';
          const groupName = groupInfo.groupName || apiCar.Car_Name || apiCar.car_Name || apiCar.CAR_NAME || 'Standard';

          // Fiyat bilgilerini kontrol et - tüm olası alan adlarını kontrol et
          // Önce tüm olası fiyat alanlarını topla
          const possibleDailyPrices = [
            apiCar.Daily_Rental,
            apiCar.daily_Rental,
            apiCar.DailyRental,
            apiCar.dailyRental,
            apiCar.DAILY_RENTAL,
            apiCar.daily_rental,
            apiCar.Rental,
            apiCar.rental,
            apiCar.RENTAL,
            apiCar.Price,
            apiCar.price,
            apiCar.PRICE,
            apiCar.Daily_Price,
            apiCar.daily_price,
            apiCar.DAILY_PRICE
          ];

          // İlk geçerli değeri bul
          let dailyRentalValue = 0;
          for (const price of possibleDailyPrices) {
            const parsed = parsePrice(price);
            if (parsed > 0) {
              dailyRentalValue = parsed;
              break;
            }
          }

          // Toplam fiyat için de aynı işlemi yap
          const possibleTotalPrices = [
            apiCar.Total_Rental,
            apiCar.total_Rental,
            apiCar.TotalRental,
            apiCar.totalRental,
            apiCar.TOTAL_RENTAL,
            apiCar.total_rental,
            apiCar.Total,
            apiCar.total,
            apiCar.TOTAL,
            apiCar.Total_Price,
            apiCar.total_price,
            apiCar.TOTAL_PRICE
          ];

          let totalRentalValue = 0;
          for (const price of possibleTotalPrices) {
            const parsed = parsePrice(price);
            if (parsed > 0) {
              totalRentalValue = parsed;
              break;
            }
          }

          const dailyRental = dailyRentalValue;
          const totalRental = totalRentalValue;

          // Para birimi dönüştürme - Backend'den her zaman EUR cinsinden gönder
          // Frontend'de dönüştürme yapılacak
          let finalDailyPrice = dailyRental; // EUR cinsinden
          let finalTotalPrice = totalRental; // EUR cinsinden
          const currencySymbol = targetCurrency === 'USD' ? '$' : targetCurrency === 'GBP' ? '£' : '€';

          // Backend'den her zaman EUR cinsinden gönder, frontend'de dönüştürülecek
          // if (targetCurrency !== 'EURO' && exchangeRates) {
          //   finalDailyPrice = convertPrice(dailyRental, 'EUR', targetCurrency, exchangeRates);
          //   finalTotalPrice = convertPrice(totalRental, 'EUR', targetCurrency, exchangeRates);
          // }

          // Debug: Fiyat bulunamadıysa tüm alanları logla
          if (availableCars.indexOf(car) === 0) {
            console.log('  Hesaplanan değerler:');
            console.log('    Marka:', brand);
            console.log('    Model:', model);
            console.log('    Günlük fiyat:', dailyRental);
            console.log('    Toplam fiyat:', totalRental);

            if (dailyRental === 0) {
              console.log('⚠️ Fiyat bulunamadı! API\'den gelen tüm alanlar:');
              const priceRelatedKeys = Object.keys(apiCar).filter(key =>
                key.toLowerCase().includes('rental') ||
                key.toLowerCase().includes('price') ||
                key.toLowerCase().includes('cost') ||
                key.toLowerCase().includes('fee') ||
                key.toLowerCase().includes('amount')
              );
              if (priceRelatedKeys.length > 0) {
                priceRelatedKeys.forEach(key => {
                  console.log(`    ${key}: ${apiCar[key]} (tip: ${typeof apiCar[key]})`);
                });
              } else {
                console.log('    Fiyat ile ilgili alan bulunamadı. Tüm alanlar:');
                console.log('    ', Object.keys(apiCar));
              }
            }
          }

          // API dokümantasyonuna göre: Rez_ID, Cars_Park_ID, Group_ID
          // Ama API küçük harfle gönderiyor: rez_id, cars_park_id, group_id
          // Tüm olası case'leri kontrol et (önce küçük harf, sonra büyük harf)
          const rezId = apiCar.rez_id || apiCar.Rez_ID || apiCar.rez_ID || apiCar.RezID || apiCar.rezID || apiCar.REZ_ID || apiCar.rezId;
          const carsParkId = apiCar.cars_park_id || apiCar.Cars_Park_ID || apiCar.cars_Park_ID || apiCar.CarsParkID || apiCar.carsParkID || apiCar.CARS_PARK_ID || apiCar.carsParkId;
          const finalGroupId = groupId || apiCar.group_id || apiCar.Group_ID || apiCar.group_ID || apiCar.GroupID || apiCar.groupID || apiCar.GROUP_ID || apiCar.groupId;

          // Debug: İlk araç için rezervasyon alanlarını logla
          if (availableCars.indexOf(car) === 0) {
            console.log('🔍 Rezervasyon için gerekli alanlar:');
            console.log('  Rez_ID (rezId):', rezId, '(API\'den:', {
              'Rez_ID': apiCar.Rez_ID,
              'rez_ID': apiCar.rez_ID,
              'RezID': apiCar.RezID,
              'rezID': apiCar.rezID,
              'REZ_ID': apiCar.REZ_ID,
              'rezId': apiCar.rezId
            }, ')');
            console.log('  Cars_Park_ID (carsParkId):', carsParkId, '(API\'den:', {
              'Cars_Park_ID': apiCar.Cars_Park_ID,
              'cars_Park_ID': apiCar.cars_Park_ID,
              'CarsParkID': apiCar.CarsParkID,
              'carsParkID': apiCar.carsParkID,
              'CARS_PARK_ID': apiCar.CARS_PARK_ID,
              'carsParkId': apiCar.carsParkId
            }, ')');
            console.log('  Group_ID (groupId):', finalGroupId, '(API\'den:', {
              'Group_ID': apiCar.Group_ID,
              'group_ID': apiCar.group_ID,
              'GroupID': apiCar.GroupID,
              'groupID': apiCar.groupID,
              'GROUP_ID': apiCar.GROUP_ID,
              'groupId': apiCar.groupId
            }, ', grup map\'ten:', groupId, ')');

            if (!rezId || !carsParkId || !finalGroupId) {
              console.error('❌ Rezervasyon için gerekli alanlar eksik!');
              console.error('  API\'den gelen tüm alanlar:', Object.keys(apiCar));
              console.error('  API\'den gelen değerler:', JSON.stringify(apiCar, null, 2));

              // Rez_ID, Cars_Park_ID, Group_ID içeren tüm key'leri bul
              const rezIdKeys = Object.keys(apiCar).filter(key =>
                key.toLowerCase().includes('rez') || (key.toLowerCase().includes('id') && !key.toLowerCase().includes('park') && !key.toLowerCase().includes('group'))
              );
              const carsParkIdKeys = Object.keys(apiCar).filter(key =>
                key.toLowerCase().includes('park') || key.toLowerCase().includes('cars')
              );
              const groupIdKeys = Object.keys(apiCar).filter(key =>
                key.toLowerCase().includes('group')
              );

              console.error('  Rez_ID içeren key\'ler:', rezIdKeys);
              console.error('  Cars_Park_ID içeren key\'ler:', carsParkIdKeys);
              console.error('  Group_ID içeren key\'ler:', groupIdKeys);
            }
          }

          // Eğer değerler hala undefined ise, uyar
          if (!rezId || !carsParkId || !finalGroupId) {
            console.warn('⚠️ CarService: Rezervasyon alanları undefined!', {
              rezId,
              carsParkId,
              finalGroupId,
              apiCarKeys: Object.keys(apiCar)
            });
          }

          // Eğer değerler hala undefined ise, API'den gelen tüm key'leri kontrol et
          let finalRezId = rezId;
          let finalCarsParkId = carsParkId;
          let finalGroupIdValue = finalGroupId;

          if (!finalRezId) {
            // Rez_ID içeren tüm key'leri bul
            const rezKeys = Object.keys(apiCar).filter(k => k.toLowerCase().includes('rez'));
            if (rezKeys.length > 0) {
              finalRezId = apiCar[rezKeys[0]];
              console.warn(`⚠️ Rez_ID bulunamadı, alternatif key kullanıldı: ${rezKeys[0]} = ${finalRezId}`);
            }
          }

          if (!finalCarsParkId) {
            // Cars_Park_ID içeren tüm key'leri bul
            const parkKeys = Object.keys(apiCar).filter(k =>
              k.toLowerCase().includes('park') || k.toLowerCase().includes('cars_park')
            );
            if (parkKeys.length > 0) {
              finalCarsParkId = apiCar[parkKeys[0]];
              console.warn(`⚠️ Cars_Park_ID bulunamadı, alternatif key kullanıldı: ${parkKeys[0]} = ${finalCarsParkId}`);
            }
          }

          if (!finalGroupIdValue) {
            // Group_ID içeren tüm key'leri bul
            const groupKeys = Object.keys(apiCar).filter(k => k.toLowerCase().includes('group'));
            if (groupKeys.length > 0) {
              finalGroupIdValue = apiCar[groupKeys[0]];
              console.warn(`⚠️ Group_ID bulunamadı, alternatif key kullanıldı: ${groupKeys[0]} = ${finalGroupIdValue}`);
            }
          }

          return {
            externalId: finalRezId || finalCarsParkId,
            rezId: finalRezId,
            carsParkId: finalCarsParkId,
            groupId: finalGroupIdValue,
            brand: brand,
            model: model,
            year: new Date().getFullYear(),
            category: groupName,
            group_str: apiCar.group_str || apiCar.Group_Str || apiCar.GROUP_STR || apiCar.groupStr || groupName || 'Standard',
            transmission: apiCar.Transmission || apiCar.transmission || apiCar.TRANSMISSION || (groupName.includes('OTOMATİK') || groupName.includes('AUTOMATIC') ? 'Otomatik' : 'Manuel'),
            seats: apiCar.Chairs || apiCar.chairs || apiCar.CHAIRS || 5,
            doors: apiCar.Doors || apiCar.doors || apiCar.DOORS || 5,
            airConditioning: apiCar.AirCondition || apiCar.air_condition || apiCar.Air_Condition || apiCar.airCondition || apiCar.AIR_CONDITION || 'A/C',
            bags: apiCar.small_bags || apiCar.Small_Bags || apiCar.SMALL_BAGS || apiCar.bags || apiCar.Bags || 2,
            bigBags: apiCar.big_bags || apiCar.Big_Bags || apiCar.BIG_BAGS || apiCar.bigBags || 0,
            pricePerDay: finalDailyPrice, // EUR cinsinden
            totalPrice: finalTotalPrice, // EUR cinsinden
            days: apiCar.Days || apiCar.days || 1,
            currency: 'EURO', // Her zaman EUR cinsinden gönder, frontend'de dönüştürülecek
            location: {
              pickupId: params.pickupId,
              dropoffId: params.dropoffId
            },
            image: (() => {
              // Group ID'yi al (log için)
              const finalGroupId = groupId || apiCar.Group_ID || apiCar.group_ID || apiCar.group_id || apiCar.GroupID;

              // ÖNCELİK 1: Groups endpoint'indeki image_path alanını kullan (en yüksek öncelik)
              // image_path değerinden resim ismini al ve https://t1.trvcar.com/XDriveDzn/ sonuna ekle
              const groupImage = groupInfo.imagePath;
              if (groupImage && groupImage.trim() !== '' && groupImage !== 'null' && groupImage !== 'undefined') {
                let cleanImageName = groupImage.trim();

                // Eğer tam URL ise, sadece dosya adını çıkar
                if (cleanImageName.includes('t1.trvcar.com') || cleanImageName.includes('trvcar.com')) {
                  // URL'den dosya adını çıkar
                  const urlParts = cleanImageName.split('/');
                  cleanImageName = urlParts[urlParts.length - 1];
                } else if (cleanImageName.startsWith('http://') || cleanImageName.startsWith('https://')) {
                  // Diğer URL'lerden dosya adını çıkar
                  const urlParts = cleanImageName.split('/');
                  cleanImageName = urlParts[urlParts.length - 1];
                } else if (cleanImageName.startsWith('/')) {
                  // / ile başlıyorsa kaldır
                  cleanImageName = cleanImageName.substring(1);
                }

                // Resim ismini direkt https://t1.trvcar.com/XDriveDzn/ sonuna ekle (proxy kullanmadan)
                // Örnek: "34d6fc31-7543-4642-ae3e-fe247f90ff55-.jpeg" → "https://t1.trvcar.com/XDriveDzn/34d6fc31-7543-4642-ae3e-fe247f90ff55-.jpeg"
                const finalImageUrl = `https://t1.trvcar.com/XDriveDzn/${cleanImageName}`;

                if (availableCars.indexOf(car) === 0) {
                  console.log('  ✅ Groups image_path kullanılıyor:');
                  console.log('    📋 Orijinal image_path:', groupImage);
                  console.log('    📋 Temizlenmiş resim ismi:', cleanImageName);
                  console.log('    🔗 Final image URL:', finalImageUrl);
                }

                return finalImageUrl;
              }

              // ÖNCELİK 1.5: image_path boş ise, placeholder döndür (group_id ile alternatif URL oluşturma kaldırıldı)
              // Sadece Groups endpoint'inden gelen image_path değeri kullanılacak
              if (availableCars.indexOf(car) === 0) {
                console.log('  ⚠️ Groups image_path boş, placeholder kullanılacak (group_id:', finalGroupId, ')');
              }

              // ÖNCELİK 3: JsonRez.aspx'ten Image_Path field'ı (düşük öncelik - sadece Groups'da yoksa)
              // API'den gelen Image_Path'i kontrol et (tüm case varyasyonları)
              const imagePathFields = [
                apiCar.Image_Path,      // Dökümantasyonda belirtilen field
                apiCar.image_Path,
                apiCar.image_path,
                apiCar.IMAGE_PATH,
                apiCar.ImagePath,
                apiCar.imagePath
              ];

              // Debug: İlk araç için resim bilgilerini logla
              if (availableCars.indexOf(car) === 0) {
                console.log('🖼️ Resim bilgileri (Dökümantasyona göre):');
                console.log('  📋 Groups image_path:', groupImage || '(boş)');
                console.log('  📋 API Image_Path (dökümantasyonda belirtilen):', apiCar.Image_Path);
                console.log('  📋 Image_Path tüm varyasyonlar:', {
                  'Image_Path': apiCar.Image_Path,
                  'image_Path': apiCar.image_Path,
                  'image_path': apiCar.image_path,
                  'IMAGE_PATH': apiCar.IMAGE_PATH,
                  'ImagePath': apiCar.ImagePath,
                  'imagePath': apiCar.imagePath
                });
                console.log('  🔍 API\'den gelen TÜM KEY\'LER:', Object.keys(apiCar));
                console.log('  🔍 Image ile ilgili tüm key\'ler:', Object.keys(apiCar).filter(k =>
                  k.toLowerCase().includes('image') ||
                  k.toLowerCase().includes('img') ||
                  k.toLowerCase().includes('photo') ||
                  k.toLowerCase().includes('picture') ||
                  k.toLowerCase().includes('resim') ||
                  k.toLowerCase().includes('foto') ||
                  k.toLowerCase().includes('path')
                ));
              }

              // ÖNCELİK 3: API'den gelen Image_Path field'ını kontrol et
              // Image_Path değerinden resim ismini al ve https://t1.trvcar.com/XDriveDzn/ sonuna ekle
              for (const imagePath of imagePathFields) {
                if (imagePath &&
                  typeof imagePath === 'string' &&
                  imagePath.trim() !== '' &&
                  imagePath !== 'null' &&
                  imagePath !== 'undefined' &&
                  !imagePath.startsWith('data:image/svg+xml')) {

                  let cleanImageName = imagePath.trim();

                  // Eğer tam URL ise, sadece dosya adını çıkar
                  if (cleanImageName.includes('t1.trvcar.com') || cleanImageName.includes('trvcar.com')) {
                    // URL'den dosya adını çıkar
                    const urlParts = cleanImageName.split('/');
                    cleanImageName = urlParts[urlParts.length - 1];
                  } else if (cleanImageName.startsWith('http://') || cleanImageName.startsWith('https://')) {
                    // Diğer URL'lerden dosya adını çıkar
                    const urlParts = cleanImageName.split('/');
                    cleanImageName = urlParts[urlParts.length - 1];
                  } else if (cleanImageName.startsWith('/')) {
                    // / ile başlıyorsa kaldır
                    cleanImageName = cleanImageName.substring(1);
                  }

                  // Resim ismini direkt https://t1.trvcar.com/XDriveDzn/ sonuna ekle (proxy kullanmadan)
                  // Örnek: "40148f19-3c9b-4499-804e-a49991f216b0-.png" → "https://t1.trvcar.com/XDriveDzn/40148f19-3c9b-4499-804e-a49991f216b0-.png"
                  const finalImageUrl = `https://t1.trvcar.com/XDriveDzn/${cleanImageName}`;

                  if (availableCars.indexOf(car) === 0) {
                    console.log('  ✅ API Image_Path kullanılıyor:');
                    console.log('    📋 Orijinal Image_Path:', imagePath);
                    console.log('    📋 Temizlenmiş resim ismi:', cleanImageName);
                    console.log('    🔗 Final image URL:', finalImageUrl);
                    console.log('    📋 Field:', Object.keys(apiCar).find(k => apiCar[k] === imagePath));
                  }

                  return finalImageUrl;
                }
              }

              // ÖNCELİK 4: Image_Path ve grup resmi yoksa, alternatif URL formatlarını dene
              // Dökümantasyona göre: Cars_Park_ID, Group_ID, Rez_ID mevcut
              const carsParkId = apiCar.Cars_Park_ID || apiCar.cars_Park_ID || apiCar.cars_park_id || apiCar.CarsParkID;
              const rezId = apiCar.Rez_ID || apiCar.rez_ID || apiCar.rez_id || apiCar.RezID;
              const carWebId = apiCar.car_web_id || apiCar.Car_Web_ID || apiCar.car_Web_ID;

              // Alternatif image URL formatları (dökümantasyondaki ID'lere göre)
              const alternativeUrls = [];

              // Group_ID ile resim URL'leri KALDIRILDI
              // Sadece Groups endpoint'inden gelen image_path kullanılacak
              // group_id ile alternatif URL oluşturma kaldırıldı (group_425.jpeg gibi formatlar çalışmıyor)

              // Rez_ID ile resim URL'leri (dökümantasyonda Rez_ID var) - Proxy kullan
              if (rezId) {
                const cleanRezId = String(rezId).replace('XML-', '');
                const rezUrls = [
                  `http://xdrivejson.turevsistem.com/images/rez_${cleanRezId}.jpg`,
                  `http://xdrivejson.turevsistem.com/images/rez_${cleanRezId}.png`,
                  `http://xdrivejson.turevsistem.com/cars/rez_${cleanRezId}.jpg`,
                  `http://xdrivejson.turevsistem.com/cars/rez_${cleanRezId}.png`,
                  `http://xdrivejson.turevsistem.com/images/${cleanRezId}.jpg`,
                  `http://xdrivejson.turevsistem.com/images/${cleanRezId}.png`
                ];
                alternativeUrls.push(...rezUrls.map(url => `/api/images/proxy?url=${encodeURIComponent(url)}`));
              }

              // Cars_Park_ID ile resim URL'leri (dökümantasyonda Cars_Park_ID var) - Proxy kullan
              if (carsParkId) {
                const carsParkIdStr = String(carsParkId);
                const carsParkUrls = [
                  `http://xdrivejson.turevsistem.com/images/car_${carsParkIdStr}.jpg`,
                  `http://xdrivejson.turevsistem.com/images/car_${carsParkIdStr}.png`,
                  `http://xdrivejson.turevsistem.com/cars/${carsParkIdStr}.jpg`,
                  `http://xdrivejson.turevsistem.com/cars/${carsParkIdStr}.png`
                ];
                alternativeUrls.push(...carsParkUrls.map(url => `/api/images/proxy?url=${encodeURIComponent(url)}`));
              }

              // car_web_id ile resim URL'leri (eğer varsa) - Proxy kullan
              if (carWebId) {
                const carWebIdStr = String(carWebId);
                const carWebUrls = [
                  `http://xdrivejson.turevsistem.com/images/car_${carWebIdStr}.jpg`,
                  `http://xdrivejson.turevsistem.com/images/car_${carWebIdStr}.png`,
                  `http://xdrivejson.turevsistem.com/cars/${carWebIdStr}.jpg`,
                  `http://xdrivejson.turevsistem.com/cars/${carWebIdStr}.png`,
                  `http://xdrivejson.turevsistem.com/arac/${carWebIdStr}.jpg`,
                  `http://xdrivejson.turevsistem.com/arac/${carWebIdStr}.png`
                ];
                alternativeUrls.push(...carWebUrls.map(url => `/api/images/proxy?url=${encodeURIComponent(url)}`));
              }

              // İlk alternatif URL'i döndür (frontend'de fallback mekanizması var)
              if (alternativeUrls.length > 0) {
                if (availableCars.indexOf(car) === 0) {
                  console.log('  🔄 Alternatif resim URL\'leri deneniyor (proxy ile):');
                  console.log('    Group_ID:', finalGroupId);
                  console.log('    Rez_ID:', rezId);
                  console.log('    Cars_Park_ID:', carsParkId);
                  console.log('    İlk URL:', alternativeUrls[0]);
                }
                return alternativeUrls[0];
              }

              // Hiç resim yoksa placeholder döndür
              if (availableCars.indexOf(car) === 0) {
                console.log('  ⚠️ Resim bulunamadı, placeholder kullanılıyor');
                console.log('  ⚠️ Image_Path, grup resmi ve alternatif URL\'ler kontrol edildi, hiçbiri geçerli değil');
                console.log('  ⚠️ Mevcut ID\'ler:', {
                  'Group_ID': finalGroupId,
                  'Rez_ID': rezId,
                  'Cars_Park_ID': carsParkId,
                  'car_web_id': carWebId
                });
              }

              return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iI2Y1ZjVmNSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMjAiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5BcmHDpyBSZXNtaTwvdGV4dD48L3N2Zz4=';
            })(),
            available: true,
            features: [],
            rating: 4.5,
            reviewCount: 0,
            // Ek bilgiler
            sipp: apiCar.SIPP || apiCar.sipp || apiCar.sipp_code,
            bigBags: apiCar.big_bags || apiCar.Big_Bags || apiCar.BIG_BAGS || apiCar.bigBags || 0,
            smallBags: apiCar.small_bags || apiCar.Small_Bags || apiCar.SMALL_BAGS || apiCar.smallBags || 2,
            drivingLicenseAge: apiCar.Driving_License_Age || apiCar.driving_License_Age || apiCar.driving_license_age,
            // Minimum driver age (API: driver_age)
            driverAge: apiCar.driver_age || apiCar.Driver_Age || apiCar.driver_Age,
            // Young driver minimum age (API: young_drive_age)
            youngDriveAge: apiCar.young_drive_age || apiCar.Young_Drive_Age || apiCar.youngDriveAge,
            young_drive_age: apiCar.young_drive_age || apiCar.Young_Drive_Age || apiCar.youngDriveAge,
            provision: (() => {
              const amount = apiCar.Provision || apiCar.provision;
              if (amount === undefined || amount === null || amount === '') return 0;
              const parsed = typeof amount === 'string' ? parseFloat(amount.replace(',', '.')) : amount;
              if (isNaN(parsed)) return 0;

              // Her zaman EUR cinsinden gönder, frontend'de dönüştürülecek
              // if (targetCurrency !== 'EURO' && exchangeRates) {
              //   return convertPrice(parsed, 'EUR', targetCurrency, exchangeRates);
              // }
              return parsed; // EUR cinsinden
            })(),
            kmLimit: apiCar.km_limit || apiCar.Km_Limit || apiCar.km_Limit || apiCar.KmLimit,
            drop: apiCar.Drop || apiCar.drop,
            cdw: apiCar.CDW || apiCar.cdw,
            scdw: apiCar.SCDW || apiCar.scdw,
            lcf: apiCar.LCF || apiCar.lcf,
            pai: apiCar.PAI || apiCar.pai,
            babySeat: apiCar.Baby_Seat || apiCar.baby_Seat,
            navigation: apiCar.Navigation || apiCar.navigation,
            additionalDriver: apiCar.Additional_Driver || apiCar.additional_Driver,
            fuel: apiCar.Fuel || apiCar.fuel || apiCar.FUEL || 'Petrol',
            fuel_type: apiCar.Fuel || apiCar.fuel || apiCar.FUEL || 'Petrol',
            AirCondition: apiCar.AirCondition || apiCar.air_condition || apiCar.Air_Condition || apiCar.airCondition || apiCar.AIR_CONDITION || 'A/C',
            // Ekstra özellik fiyatları - API'den Services array'i içinde geliyor
            // Services array'i içinde: service_name, service_title, service_desc, service_total_price
            // service_total_price string formatında (virgülle ayrılmış olabilir: "80,09")
            // Gün sayısına bölerek günlük fiyatı hesaplıyoruz
            extras: (() => {
              const days = apiCar.Days || apiCar.days || 1;
              const services = apiCar.Services || apiCar.services || [];

              // Services array'inden extras verilerini parse et
              const extrasFromServices = {};
              const extrasMetadata = {}; // title ve description için

              // Debug: İlk araç için Services array'ini logla
              if (availableCars.indexOf(car) === 0) {
                console.log('🔍 Services array kontrolü:');
                console.log('  Services:', services);
                console.log('  Services length:', services?.length || 0);
                console.log('  Services is array:', Array.isArray(services));
              }

              if (Array.isArray(services) && services.length > 0) {
                services.forEach((service, index) => {
                  if (!service || !service.service_name) {
                    if (availableCars.indexOf(car) === 0 && index === 0) {
                      console.warn('⚠️ Service objesi veya service_name eksik:', service);
                    }
                    return;
                  }

                  const serviceName = service.service_name.toLowerCase();
                  const totalPriceStr = service.service_total_price || '0';
                  // service_name'den title ve description oluştur
                  const serviceNameOriginal = service.service_name || '';
                  const serviceTitle = serviceNameOriginal
                    .replace(/_/g, ' ') // Alt çizgiyi boşlukla değiştir
                    .replace(/\b\w/g, l => l.toUpperCase()); // İlk harfleri büyük yap
                  const serviceDesc = service.service_desc || '';

                  // Fiyat string'ini parse et (virgülü noktaya çevir: "80,09" -> "80.09")
                  const totalPrice = parseFloat(totalPriceStr.replace(',', '.'));

                  // Debug: İlk araç için service parse bilgilerini logla
                  if (availableCars.indexOf(car) === 0) {
                    console.log(`  Service ${index + 1}:`, {
                      service_name: service.service_name,
                      service_name_lower: serviceName,
                      service_title_from_name: serviceTitle,
                      service_desc: serviceDesc,
                      service_total_price: totalPriceStr,
                      parsed_total_price: totalPrice,
                      days: days,
                      calculated_daily_price: days > 0 ? totalPrice / days : totalPrice
                    });
                  }

                  if (!isNaN(totalPrice) && totalPrice > 0) {
                    // Günlük fiyatı hesapla (toplam fiyat / gün sayısı)
                    let dailyPrice = days > 0 ? totalPrice / days : totalPrice;

                    // Her zaman EUR cinsinden gönder, frontend'de dönüştürülecek
                    // if (targetCurrency !== 'EURO' && exchangeRates) {
                    //   dailyPrice = convertPrice(dailyPrice, 'EUR', targetCurrency, exchangeRates);
                    // }

                    // Service name'e göre mapping
                    if (serviceName === 'baby_seat' || serviceName === 'babyseat') {
                      extrasFromServices.babySeat = dailyPrice;
                      extrasMetadata.babySeat = { title: serviceTitle, description: serviceDesc };
                      if (availableCars.indexOf(car) === 0) {
                        console.log('  ✅ Baby_Seat mapped to babySeat:', dailyPrice, 'title:', serviceTitle);
                      }
                    } else if (serviceName === 'addition_drive' || serviceName === 'additional_driver' || serviceName === 'additionaldriver') {
                      extrasFromServices.additionalDriver = dailyPrice;
                      extrasMetadata.additionalDriver = { title: serviceTitle, description: serviceDesc };
                      if (availableCars.indexOf(car) === 0) {
                        console.log('  ✅ Addition_Drive mapped to additionalDriver:', dailyPrice, 'title:', serviceTitle);
                      }
                    } else if (serviceName === 'navigation' || serviceName === 'gps') {
                      extrasFromServices.navigation = dailyPrice;
                      extrasMetadata.navigation = { title: serviceTitle, description: serviceDesc };
                      if (availableCars.indexOf(car) === 0) {
                        console.log('  ✅ Navigation mapped to navigation:', dailyPrice, 'title:', serviceTitle);
                      }
                    } else if (serviceName === 'cdw') {
                      extrasFromServices.cdw = dailyPrice;
                      extrasMetadata.cdw = { title: serviceTitle, description: serviceDesc };
                      if (availableCars.indexOf(car) === 0) {
                        console.log('  ✅ CDW mapped to cdw:', dailyPrice, 'title:', serviceTitle);
                      }
                    } else if (serviceName === 'scdw') {
                      extrasFromServices.scdw = dailyPrice;
                      extrasMetadata.scdw = { title: serviceTitle, description: serviceDesc };
                      if (availableCars.indexOf(car) === 0) {
                        console.log('  ✅ SCDW mapped to scdw:', dailyPrice, 'title:', serviceTitle);
                      }
                    } else if (serviceName === 'lcf') {
                      extrasFromServices.lcf = dailyPrice;
                      extrasMetadata.lcf = { title: serviceTitle, description: serviceDesc };
                      if (availableCars.indexOf(car) === 0) {
                        console.log('  ✅ LCF mapped to lcf:', dailyPrice, 'title:', serviceTitle);
                      }
                    } else if (serviceName === 'young_driver' || serviceName === 'youngdriver') {
                      extrasFromServices.youngDriver = dailyPrice;
                      extrasMetadata.youngDriver = { title: serviceTitle, description: serviceDesc };
                      if (availableCars.indexOf(car) === 0) {
                        console.log('  ✅ Young_Driver mapped to youngDriver:', dailyPrice, 'title:', serviceTitle);
                      }
                    } else {
                      if (availableCars.indexOf(car) === 0) {
                        console.warn('  ⚠️ Unknown service_name:', serviceName, service);
                      }
                    }
                  } else {
                    if (availableCars.indexOf(car) === 0) {
                      console.warn('  ⚠️ Invalid price for service:', serviceName, totalPriceStr, totalPrice);
                    }
                  }
                });

                // Debug: İlk araç için parse edilen extras'ları logla
                if (availableCars.indexOf(car) === 0) {
                  console.log('  ✅ Parsed extras from Services:', extrasFromServices);
                  console.log('  ✅ Extras metadata:', extrasMetadata);
                }
              } else {
                if (availableCars.indexOf(car) === 0) {
                  console.warn('  ⚠️ Services array boş veya geçersiz');
                }
              }

              // Eğer Services array'i yoksa, eski yöntemi kullan (backward compatibility)
              // Baby_Seat, Navigation, Additional_Driver, CDW, SCDW, LCF alanları direkt car objesinde olabilir
              return {
                babySeat: extrasFromServices.babySeat || (() => {
                  const totalPrice = apiCar.Baby_Seat || apiCar.baby_Seat;
                  if (totalPrice === undefined || totalPrice === null || totalPrice === '' || totalPrice === -1) return 0;
                  const parsed = typeof totalPrice === 'string' ? parseFloat(totalPrice.replace(',', '.')) : totalPrice;
                  if (isNaN(parsed) || parsed <= 0) return 0;

                  let dailyPrice = days > 0 ? parsed / days : parsed;
                  // Her zaman EUR cinsinden gönder, frontend'de dönüştürülecek
                  // if (targetCurrency !== 'EURO' && exchangeRates) {
                  //   dailyPrice = convertPrice(dailyPrice, 'EUR', targetCurrency, exchangeRates);
                  // }
                  return dailyPrice; // EUR cinsinden
                })(),
                navigation: extrasFromServices.navigation || (() => {
                  const totalPrice = apiCar.Navigation || apiCar.navigation;
                  if (totalPrice === undefined || totalPrice === null || totalPrice === '' || totalPrice === -1) return 0;
                  const parsed = typeof totalPrice === 'string' ? parseFloat(totalPrice.replace(',', '.')) : totalPrice;
                  if (isNaN(parsed) || parsed <= 0) return 0;

                  let dailyPrice = days > 0 ? parsed / days : parsed;
                  // Her zaman EUR cinsinden gönder, frontend'de dönüştürülecek
                  // if (targetCurrency !== 'EURO' && exchangeRates) {
                  //   dailyPrice = convertPrice(dailyPrice, 'EUR', targetCurrency, exchangeRates);
                  // }
                  return dailyPrice; // EUR cinsinden
                })(),
                additionalDriver: extrasFromServices.additionalDriver || (() => {
                  const totalPrice = apiCar.Additional_Driver || apiCar.additional_Driver;
                  if (totalPrice === undefined || totalPrice === null || totalPrice === '' || totalPrice === -1) return 0;
                  const parsed = typeof totalPrice === 'string' ? parseFloat(totalPrice.replace(',', '.')) : totalPrice;
                  if (isNaN(parsed) || parsed <= 0) return 0;

                  let dailyPrice = days > 0 ? parsed / days : parsed;
                  // Her zaman EUR cinsinden gönder, frontend'de dönüştürülecek
                  // if (targetCurrency !== 'EURO' && exchangeRates) {
                  //   dailyPrice = convertPrice(dailyPrice, 'EUR', targetCurrency, exchangeRates);
                  // }
                  return dailyPrice; // EUR cinsinden
                })(),
                cdw: extrasFromServices.cdw || (() => {
                  const totalPrice = apiCar.CDW || apiCar.cdw;
                  if (totalPrice === undefined || totalPrice === null || totalPrice === '' || totalPrice === -1) return 0;
                  const parsed = typeof totalPrice === 'string' ? parseFloat(totalPrice.replace(',', '.')) : totalPrice;
                  if (isNaN(parsed) || parsed <= 0) return 0;

                  let dailyPrice = days > 0 ? parsed / days : parsed;
                  // Her zaman EUR cinsinden gönder, frontend'de dönüştürülecek
                  // if (targetCurrency !== 'EURO' && exchangeRates) {
                  //   dailyPrice = convertPrice(dailyPrice, 'EUR', targetCurrency, exchangeRates);
                  // }
                  return dailyPrice; // EUR cinsinden
                })(),
                scdw: extrasFromServices.scdw || (() => {
                  const totalPrice = apiCar.SCDW || apiCar.scdw;
                  if (totalPrice === undefined || totalPrice === null || totalPrice === '' || totalPrice === -1) return 0;
                  const parsed = typeof totalPrice === 'string' ? parseFloat(totalPrice.replace(',', '.')) : totalPrice;
                  if (isNaN(parsed) || parsed <= 0) return 0;

                  let dailyPrice = days > 0 ? parsed / days : parsed;
                  // Her zaman EUR cinsinden gönder, frontend'de dönüştürülecek
                  // if (targetCurrency !== 'EURO' && exchangeRates) {
                  //   dailyPrice = convertPrice(dailyPrice, 'EUR', targetCurrency, exchangeRates);
                  // }
                  return dailyPrice; // EUR cinsinden
                })(),
                lcf: extrasFromServices.lcf || (() => {
                  const totalPrice = apiCar.LCF || apiCar.lcf;
                  if (totalPrice === undefined || totalPrice === null || totalPrice === '' || totalPrice === -1) return 0;
                  const parsed = typeof totalPrice === 'string' ? parseFloat(totalPrice.replace(',', '.')) : totalPrice;
                  if (isNaN(parsed) || parsed <= 0) return 0;

                  let dailyPrice = days > 0 ? parsed / days : parsed;
                  // Her zaman EUR cinsinden gönder, frontend'de dönüştürülecek
                  // if (targetCurrency !== 'EURO' && exchangeRates) {
                  //   dailyPrice = convertPrice(dailyPrice, 'EUR', targetCurrency, exchangeRates);
                  // }
                  return dailyPrice; // EUR cinsinden
                })(),
                youngDriver: extrasFromServices.youngDriver || 0,
                // Metadata (title ve description) ekle
                metadata: extrasMetadata
              };
            })()
          };
        });
      }
      return [];
    }

    // Parametre yoksa boş dizi döndür (lokasyon ve tarih gerekli)
    return [];
  } catch (error) {
    console.error('Dış API hatası:', error);
    console.error('Hata stack:', error.stack);
    // Hata mesajını daha anlaşılır hale getir
    if (error.message) {
      throw error;
    } else {
      throw new Error(`Araç verileri alınırken bir hata oluştu: ${error.message || 'Bilinmeyen hata'}`);
    }
  }
};

// Lokasyonları getir (cache ile)
const fetchLocations = async () => {
  try {
    // Cache kontrolü
    const now = Date.now();
    if (locationCache.data && locationCache.timestamp &&
      (now - locationCache.timestamp) < locationCache.ttl) {
      console.log('✅ Lokasyonlar cache\'den döndürülüyor');
      return locationCache.data;
    }

    // Cache'de yoksa veya süresi dolmuşsa API'den çek
    console.log('🌐 Lokasyonlar external API\'den çekiliyor...');
    const locations = await getLocations();
    const locationArray = Array.isArray(locations) ? locations : [];

    // Cache'e kaydet
    locationCache.data = locationArray;
    locationCache.timestamp = now;
    console.log(`✅ ${locationArray.length} lokasyon cache'e kaydedildi`);

    return locationArray;
  } catch (error) {
    console.error('Lokasyon çekme hatası:', error);

    // Hata durumunda cache'deki eski veriyi döndür (varsa)
    if (locationCache.data) {
      console.warn('⚠️ API hatası, cache\'deki eski lokasyonlar döndürülüyor');
      return locationCache.data;
    }

    throw error;
  }
};

// Grupları getir (cache ile)
const fetchGroups = async () => {
  try {
    // Cache kontrolü
    const now = Date.now();
    if (groupCache.data && groupCache.timestamp &&
      (now - groupCache.timestamp) < groupCache.ttl) {
      console.log('✅ Gruplar cache\'den döndürülüyor');
      return groupCache.data;
    }

    // Cache'de yoksa veya süresi dolmuşsa API'den çek
    console.log('🌐 Gruplar external API\'den çekiliyor...');
    const groups = await getGroups();
    const groupArray = Array.isArray(groups) ? groups : [];

    // Cache'e kaydet
    groupCache.data = groupArray;
    groupCache.timestamp = now;
    console.log(`✅ ${groupArray.length} grup cache'e kaydedildi`);

    return groupArray;
  } catch (error) {
    console.error('Grup çekme hatası:', error);

    // Hata durumunda cache'deki eski veriyi döndür (varsa)
    if (groupCache.data) {
      console.warn('⚠️ API hatası, cache\'deki eski gruplar döndürülüyor');
      return groupCache.data;
    }

    throw error;
  }
};

// Araçları senkronize etme (artık kullanılmıyor, çünkü gerçek zamanlı sorgu yapıyoruz)
const syncCars = async (params) => {
  try {
    const externalCars = await fetchCarsFromExternalAPI(params);

    // Artık veritabanına kaydetmiyoruz, direkt API'den çekiyoruz
    // Ama cache için kaydedebiliriz
    for (const carData of externalCars) {
      await Car.findOneAndUpdate(
        { externalId: carData.externalId },
        carData,
        { upsert: true, new: true }
      );
    }

    return { success: true, count: externalCars.length };
  } catch (error) {
    console.error('Araç senkronizasyon hatası:', error);
    throw error;
  }
};

module.exports = {
  fetchCarsFromExternalAPI,
  fetchLocations,
  fetchGroups,
  syncCars
};
