const mongoose = require('mongoose');

const carSchema = new mongoose.Schema({
  externalId: {
    type: String,
    required: true,
    unique: true
  },
  brand: {
    type: String,
    required: true
  },
  model: {
    type: String,
    required: true
  },
  year: {
    type: Number,
    required: true
  },
  category: {
    type: String,
    enum: ['Economy', 'Compact', 'Intermediate', 'Standard', 'Full Size', 'Premium', 'Luxury', 'SUV', 'Van'],
    required: true
  },
  transmission: {
    type: String,
    enum: ['Manual', 'Automatic'],
    required: true
  },
  seats: {
    type: Number,
    required: true
  },
  pricePerDay: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'USD'
  },
  location: {
    city: String,
    country: String,
    address: String
  },
  image: {
    type: String,
    default: 'https://via.placeholder.com/400x300?text=Car+Image'
  },
  available: {
    type: Boolean,
    default: true
  },
  features: [{
    type: String
  }],
  rating: {
    type: Number,
    min: 0,
    max: 5,
    default: 4.5
  },
  reviewCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Car', carSchema);

