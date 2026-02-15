const multer = require('multer');
const path = require('path');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const logger = require('./logger');

// Allowed file types
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];
const ALLOWED_DOCUMENT_TYPES = ['application/pdf', 'application/msword'];

// Size limits
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_DOCUMENT_SIZE = 25 * 1024 * 1024; // 25MB

/**
 * File filter for uploads
 */
function fileFilter(req, file, cb) {
  // Check file type
  const allowedMimetypes = [
    ...ALLOWED_IMAGE_TYPES,
    ...ALLOWED_VIDEO_TYPES,
    ...ALLOWED_DOCUMENT_TYPES,
  ];

  if (!allowedMimetypes.includes(file.mimetype)) {
    return cb(new Error(`File type ${file.mimetype} not allowed`));
  }

  // Check file extension
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.mov', '.avi', '.pdf', '.doc', '.docx'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (!allowedExtensions.includes(ext)) {
    return cb(new Error(`File extension ${ext} not allowed`));
  }

  cb(null, true);
}

/**
 * Storage configuration for multer
 */
const storage = multer.memoryStorage();

/**
 * Create multer upload middleware
 */
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_IMAGE_SIZE,
    files: 5, // Max 5 files per request
  },
});

/**
 * Optimize and validate image
 */
async function optimizeImage(buffer, options = {}) {
  try {
    const {
      maxWidth = 1200,
      maxHeight = 1200,
      quality = 80,
      format = 'webp',
    } = options;

    let pipeline = sharp(buffer);

    // Get metadata
    const metadata = await pipeline.metadata();
    if (!metadata || !['jpeg', 'png', 'gif', 'webp'].includes(metadata.format)) {
      throw new Error('Invalid image format');
    }

    // Resize if needed
    if (metadata.width > maxWidth || metadata.height > maxHeight) {
      pipeline = pipeline.resize(maxWidth, maxHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    // Convert to webp for better compression
    if (format === 'webp') {
      pipeline = pipeline.webp({ quality });
    } else {
      pipeline = pipeline.jpeg({ quality, progressive: true });
    }

    const optimized = await pipeline.toBuffer();
    return optimized;
  } catch (error) {
    logger.error('Image optimization failed:', error.message);
    throw new Error('Failed to process image');
  }
}

/**
 * Generate thumbnail
 */
async function generateThumbnail(buffer, size = 300) {
  try {
    const thumbnail = await sharp(buffer)
      .resize(size, size, {
        fit: 'cover',
        position: 'center',
      })
      .webp({ quality: 60 })
      .toBuffer();

    return thumbnail;
  } catch (error) {
    logger.error('Thumbnail generation failed:', error.message);
    throw new Error('Failed to generate thumbnail');
  }
}

/**
 * Validate file before upload
 */
async function validateFile(file) {
  if (!file) {
    throw new Error('No file provided');
  }

  // Check size based on type
  if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    if (file.size > MAX_IMAGE_SIZE) {
      throw new Error(`Image size exceeds ${MAX_IMAGE_SIZE / 1024 / 1024}MB limit`);
    }
  } else if (ALLOWED_VIDEO_TYPES.includes(file.mimetype)) {
    if (file.size > MAX_VIDEO_SIZE) {
      throw new Error(`Video size exceeds ${MAX_VIDEO_SIZE / 1024 / 1024}MB limit`);
    }
  } else if (ALLOWED_DOCUMENT_TYPES.includes(file.mimetype)) {
    if (file.size > MAX_DOCUMENT_SIZE) {
      throw new Error(`Document size exceeds ${MAX_DOCUMENT_SIZE / 1024 / 1024}MB limit`);
    }
  }

  // Validate image if it's an image
  if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    try {
      const metadata = await sharp(file.buffer).metadata();
      if (!metadata) {
        throw new Error('Invalid image file');
      }
      // Check for suspicious dimensions
      if (metadata.width < 100 || metadata.height < 100) {
        throw new Error('Image dimensions too small');
      }
      if (metadata.width > 8000 || metadata.height > 8000) {
        throw new Error('Image dimensions too large');
      }
    } catch (error) {
      throw new Error('Invalid or corrupted image file');
    }
  }

  return true;
}

/**
 * Generate unique filename
 */
function generateFilename(originalname, extension = '') {
  const timestamp = Date.now();
  const random = uuidv4().split('-')[0];
  const ext = extension || path.extname(originalname).toLowerCase();
  return `${timestamp}-${random}${ext}`;
}

module.exports = {
  upload,
  optimizeImage,
  generateThumbnail,
  validateFile,
  generateFilename,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_VIDEO_TYPES,
  ALLOWED_DOCUMENT_TYPES,
  MAX_IMAGE_SIZE,
  MAX_VIDEO_SIZE,
  MAX_DOCUMENT_SIZE,
};
