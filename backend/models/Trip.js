const mongoose = require('mongoose');

const participantSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: {
    type: String,
    enum: ['host', 'confirmed', 'pending', 'waitlisted', 'declined'],
    default: 'pending'
  },
  joinedAt: { type: Date, default: Date.now },
  note: String
}, { _id: false });

const checklistItemSchema = new mongoose.Schema({
  label: String,
  completed: { type: Boolean, default: false },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { _id: false });

const expenseSchema = new mongoose.Schema({
  title: String,
  amount: Number,
  currency: { type: String, default: 'USD' },
  paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  sharedWith: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { _id: false });

const tripSchema = new mongoose.Schema({
  host: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 140
  },
  destination: {
    city: String,
    country: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  description: {
    type: String,
    maxlength: 2000
  },
  contactPhone: {
    type: String,
    trim: true,
    maxlength: 40
  },
  coverImage: String,
  startDate: Date,
  endDate: Date,
  maxParticipants: {
    type: Number,
    default: 8
  },
  visibility: {
    type: String,
    enum: ['public', 'friends', 'invite-only'],
    default: 'public'
  },
  travelStyle: {
    type: String,
    enum: ['luxury', 'budget', 'adventure', 'culture', 'relaxation', 'flexible'],
    default: 'flexible'
  },
  status: {
    type: String,
    enum: ['draft', 'open', 'in-progress', 'completed', 'cancelled'],
    default: 'open'
  },
  participants: [participantSchema],
  checklist: [checklistItemSchema],
  expenses: [expenseSchema],
  interests: [{ type: String }],
  highlights: [{
    day: Number,
    label: String,
    details: String
  }],
  aiInsights: [{
    title: String,
    body: String,
    createdAt: { type: Date, default: Date.now }
  }],
  polls: [{
    _id: mongoose.Schema.Types.ObjectId,
    question: String,
    options: [{
      _id: mongoose.Schema.Types.ObjectId,
      text: String,
      votes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
    }],
    status: { type: String, enum: ['active', 'closed'], default: 'active' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
  }],
  media: [{
    _id: mongoose.Schema.Types.ObjectId,
    url: String,
    type: { type: String, enum: ['image', 'video'], default: 'image' },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    uploadedAt: { type: Date, default: Date.now }
  }],
  chat: [{
    _id: mongoose.Schema.Types.ObjectId,
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    content: String,
    createdAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

// Comprehensive indexes for fast trip queries
tripSchema.index({ startDate: 1, endDate: 1 }); // Date range queries
tripSchema.index({ 'destination.city': 1, 'destination.country': 1 }); // Location search
tripSchema.index({ visibility: 1, status: 1 }); // Filter by visibility/status
tripSchema.index({ host: 1, createdAt: -1 }); // Host's trips
tripSchema.index({ 'participants.user': 1 }); // User participation
tripSchema.index({ travelStyle: 1 }); // Style-based matching
tripSchema.index({ createdAt: -1 }); // Recent trips

module.exports = mongoose.model('Trip', tripSchema);

