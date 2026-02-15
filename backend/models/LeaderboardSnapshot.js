const mongoose = require('mongoose');

const leaderboardSnapshotSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['daily', 'weekly', 'travelers'],
    default: 'daily'
  },
  metric: {
    type: String,
    enum: ['likes', 'comments', 'engagement', 'trip_hosts'],
    default: 'likes'
  },
  slug: {
    type: String,
    index: true
  },
  periodStart: Date,
  periodEnd: Date,
  entries: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    score: Number,
    likes: Number,
    comments: Number,
    posts: Number,
    rank: Number,
    badges: [String]
  }]
}, { timestamps: true });

leaderboardSnapshotSchema.index({ type: 1, periodStart: -1 });

module.exports = mongoose.model('LeaderboardSnapshot', leaderboardSnapshotSchema);

