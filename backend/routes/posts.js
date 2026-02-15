const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const User = require('../models/User');
const auth = require('../middleware/auth');
const notificationsRouter = require('./notifications');
const createNotification = notificationsRouter.createNotification;
const { cache } = require('../utils/cache');

// Create new post
router.post('/', auth, async (req, res) => {
  try {
    const { image } = req.body;
    const rawContent = typeof req.body.content === 'string' ? req.body.content : '';
    const content = rawContent.trim();

    if (!content && !image) {
      return res.status(400).json({ message: 'Share a thought or attach media' });
    }

    const post = new Post({
      author: req.user._id,
      content,
      image: image || '',
      mediaUrl: image || ''
    });

    await post.save();
    
    await post.populate('author', 'username fullName profilePicture');

    // Clear posts cache
    cache.clearPattern('^/api/posts');

    const io = req.app.get('io');
    io.emit('post-created', {
      postId: post._id,
      author: post.author,
      content: post.content,
      createdAt: post.createdAt
    });

    res.status(201).json(post);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all posts (feed) with pagination and caching
router.get('/', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    
    // Try cache first
    const cacheKey = `posts:feed:${page}:${limit}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Ultra-optimized query: minimal fields, no comment population on feed
    const [posts, total] = await Promise.all([
      Post.find()
        .select('author content image mediaUrl likes comments createdAt')
        .populate('author', 'username fullName profilePicture')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Post.countDocuments()
    ]);

    // Optimized formatting
    const formattedPosts = posts.map(post => ({
      ...post,
      likesCount: post.likes?.length || 0,
      commentsCount: post.comments?.length || 0,
      author: post.author || { username: 'Unknown', fullName: 'Unknown User' }
    }));

    const response = {
      posts: formattedPosts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
    
    // Cache for 10 seconds for instant response
    await cache.set(cacheKey, response, 10);

    res.json(response);
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get single post with caching
router.get('/:id', auth, async (req, res) => {
  try {
    // Try cache first
    const cacheKey = `post:${req.params.id}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const post = await Post.findById(req.params.id)
      .select('author content image mediaUrl likes comments createdAt updatedAt')
      .populate('author', 'username fullName profilePicture')
      .populate('comments.user', 'username profilePicture')
      .lean();

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Cache for 20 seconds
    await cache.set(cacheKey, post, 20);

    res.json(post);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get user's posts with pagination and caching
router.get('/user/:userId', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    // Try cache first
    const cacheKey = `posts:user:${req.params.userId}:${page}:${limit}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const [posts, total] = await Promise.all([
      Post.find({ author: req.params.userId })
        .select('author content image mediaUrl likes comments createdAt')
        .populate('author', 'username fullName profilePicture')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Post.countDocuments({ author: req.params.userId })
    ]);

    const response = {
      posts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };

    // Cache for 45 seconds
    await cache.set(cacheKey, response, 45);

    res.json(response);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update post
router.put('/:id', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Check if user is the author
    if (post.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    post.content = req.body.content || post.content;
    post.image = req.body.image !== undefined ? req.body.image : post.image;

    await post.save();
    await post.populate('author', 'username fullName profilePicture');

    // Clear posts cache
    cache.clearPattern('^/api/posts');

    res.json(post);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete post
router.delete('/:id', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Check if user is the author
    if (post.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await post.deleteOne();

    // Clear posts cache
    cache.clearPattern('^/api/posts');

    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Like/Unlike post (optimized)
router.post('/:id/like', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('author', 'username fullName avatar')
      .select('likes author content image mediaUrl createdAt updatedAt');

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const likeIndex = post.likes.indexOf(req.user._id);

    let action = 'liked';
    if (likeIndex > -1) {
      // Unlike
      post.likes.splice(likeIndex, 1);
      action = 'unliked';
    } else {
      // Like
      post.likes.push(req.user._id);
    }

    await post.save();

    // Clear posts cache
    cache.delete(`/api/posts/${req.params.id}`);

    if (action === 'liked' && post.author.toString() !== req.user._id.toString()) {
      try {
        await createNotification(
          post.author,
          req.user._id,
          'like',
          `${req.user.fullName || req.user.username} liked your post`,
          `/posts/${post._id}`,
          req.app.get('io')
        );
      } catch (notifyErr) {
        console.error('Like notification failed', notifyErr);
      }
    }

    res.json({ 
      ...post.toObject(),
      success: true, 
      action, 
      likesCount: post.likes.length 
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Add comment (optimized)
router.post('/:id/comment', auth, async (req, res) => {
  try {
    const { text } = req.body;
    const post = await Post.findById(req.params.id).select('comments author');

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const comment = {
      user: req.user._id,
      username: req.user.username,
      text,
      createdAt: new Date()
    };

    post.comments.push(comment);
    await post.save();
    
    // Clear posts cache
    cache.delete(`/api/posts/${req.params.id}`);
    
    // Only populate the new comment
    const savedComment = post.comments[post.comments.length - 1];
    await post.populate('comments.user', 'username profilePicture');

    if (post.author.toString() !== req.user._id.toString()) {
      try {
        await createNotification(
          post.author,
          req.user._id,
          'comment',
          `${req.user.fullName || req.user.username} commented: "${text.slice(0, 60)}"`,
          `/posts/${post._id}`,
          req.app.get('io')
        );
      } catch (notifyErr) {
        console.error('Comment notification failed', notifyErr);
      }
    }

    res.json({ 
      success: true, 
      comment: post.comments[post.comments.length - 1],
      commentsCount: post.comments.length 
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete comment
router.delete('/:postId/comment/:commentId', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const comment = post.comments.id(req.params.commentId);

    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Check if user is comment author or post author
    if (comment.user.toString() !== req.user._id.toString() && 
        post.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    comment.deleteOne();
    await post.save();

    // Clear posts cache
    cache.delete(`/api/posts/${req.params.postId}`);

    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;