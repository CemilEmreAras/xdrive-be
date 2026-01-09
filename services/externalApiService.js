const axios = require('axios');

// API Konfigürasyonu
const API_CONFIG = {
  BASE_URL: 'http://xdrivejson.turevsistem.com',
  KEY_HACK: '5c0fdb7f-7322-4101-a587-ffa75cf0bd54',
  USER_NAME: 'webenrr0nc96gfd',
  USER_PASS: '4cyf7r3ksva6kn7'
};

// Lokasyonları getir
const getLocations = async () => {
  try {
    const url = `${API_CONFIG.BASE_URL}/JsonLocations.aspx`;
    const response = await axios.get(url, {
      params: {
        Key_Hack: API_CONFIG.KEY_HACK
      }
    });
    return response.data;
  } catch (error) {
    console.error('Lokasyon API hatası:', error.message);
    throw error;
  }
};

// Grupları getir (araç kategorileri)
const getGroups = async () => {
  try {
    const url = `${API_CONFIG.BASE_URL}/JsonGroup.aspx`;
    const response = await axios.get(url, {
      params: {
        Key_Hack: API_CONFIG.KEY_HACK
      }
    });
    return response.data;
  } catch (error) {
    console.error('Grup API hatası:', error.message);
    throw error;
  }
};

// Müsait araçları getir
const getAvailableCars = async (params) => {
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
      currency = 'EURO'
    } = params;

    // Tarihi parse et
    const pickup = new Date(pickupDate);
    const dropoff = new Date(dropoffDate);

    const url = `${API_CONFIG.BASE_URL}/JsonRez.aspx`;
    const response = await axios.get(url, {
      params: {
        Key_Hack: API_CONFIG.KEY_HACK,
        User_Name: API_CONFIG.USER_NAME,
        User_Pass: API_CONFIG.USER_PASS,
        Pickup_ID: pickupId,
        Drop_Off_ID: dropoffId,
        Pickup_Day: String(pickup.getDate()).padStart(2, '0'),
        Pickup_Month: String(pickup.getMonth() + 1).padStart(2, '0'),
        Pickup_Year: pickup.getFullYear(),
        Drop_Off_Day: String(dropoff.getDate()).padStart(2, '0'),
        Drop_Off_Month: String(dropoff.getMonth() + 1).padStart(2, '0'),
        Drop_Off_Year: dropoff.getFullYear(),
        Pickup_Hour: pickupHour,
        Pickup_Min: pickupMin,
        Drop_Off_Hour: dropoffHour,
        Drop_Off_Min: dropoffMin,
        Currency: currency
      }
    });
    
    // API'den hata mesajı gelirse kontrol et
    if (Array.isArray(response.data) && response.data.length > 0) {
      const firstItem = response.data[0];
      if (firstItem.success === 'False' || firstItem.error) {
        const errorMsg = firstItem.error || 'Bilinmeyen hata';
        
        // "Man Süresi" (Minimum kiralama süresi) hatasını özel olarak handle et
        // Bu durumda boş array döndür, hata fırlatma
        if (errorMsg.includes('Man Süresi') || errorMsg.includes('Man Süre') || 
            errorMsg.toLowerCase().includes('minimum') || errorMsg.toLowerCase().includes('min')) {
          console.warn('⚠️ Minimum kiralama süresi hatası (sessizce yok sayılıyor):', errorMsg);
          return []; // Boş array döndür, hata fırlatma
        }
        
        throw new Error(`API Hatası: ${errorMsg}. Lütfen API sağlayıcısı ile iletişime geçin (0312 870 10 35).`);
      }
    }
    
    return response.data;
  } catch (error) {
    console.error('Müsait araç API hatası:', error.message);
    throw error;
  }
};

// Rezervasyon kaydet
const saveReservation = async (reservationData) => {
  try {
    const {
      pickupId,
      dropoffId,
      name,
      surname,
      mobilePhone,
      mailAddress,
      rentalId,
      carsParkId,
      groupId,
      rezId,
      pickupDate,
      dropoffDate,
      pickupHour = 10,
      pickupMin = 0,
      dropoffHour = 10,
      dropoffMin = 0,
      address,
      district,
      city,
      country,
      flightNumber,
      currency = 'EURO',
      babySeat = 'OFF',
      navigation = 'OFF',
      additionalDriver = 'OFF',
      cdw = 'OFF',
      scdw = 'OFF',
      lcf = 'OFF',
      yourRezId,
      yourRentPrice,
      yourExtraPrice,
      yourDropPrice,
      paymentType = 0
    } = reservationData;

    const pickup = new Date(pickupDate);
    const dropoff = new Date(dropoffDate);

    const url = `${API_CONFIG.BASE_URL}/JsonRez_Save.aspx`;
    
    // Gönderilecek parametreleri hazırla (tüm değerler string olmalı)
    const params = {
      Key_Hack: String(API_CONFIG.KEY_HACK),
      Pickup_ID: String(pickupId),
      Drop_Off_ID: String(dropoffId),
      Name: String(name || ''),
      SurName: String(surname || ''),
      MobilePhone: String(mobilePhone || ''),
      Mail_Adress: String(mailAddress || ''),
      Rental_ID: String(rentalId || ''),
      Cars_Park_ID: String(carsParkId),
      Group_ID: String(groupId),
      User_Name: String(API_CONFIG.USER_NAME),
      User_Pass: String(API_CONFIG.USER_PASS),
      Rez_ID: String(rezId),
      Pickup_Day: String(pickup.getDate()).padStart(2, '0'),
      Pickup_Month: String(pickup.getMonth() + 1).padStart(2, '0'),
      Pickup_Year: String(pickup.getFullYear()), // String olarak gönder
      Drop_Off_Day: String(dropoff.getDate()).padStart(2, '0'),
      Drop_Off_Month: String(dropoff.getMonth() + 1).padStart(2, '0'),
      Drop_Off_Year: String(dropoff.getFullYear()), // String olarak gönder
      Pickup_Hour: String(pickupHour).padStart(2, '0'), // String ve 2 haneli
      Pickup_Min: String(pickupMin).padStart(2, '0'), // String ve 2 haneli
      Drop_Off_Hour: String(dropoffHour).padStart(2, '0'), // String ve 2 haneli
      Drop_Off_Min: String(dropoffMin).padStart(2, '0'), // String ve 2 haneli
      Adress: String(address || ''),
      District: String(district || ''),
      City: String(city || ''),
      Country: String(country || ''),
      Flight_Number: String(flightNumber || ''),
      Currency: String(currency || 'EURO'),
      Baby_Seat: String(babySeat || 'OFF'),
      Navigation: String(navigation || 'OFF'),
      Additional_Driver: String(additionalDriver || 'OFF'),
      CDW: String(cdw || 'OFF'),
      SCDW: String(scdw || 'OFF'),
      LCF: String(lcf || 'OFF'),
      Your_Rez_ID: yourRezId,
      Your_Rent_Price: String(yourRentPrice || 0), // String olarak gönder
      Your_Extra_Price: String(yourExtraPrice || 0), // String olarak gönder
      Your_Drop_Price: String(yourDropPrice || 0), // String olarak gönder
      Payment_Type: String(paymentType || 0) // String olarak gönder
    };
    
    // Debug: Gönderilecek parametreleri logla
    console.log('📤 External API\'ye gönderilecek parametreler:');
    console.log(JSON.stringify(params, null, 2));
    console.log('📤 External API URL:', url);
    
    const response = await axios.get(url, { params });
    
    // API yanıtını kontrol et
    console.log('📥 External API rezervasyon yanıtı (raw):', {
      status: response.status,
      statusText: response.statusText,
      data: response.data,
      dataType: typeof response.data,
      dataLength: response.data ? (Array.isArray(response.data) ? response.data.length : String(response.data).length) : 0
    });
    
    // Yanıt boş mu kontrol et
    if (!response.data || 
        (typeof response.data === 'string' && response.data.trim() === '') ||
        (Array.isArray(response.data) && response.data.length === 0)) {
      console.warn('⚠️ External API boş yanıt döndü');
      console.warn('⚠️ Bu durumda rezervasyon yapılmış olabilir ama onaylanmamış olabilir');
      // Boş yanıt döndür ama hata fırlatma (rezervasyon devam edebilir)
      return response.data || [];
    }
    
    console.log('📥 External API rezervasyon yanıtı:', JSON.stringify(response.data, null, 2));
    
    // Hata kontrolü
    if (Array.isArray(response.data) && response.data.length > 0) {
      const firstItem = response.data[0];
      
      // success: "True" veya Status: "True" kontrolü
      const isSuccess = firstItem.success === 'True' || firstItem.success === true || 
                       firstItem.Status === 'True' || firstItem.Status === true ||
                       firstItem.status === 'True' || firstItem.status === true;
      
      // success: "False" kontrolü - ama rez_id varsa rezervasyon yapılmış olabilir
      if (firstItem.success === 'False' || firstItem.success === false) {
        // Eğer rez_id varsa, rezervasyon yapılmış olabilir (sadece kayıt numarası 0 olabilir)
        if (firstItem.rez_id) {
          console.warn('⚠️ External API success: False ama rez_id var:', firstItem.rez_id);
          console.warn('⚠️ Bu durumda rezervasyon yapılmış olabilir ama kayıt numarası 0');
          // Rezervasyon yapılmış gibi devam et, ama uyar
          console.warn('⚠️ Rezervasyon türevde görünmeyebilir, lütfen kontrol edin');
        } else {
          // Hata mesajını bul
          const errorMsg = firstItem.error || firstItem.Error || firstItem.message || firstItem.Message || 
                          firstItem.hata || firstItem.Hata || 
                          (firstItem.rez_kayit_no === '0' ? 'Rezervasyon kaydedilemedi (rez_kayit_no: 0). Lütfen API sağlayıcısı ile iletişime geçin: 0312 870 10 35' : 'Bilinmeyen hata');
          console.error('❌ External API rezervasyon hatası detayları:', {
            success: firstItem.success,
            Status: firstItem.Status,
            rez_id: firstItem.rez_id,
            rez_kayit_no: firstItem.rez_kayit_no,
            error: errorMsg,
            fullResponse: firstItem
          });
  
          throw new Error(`External API Rezervasyon Hatası: ${errorMsg}`);
        }
      }
      
      // Başarılı ise logla
      if (isSuccess) {
        console.log('✅ External API rezervasyon başarılı:', {
          rez_id: firstItem.rez_id,
          rez_kayit_no: firstItem.rez_kayit_no,
          ID: firstItem.ID,
          Status: firstItem.Status || firstItem.status
        });
      }
    } else if (typeof response.data === 'object' && response.data !== null) {
      // Array değilse, direkt obje olabilir
      console.log('📥 External API yanıtı obje formatında:', response.data);
    }
    
    return response.data;
  } catch (error) {
    console.error('Rezervasyon kaydetme API hatası:', error.message);
    if (error.response) {
      console.error('API yanıt detayları:', error.response.data);
    }
    throw error;
  }
};

// Rezervasyon iptal et
const cancelReservation = async (rezId, id) => {
  try {
    const url = `${API_CONFIG.BASE_URL}/JsonCancel.aspx`;
    const response = await axios.get(url, {
      params: {
        Key_Hack: API_CONFIG.KEY_HACK,
        Rez_ID: rezId,
        ID: id,
        User_Name: API_CONFIG.USER_NAME,
        User_Pass: API_CONFIG.USER_PASS
      }
    });
    return response.data;
  } catch (error) {
    console.error('Rezervasyon iptal API hatası:', error.message);
    throw error;
  }
};

module.exports = {
  getLocations,
  getGroups,
  getAvailableCars,
  saveReservation,
  cancelReservation,
  API_CONFIG
};

