const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 2000
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'video', 'file'],
    default: 'text'
  },
  mediaUrl: {
    type: String,
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

// Comprehensive indexes for chat queries
messageSchema.index({ sender: 1, receiver: 1, createdAt: -1 }); // Conversation history
messageSchema.index({ receiver: 1, isRead: 1 }); // Unread messages
messageSchema.index({ sender: 1, createdAt: -1 }); // Sent messages
messageSchema.index({ createdAt: -1 }); // Recent messages

// Track per-user soft deletion so each participant can hide messages
messageSchema.add({
  deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
});

module.exports = mongoose.model('Message', messageSchema);
