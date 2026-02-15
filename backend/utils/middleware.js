const { v4: uuidv4 } = require('uuid');
const logger = require('./logger');
const metrics = require('./metrics');
const sentry = require('./sentry');

/**
 * Request tracking middleware - adds requestId and timing
 */
function requestTracking(req, res, next) {
  req.id = req.headers['x-request-id'] || uuidv4();
  res.setHeader('X-Request-ID', req.id);

  const start = Date.now();

  // Track response
  const originalJson = res.json.bind(res);
  res.json = function(data) {
    const duration = Date.now() - start;
    const statusCode = Number(res.statusCode);

    // Record metrics
    const method = req.method;
    const route = req.baseUrl + req.path;
    const requestSize = Number(req.get('content-length') || 0);
    const responseSize = JSON.stringify(data).length;

    metrics.recordHttpMetric(method, route, statusCode, duration, requestSize, responseSize);

    // Log request
    logger.info({
      requestId: req.id,
      method,
      path: req.path,
      statusCode,
      duration: `${duration}ms`,
      query: req.query,
      user: req.user?.id || 'anonymous',
    });

    // Record errors
    if (statusCode >= 400) {
      metrics.recordError('http', statusCode);
    }

    return originalJson(data);
  };

  next();
}

/**
 * Error handling middleware
 */
function errorHandler(err, req, res, next) {
  const requestId = req.id || 'unknown';
  const statusCode = err.statusCode || err.status || 500;

  // Log error
  logger.error({
    requestId,
    message: err.message,
    statusCode,
    path: req.path,
    method: req.method,
    stack: err.stack,
    user: req.user?.id || 'anonymous',
  });

  // Record error metric
  metrics.recordError('exception', statusCode);

  // Send to Sentry
  if (statusCode >= 500) {
    sentry.captureException(err, {
      request: {
        url: req.originalUrl,
        method: req.method,
        headers: req.headers,
      },
    });
  }

  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal server error',
    requestId,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

/**
 * 404 Not Found middleware
 */
function notFound(req, res) {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    path: req.originalUrl,
    requestId: req.id,
  });
}

/**
 * CORS preflight caching
 */
function corsPreflightCache(req, res, next) {
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  next();
}

/**
 * Security headers
 */
function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
}

/**
 * Request size limiting
 */
function requestSizeLimiter(maxSize = '10mb') {
  return (req, res, next) => {
    const contentLength = parseInt(req.get('content-length'), 10);
    const maxBytes = maxSize === '10mb' ? 10 * 1024 * 1024 : parseInt(maxSize, 10);

    if (contentLength && contentLength > maxBytes) {
      return res.status(413).json({
        success: false,
        message: `Request body too large. Maximum size: ${maxSize}`,
      });
    }
    next();
  };
}

/**
 * Response compression cache control
 */
function cacheControl(maxAge = 300) {
  return (req, res, next) => {
    if (req.method === 'GET' && res.statusCode === 200) {
      res.setHeader('Cache-Control', `public, max-age=${maxAge}`);
    } else if (req.method === 'GET') {
      res.setHeader('Cache-Control', 'no-cache');
    }
    next();
  };
}

/**
 * Rate limit exceeded handler
 */
function rateLimitHandler(req, res) {
  res.status(429).json({
    success: false,
    message: 'Too many requests, please try again later',
    retryAfter: req.rateLimit.resetTime,
  });
}

/**
 * Request logging middleware
 */
function requestLogger(req, res, next) {
  sentry.addBreadcrumb(`${req.method} ${req.path}`, {
    query: req.query,
    params: req.params,
  }, 'http');
  next();
}

/**
 * Performance monitoring middleware
 */
function performanceMonitor(req, res, next) {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1000000; // Convert to ms

    // Log slow requests
    if (duration > 1000) {
      logger.warn('Slow request detected', {
        method: req.method,
        path: req.path,
        duration: `${duration}ms`,
        statusCode: res.statusCode,
      });
    }
  });

  next();
}

/**
 * Trust proxy middleware (for behind reverse proxy)
 */
function trustProxy(req, res, next) {
  // Already handled in server.js with app.set('trust proxy', 1)
  next();
}

/**
 * Request deduplication middleware (prevent double submissions)
 */
function requestDeduplication() {
  const recentRequests = new Map();
  const WINDOW = 5000; // 5 seconds

  return (req, res, next) => {
    // Only check POST/PUT/DELETE
    if (!['POST', 'PUT', 'DELETE'].includes(req.method)) {
      return next();
    }

    const key = `${req.user?.id}-${req.method}-${req.path}-${JSON.stringify(req.body)}`;
    const now = Date.now();

    if (recentRequests.has(key)) {
      const lastTime = recentRequests.get(key);
      if (now - lastTime < WINDOW) {
        return res.status(409).json({
          success: false,
          message: 'Duplicate request detected',
        });
      }
    }

    recentRequests.set(key, now);

    // Cleanup old entries
    if (recentRequests.size > 10000) {
      for (const [k, v] of recentRequests.entries()) {
        if (now - v > WINDOW) {
          recentRequests.delete(k);
        }
      }
    }

    next();
  };
}

/**
 * Graceful shutdown handler
 */
function setupGracefulShutdown(server, dependencies = {}) {
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, starting graceful shutdown');

    // Stop accepting new requests
    server.close(async () => {
      logger.info('HTTP server closed');

      try {
        // Close database connection
        if (dependencies.mongoose) {
          await dependencies.mongoose.connection.close();
          logger.info('MongoDB connection closed');
        }

        // Close Redis connection
        if (dependencies.redis) {
          await dependencies.redis.quit();
          logger.info('Redis connection closed');
        }

        // Close WebSocket connections
        if (dependencies.io) {
          dependencies.io.close();
          logger.info('WebSocket connections closed');
        }

        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during graceful shutdown:', error);
        process.exit(1);
      }
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
      logger.error('Forced shutdown due to timeout');
      process.exit(1);
    }, 30000);
  });

  process.on('SIGINT', async () => {
    logger.info('SIGINT received, starting graceful shutdown');
    process.emit('SIGTERM');
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    // Log to console as well so we never lose the stack trace
    console.error('Uncaught Exception', error);
    logger.error({ err: error }, 'Uncaught Exception');
    sentry.captureException(error);
    process.exit(1);
  });

  // Handle unhandled rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection', reason);
    logger.error({ promise, reason }, 'Unhandled Rejection');
    sentry.captureException(reason);
    process.exit(1);
  });
}

module.exports = {
  requestTracking,
  errorHandler,
  notFound,
  corsPreflightCache,
  securityHeaders,
  requestSizeLimiter,
  cacheControl,
  rateLimitHandler,
  requestLogger,
  performanceMonitor,
  trustProxy,
  requestDeduplication,
  setupGracefulShutdown,
};
