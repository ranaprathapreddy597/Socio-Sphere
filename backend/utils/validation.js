const { body, validationResult } = require('express-validator');
const logger = require('./logger');

// Validation schemas for common operations
const schemas = {
  // User validation
  register: [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain uppercase, lowercase, and numbers'),
    body('username')
      .trim()
      .isLength({ min: 3, max: 30 })
      .withMessage('Username must be 3-30 characters')
      .matches(/^[a-zA-Z0-9_-]+$/)
      .withMessage('Username can only contain letters, numbers, underscore, and dash'),
  ],

  login: [
    body('email').isEmail().normalizeEmail(),
    body('password').exists().withMessage('Password required'),
  ],

  updateProfile: [
    body('fullName')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Full name too long'),
    body('bio')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Bio must be less than 500 characters'),
    body('username')
      .optional()
      .trim()
      .matches(/^[a-zA-Z0-9_-]+$/)
      .withMessage('Invalid username format'),
  ],

  changePassword: [
    body('currentPassword')
      .exists()
      .withMessage('Current password required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain uppercase, lowercase, and numbers'),
    body('confirmPassword')
      .custom((value, { req }) => value === req.body.newPassword)
      .withMessage('Passwords do not match'),
  ],

  // Post validation
  createPost: [
    body('content')
      .trim()
      .isLength({ min: 1, max: 5000 })
      .withMessage('Post must be 1-5000 characters'),
  ],

  createComment: [
    body('text')
      .trim()
      .isLength({ min: 1, max: 1000 })
      .withMessage('Comment must be 1-1000 characters'),
    body('postId')
      .isMongoId()
      .withMessage('Invalid post ID'),
  ],

  // Trip validation
  createTrip: [
    body('title')
      .trim()
      .isLength({ min: 3, max: 100 })
      .withMessage('Trip title must be 3-100 characters'),
    body('destination')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Destination must be 2-100 characters'),
    body('startDate')
      .isISO8601()
      .withMessage('Invalid start date'),
    body('endDate')
      .isISO8601()
      .withMessage('Invalid end date')
      .custom((value, { req }) => {
        if (new Date(value) <= new Date(req.body.startDate)) {
          throw new Error('End date must be after start date');
        }
        return true;
      }),
  ],

  // Message validation
  sendMessage: [
    body('text')
      .trim()
      .isLength({ min: 1, max: 2000 })
      .withMessage('Message must be 1-2000 characters'),
    body('receiverId')
      .isMongoId()
      .withMessage('Invalid receiver ID'),
  ],
};

/**
 * Middleware to handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn({
      message: 'Validation failed',
      path: req.path,
      errors: errors.array(),
    });
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.param,
        message: err.msg,
      })),
    });
  }
  next();
};

/**
 * Sanitize text input
 */
function sanitizeText(text) {
  if (typeof text !== 'string') return '';
  return text
    .trim()
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Validate MongoDB ObjectId
 */
function isValidObjectId(id) {
  return /^[0-9a-fA-F]{24}$/.test(id);
}

module.exports = {
  schemas,
  handleValidationErrors,
  sanitizeText,
  isValidObjectId,
};
