const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    trim: true,
    maxlength: 1000,
    default: ''
  },
  image: {
    type: String,
    default: ''
  },
  mediaUrl: {
    type: String,
    default: ''
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  comments: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    username: String,
    text: {
      type: String,
      required: true,
      maxlength: 500
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
}, { timestamps: true });

// Add indexes for better query performance
postSchema.index({ author: 1, createdAt: -1 }); // For user posts sorted by date
postSchema.index({ createdAt: -1 }); // For feed sorting
postSchema.index({ likes: 1 }); // For like queries
postSchema.index({ 'comments.user': 1 }); // For comment queries

module.exports = mongoose.model('Post', postSchema);