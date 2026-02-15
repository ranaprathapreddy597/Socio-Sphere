const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Post = require('../models/Post');
const LeaderboardSnapshot = require('../models/LeaderboardSnapshot');
const auth = require('../middleware/auth');

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

router.get('/daily', auth, async (req, res) => {
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
          likesCount: { $size: '$likes' },
          commentsCount: { $size: '$comments' }
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
      { $limit: 20 }
    ];

    const results = await Post.aggregate(pipeline);
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

    res.json(entries);
  } catch (error) {
    res.status(500).json({ message: 'Unable to build leaderboard', error: error.message });
  }
});

router.get('/users', auth, async (req, res) => {
  try {
    const users = await User.find()
      .select('-password')
      .sort({ followers: -1 })
      .limit(10)
      .populate('followers', 'username fullName profilePicture')
      .lean();

    const usersWithStats = users.map(user => ({
      ...user,
      followersCount: user.followers ? user.followers.length : 0,
      followingCount: user.following ? user.following.length : 0
    }));

    res.json(usersWithStats.sort((a, b) => b.followersCount - a.followersCount));
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/posts', auth, async (req, res) => {
  try {
    const posts = await Post.find()
      .populate('author', 'username fullName profilePicture')
      .sort({ likes: -1 })
      .limit(10)
      .lean();

    const postsWithStats = posts.map(post => ({
      ...post,
      likesCount: post.likes ? post.likes.length : 0,
      commentsCount: post.comments ? post.comments.length : 0
    }));

    res.json(postsWithStats.sort((a, b) => b.likesCount - a.likesCount));
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/overall', auth, async (req, res) => {
  try {
    const users = await User.find().select('-password').lean();
    
    const leaderboard = users.map(user => {
      return {
        user: {
          _id: user._id,
          username: user.username,
          fullName: user.fullName,
          profilePicture: user.profilePicture,
          bio: user.bio
        },
        followersCount: user.followers ? user.followers.length : 0,
        followingCount: user.following ? user.following.length : 0,
        score: (user.followers ? user.followers.length : 0) * 2 + (user.following ? user.following.length : 0)
      };
    });

    res.json(leaderboard.sort((a, b) => b.score - a.score).slice(0, 20));
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/history', auth, async (req, res) => {
  try {
    const snapshots = await LeaderboardSnapshot.find()
      .populate('entries.user', 'username fullName profilePicture')
      .sort({ createdAt: -1 })
      .limit(14);

    res.json(snapshots);
  } catch (error) {
    res.status(500).json({ message: 'Unable to fetch history', error: error.message });
  }
});

module.exports = router;
