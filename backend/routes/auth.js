const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const OtpToken = require('../models/OtpToken');
const { sendWelcomeEmail, sendOtpEmail } = require('../utils/emailService');

function issueJwt(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

function sanitizeEmail(email) {
  return email?.toLowerCase().trim();
}

async function resolveUsername(preferred = '') {
  const base = preferred
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 20) || `traveler${Math.floor(Math.random() * 9999)}`;
  let candidate = base;
  let suffix = 1;
  // eslint-disable-next-line no-await-in-loop
  while (await User.exists({ username: candidate })) {
    candidate = `${base}${suffix}`;
    suffix += 1;
  }
  return candidate;
}

async function recordDevice(user, req) {
  const deviceId = req.headers['x-device-id'];
  if (!deviceId) {
    user.lastActiveAt = new Date();
    await user.save();
    return;
  }

  if (!user.devices) {
    user.devices = [];
  }

  const existing = user.devices?.find((d) => d.deviceId === deviceId);
  if (existing) {
    existing.lastLoginAt = new Date();
    existing.ip = req.ip;
  } else {
    user.devices.push({
      deviceId,
      deviceName: req.headers['x-device-name'] || req.headers['user-agent'],
      lastLoginAt: new Date(),
      ip: req.ip
    });
  }
  user.lastActiveAt = new Date();
  await user.save();
}

async function generateOtp(email, purpose = 'login') {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await OtpToken.deleteMany({ email, purpose });
  await OtpToken.create({ email, code, purpose, expiresAt });
  
  try {
    await sendOtpEmail(email, code, purpose);
  } catch (emailError) {
    // OTP is still saved in database, error already logged in sendOtpEmail
    // Don't throw - OTP code is available in console if email fails
  }
}

function publicUser(user) {
  return {
    id: user._id,
    username: user.username,
    email: user.email,
    fullName: user.fullName,
    profilePicture: user.profilePicture,
    bio: user.bio,
    role: user.role
  };
}

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, fullName } = req.body;
    const normalizedEmail = sanitizeEmail(email);

    const existingUser = await User.findOne({ 
      $or: [{ email: normalizedEmail }, { username }] 
    });

    if (existingUser) {
      return res.status(400).json({ 
        message: 'User with this email or username already exists' 
      });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ 
        message: 'Password must be at least 6 characters' 
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = new User({
      username: username.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      fullName: (fullName || username).trim()
    });

    await user.save();
    sendWelcomeEmail(user.email, user.fullName || user.username);

    const token = issueJwt(user._id);

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        profilePicture: user.profilePicture,
        bio: user.bio,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Login user via password
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        message: 'Email and password are required' 
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        message: 'Please provide a valid email address' 
      });
    }

    const user = await User.findOne({ email: sanitizeEmail(email) });
    
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = issueJwt(user._id);
    await recordDevice(user, req);

    res.json({
      message: 'Login successful',
      token,
      user: publicUser(user)
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Request OTP
router.post('/request-otp', async (req, res) => {
  try {
    const { email, purpose = 'login' } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const normalizedEmail = sanitizeEmail(email);
    const user = await User.findOne({ email: normalizedEmail });

    if (purpose === 'login' && !user) {
      return res.status(404).json({ message: 'No account found for this email' });
    }
    if (purpose === 'password-reset' && !user) {
      return res.status(404).json({ message: 'Unable to reset password for this email' });
    }

    await generateOtp(normalizedEmail, purpose);
    
    // Check if email is configured
    const emailConfigured = !!(process.env.EMAIL_USER && process.env.EMAIL_PASS);
    const message = emailConfigured 
      ? 'OTP sent to your email. Check your inbox.' 
      : 'OTP generated. Check server console for code (development mode).';
    
    res.json({ 
      message,
      emailConfigured,
      hint: !emailConfigured ? 'Email not configured. OTP code is logged in server console.' : undefined
    });
  } catch (error) {
    console.error('OTP request error:', error);
    res.status(500).json({ 
      message: error.message || 'Server error', 
      error: error.message 
    });
  }
});

// Login via OTP
router.post('/login-otp', async (req, res) => {
  try {
    const { email, code, fullName, username } = req.body;
    const normalizedEmail = sanitizeEmail(email);
    if (!normalizedEmail || !code) {
      return res.status(400).json({ message: 'Email and code are required' });
    }

    const otpToken = await OtpToken.findOne({ email: normalizedEmail, purpose: 'login' }).sort({ createdAt: -1 });
    if (!otpToken || otpToken.expiresAt < new Date()) {
      return res.status(400).json({ message: 'Code expired or invalid' });
    }

    if (otpToken.code !== code) {
      otpToken.attempts += 1;
      await otpToken.save();
      const attemptsLeft = Math.max(0, 5 - otpToken.attempts);
      if (attemptsLeft === 0) {
        await OtpToken.deleteMany({ email: normalizedEmail, purpose: 'login' });
      }
      return res.status(400).json({ message: `Code is incorrect. ${attemptsLeft} attempts left.` });
    }

    otpToken.consumedAt = new Date();
    await otpToken.save();

    let user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      if (!username) {
        return res.status(400).json({ message: 'Username required for first-time OTP login' });
      }
      const fallbackUsername = await resolveUsername(username.trim() || normalizedEmail.split('@')[0]);
      const salt = await bcrypt.genSalt(10);
      const placeholderPassword = await bcrypt.hash(Math.random().toString(36).slice(-10), salt);
      user = await User.create({
        email: normalizedEmail,
        username: fallbackUsername,
        fullName: fullName || fallbackUsername,
        password: placeholderPassword
      });
      sendWelcomeEmail(user.email, user.fullName || user.username);
    }

    const token = issueJwt(user._id);
    await recordDevice(user, req);
    await OtpToken.deleteMany({ email: normalizedEmail, purpose: 'login' });

    res.json({
      message: 'Login successful',
      token,
      user: publicUser(user)
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Password reset request
router.post('/password/reset/request', async (req, res) => {
  try {
    const { email } = req.body;
    const normalizedEmail = sanitizeEmail(email);
    if (!normalizedEmail) return res.status(400).json({ message: 'Email is required' });

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(404).json({ message: 'No user found' });

    await generateOtp(normalizedEmail, 'password-reset');
    res.json({ message: 'Password reset code sent' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Password reset confirm
router.post('/password/reset/confirm', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      return res.status(400).json({ message: 'Email, code and new password required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const normalizedEmail = sanitizeEmail(email);
    const otpToken = await OtpToken.findOne({ email: normalizedEmail, purpose: 'password-reset' }).sort({ createdAt: -1 });
    if (!otpToken || otpToken.expiresAt < new Date() || otpToken.code !== code) {
      return res.status(400).json({ message: 'Invalid or expired code' });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();
    await OtpToken.deleteMany({ email: normalizedEmail, purpose: 'password-reset' });

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;