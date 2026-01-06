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
                
                // Grup verisinden resim alanını bul (tüm olası alanları kontrol et)
                const groupImageKeys = Object.keys(group).filter(k => {
                  const lowerKey = k.toLowerCase();
                  return lowerKey.includes('image') || 
                         lowerKey.includes('img') || 
                         lowerKey.includes('photo') ||
                         lowerKey.includes('picture') ||
                         lowerKey.includes('resim') ||
                         lowerKey.includes('foto');
                });
                
                let groupImagePath = '';
                if (groupImageKeys.length > 0) {
                  // İlk geçerli resim alanını bul
                  for (const key of groupImageKeys) {
                    const value = group[key];
                    if (value && typeof value === 'string' && value.trim() !== '' && value !== 'null' && value !== 'undefined') {
                      groupImagePath = value;
                      break;
                    }
                  }
                }
                
                // Eğer dinamik olarak bulunamadıysa, statik alanları kontrol et
                if (!groupImagePath) {
                  groupImagePath = group.image_path || group.Image_Path || group.image_Path || group.Image || group.image || '';
                }
                
                // İlk grup için debug log
                if (groups.indexOf(group) === 0) {
                  console.log('🔍 İlk grup verisi:');
                  console.log('  Tüm key\'ler:', Object.keys(group));
                  console.log('  Resim ile ilgili key\'ler:', groupImageKeys);
                  console.log('  Bulunan resim path:', groupImagePath);
                }
                
                const groupData = {
                  brand: group.brand || group.Brand || '',
                  type: group.type || group.Type || '',
                  groupName: group.group_name || group.Group_Name || '',
                  imagePath: groupImagePath
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
            
            // Resim ile ilgili TÜM alanları özellikle logla
            const imageRelatedKeys = Object.keys(apiCar).filter(k => 
              k.toLowerCase().includes('image') || 
              k.toLowerCase().includes('img') || 
              k.toLowerCase().includes('photo') ||
              k.toLowerCase().includes('picture') ||
              k.toLowerCase().includes('resim') ||
              k.toLowerCase().includes('foto')
            );
            console.log('🖼️ Resim ile ilgili alanlar:', imageRelatedKeys);
            imageRelatedKeys.forEach(key => {
              console.log(`  ${key}:`, apiCar[key], '(tip:', typeof apiCar[key], ')');
            });
            
            // Eğer resim alanı yoksa, tüm alanları göster
            if (imageRelatedKeys.length === 0) {
              console.log('⚠️ API\'den resim alanı gelmedi! Tüm alanlar:');
              Object.keys(apiCar).forEach(key => {
                console.log(`  ${key}:`, apiCar[key], '(tip:', typeof apiCar[key], ')');
              });
            }
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
              // ÖNCE API dokümantasyonunda belirtilen Image_Path alanını kontrol et (öncelikli)
              const apiImagePath = apiCar.Image_Path || apiCar.image_Path || apiCar.image_path || apiCar.IMAGE_PATH;
              
              // Debug: İlk araç için resim bilgilerini logla
              if (availableCars.indexOf(car) === 0) {
                console.log('🖼️ Resim bilgileri (İLK ARAÇ):');
                console.log('  📋 API dokümantasyonunda belirtilen Image_Path:', apiImagePath);
                console.log('  📋 Image_Path (tüm varyasyonlar):', {
                  'Image_Path': apiCar.Image_Path,
                  'image_Path': apiCar.image_Path,
                  'image_path': apiCar.image_path,
                  'IMAGE_PATH': apiCar.IMAGE_PATH
                });
                
                // API'den gelen tüm resim alanlarını kontrol et
                const allImageKeys = Object.keys(apiCar).filter(k => 
                  k.toLowerCase().includes('image') || 
                  k.toLowerCase().includes('img') || 
                  k.toLowerCase().includes('photo') ||
                  k.toLowerCase().includes('picture') ||
                  k.toLowerCase().includes('resim') ||
                  k.toLowerCase().includes('foto')
                );
                
                console.log('  🔍 API\'den gelen tüm resim alanları:', allImageKeys);
                allImageKeys.forEach(key => {
                  const value = apiCar[key];
                  console.log(`    ${key}:`, value, '(tip:', typeof value, ', boş mu:', !value || value === '' || value === 'null' || value === 'undefined', ')');
                });
                
                // Eğer hiç resim alanı yoksa, tüm alanları göster
                if (allImageKeys.length === 0) {
                  console.log('  ⚠️ API\'den hiç resim alanı gelmedi! Tüm alanlar:');
                  Object.keys(apiCar).forEach(key => {
                    const value = apiCar[key];
                    console.log(`    ${key}:`, value, '(tip:', typeof value, ')');
                  });
                }
              }
              
              // ÖNCE Image_Path'i kontrol et (API dokümantasyonunda belirtilen alan)
              if (apiImagePath && 
                  typeof apiImagePath === 'string' && 
                  apiImagePath.trim() !== '' && 
                  apiImagePath !== 'null' && 
                  apiImagePath !== 'undefined' &&
                  !apiImagePath.startsWith('data:image/svg+xml')) {
                
                let finalImageUrl;
                if (apiImagePath.startsWith('http://') || apiImagePath.startsWith('https://')) {
                  finalImageUrl = apiImagePath;
                } else if (apiImagePath.startsWith('/')) {
                  finalImageUrl = `http://xdrivejson.turevsistem.com${apiImagePath}`;
                } else {
                  finalImageUrl = `http://xdrivejson.turevsistem.com/${apiImagePath}`;
                }
                
                if (availableCars.indexOf(car) === 0) {
                  console.log('  ✅ Image_Path kullanılıyor:', finalImageUrl);
                }
                
                return finalImageUrl;
              }
              
              // Image_Path yoksa, grup bilgisinden resim al
              const groupImage = groupInfo.imagePath;
              
              if (groupImage && groupImage.trim() !== '' && groupImage !== 'null' && groupImage !== 'undefined') {
                // Eğer tam URL değilse, base URL ekle
                let finalImageUrl;
                if (groupImage.startsWith('http://') || groupImage.startsWith('https://')) {
                  finalImageUrl = groupImage;
                } else if (groupImage.startsWith('/')) {
                  finalImageUrl = `http://xdrivejson.turevsistem.com${groupImage}`;
                } else {
                  finalImageUrl = `http://xdrivejson.turevsistem.com/${groupImage}`;
                }
                
                if (availableCars.indexOf(car) === 0) {
                  console.log('  ✅ Group image kullanılıyor:', finalImageUrl);
                }
                
                return finalImageUrl;
              }
              
              // Grup resmi yoksa, API'den gelen resmi kontrol et (tüm olası alanları kontrol et)
              // Önce API'den gelen tüm key'leri dinamik olarak kontrol et
              const allApiKeys = Object.keys(apiCar);
              const imageKeys = allApiKeys.filter(k => {
                const lowerKey = k.toLowerCase();
                return lowerKey.includes('image') || 
                       lowerKey.includes('img') || 
                       lowerKey.includes('photo') ||
                       lowerKey.includes('picture') ||
                       lowerKey.includes('resim') ||
                       lowerKey.includes('foto');
              });
              
              // Önce dinamik olarak bulunan key'leri kontrol et
              const apiImageFields = [];
              imageKeys.forEach(key => {
                const value = apiCar[key];
                if (value !== undefined && value !== null) {
                  apiImageFields.push(value);
                }
              });
              
              // Sonra statik alanları da kontrol et (fallback)
              const staticImageFields = [
                apiCar.Image_Path,
                apiCar.image_Path,
                apiCar.image_path,
                apiCar.IMAGE_PATH,
                apiCar.Image,
                apiCar.image,
                apiCar.IMG,
                apiCar.img,
                apiCar.Photo,
                apiCar.photo,
                apiCar.Picture,
                apiCar.picture
              ];
              
              // Statik alanları da ekle (duplicate'leri önlemek için)
              staticImageFields.forEach(field => {
                if (field !== undefined && field !== null && !apiImageFields.includes(field)) {
                  apiImageFields.push(field);
                }
              });
              
              // Tüm resim alanlarını kontrol et
              for (const apiImage of apiImageFields) {
                // Boş string, null, undefined kontrolü
                if (apiImage && 
                    typeof apiImage === 'string' && 
                    apiImage.trim() !== '' && 
                    apiImage !== 'null' && 
                    apiImage !== 'undefined' &&
                    !apiImage.startsWith('data:image/svg+xml')) {
                  
                  let finalImageUrl;
                  if (apiImage.startsWith('http://') || apiImage.startsWith('https://')) {
                    finalImageUrl = apiImage;
                  } else if (apiImage.startsWith('/')) {
                    finalImageUrl = `http://xdrivejson.turevsistem.com${apiImage}`;
                  } else {
                    finalImageUrl = `http://xdrivejson.turevsistem.com/${apiImage}`;
                  }
                  
                  if (availableCars.indexOf(car) === 0) {
                    console.log('  ✅ API image kullanılıyor:', finalImageUrl, '(alan:', Object.keys(apiCar).find(k => apiCar[k] === apiImage), ')');
                  }
                  
                  return finalImageUrl;
                }
              }
              
              // Hiç resim yoksa placeholder döndür
              if (availableCars.indexOf(car) === 0) {
                console.log('  ⚠️ Resim bulunamadı, placeholder kullanılıyor');
                console.log('  ⚠️ Tüm resim alanları kontrol edildi, hiçbiri geçerli değil');
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
            fuel: apiCar.Fuel || apiCar.fuel
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
