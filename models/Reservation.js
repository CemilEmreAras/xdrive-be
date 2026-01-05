const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema({
  car: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Car',
    required: true
  },
  user: {
    firstName: {
      type: String,
      required: true
    },
    lastName: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    },
    phone: {
      type: String,
      required: true
    },
    licenseNumber: {
      type: String,
      required: true
    },
    age: {
      type: Number,
      required: true
    },
    country: {
      type: String,
      required: true
    }
  },
  pickupDate: {
    type: Date,
    required: true
  },
  dropoffDate: {
    type: Date,
    required: true
  },
  pickupLocation: {
    city: String,
    address: String
  },
  dropoffLocation: {
    city: String,
    address: String,
    sameLocation: {
      type: Boolean,
      default: true
    }
  },
  basePrice: {
    type: Number,
    default: 0
  },
  commission: {
    type: Number,
    default: 0
  },
  totalPrice: {
    type: Number,
    required: true
  },
  paymentAmount: {
    type: Number,
    default: 0,
    comment: 'Ödenecek tutar (sadece komisyon)'
  },
  currency: {
    type: String,
    default: 'EURO'
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'completed'],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'refunded'],
    default: 'pending'
  },
  reservationNumber: {
    type: String,
    unique: true,
    required: true
  },
  externalRezId: {
    type: String,
    default: null
  },
  externalId: {
    type: String,
    default: null
  },
  rezId: {
    type: String,
    default: null,
    comment: 'API\'den gelen Rez_ID - cache için gerekli'
  },
  carsParkId: {
    type: String,
    default: null,
    comment: 'API\'den gelen Cars_Park_ID - cache için gerekli'
  }
}, {
  timestamps: true
});

// Reservation number oluşturma
reservationSchema.pre('save', async function(next) {
  if (!this.reservationNumber) {
    this.reservationNumber = 'RES-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9).toUpperCase();
  }
  next();
});

module.exports = mongoose.model('Reservation', reservationSchema);

