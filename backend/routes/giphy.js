const express = require('express');
const axios = require('axios');
const router = express.Router();

// Server-side proxy for Giphy to avoid exposing API key in the client
// If GIPHY_API_KEY is not set or Giphy is unreachable, return a small
// fallback JSON payload so the frontend can still show GIF options.
const GIPHY_KEY = process.env.GIPHY_API_KEY || '';
const GIPHY_BASE = 'https://api.giphy.com/v1/gifs';

const FALLBACK_GIFS = [
  'https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif',
  'https://media.giphy.com/media/l0HlNQ03J5JxX6lva/giphy.gif',
  'https://media.giphy.com/media/ICOgUNjpvO0PC/giphy.gif',
  'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif',
  'https://media.giphy.com/media/xT0xeJpnrWC4XWblEk/giphy.gif'
];

function buildFallbackResponse(filter) {
  const list = filter && filter.length
    ? FALLBACK_GIFS.filter(u => u.toLowerCase().includes(filter.toLowerCase()))
    : FALLBACK_GIFS;
  const data = list.map(u => ({
    type: 'gif',
    id: u,
    url: u,
    title: 'Fallback gif',
    images: {
      original: { url: u },
      fixed_height: { url: u },
      fixed_height_small: { url: u },
      downsized: { url: u }
    }
  }));
  return { data };
}

router.get('/trending', async (req, res) => {
  if (!GIPHY_KEY) {
    // Graceful fallback instead of 503 so frontend UX remains functional.
    return res.json(buildFallbackResponse());
  }
  try {
    const r = await axios.get(`${GIPHY_BASE}/trending`, {
      params: { api_key: GIPHY_KEY, limit: 20 }
    });
    return res.json({ data: r.data.data });
  } catch (e) {
    console.error('Giphy proxy error (trending):', e && e.message ? e.message : e);
    return res.json(buildFallbackResponse());
  }
});

router.get('/search', async (req, res) => {
  const q = req.query.q || '';
  if (!GIPHY_KEY) {
    return res.json(buildFallbackResponse(q));
  }
  if (!q) return res.status(400).json({ message: 'Query required' });
  try {
    const r = await axios.get(`${GIPHY_BASE}/search`, {
      params: { api_key: GIPHY_KEY, q, limit: 20 }
    });
    return res.json({ data: r.data.data });
  } catch (e) {
    console.error('Giphy proxy error (search):', e && e.message ? e.message : e);
    return res.json(buildFallbackResponse(q));
  }
});

module.exports = router;
