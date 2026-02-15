const Post = require('../models/Post');
const LeaderboardSnapshot = require('../models/LeaderboardSnapshot');

function buildScoreEntries(results = []) {
  return results.map((entry, index) => ({
    user: {
      _id: entry.author?._id || entry.user?._id,
      username: entry.author?.username || entry.user?.username,
      fullName: entry.author?.fullName || entry.user?.fullName,
      profilePicture: entry.author?.profilePicture || entry.user?.profilePicture
    },
    likes: entry.likes || 0,
    comments: entry.comments || 0,
    posts: entry.posts || entry.postCount || 0,
    score: entry.score || 0,
    rank: index + 1,
    badges: entry.badges || []
  }));
}

async function updateDailyLeaderboard() {
  try {
    const now = new Date();
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const slug = `daily-${now.toISOString().slice(0, 10)}`;
    
    const pipeline = [
      { $match: { createdAt: { $gte: since } } },
      {
        $lookup: {
          from: 'users',
          localField: 'author',
          foreignField: '_id',
          as: 'author'
        }
      },
      { $unwind: '$author' },
      {
        $addFields: {
          likesCount: { $size: { $ifNull: ['$likes', []] } },
          commentsCount: { $size: { $ifNull: ['$comments', []] } }
        }
      },
      {
        $group: {
          _id: '$author._id',
          author: { $first: '$author' },
          likes: { $sum: '$likesCount' },
          comments: { $sum: '$commentsCount' },
          posts: { $sum: 1 }
        }
      },
      {
        $addFields: {
          score: { $add: [{ $multiply: ['$likes', 2] }, '$comments'] }
        }
      },
      { $sort: { score: -1 } },
      { $limit: 50 }
    ];

    // Execute aggregation with optimizations
    const results = await Post.aggregate(pipeline).allowDiskUse(true);

    const entries = buildScoreEntries(results);

    await LeaderboardSnapshot.findOneAndUpdate(
      { slug },
      {
        type: 'daily',
        metric: 'likes',
        slug,
        periodStart: since,
        periodEnd: now,
        entries: entries.map((e) => ({
          user: e.user._id,
          score: e.score,
          likes: e.likes,
          comments: e.comments,
          posts: e.posts,
          rank: e.rank,
          badges: e.badges
        }))
      },
      { upsert: true }
    );

    console.log(`✅ Daily leaderboard updated: ${entries.length} entries`);
    return entries;
  } catch (error) {
    console.error('❌ Error updating daily leaderboard:', error.message);
    // Don't throw - just log the error so the app keeps running
    return [];
  }
}

// Schedule to run every 24 hours
async function startLeaderboardScheduler() {
  // Run immediately on startup (non-blocking)
  updateDailyLeaderboard().catch(err => {
    console.error('Initial leaderboard update failed:', err.message);
  });

  // Then schedule to run every 24 hours
  const interval = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  setInterval(() => {
    updateDailyLeaderboard().catch(err => {
      console.error('Scheduled leaderboard update failed:', err.message);
    });
  }, interval);

  console.log('📊 Leaderboard scheduler started (updates every 24 hours)');
}

module.exports = {
  updateDailyLeaderboard,
  startLeaderboardScheduler
};

