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
    
    // Saat değerlerini kontrol et ve normalize et
    // API 0-5 arası saatleri kabul etmeyebilir, minimum 10:00 olmalı
    let normalizedPickupHour = pickupHour;
    let normalizedPickupMin = pickupMin;
    let normalizedDropoffHour = dropoffHour;
    let normalizedDropoffMin = dropoffMin;
    
    if (normalizedPickupHour < 10) {
      console.warn(`⚠️ Pickup saat çok erken (${normalizedPickupHour}:${normalizedPickupMin}), 10:00'a ayarlanıyor`);
      normalizedPickupHour = 10;
      normalizedPickupMin = 0;
    }
    if (normalizedDropoffHour < 10) {
      console.warn(`⚠️ Dropoff saat çok erken (${normalizedDropoffHour}:${normalizedDropoffMin}), 10:00'a ayarlanıyor`);
      normalizedDropoffHour = 10;
      normalizedDropoffMin = 0;
    }
    
    // Gönderilecek parametreleri hazırla (tüm değerler string olmalı)
    // ÖNEMLİ: Boş string yerine varsayılan değerler kullan
    const params = {
      Key_Hack: String(API_CONFIG.KEY_HACK),
      Pickup_ID: String(pickupId),
      Drop_Off_ID: String(dropoffId),
      Name: String(name || ''),
      SurName: String(surname || ''),
      MobilePhone: String(mobilePhone || ''),
      Mail_Adress: String(mailAddress || ''),
      Rental_ID: String(rentalId || ''), // Ehliyet numarası - boş olabilir ama string olmalı
      Cars_Park_ID: String(carsParkId),
      Group_ID: String(groupId),
      User_Name: String(API_CONFIG.USER_NAME),
      User_Pass: String(API_CONFIG.USER_PASS),
      Rez_ID: String(rezId),
      Pickup_Day: String(pickup.getDate()).padStart(2, '0'),
      Pickup_Month: String(pickup.getMonth() + 1).padStart(2, '0'),
      Pickup_Year: String(pickup.getFullYear()),
      Drop_Off_Day: String(dropoff.getDate()).padStart(2, '0'),
      Drop_Off_Month: String(dropoff.getMonth() + 1).padStart(2, '0'),
      Drop_Off_Year: String(dropoff.getFullYear()),
      Pickup_Hour: String(normalizedPickupHour).padStart(2, '0'), // Minimum 10:00
      Pickup_Min: String(normalizedPickupMin).padStart(2, '0'),
      Drop_Off_Hour: String(normalizedDropoffHour).padStart(2, '0'), // Minimum 10:00
      Drop_Off_Min: String(normalizedDropoffMin).padStart(2, '0'),
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
      Your_Rez_ID: String(yourRezId || `XDRIVE-${Date.now()}`), // Boş olmamalı
      Your_Rent_Price: String(yourRentPrice || 0), // Fiyat 0 olamaz, kontrol et
      Your_Extra_Price: String(yourExtraPrice || 0),
      Your_Drop_Price: String(yourDropPrice || 0),
      Payment_Type: String(paymentType || 0)
    };
    
    // Fiyat kontrolü - Your_Rent_Price 0 ise uyar ve hata fırlat
    const rentPrice = parseFloat(params.Your_Rent_Price);
    if (isNaN(rentPrice) || rentPrice <= 0) {
      console.error('❌ Your_Rent_Price geçersiz:', params.Your_Rent_Price);
      console.error('❌ Bu durumda API rezervasyonu reddedecek!');
      throw new Error(`Rezervasyon fiyatı geçersiz (Your_Rent_Price: ${params.Your_Rent_Price}). Lütfen araç fiyatını kontrol edin.`);
    }
    
    // Zorunlu alanları kontrol et
    const requiredFields = ['Pickup_ID', 'Drop_Off_ID', 'Cars_Park_ID', 'Group_ID', 'Rez_ID', 'Name', 'SurName'];
    const missingFields = requiredFields.filter(field => !params[field] || params[field] === 'undefined' || params[field] === 'null');
    if (missingFields.length > 0) {
      console.error('❌ Zorunlu alanlar eksik:', missingFields);
      throw new Error(`Rezervasyon için zorunlu alanlar eksik: ${missingFields.join(', ')}`);
    }
    
    // Debug: Gönderilecek parametreleri logla
    console.log('📤 External API\'ye gönderilecek parametreler:');
    console.log(JSON.stringify(params, null, 2));
    console.log('📤 External API URL:', url);
    console.log('📤 Tam URL (debug için):', `${url}?${new URLSearchParams(params).toString()}`);
    
    let response;
    try {
      response = await axios.get(url, { 
        params,
        timeout: 30000, // 30 saniye timeout
        validateStatus: function (status) {
          // 200-299 arası status kodlarını kabul et
          return status >= 200 && status < 300;
        }
      });
    } catch (axiosError) {
      console.error('❌ External API istek hatası:', axiosError.message);
      if (axiosError.response) {
        console.error('❌ API yanıt status:', axiosError.response.status);
        console.error('❌ API yanıt data:', axiosError.response.data);
      }
      if (axiosError.request) {
        console.error('❌ İstek gönderildi ama yanıt alınamadı');
      }
      throw new Error(`External API istek hatası: ${axiosError.message}. Lütfen API sağlayıcısı ile iletişime geçin: 0312 870 10 35`);
    }
    
    // API yanıtını kontrol et - DETAYLI
    console.log('📥 External API rezervasyon yanıtı (raw):', {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data: response.data,
      dataType: typeof response.data,
      isArray: Array.isArray(response.data),
      dataLength: response.data ? (Array.isArray(response.data) ? response.data.length : String(response.data).length) : 0,
      dataString: typeof response.data === 'string' ? response.data.substring(0, 500) : 'N/A'
    });
    
    // Yanıt boş mu kontrol et - DETAYLI
    const isEmpty = !response.data || 
        (typeof response.data === 'string' && response.data.trim() === '') ||
        (Array.isArray(response.data) && response.data.length === 0) ||
        (typeof response.data === 'object' && response.data !== null && Object.keys(response.data).length === 0);
    
    if (isEmpty) {
      console.error('❌ External API boş yanıt döndü');
      console.error('❌ Gönderilen parametreler (tümü):', JSON.stringify(params, null, 2));
      console.error('❌ Bu durumda rezervasyon türevde görünmeyecek!');
      console.error('❌ Olası nedenler:');
      console.error('   1. Parametreler yanlış formatlanmış olabilir');
      console.error('   2. API tarafında bir hata oluşmuş olabilir');
      console.error('   3. Zorunlu alanlar eksik olabilir');
      console.error('   4. Fiyat değeri geçersiz olabilir');
      // Boş yanıt = rezervasyon başarısız, hata fırlat
      throw new Error(`External API boş yanıt döndü. Gönderilen parametreler: Pickup_ID=${params.Pickup_ID}, Drop_Off_ID=${params.Drop_Off_ID}, Cars_Park_ID=${params.Cars_Park_ID}, Group_ID=${params.Group_ID}, Rez_ID=${params.Rez_ID}, Your_Rent_Price=${params.Your_Rent_Price}. Rezervasyon türevde görünmeyecek. Lütfen API sağlayıcısı ile iletişime geçin: 0312 870 10 35`);
    }
    
    console.log('📥 External API rezervasyon yanıtı:', JSON.stringify(response.data, null, 2));
    
    // Hata kontrolü - DETAYLI
    if (Array.isArray(response.data) && response.data.length > 0) {
      const firstItem = response.data[0];
      
      // TÜM alanları logla
      console.log('📥 External API yanıt detayları:', {
        success: firstItem.success,
        Success: firstItem.Success,
        status: firstItem.status,
        Status: firstItem.Status,
        rez_id: firstItem.rez_id,
        Rez_ID: firstItem.Rez_ID,
        rez_kayit_no: firstItem.rez_kayit_no,
        Rez_Kayit_No: firstItem.Rez_Kayit_No,
        ID: firstItem.ID,
        id: firstItem.id,
        error: firstItem.error,
        Error: firstItem.Error,
        message: firstItem.message,
        Message: firstItem.Message,
        hata: firstItem.hata,
        Hata: firstItem.Hata,
        fullResponse: firstItem
      });
      
      // success: "True" veya Status: "True" kontrolü
      const isSuccess = firstItem.success === 'True' || firstItem.success === true || 
                       firstItem.Success === 'True' || firstItem.Success === true ||
                       firstItem.Status === 'True' || firstItem.Status === true ||
                       firstItem.status === 'True' || firstItem.status === true;
      
      // rez_kayit_no kontrolü - 0 ise rezervasyon kaydedilmemiş demektir
      const rezKayitNo = firstItem.rez_kayit_no || firstItem.Rez_Kayit_No || firstItem.rezKayitNo || firstItem.rez_kayitNo;
      if (rezKayitNo === '0' || rezKayitNo === 0 || rezKayitNo === null || rezKayitNo === undefined || rezKayitNo === '') {
        // Tüm hata mesajlarını topla
        const errorMessages = [
          firstItem.error,
          firstItem.Error,
          firstItem.message,
          firstItem.Message,
          firstItem.hata,
          firstItem.Hata,
          firstItem.Mesaj,
          firstItem.mesaj,
          firstItem.ErrorMessage,
          firstItem.errorMessage
        ].filter(msg => msg && msg.trim() !== '');
        
        const errorMsg = errorMessages.length > 0 
          ? errorMessages.join('. ')
          : 'Rezervasyon kaydedilemedi (rez_kayit_no: 0). Lütfen API sağlayıcısı ile iletişime geçin: 0312 870 10 35';
        
        console.error('❌ External API rezervasyon kaydedilemedi (rez_kayit_no: 0):', {
          success: firstItem.success,
          Success: firstItem.Success,
          Status: firstItem.Status,
          status: firstItem.status,
          rez_id: firstItem.rez_id || firstItem.Rez_ID,
          rez_kayit_no: rezKayitNo,
          error: errorMsg,
          allErrorFields: errorMessages,
          fullResponse: firstItem,
          sentParams: {
            Pickup_ID: params.Pickup_ID,
            Drop_Off_ID: params.Drop_Off_ID,
            Cars_Park_ID: params.Cars_Park_ID,
            Group_ID: params.Group_ID,
            Rez_ID: params.Rez_ID,
            Your_Rent_Price: params.Your_Rent_Price,
            Pickup_Hour: params.Pickup_Hour,
            Drop_Off_Hour: params.Drop_Off_Hour,
            Name: params.Name,
            SurName: params.SurName
          }
        });
        
        // Gönderilen parametreleri de hata mesajına ekle (debug için)
        throw new Error(`External API Rezervasyon Hatası: ${errorMsg}. Gönderilen parametreler: Pickup_ID=${params.Pickup_ID}, Drop_Off_ID=${params.Drop_Off_ID}, Cars_Park_ID=${params.Cars_Park_ID}, Group_ID=${params.Group_ID}, Rez_ID=${params.Rez_ID}, Your_Rent_Price=${params.Your_Rent_Price}, Pickup_Hour=${params.Pickup_Hour}, Drop_Off_Hour=${params.Drop_Off_Hour}`);
      }
      
      // success: "False" kontrolü
      if (firstItem.success === 'False' || firstItem.success === false || 
          firstItem.Success === 'False' || firstItem.Success === false) {
        // Eğer rez_id veya rez_kayit_no varsa, rezervasyon yapılmış olabilir
        const rezId = firstItem.rez_id || firstItem.Rez_ID || firstItem.rezId;
        if (rezId && rezKayitNo && rezKayitNo !== '0' && rezKayitNo !== 0) {
          console.warn('⚠️ External API success: False ama rez_id ve rez_kayit_no var:', {
            rez_id: rezId,
            rez_kayit_no: rezKayitNo
          });
          console.warn('⚠️ Bu durumda rezervasyon yapılmış olabilir');
          // Rezervasyon yapılmış gibi devam et
        } else {
          // Hata mesajını bul
          const errorMsg = firstItem.error || firstItem.Error || firstItem.message || firstItem.Message || 
                          firstItem.hata || firstItem.Hata || 
                          'Rezervasyon kaydedilemedi. Lütfen API sağlayıcısı ile iletişime geçin: 0312 870 10 35';
          console.error('❌ External API rezervasyon hatası detayları:', {
            success: firstItem.success,
            Status: firstItem.Status,
            rez_id: firstItem.rez_id,
            rez_kayit_no: rezKayitNo,
            error: errorMsg,
            fullResponse: firstItem
          });
  
          throw new Error(`External API Rezervasyon Hatası: ${errorMsg}`);
        }
      }
      
      // Başarılı ise logla
      if (isSuccess) {
        console.log('✅ External API rezervasyon başarılı:', {
          rez_id: firstItem.rez_id || firstItem.Rez_ID,
          rez_kayit_no: rezKayitNo,
          ID: firstItem.ID || firstItem.id,
          Status: firstItem.Status || firstItem.status || firstItem.Success
        });
      }
    } else if (typeof response.data === 'object' && response.data !== null) {
      // Array değilse, direkt obje olabilir
      console.log('📥 External API yanıtı obje formatında:', response.data);
      
      // Obje formatında da hata kontrolü yap
      if (response.data.success === 'False' || response.data.success === false) {
        const errorMsg = response.data.error || response.data.Error || 
                        'Rezervasyon kaydedilemedi. Lütfen API sağlayıcısı ile iletişime geçin: 0312 870 10 35';
        throw new Error(`External API Rezervasyon Hatası: ${errorMsg}`);
      }
    } else if (typeof response.data === 'string') {
      // String yanıt olabilir (XML veya HTML hata sayfası)
      console.warn('⚠️ External API string yanıt döndü:', response.data.substring(0, 500));
      
      // Eğer string yanıt boş değilse, parse etmeyi dene
      if (response.data.trim() !== '') {
        try {
          // JSON string olabilir
          const parsed = JSON.parse(response.data);
          console.log('📥 String yanıt JSON olarak parse edildi:', parsed);
          return parsed;
        } catch (parseError) {
          // JSON değilse, hata sayfası veya XML olabilir
          console.error('❌ String yanıt JSON değil, muhtemelen hata sayfası');
          console.error('❌ Yanıt içeriği:', response.data.substring(0, 1000));
          throw new Error(`External API beklenmedik string yanıt döndü. Muhtemelen hata sayfası. Lütfen API sağlayıcısı ile iletişime geçin: 0312 870 10 35`);
        }
      } else {
        throw new Error('External API boş string yanıt döndü. Rezervasyon türevde görünmeyecek. Lütfen API sağlayıcısı ile iletişime geçin: 0312 870 10 35');
      }
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

