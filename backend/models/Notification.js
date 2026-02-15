const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['like', 'comment', 'follow', 'message', 'mention', 'post', 'trip', 'system'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  link: {
    type: String, // Link to the relevant post/profile
    default: ''
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date
  }
}, { timestamps: true });

// Comprehensive indexes for notification queries
notificationSchema.index({ recipient: 1, createdAt: -1 }); // User's notifications
notificationSchema.index({ recipient: 1, isRead: 1 }); // Unread notifications
notificationSchema.index({ sender: 1 }); // Sent notifications
notificationSchema.index({ type: 1, createdAt: -1 }); // By type

module.exports = mongoose.model('Notification', notificationSchema);