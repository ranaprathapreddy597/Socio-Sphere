const amqp = require('amqplib');

// Lightweight RabbitMQ wrapper with lazy connection and reconnection
let connection = null;
let channel = null;
let lastError = null;

async function connect() {
  if (connection && channel) return { connection, channel };
  const url = process.env.RABBITMQ_URL || 'amqp://localhost';
  try {
    connection = await amqp.connect(url);
    channel = await connection.createChannel();
    connection.on('error', (err) => {
      lastError = err;
      console.error('RabbitMQ connection error:', err.message);
      connection = null;
      channel = null;
    });
    connection.on('close', () => {
      connection = null;
      channel = null;
    });
    return { connection, channel };
  } catch (err) {
    lastError = err;
    console.error('RabbitMQ connect failed:', err.message);
    throw err;
  }
}

async function publish(queue, message) {
  const { channel } = await connect();
  await channel.assertQueue(queue, { durable: true });
  const payload = Buffer.from(JSON.stringify(message));
  return channel.sendToQueue(queue, payload, { persistent: true });
}

async function consume(queue, handler) {
  const { channel } = await connect();
  await channel.assertQueue(queue, { durable: true });
  await channel.consume(queue, async (msg) => {
    if (!msg) return;
    try {
      const data = JSON.parse(msg.content.toString());
      await handler(data);
      channel.ack(msg);
    } catch (err) {
      console.error('RabbitMQ handler error:', err.message);
      channel.nack(msg, false, false); // drop message on handler error
    }
  }, { noAck: false });
}

function getStatus() {
  return {
    connected: Boolean(connection && channel),
    lastError: lastError ? lastError.message : null,
    url: process.env.RABBITMQ_URL || 'amqp://localhost'
  };
}

module.exports = {
  connect,
  publish,
  consume,
  getStatus
};
