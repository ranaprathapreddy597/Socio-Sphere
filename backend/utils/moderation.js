const Filter = require('bad-words');
const logger = require('./logger');

// Initialize bad words filter
const filter = new Filter();

// Additional banned words (customize for your platform)
const customBannedWords = [
  'spam',
  'scam',
  'adult',
];

filter.addWords(...customBannedWords);

/**
 * Check if content contains toxic/banned words
 */
function checkBannedWords(text) {
  if (!text || typeof text !== 'string') {
    return { isFlagged: false, reason: null };
  }

  const isFlagged = filter.isProfane(text);
  if (isFlagged) {
    return {
      isFlagged: true,
      reason: 'Content contains inappropriate language',
      cleanedText: filter.clean(text),
    };
  }

  return { isFlagged: false, reason: null };
}

/**
 * Moderate text content
 */
async function moderateText(text, context = {}) {
  if (!text || typeof text !== 'string') {
    return { approved: false, reason: 'Invalid text' };
  }

  // Check length
  if (text.length > 5000) {
    return { approved: false, reason: 'Content too long' };
  }

  // Check for banned words
  const badWordsResult = checkBannedWords(text);
  if (badWordsResult.isFlagged) {
    logger.warn('Content flagged for banned words', { text: text.substring(0, 100) });
    return {
      approved: false,
      reason: badWordsResult.reason,
      flagged: true,
    };
  }

  // Check for spam patterns
  const spamResult = detectSpam(text);
  if (spamResult.isSpam) {
    logger.warn('Content flagged as spam', { text: text.substring(0, 100) });
    return {
      approved: false,
      reason: spamResult.reason,
      flagged: true,
    };
  }

  return { approved: true };
}

/**
 * Detect spam patterns
 */
function detectSpam(text) {
  if (!text || typeof text !== 'string') {
    return { isSpam: false, reason: null };
  }

  // Check for excessive repetition
  const repeatedPattern = /(.)\1{9,}/;
  if (repeatedPattern.test(text)) {
    return { isSpam: true, reason: 'Excessive character repetition' };
  }

  // Check for excessive caps
  const capsCount = (text.match(/[A-Z]/g) || []).length;
  if (capsCount > text.length * 0.5) {
    return { isSpam: true, reason: 'Excessive capitals' };
  }

  // Check for spam keywords
  const spamKeywords = ['buy now', 'click here', 'free money', 'work from home', 'earn cash'];
  for (const keyword of spamKeywords) {
    if (text.toLowerCase().includes(keyword)) {
      return { isSpam: true, reason: `Contains spam keyword: "${keyword}"` };
    }
  }

  // Check for URL spam (too many URLs)
  const urlPattern = /https?:\/\/[^\s]+/g;
  const urls = text.match(urlPattern) || [];
  if (urls.length > 3) {
    return { isSpam: true, reason: 'Too many URLs' };
  }

  // Check for mention spam
  const mentionPattern = /@[\w.-]+/g;
  const mentions = text.match(mentionPattern) || [];
  if (mentions.length > 10) {
    return { isSpam: true, reason: 'Excessive mentions' };
  }

  return { isSpam: false, reason: null };
}

/**
 * Moderate post
 */
async function moderatePost(post) {
  // Check post content
  if (post.content) {
    const contentResult = await moderateText(post.content, { type: 'post' });
    if (!contentResult.approved) {
      return contentResult;
    }
  }

  // Check for multiple reports (implemented in Report model)
  return { approved: true };
}

/**
 * Moderate comment
 */
async function moderateComment(comment) {
  // Check comment content
  const contentResult = await moderateText(comment.text, { type: 'comment' });
  if (!contentResult.approved) {
    return contentResult;
  }

  return { approved: true };
}

/**
 * Moderate user profile
 */
async function moderateUserProfile(profile) {
  // Check username for banned words
  if (profile.username) {
    const usernameResult = checkBannedWords(profile.username);
    if (usernameResult.isFlagged) {
      return { approved: false, reason: 'Username contains inappropriate content' };
    }
  }

  // Check bio
  if (profile.bio) {
    const bioResult = await moderateText(profile.bio, { type: 'bio' });
    if (!bioResult.approved) {
      return bioResult;
    }
  }

  return { approved: true };
}

/**
 * Report content
 */
async function reportContent(type, contentId, userId, reason, description) {
  const allowedTypes = ['post', 'comment', 'user', 'message'];
  const allowedReasons = ['spam', 'inappropriate', 'harassment', 'violence', 'hate_speech', 'other'];

  if (!allowedTypes.includes(type)) {
    return { success: false, error: 'Invalid report type' };
  }

  if (!allowedReasons.includes(reason)) {
    return { success: false, error: 'Invalid report reason' };
  }

  if (!description || description.length < 10) {
    return { success: false, error: 'Description must be at least 10 characters' };
  }

  // Report would be created in database
  return {
    success: true,
    message: 'Report submitted successfully',
    data: {
      type,
      contentId,
      userId,
      reason,
      description,
      timestamp: new Date(),
      status: 'pending',
    },
  };
}

/**
 * Get moderation status
 */
function getModerationStatus(content) {
  if (!content) {
    return { status: 'unknown', flags: [] };
  }

  const flags = [];

  if (checkBannedWords(content.content || '').isFlagged) {
    flags.push('banned_words');
  }

  if (detectSpam(content.content || '').isSpam) {
    flags.push('spam');
  }

  return {
    status: flags.length > 0 ? 'flagged' : 'clean',
    flags,
    reviewedAt: new Date(),
  };
}

module.exports = {
  moderateText,
  moderatePost,
  moderateComment,
  moderateUserProfile,
  checkBannedWords,
  detectSpam,
  reportContent,
  getModerationStatus,
};
