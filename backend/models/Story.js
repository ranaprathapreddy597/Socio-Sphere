const mongoose = require('mongoose');

const storySchema = new mongoose.Schema({
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  mediaUrl: {
    type: String,
    required: true
  },
  mediaType: {
    type: String,
    enum: ['image', 'video'],
    default: 'image'
  },
  caption: {
    type: String,
    maxlength: 200
  },
  views: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    viewedAt: {
      type: Date,
      default: Date.now
    }
  }],
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  expiresAt: {
    type: Date,
    default: () => new Date(+new Date() + 24*60*60*1000) // 24 hours
  }
}, { timestamps: true });

// Comprehensive indexes for fast story queries
storySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // Auto-delete expired
storySchema.index({ author: 1, createdAt: -1 }); // User's stories
storySchema.index({ createdAt: -1 }); // Recent stories
storySchema.index({ 'views.user': 1 }); // View tracking

module.exports = mongoose.model('Story', storySchema);