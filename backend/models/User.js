const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
  deviceId: String,
  deviceName: String,
  lastLoginAt: Date,
  ip: String
}, { _id: false });

const notificationPreferenceSchema = new mongoose.Schema({
  likes: { type: Boolean, default: true },
  comments: { type: Boolean, default: true },
  newFollowers: { type: Boolean, default: true },
  trips: { type: Boolean, default: true },
  aiTips: { type: Boolean, default: true }
}, { _id: false });

const travelPreferenceSchema = new mongoose.Schema({
  travelStyle: { type: String, default: 'flexible' },
  budget: { type: String, default: 'moderate' },
  interests: [{ type: String }],
  passportReady: { type: Boolean, default: false }
}, { _id: false });

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true, // unique: true automatically creates an index
    trim: true,
    minlength: 3,
    maxlength: 20
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true, // unique: true automatically creates an index
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 6
  },
  fullName: {
    type: String,
    default: ''
  },
  bio: {
    type: String,
    default: '',
    maxlength: 200
  },
  profilePicture: {
    type: String,
    default: ''
  },
  coverImage: {
    type: String,
    default: ''
  },
  role: {
    type: String,
    enum: ['user', 'moderator', 'admin'],
    default: 'user'
  },
  accountStatus: {
    type: String,
    enum: ['active', 'review', 'suspended'],
    default: 'active'
  },
  location: {
    city: String,
    country: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  interests: [{
    type: String,
    trim: true
  }],
  travelPreferences: {
    type: travelPreferenceSchema,
    default: () => ({})
  },
  notificationPreferences: {
    type: notificationPreferenceSchema,
    default: () => ({})
  },
  badges: [{
    type: String
  }],
  aiPersona: {
    tone: { type: String, default: 'friendly' },
    goals: [{ type: String }]
  },
  following: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  favorites: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post'
  }],
  lastActiveAt: {
    type: Date,
    default: Date.now
  },
  onboardingComplete: {
    type: Boolean,
    default: false
  },
  devices: [deviceSchema],
  freezedUntil: Date,
  banned: {
    type: Boolean,
    default: false
  },
  banReason: {
    type: String,
    default: null
  },
  bannedAt: {
    type: Date,
    default: null
  },
  bannedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, { timestamps: true });

// Comprehensive indexes for maximum query performance
userSchema.index({ 'location.city': 1, 'location.country': 1 }); // Location-based queries
userSchema.index({ followers: 1 }); // Follower queries
userSchema.index({ following: 1 }); // Following queries
userSchema.index({ lastActiveAt: -1 }); // Active user queries
userSchema.index({ createdAt: -1 }); // New user queries
userSchema.index({ username: 1, fullName: 1 }); // Search by name
userSchema.index({ interests: 1 }); // Interest-based matching

module.exports = mongoose.model('User', userSchema);
