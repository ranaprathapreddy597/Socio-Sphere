const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { Server } = require('socket.io');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xssClean = require('xss-clean');
const client = require('prom-client');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const logger = require('./utils/logger');
const metrics = require('./utils/metrics');
const middleware = require('./utils/middleware');
const sentry = require('./utils/sentry');

// Load environment variables
dotenv.config();

// Initialize Sentry if DSN provided
if (process.env.SENTRY_DSN) {
  sentry.initSentry();
}

// Create Express app and HTTP/HTTPS server
const app = express();
let server;
let protocol = 'http';
const USE_HTTPS = process.env.HTTPS_ENABLED === 'true';
if (USE_HTTPS) {
  const certPath = process.env.SSL_CERT_PATH ? path.resolve(process.env.SSL_CERT_PATH) : null;
  const keyPath = process.env.SSL_KEY_PATH ? path.resolve(process.env.SSL_KEY_PATH) : null;
  if (!certPath || !keyPath) {
    console.warn('HTTPS_ENABLED is true but SSL_CERT_PATH or SSL_KEY_PATH is not set — falling back to HTTP');
  } else {
    try {
      const httpsOptions = {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
        ca: process.env.SSL_CA_PATH ? fs.readFileSync(path.resolve(process.env.SSL_CA_PATH)) : undefined
      };
      server = https.createServer(httpsOptions, app);
      protocol = 'https';
    } catch (err) {
      console.warn('Failed to load SSL cert/key, falling back to HTTP. Error:', err.message);
    }
  }
}
if (!server) {
  server = http.createServer(app);
}
app.set('trust proxy', 1);

// Get local network IP address dynamically
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal (loopback) and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const LOCAL_IP = process.env.LOCAL_IP || getLocalIP();

// Socket.IO for real-time features
const defaultOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:4173',
  'http://10.247.198.85:5500',
  'http://127.0.0.1:4173',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  'http://10.247.198.245:5000',
  'http://10.36.189.140:5000',
  'https://localhost:3000',
  'https://127.0.0.1:3000',
  'https://localhost:5500',
  'https://127.0.0.1:5500',
  'https://localhost:4173',
  'https://127.0.0.1:4173',
  'https://localhost:5173',
  'https://127.0.0.1:5173',
  'https://localhost:8080',
  'https://127.0.0.1:8080',
  'https://localhost:5000',
  'https://127.0.0.1:5000',
  'http://10.247.198.245:5500',
  'https://10.247.198.245:5000',
  'https://10.247.198.245:5500',
  // Dynamic IP for multi-device access (auto-detected)
  `http://${LOCAL_IP}:3000`,
  `http://${LOCAL_IP}:4173`,
  `http://${LOCAL_IP}:5173`,
  `http://${LOCAL_IP}:5500`,
  `http://${LOCAL_IP}:8080`,
  `http://${LOCAL_IP}:8000`,
  `http://${LOCAL_IP}:5000`,
  `https://${LOCAL_IP}:3000`,
  `https://${LOCAL_IP}:4173`,
  `https://${LOCAL_IP}:5173`,
  `https://${LOCAL_IP}:5500`,
  `https://${LOCAL_IP}:8080`,
  `https://${LOCAL_IP}:8000`,
  `https://${LOCAL_IP}:5000`
];

const extraOrigins = (process.env.CLIENT_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

const publicOrigins = (process.env.PUBLIC_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

const allowedOrigins = Array.from(new Set([...defaultOrigins, ...extraOrigins, ...publicOrigins]));

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  }
});

// Middleware
// Configure helmet based on protocol - only apply strict headers for HTTPS
const helmetConfig = {
  contentSecurityPolicy: false, // Allow inline styles for better UX
};

// Only apply these headers in HTTPS mode (they require secure context)
if (protocol === 'https') {
  helmetConfig.crossOriginOpenerPolicy = { policy: "same-origin-allow-popups" };
  helmetConfig.crossOriginEmbedderPolicy = false;
} else {
  // Disable these headers for HTTP to avoid browser warnings
  helmetConfig.crossOriginOpenerPolicy = false;
  helmetConfig.crossOriginEmbedderPolicy = false;
}

app.use(helmet(helmetConfig)); // Security headers
// Optimized compression with higher level for better ratio
app.use(compression({ 
  level: 6, // Balance between speed and compression ratio
  threshold: 1024, // Only compress responses > 1KB
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));

// Prometheus metrics (must be early to capture middleware timings)
const register = new client.Registry();
client.collectDefaultMetrics({ register });
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10]
});
register.registerMetric(httpRequestDuration);

app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer({
    method: req.method,
    route: req.path || req.originalUrl || 'unknown'
  });
  res.on('finish', () => {
    end({ status_code: res.statusCode });
  });
  next();
});

// Enable ETag for better caching
app.set('etag', 'strong'); // Enable strong ETags

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    console.warn('Blocked CORS origin:', origin);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
// Optimized body parsing with reasonable limits
app.use(express.json({ limit: '10mb', strict: true }));
app.use(express.urlencoded({ extended: true, limit: '10mb', parameterLimit: 10000 }));

// Rate limiting - more lenient for auth endpoints
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RL_GENERAL_WINDOW_MS || `${10 * 60 * 1000}`, 10),
  max: parseInt(process.env.RL_GENERAL_MAX || '300', 10),
  message: process.env.RL_GENERAL_MESSAGE || 'Too many requests from this IP, take a short breather and try again.',
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: true,
});

// Stricter rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: parseInt(process.env.RL_AUTH_WINDOW_MS || `${15 * 60 * 1000}`, 10),
  max: parseInt(process.env.RL_AUTH_MAX || '20', 10),
  message: process.env.RL_AUTH_MESSAGE || 'Too many login attempts, please try again shortly.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
});

// Serve static files with aggressive caching
const staticOptions = {
  maxAge: '1d', // Cache static files for 1 day
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    // Cache CSS, JS, images aggressively
    if (path.match(/\.(css|js|jpg|jpeg|png|gif|svg|webp|woff|woff2|ttf|eot)$/i)) {
      res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    }
  }
};
app.use(express.static(path.join(__dirname, '../frontend'), staticOptions));

// Apply general rate limiting to all API routes
app.use('/api/', generalLimiter);

// Apply stricter rate limiting to auth routes
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/request-otp', authLimiter);
// Connect to MongoDB with production-grade optimizations
mongoose.connect(process.env.MONGO_URI, {
  maxPoolSize: 50, // Increased for high concurrency
  minPoolSize: 10,  // Higher minimum for instant connections
  maxIdleTimeMS: 30000,
  socketTimeoutMS: 45000,
  serverSelectionTimeoutMS: 30000, // Increased for reliable local connections
  connectTimeoutMS: 30000, // Increased timeout
  family: 4,
  autoIndex: process.env.NODE_ENV !== 'production', // Disable in prod (create manually)
  retryWrites: true,
  w: 'majority',
  readPreference: 'primaryPreferred', // Read from secondary if primary busy
  compressors: ['zlib'] // Enable network compression
})
.then(() => {
  logger.info('MongoDB connected with advanced pooling');
  // Enable query profiling for optimization
  mongoose.set('debug', process.env.NODE_ENV === 'development');
})
.catch((err) => logger.error({ error: err.message }, 'MongoDB connection failed'));

// Make io accessible to routes
app.set('io', io);

// Routes
const authRoutes = require('./routes/auth');
const postRoutes = require('./routes/posts');
const userRoutes = require('./routes/users');
const messageRoutes = require('./routes/messages');
const notificationRoutes = require('./routes/notifications');
const storyRoutes = require('./routes/stories');
const hfRoutes = require('./routes/hf');
const leaderboardRoutes = require('./routes/leaderboard');
const tripRoutes = require('./routes/trips');
const giphyRoutes = require('./routes/giphy');
const systemRoutes = require('./routes/system');
const exploreRoutes = require('./routes/explore');
const adminRoutes = require('./routes/admin');
const { startLeaderboardScheduler } = require('./utils/leaderboardScheduler');

// Swagger API Documentation
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SocioSphere API',
      version: '2.0.0',
      description: 'Social Media Platform API with AI and Real-time Features'
    },
    servers: [
      {
        url: `${protocol}://localhost:${process.env.PORT || 5000}`,
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    }
  },
  apis: ['./routes/*.js']
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Core middleware - apply early
app.use(middleware.requestTracking); // Track all requests with unique IDs
if (process.env.SENTRY_DSN) {
  app.use(sentry.requestHandler()); // Sentry request tracking
}
app.use(middleware.performanceMonitor); // Monitor request performance
app.use(middleware.securityHeaders); // Add security headers
app.use(middleware.requestLogger); // Add breadcrumbs for debugging

// Data sanitization and XSS prevention
app.use(mongoSanitize()); // Prevent MongoDB injection
app.use(xssClean()); // Prevent XSS attacks

// Optimize API responses with caching headers
app.use('/api/', (req, res, next) => {
  // Enable ETag validation for GET requests
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'private, max-age=10, must-revalidate');
  } else {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
  next();
});

// Body size limiting
app.use(middleware.requestSizeLimiter('10mb'));

// Apply general rate limiting to all API routes
app.use('/api/', generalLimiter);

// Apply stricter rate limiting to auth routes
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/request-otp', authLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/stories', storyRoutes);
app.use('/api/hf', hfRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/gifs', giphyRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/explore', exploreRoutes);
app.use('/api/admin', adminRoutes); // Admin dashboard API

// Prometheus metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    const metricsString = await metrics.getMetrics();
    res.set('Content-Type', 'text/plain');
    res.end(metricsString);
  } catch (err) {
    logger.error('Metrics error:', err.message);
    res.status(500).json({ error: 'Metrics unavailable' });
  }
});

// Admin dashboard - separate URL
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'admin.html'));
});

// Health check endpoint (for load balancers)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date(),
    uptime: process.uptime(),
    message: 'Server is healthy'
  });
});

// Ready check endpoint (for Kubernetes)
app.get('/ready', (req, res) => {
  // Check if all connections are ready
  if (mongoose.connection.readyState === 1) {
    res.json({ ready: true });
  } else {
    res.status(503).json({ ready: false, reason: 'MongoDB not connected' });
  }
});

// Friendly root endpoint to show service status
app.get('/', (req, res) => {
  res.json({
    status: 'running',
    environment: process.env.NODE_ENV || 'development',
    protocol,
    port: PORT,
    api: `${protocol}://localhost:${PORT}/api`,
    admin: `${protocol}://localhost:${PORT}/admin`,
    docs: `${protocol}://localhost:${PORT}/api-docs`,
    metrics: `${protocol}://localhost:${PORT}/metrics`,
    health: `${protocol}://localhost:${PORT}/health`
  });
});

// Serve static files with aggressive caching for assets
app.use(express.static(path.join(__dirname, '..', 'frontend'), {
  maxAge: '1d', // Cache static files for 1 day
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    // Cache CSS/JS/images aggressively
    if (filePath.endsWith('.css') || filePath.endsWith('.js') || filePath.endsWith('.woff2') || filePath.endsWith('.woff')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // 1 year for assets
    } else if (filePath.match(/\.(jpg|jpeg|png|gif|svg|webp|ico)$/i)) {
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day for images
    }
  }
}));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
  res.setHeader('Cache-Control', 'no-cache'); // Don't cache HTML
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// Test route
const apiMeta = {
  message: 'SocioSphere Enhanced API Running!',
  version: '2.0.0',
  features: [
    'Real-time Chat',
    'Notifications',
    'Stories',
    'AI Content Generation',
    'Smart Suggestions'
  ]
};

app.get('/', (req, res) => res.json(apiMeta));
app.get('/api/health', (req, res) => {
  res.json({
    ...apiMeta,
    status: 'ok',
    serverTime: Date.now()
  });
});

// Socket.IO Connection Handler
const onlineUsers = new Map();

io.on('connection', (socket) => {
  logger.debug({ socketId: socket.id }, 'User connected');

  // User comes online
  socket.on('user-online', (userId) => {
    onlineUsers.set(userId, socket.id);
    io.emit('user-status', { userId, status: 'online' });
    logger.debug({ userId, socketId: socket.id }, 'User online');
  });

  // Join personal room for notifications
  socket.on('join-room', (userId) => {
    socket.join(`user-${userId}`);
  });

  // Real-time messaging
  socket.on('send-message', async (data) => {
    const { senderId, receiverId, message } = data;
    const receiverSocketId = onlineUsers.get(receiverId);
    
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('receive-message', {
        senderId,
        message,
        timestamp: new Date()
      });
    }

    // Also emit to receiver's room
    io.to(`user-${receiverId}`).emit('new-notification', {
      type: 'message',
      from: senderId,
      message: message.substring(0, 50)
    });
  });

  // Typing indicator
  socket.on('typing', (data) => {
    const { receiverId, isTyping } = data;
    const receiverSocketId = onlineUsers.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('user-typing', { isTyping });
    }
  });

  // Voice call signalling - optimized for low latency
  socket.on('call-offer', ({ targetUserId, offer, caller }) => {
    const receiverSocketId = onlineUsers.get(targetUserId);
    if (!receiverSocketId) {
      socket.emit('call-unavailable', { reason: 'User offline' });
      return;
    }
    // Send offer with high priority
    io.to(receiverSocketId).emit('incoming-call-offer', {
      offer,
      caller,
      callerId: caller?._id || caller?.id,
      timestamp: Date.now()
    });
  });

  socket.on('call-answer', ({ targetUserId, answer }) => {
    const receiverSocketId = onlineUsers.get(targetUserId);
    if (!receiverSocketId) return;
    // Send answer with high priority
    io.to(receiverSocketId).emit('incoming-call-answer', { 
      answer,
      timestamp: Date.now()
    });
  });

  socket.on('call-ice-candidate', ({ targetUserId, candidate }) => {
    const receiverSocketId = onlineUsers.get(targetUserId);
    if (!receiverSocketId) return;
    // Send ICE candidates immediately (batch them on receiver side if needed)
    io.to(receiverSocketId).emit('call-ice-candidate', { 
      candidate,
      timestamp: Date.now()
    });
  });

  socket.on('end-call', ({ targetUserId, reason }) => {
    const receiverSocketId = onlineUsers.get(targetUserId);
    if (!receiverSocketId) return;
    io.to(receiverSocketId).emit('call-ended', { reason });
  });

  // New post notification
  socket.on('new-post', (data) => {
    io.emit('post-created', data);
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log('❌ User disconnected:', socket.id);
    // Remove from online users
    for (let [userId, socketId] of onlineUsers.entries()) {
      if (socketId === socket.id) {
        onlineUsers.delete(userId);
        io.emit('user-status', { userId, status: 'offline' });
        break;
      }
    }
  });
});

// 404 handler (must be before error handler)
app.use(middleware.notFound);

// Global error handling middleware (must be last)
if (process.env.SENTRY_DSN) {
  app.use(sentry.errorHandler());
}

app.use(middleware.errorHandler);

// Start server with graceful shutdown
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  logger.info({
    message: 'Server started successfully',
    protocol,
    port: PORT,
    localIP: LOCAL_IP,
    environment: process.env.NODE_ENV || 'development',
    features: [
      'Real-time Chat',
      'Notifications',
      'Stories',
      'AI Content Generation',
      'Admin Dashboard',
      'Prometheus Metrics',
      'Error Tracking with Sentry',
      'Request Validation',
      'File Upload Security'
    ]
  });

  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 SocioSphere Server Running`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Protocol: ${protocol.toUpperCase()}`);
  console.log(`Port: ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Local IP: ${LOCAL_IP}`);
  console.log(`\n📍 Access URLs:`);
  console.log(`   API: ${protocol}://localhost:${PORT}/api`);
  console.log(`   API Docs: ${protocol}://localhost:${PORT}/api-docs`);
  console.log(`   Admin: ${protocol}://localhost:${PORT}/admin`);
  console.log(`   Metrics: ${protocol}://localhost:${PORT}/metrics`);
  console.log(`   Health: ${protocol}://localhost:${PORT}/health`);
  if (LOCAL_IP !== 'localhost') {
    console.log(`\n🌐 Network Access:`);
    console.log(`   API: ${protocol}://${LOCAL_IP}:${PORT}/api`);
    console.log(`   Admin: ${protocol}://${LOCAL_IP}:${PORT}/admin`);
  }
  console.log(`\n📡 Socket.IO: Enabled for real-time features`);
  console.log(`${'='.repeat(60)}\n`);

  // Start leaderboard scheduler
  startLeaderboardScheduler();
});

// Setup graceful shutdown
middleware.setupGracefulShutdown(server, {
  mongoose,
  redis: global.redis, // Assuming you expose redis globally
  io
});
