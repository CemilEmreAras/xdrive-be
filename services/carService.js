const axios = require('axios');
const Car = require('../models/Car');
const { getAvailableCars, getLocations, getGroups } = require('./externalApiService');

// Dış API'den araçları çekme - gerçek API kullanımı
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
        currency: params.currency || 'EURO'
      });

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
            // Ekstra özellik alanlarını özellikle logla
            console.log('🔍 Ekstra özellik alanları:', {
              Baby_Seat: apiCar.Baby_Seat,
              baby_Seat: apiCar.baby_Seat,
              Baby_Seat_Price: apiCar.Baby_Seat_Price,
              Additional_Driver: apiCar.Additional_Driver,
              additional_Driver: apiCar.additional_Driver,
              Additional_Driver_Price: apiCar.Additional_Driver_Price,
              Navigation: apiCar.Navigation,
              navigation: apiCar.navigation,
              Navigation_Price: apiCar.Navigation_Price,
              CDW: apiCar.CDW,
              CDW_Price: apiCar.CDW_Price,
              SCDW: apiCar.SCDW,
              SCDW_Price: apiCar.SCDW_Price,
              LCF: apiCar.LCF,
              LCF_Price: apiCar.LCF_Price
            });
          }
          
          const groupId = apiCar.Group_ID || apiCar.group_ID || apiCar.GroupID;
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
            if (price !== undefined && price !== null && price !== '') {
              const parsed = parseFloat(price);
              if (!isNaN(parsed) && parsed > 0) {
                dailyRentalValue = parsed;
                break;
              }
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
            if (price !== undefined && price !== null && price !== '') {
              const parsed = parseFloat(price);
              if (!isNaN(parsed) && parsed > 0) {
                totalRentalValue = parsed;
                break;
              }
            }
          }
          
          const dailyRental = dailyRentalValue;
          const totalRental = totalRentalValue;
          
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
            transmission: apiCar.Transmission || apiCar.transmission || (groupName.includes('OTOMATİK') || groupName.includes('AUTOMATIC') ? 'Otomatik' : 'Manuel'),
            seats: apiCar.Chairs || apiCar.chairs || 5,
            pricePerDay: dailyRental,
            totalPrice: totalRental,
            days: apiCar.Days || apiCar.days || 1,
            currency: apiCar.Currency || apiCar.currency || 'EURO',
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
            sipp: apiCar.SIPP || apiCar.sipp,
            bigBags: apiCar.Big_Bags || apiCar.big_Bags,
            smallBags: apiCar.Small_Bags || apiCar.small_Bags,
            drivingLicenseAge: apiCar.Driving_License_Age || apiCar.driving_License_Age,
            driverAge: apiCar.Driver_Age || apiCar.driver_Age,
            provision: apiCar.Provision || apiCar.provision,
            kmLimit: apiCar.Km_Limit || apiCar.km_Limit,
            drop: apiCar.Drop || apiCar.drop,
            cdw: apiCar.CDW || apiCar.cdw,
            scdw: apiCar.SCDW || apiCar.scdw,
            lcf: apiCar.LCF || apiCar.lcf,
            pai: apiCar.PAI || apiCar.pai,
            babySeat: apiCar.Baby_Seat || apiCar.baby_Seat,
            navigation: apiCar.Navigation || apiCar.navigation,
            additionalDriver: apiCar.Additional_Driver || apiCar.additional_Driver,
            fuel: apiCar.Fuel || apiCar.fuel,
            // Ekstra özellik fiyatları - API'den gelen değerleri parse et
            // API'den gelen değerler fiyat olabilir veya "ON"/"OFF" gibi flag'ler olabilir
            // Önce fiyat alanlarını kontrol et, yoksa varsayılan fiyatlar kullan
            extras: {
              babySeat: (() => {
                // Önce fiyat alanlarını kontrol et
                const priceValue = apiCar.Baby_Seat_Price || apiCar.baby_Seat_Price || apiCar.Baby_Seat_Price_Day || apiCar.baby_Seat_Price_Day;
                if (priceValue !== undefined && priceValue !== null && priceValue !== '') {
                  const parsed = typeof priceValue === 'string' ? parseFloat(priceValue) : priceValue;
                  if (!isNaN(parsed) && parsed > 0) return parsed;
                }
                // Eğer fiyat yoksa ama Baby_Seat "ON" ise varsayılan fiyat kullan (50)
                const flagValue = apiCar.Baby_Seat || apiCar.baby_Seat;
                if (flagValue === 'ON' || flagValue === 'on' || flagValue === true) {
                  return 50; // Varsayılan fiyat
                }
                return 0;
              })(),
              navigation: (() => {
                const priceValue = apiCar.Navigation_Price || apiCar.navigation_Price || apiCar.Navigation_Price_Day || apiCar.navigation_Price_Day;
                if (priceValue !== undefined && priceValue !== null && priceValue !== '') {
                  const parsed = typeof priceValue === 'string' ? parseFloat(priceValue) : priceValue;
                  if (!isNaN(parsed) && parsed > 0) return parsed;
                }
                const flagValue = apiCar.Navigation || apiCar.navigation;
                if (flagValue === 'ON' || flagValue === 'on' || flagValue === true) {
                  return 30; // Varsayılan fiyat
                }
                return 0;
              })(),
              additionalDriver: (() => {
                const priceValue = apiCar.Additional_Driver_Price || apiCar.additional_Driver_Price || apiCar.Additional_Driver_Price_Day || apiCar.additional_Driver_Price_Day;
                if (priceValue !== undefined && priceValue !== null && priceValue !== '') {
                  const parsed = typeof priceValue === 'string' ? parseFloat(priceValue) : priceValue;
                  if (!isNaN(parsed) && parsed > 0) return parsed;
                }
                const flagValue = apiCar.Additional_Driver || apiCar.additional_Driver;
                if (flagValue === 'ON' || flagValue === 'on' || flagValue === true) {
                  return 30; // Varsayılan fiyat
                }
                return 0;
              })(),
              cdw: (() => {
                const priceValue = apiCar.CDW_Price || apiCar.cdw_Price || apiCar.CDW_Price_Day || apiCar.cdw_Price_Day;
                if (priceValue !== undefined && priceValue !== null && priceValue !== '') {
                  const parsed = typeof priceValue === 'string' ? parseFloat(priceValue) : priceValue;
                  if (!isNaN(parsed) && parsed > 0) return parsed;
                }
                const flagValue = apiCar.CDW || apiCar.cdw;
                if (flagValue === 'ON' || flagValue === 'on' || flagValue === true) {
                  return 20; // Varsayılan fiyat
                }
                return 0;
              })(),
              scdw: (() => {
                const priceValue = apiCar.SCDW_Price || apiCar.scdw_Price || apiCar.SCDW_Price_Day || apiCar.scdw_Price_Day;
                if (priceValue !== undefined && priceValue !== null && priceValue !== '') {
                  const parsed = typeof priceValue === 'string' ? parseFloat(priceValue) : priceValue;
                  if (!isNaN(parsed) && parsed > 0) return parsed;
                }
                const flagValue = apiCar.SCDW || apiCar.scdw;
                if (flagValue === 'ON' || flagValue === 'on' || flagValue === true) {
                  return 25; // Varsayılan fiyat
                }
                return 0;
              })(),
              lcf: (() => {
                const priceValue = apiCar.LCF_Price || apiCar.lcf_Price || apiCar.LCF_Price_Day || apiCar.lcf_Price_Day;
                if (priceValue !== undefined && priceValue !== null && priceValue !== '') {
                  const parsed = typeof priceValue === 'string' ? parseFloat(priceValue) : priceValue;
                  if (!isNaN(parsed) && parsed > 0) return parsed;
                }
                const flagValue = apiCar.LCF || apiCar.lcf;
                if (flagValue === 'ON' || flagValue === 'on' || flagValue === true) {
                  return 15; // Varsayılan fiyat
                }
                return 0;
              })()
            }
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

// Lokasyonları getir
const fetchLocations = async () => {
  try {
    const locations = await getLocations();
    return Array.isArray(locations) ? locations : [];
  } catch (error) {
    console.error('Lokasyon çekme hatası:', error);
    throw error;
  }
};

// Grupları getir
const fetchGroups = async () => {
  try {
    const groups = await getGroups();
    return Array.isArray(groups) ? groups : [];
  } catch (error) {
    console.error('Grup çekme hatası:', error);
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
