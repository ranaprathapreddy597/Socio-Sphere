const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');

// Get current user profile (optimized with caching)
router.get('/me', auth, async (req, res) => {
  try {
    const { cache } = require('../utils/cache');
    const cacheKey = `user:${req.user._id}`;
    
    // Try cache first
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const user = await User.findById(req.user._id)
      .select('-password -devices -__v')
      .populate('followers', 'username')
      .populate('following', 'username')
      .lean();
    
    // Cache for 15 seconds
    await cache.set(cacheKey, user, 15);
    
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get user by ID (optimized with caching)
router.get('/:id', auth, async (req, res) => {
  try {
    const { cache } = require('../utils/cache');
    const cacheKey = `user:${req.params.id}`;
    
    // Try cache first
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const user = await User.findById(req.params.id)
      .select('-password -devices -__v')
      .populate('followers', 'username')
      .populate('following', 'username')
      .lean();
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Cache for 15 seconds
    await cache.set(cacheKey, user, 15);
    
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update user profile
router.put('/profile', auth, async (req, res) => {
  try {
    const {
      fullName,
      bio,
      profilePicture,
      coverImage,
      username
    } = req.body;

    const updatePayload = {};
    if (fullName !== undefined) updatePayload.fullName = fullName;
    if (bio !== undefined) updatePayload.bio = bio;
    if (profilePicture !== undefined) updatePayload.profilePicture = profilePicture;
    if (coverImage !== undefined) updatePayload.coverImage = coverImage;

    if (username && username.trim().toLowerCase() !== req.user.username.toLowerCase()) {
      const sanitized = username.trim();
      const exists = await User.findOne({
        username: sanitized,
        _id: { $ne: req.user._id }
      });
      if (exists) {
        return res.status(400).json({ message: 'Username already taken' });
      }
      updatePayload.username = sanitized;
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updatePayload,
      { new: true, runValidators: true }
    ).select('-password');

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.put('/password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    const user = await User.findById(req.user._id);
    const matches = await bcrypt.compare(currentPassword, user.password);
    if (!matches) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Follow user
router.post('/follow/:id', auth, async (req, res) => {
  try {
    const userToFollow = await User.findById(req.params.id);
    const currentUser = await User.findById(req.user._id);

    if (!userToFollow) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if already following
    if (currentUser.following.includes(userToFollow._id)) {
      return res.status(400).json({ message: 'Already following this user' });
    }

    // Add to following and followers
    currentUser.following.push(userToFollow._id);
    userToFollow.followers.push(currentUser._id);

    await currentUser.save();
    await userToFollow.save();

    // Return updated current user data
    const updatedUser = await User.findById(req.user._id)
      .select('-password')
      .populate('followers', 'username profilePicture')
      .populate('following', 'username profilePicture');

    res.json({ message: 'User followed successfully', user: updatedUser });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Unfollow user
router.post('/unfollow/:id', auth, async (req, res) => {
  try {
    const userToUnfollow = await User.findById(req.params.id);
    const currentUser = await User.findById(req.user._id);

    if (!userToUnfollow) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Remove from following and followers
    currentUser.following = currentUser.following.filter(
      id => id.toString() !== userToUnfollow._id.toString()
    );
    userToUnfollow.followers = userToUnfollow.followers.filter(
      id => id.toString() !== currentUser._id.toString()
    );

    await currentUser.save();
    await userToUnfollow.save();

    // Return updated current user data
    const updatedUser = await User.findById(req.user._id)
      .select('-password')
      .populate('followers', 'username profilePicture')
      .populate('following', 'username profilePicture');

    res.json({ message: 'User unfollowed successfully', user: updatedUser });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Search users
router.get('/search/:query', auth, async (req, res) => {
  try {
    const users = await User.find({
      $or: [
        { username: { $regex: req.params.query, $options: 'i' } },
        { fullName: { $regex: req.params.query, $options: 'i' } }
      ]
    })
    .select('-password')
    .limit(10);

    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;