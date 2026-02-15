const express = require('express');
const router = express.Router();
const { getEmailStatus } = require('../utils/emailService');
const { getStatus: getQueueStatus } = require('../utils/messageQueue');
const axios = require('axios');

router.get('/status', (req, res) => {
  const llmAvailable = Boolean(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY);
  res.json({
    email: getEmailStatus(),
    queue: getQueueStatus(),
    llm: {
      provider: (process.env.LLM_PROVIDER || (process.env.OPENAI_API_KEY ? 'openai' : 'anthropic')).toLowerCase(),
      available: llmAvailable
    }
  });
});

module.exports = router;
router.get('/ice', async (req, res) => {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    console.warn('⚠️ Twilio credentials not configured in environment variables');
    return res.status(400).json({ message: 'Twilio credentials not configured' });
  }
  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Tokens.json`;
    console.log('🔄 Fetching fresh TURN credentials from Twilio API...');
    const resp = await axios.post(url, null, {
      auth: {
        username: process.env.TWILIO_ACCOUNT_SID,
        password: process.env.TWILIO_AUTH_TOKEN
      }
    });
    const servers = resp?.data?.ice_servers || [];
    console.log('✅ Retrieved', servers.length, 'ICE servers from Twilio');
    res.json({ iceServers: servers });
  } catch (err) {
    console.error('❌ Failed to fetch ICE servers from Twilio:', err?.response?.data || err.message);
    res.status(500).json({ message: 'Failed to fetch ICE servers', error: err?.response?.data || err.message });
  }
});

