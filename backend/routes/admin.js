const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Post = require('../models/Post');
const Message = require('../models/Message');
const Notification = require('../models/Notification');
const logger = require('../utils/logger');
const metrics = require('../utils/metrics');

// Lightweight admin auth: allow all in non-production; in production require Basic auth against env creds.
const adminAuth = (req, res, next) => {
  const { NODE_ENV, ADMIN_USERNAME, ADMIN_PASSWORD } = process.env;

  // Allow dev flows without blocking the UI
  if (NODE_ENV !== 'production') {
    return next();
  }

  const header = req.headers.authorization || '';
  if (!header.startsWith('Basic ')) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const decoded = Buffer.from(header.replace('Basic ', ''), 'base64').toString();
  const [user, pass] = decoded.split(':');

  if (user === ADMIN_USERNAME && pass === ADMIN_PASSWORD) {
    return next();
  }

  return res.status(401).json({ success: false, message: 'Unauthorized' });
};

/**
 * Get dashboard statistics
 */
router.get('/stats', adminAuth, async (req, res) => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // User statistics
    const totalUsers = await User.countDocuments();
    const usersToday = await User.countDocuments({ createdAt: { $gte: today } });
    const usersThisWeek = await User.countDocuments({ createdAt: { $gte: lastWeek } });
    const activeUsers = await User.countDocuments({
      lastActive: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) }
    });

    // Post statistics
    const totalPosts = await Post.countDocuments();
    const postsToday = await Post.countDocuments({ createdAt: { $gte: today } });
    const postsThisWeek = await Post.countDocuments({ createdAt: { $gte: lastWeek } });
    const totalLikes = await Post.aggregate([
      { $group: { _id: null, total: { $sum: { $size: '$likes' } } } }
    ]);

    // Message statistics
    const totalMessages = await Message.countDocuments();
    const messagesThisWeek = await Message.countDocuments({ createdAt: { $gte: lastWeek } });

    // Calculate engagement metrics
    const avgPostsPerUser = totalUsers > 0 ? (totalPosts / totalUsers).toFixed(2) : 0;
    const postEngagement = totalPosts > 0 ? ((totalLikes[0]?.total || 0) / totalPosts).toFixed(2) : 0;

    metrics.recordDbMetric('admin', 'stats', 1);

    res.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          today: usersToday,
          thisWeek: usersThisWeek,
          active: activeUsers,
          growth: ((activeUsers / totalUsers) * 100).toFixed(2) + '%'
        },
        posts: {
          total: totalPosts,
          today: postsToday,
          thisWeek: postsThisWeek,
          totalLikes: totalLikes[0]?.total || 0,
          avgLikesPerPost: totalPosts > 0 ? ((totalLikes[0]?.total || 0) / totalPosts).toFixed(2) : 0,
        },
        messages: {
          total: totalMessages,
          thisWeek: messagesThisWeek,
        },
        engagement: {
          avgPostsPerUser,
          postEngagement,
          activeUserPercentage: ((activeUsers / totalUsers) * 100).toFixed(2) + '%'
        },
        timestamp: new Date()
      }
    });
  } catch (error) {
    logger.error('Admin stats error:', error);
    metrics.recordError('admin_stats', 500);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Get all users with pagination and filtering
 */
router.get('/users', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', sortBy = 'createdAt', order = 'desc' } = req.query;
    const skip = (page - 1) * limit;

    const query = search
      ? {
          $or: [
            { username: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
            { fullName: { $regex: search, $options: 'i' } }
          ]
        }
      : {};

    const users = await User.find(query)
      .select('-password')
      .sort({ [sortBy]: order === 'desc' ? -1 : 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          total,
          pages: Math.ceil(total / limit),
          current: parseInt(page),
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get users error:', error);
    metrics.recordError('admin_users', 500);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Get single user details
 */
router.get('/users/:userId', adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .select('-password')
      .populate('followers', 'username fullName avatar')
      .populate('following', 'username fullName avatar');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Get user's activity stats
    const postsCount = await Post.countDocuments({ user: user._id });
    const messagesCount = await Message.countDocuments({
      $or: [{ sender: user._id }, { receiver: user._id }]
    });

    res.json({
      success: true,
      data: {
        user: {
          ...user.toObject(),
          stats: {
            postsCount,
            messagesCount,
            followersCount: user.followers.length,
            followingCount: user.following.length
          }
        }
      }
    });
  } catch (error) {
    logger.error('Get user details error:', error);
    metrics.recordError('admin_user_details', 500);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Ban/Unban user
 */
router.post('/users/:userId/ban', adminAuth, async (req, res) => {
  try {
    const { reason = 'Violation of community guidelines' } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      {
        banned: true,
        banReason: reason,
        bannedAt: new Date(),
        bannedBy: req.user._id
      },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    logger.info(`User ${user.username} banned by admin ${req.user.username}: ${reason}`);

    // Disconnect user from WebSocket if online
    const io = req.app.get('io');
    io.to(`user-${user._id}`).emit('banned', { reason });

    res.json({
      success: true,
      message: `User ${user.username} has been banned`,
      data: { user }
    });
  } catch (error) {
    logger.error('Ban user error:', error);
    metrics.recordError('admin_ban_user', 500);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Unban user
 */
router.post('/users/:userId/unban', adminAuth, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      {
        banned: false,
        banReason: null,
        bannedAt: null,
        bannedBy: null
      },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    logger.info(`User ${user.username} unbanned by admin ${req.user.username}`);

    res.json({
      success: true,
      message: `User ${user.username} has been unbanned`,
      data: { user }
    });
  } catch (error) {
    logger.error('Unban user error:', error);
    metrics.recordError('admin_unban_user', 500);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Delete user
 */
router.delete('/users/:userId', adminAuth, async (req, res) => {
  try {
    const { reason = 'Account deletion by admin' } = req.body;

    const user = await User.findByIdAndDelete(req.params.userId);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Delete user's posts, messages, etc.
    await Post.deleteMany({ user: user._id });
    await Message.deleteMany({ $or: [{ sender: user._id }, { receiver: user._id }] });

    logger.info(`User ${user.username} deleted by admin ${req.user.username}: ${reason}`);

    res.json({
      success: true,
      message: `User ${user.username} has been deleted`,
    });
  } catch (error) {
    logger.error('Delete user error:', error);
    metrics.recordError('admin_delete_user', 500);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Get all posts for moderation
 */
router.get('/posts', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, filterBy = 'all', sortBy = 'createdAt' } = req.query;
    const skip = (page - 1) * limit;

    const query = {};
    if (filterBy === 'flagged') {
      query.flaggedForReview = true;
    }

    const posts = await Post.find(query)
      .populate('author', 'username fullName profilePicture')
      .sort({ [sortBy]: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Post.countDocuments(query);

    res.json({
      success: true,
      data: {
        posts,
        pagination: {
          total,
          pages: Math.ceil(total / limit),
          current: parseInt(page),
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get posts error:', error);
    metrics.recordError('admin_posts', 500);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Delete post
 */
router.delete('/posts/:postId', adminAuth, async (req, res) => {
  try {
    const { reason = 'Violates community guidelines' } = req.body;

    const post = await Post.findByIdAndDelete(req.params.postId);

    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    logger.info(`Post deleted by admin ${req.user.username}: ${reason}`);

    res.json({
      success: true,
      message: 'Post has been deleted',
    });
  } catch (error) {
    logger.error('Delete post error:', error);
    metrics.recordError('admin_delete_post', 500);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Report content
 */
router.post('/reports', async (req, res) => {
  try {
    const { contentType, contentId, reason, description } = req.body;

    if (!['post', 'comment', 'user', 'message'].includes(contentType)) {
      return res.status(400).json({ success: false, message: 'Invalid content type' });
    }

    // TODO: Create Report model and save report
    logger.info(`Report submitted: ${contentType} ${contentId} - ${reason}`);

    res.json({
      success: true,
      message: 'Report submitted successfully',
      data: {
        contentType,
        contentId,
        reason,
        timestamp: new Date(),
        status: 'pending'
      }
    });
  } catch (error) {
    logger.error('Report error:', error);
    metrics.recordError('report', 500);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Get all reports
 */
router.get('/reports', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, status = 'all' } = req.query;
    const skip = (page - 1) * limit;

    // TODO: Query from Report model
    // For now, return empty array with structure
    const reports = [];
    const total = 0;

    res.json({
      success: true,
      data: {
        reports,
        pagination: {
          total,
          pages: Math.ceil(total / limit),
          current: parseInt(page),
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get reports error:', error);
    metrics.recordError('admin_reports', 500);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Update report status
 */
router.put('/reports/:reportId', adminAuth, async (req, res) => {
  try {
    const { status, action, actionReason } = req.body;

    // TODO: Update report status
    // Possible actions: 'dismiss', 'warn_user', 'delete_content', 'ban_user'

    res.json({
      success: true,
      message: 'Report updated',
      data: {
        reportId: req.params.reportId,
        status,
        action,
        timestamp: new Date()
      }
    });
  } catch (error) {
    logger.error('Update report error:', error);
    metrics.recordError('admin_update_report', 500);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Get system metrics
 */
router.get('/metrics', adminAuth, async (req, res) => {
  try {
    const metricsJson = await metrics.getMetricsJSON();

    // Extract relevant metrics
    const httpMetrics = metricsJson.filter(m => m.name.startsWith('http_'));
    const dbMetrics = metricsJson.filter(m => m.name.startsWith('db_'));
    const redisMetrics = metricsJson.filter(m => m.name.startsWith('redis_'));

    res.json({
      success: true,
      data: {
        http: httpMetrics,
        database: dbMetrics,
        cache: redisMetrics,
        timestamp: new Date()
      }
    });
  } catch (error) {
    logger.error('Get metrics error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Get system health
 */
router.get('/health', adminAuth, async (req, res) => {
  try {
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();

    res.json({
      success: true,
      data: {
        uptime: `${Math.floor(uptime / 60)} minutes`,
        memory: {
          heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
          heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
          external: `${(memoryUsage.external / 1024 / 1024).toFixed(2)} MB`
        },
        timestamp: new Date()
      }
    });
  } catch (error) {
    logger.error('Get health error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
