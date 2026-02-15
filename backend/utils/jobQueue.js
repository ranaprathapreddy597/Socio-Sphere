const Queue = require('bull');
const logger = require('./logger');

// Bull queue for background jobs (uses Redis)
const emailQueue = new Queue('email', process.env.REDIS_URL || 'redis://localhost:6379', {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    removeOnComplete: true,
    removeOnFail: false
  }
});

const notificationQueue = new Queue('notification', process.env.REDIS_URL || 'redis://localhost:6379', {
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 1000
    },
    removeOnComplete: true
  }
});

const analyticsQueue = new Queue('analytics', process.env.REDIS_URL || 'redis://localhost:6379', {
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: true
  }
});

// Email job processor
emailQueue.process(async (job) => {
  logger.info({ jobId: job.id, data: job.data }, 'Processing email job');
  const { to, subject, html } = job.data;
  
  try {
    const emailService = require('./emailService');
    await emailService.sendEmail(to, subject, html);
    logger.info({ jobId: job.id, to }, 'Email sent successfully');
  } catch (error) {
    logger.error({ jobId: job.id, error: error.message }, 'Email job failed');
    throw error;
  }
});

// Notification job processor
notificationQueue.process(async (job) => {
  logger.info({ jobId: job.id, data: job.data }, 'Processing notification job');
  const { userId, type, content } = job.data;
  
  try {
    // Save notification to database
    const Notification = require('../models/Notification');
    await Notification.create({
      recipient: userId,
      sender: job.data.senderId,
      type,
      content,
      link: job.data.link || ''
    });
    logger.info({ jobId: job.id, userId }, 'Notification created');
  } catch (error) {
    logger.error({ jobId: job.id, error: error.message }, 'Notification job failed');
    throw error;
  }
});

// Analytics job processor
analyticsQueue.process(async (job) => {
  logger.info({ jobId: job.id, event: job.data.event }, 'Processing analytics event');
  // Add your analytics processing here (e.g., send to analytics service)
});

// Queue event handlers
[emailQueue, notificationQueue, analyticsQueue].forEach(queue => {
  queue.on('error', (error) => {
    logger.error({ queue: queue.name, error: error.message }, 'Queue error');
  });
  
  queue.on('failed', (job, error) => {
    logger.error({ 
      queue: queue.name, 
      jobId: job.id, 
      error: error.message,
      attempts: job.attemptsMade
    }, 'Job failed');
  });
  
  queue.on('stalled', (job) => {
    logger.warn({ queue: queue.name, jobId: job.id }, 'Job stalled');
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Closing job queues...');
  await Promise.all([
    emailQueue.close(),
    notificationQueue.close(),
    analyticsQueue.close()
  ]);
  logger.info('Job queues closed');
});

module.exports = {
  emailQueue,
  notificationQueue,
  analyticsQueue
};
