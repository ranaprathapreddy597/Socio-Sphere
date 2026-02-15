const express = require('express');
const router = express.Router();
const Trip = require('../models/Trip');
const auth = require('../middleware/auth');
const notificationsRouter = require('./notifications');
const createNotification = notificationsRouter.createNotification;
const axios = require('axios');
const mongoose = require('mongoose');

function buildDestination(destination = {}) {
  if (!destination) return {};
  return {
    city: destination.city,
    country: destination.country,
    coordinates: destination.coordinates
  };
}

router.post('/', auth, async (req, res) => {
  try {
    const {
      title,
      description,
      destination,
      startDate,
      endDate,
      visibility,
      maxParticipants,
      travelStyle,
      interests,
      coverImage,
      contactPhone
    } = req.body;

    if (!title || !destination) {
      return res.status(400).json({ message: 'Title and destination are required' });
    }

    // Auto-geocode destination coordinates if not provided
    let tripDestination = buildDestination(destination);
    if (tripDestination.city && !tripDestination.coordinates?.lat) {
      try {
        const q = `${tripDestination.city}, ${tripDestination.country || ''}`.trim();
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`;
        const resp = await axios.get(url, { headers: { 'User-Agent': 'SocioSphere/1.0' }, timeout: 5000 });
        if (Array.isArray(resp.data) && resp.data[0]) {
          const lat = Number(resp.data[0].lat);
          const lng = Number(resp.data[0].lon);
          if (!isNaN(lat) && !isNaN(lng)) {
            tripDestination.coordinates = { lat, lng };
          }
        }
      } catch (e) {
        console.warn('Auto-geocoding failed during trip creation:', e.message);
      }
    }

    const trip = await Trip.create({
      host: req.user._id,
      title: title.trim(),
      description,
      destination: tripDestination,
      startDate,
      endDate,
      visibility: visibility || 'public',
      maxParticipants: maxParticipants || 8,
      travelStyle: travelStyle || req.user.travelPreferences?.travelStyle || 'flexible',
      interests,
      coverImage,
      contactPhone: contactPhone?.trim(),
      participants: [{
        user: req.user._id,
        status: 'host',
        joinedAt: new Date()
      }]
    });

    await trip.populate('host', 'username fullName profilePicture');
    res.status(201).json(trip);
  } catch (error) {
    res.status(500).json({ message: 'Unable to create trip', error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const now = new Date();
    const windowStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const memberFilter = req.user ? [{ host: req.user._id }, { 'participants.user': req.user._id }] : [];
    const trips = await Trip.find({
      status: { $in: ['open', 'in-progress'] },
      $and: [
        {
          $or: [
            { visibility: 'public' },
            ...memberFilter
          ]
        },
        {
          $or: [
            { startDate: { $gte: windowStart } },
            { startDate: null },
            { startDate: { $exists: false } }
          ]
        }
      ]
    })
      .populate('host', 'username fullName profilePicture')
      .populate('participants.user', 'username fullName profilePicture')
      .sort({ startDate: 1 })
      .limit(50);

    res.json(trips);
  } catch (error) {
    res.status(500).json({ message: 'Unable to fetch trips', error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id).populate('host', 'username fullName').populate('participants.user', 'username fullName');
    if (!trip) return res.status(404).json({ message: 'Trip not found' });
    trip.expenses = undefined;
    res.json(trip);
  } catch (error) {
    res.status(500).json({ message: 'Unable to load trip', error: error.message });
  }
});

router.get('/mine', auth, async (req, res) => {
  try {
    const trips = await Trip.find({
      $or: [
        { host: req.user._id },
        { 'participants.user': req.user._id }
      ]
    })
      .populate('host', 'username fullName profilePicture')
      .populate('participants.user', 'username fullName profilePicture')
      .sort({ startDate: 1 });

    res.json(trips);
  } catch (error) {
    res.status(500).json({ message: 'Unable to fetch trips', error: error.message });
  }
});

// Removed duplicate authenticated GET /:id route for clarity

router.post('/:id/join', auth, async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id).populate('host', 'username fullName');
    if (!trip) return res.status(404).json({ message: 'Trip not found' });

    const alreadyParticipant = trip.participants.some((p) => p.user.toString() === req.user._id.toString());
    if (alreadyParticipant) {
      return res.status(400).json({ message: 'Already part of this trip' });
    }

    const confirmedCount = trip.participants.filter((p) => ['host', 'confirmed'].includes(p.status)).length;
    if (confirmedCount >= trip.maxParticipants) {
      trip.participants.push({
        user: req.user._id,
        status: 'waitlisted',
        joinedAt: new Date()
      });
    } else {
      trip.participants.push({
        user: req.user._id,
        status: trip.visibility === 'invite-only' ? 'pending' : 'confirmed',
        joinedAt: new Date()
      });
    }

    await trip.save();
    await trip.populate('participants.user', 'username fullName profilePicture');

    await createNotification(
      trip.host._id,
      req.user._id,
      'trip',
      `${req.user.fullName || req.user.username} requested to join ${trip.title}`,
      `/trips/${trip._id}`,
      req.app.get('io')
    );

    res.json(trip);
  } catch (error) {
    res.status(500).json({ message: 'Unable to join trip', error: error.message });
  }
});

router.post('/:id/leave', auth, async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ message: 'Trip not found' });

    if (trip.host.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Hosts cannot leave their own trip' });
    }

    trip.participants = trip.participants.filter((p) => p.user.toString() !== req.user._id.toString());
    await trip.save();

    res.json({ message: 'Left trip successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Unable to leave trip', error: error.message });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ message: 'Trip not found' });

    if (trip.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only host can update trip' });
    }

    // Update allowed fields
    const allowedUpdates = ['title', 'description', 'coverImage', 'destination', 'startDate', 'endDate', 'maxParticipants', 'visibility', 'travelStyle', 'interests', 'contactPhone'];
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        trip[key] = req.body[key];
      }
    });

    await trip.save();
    await trip.populate('host', 'username fullName profilePicture');
    await trip.populate('participants.user', 'username fullName profilePicture');

    res.json(trip);
  } catch (error) {
    res.status(500).json({ message: 'Unable to update trip', error: error.message });
  }
});

router.put('/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['draft', 'open', 'in-progress', 'completed', 'cancelled'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ message: 'Trip not found' });

    if (trip.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only host can update status' });
    }

    trip.status = status;
    await trip.save();

    res.json(trip);
  } catch (error) {
    res.status(500).json({ message: 'Unable to update trip', error: error.message });
  }
});

router.post('/:id/checklist', auth, async (req, res) => {
  try {
    const { label } = req.body;
    if (!label) return res.status(400).json({ message: 'Label is required' });

    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ message: 'Trip not found' });

    const isMember = trip.host.toString() === req.user._id.toString() ||
      trip.participants.some((p) => p.user.toString() === req.user._id.toString());
    if (!isMember) return res.status(403).json({ message: 'Not part of this trip' });

    trip.checklist.push({
      label,
      completed: false,
      owner: req.user._id
    });
    await trip.save();

    res.json(trip);
  } catch (error) {
    res.status(500).json({ message: 'Unable to update checklist', error: error.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ message: 'Trip not found' });
    if (trip.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only host can delete the trip' });
    }
    await trip.deleteOne();
    res.json({ message: 'Trip deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Unable to delete trip', error: error.message });
  }
});

// Add expense to a trip
router.post('/:id/expenses', auth, async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ message: 'Trip not found' });
    const userId = req.user._id.toString();
    const isMember = trip.host.toString() === userId || trip.participants.some(p => p.user && p.user.toString() === userId);
    const isConfirmed = trip.host.toString() === userId || trip.participants.some(p => p.user && p.user.toString() === userId && ['host', 'confirmed'].includes(p.status));
    if (!isMember) return res.status(403).json({ message: 'Not a trip member' });
    if (!isConfirmed) return res.status(403).json({ message: 'Only confirmed participants can add expenses' });
    const { title, amount, currency = 'USD', paidBy, sharedWith = [], note } = req.body || {};
    if (!title || !amount || !paidBy) return res.status(400).json({ message: 'Missing required fields' });
    trip.expenses = trip.expenses || [];
    trip.expenses.push({ title, amount, currency, paidBy, sharedWith, note, createdAt: new Date() });
    await trip.save();
    res.json({ message: 'Expense added', expenses: trip.expenses });
  } catch (error) {
    res.status(500).json({ message: 'Unable to add expense', error: error.message });
  }
});

// Get expenses for a trip (restricted)
router.get('/:id/expenses', auth, async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ message: 'Trip not found' });
    const userId = req.user._id.toString();
    const isConfirmed = trip.host.toString() === userId || trip.participants.some(p => p.user && p.user.toString() === userId && ['host', 'confirmed'].includes(p.status));
    if (!isConfirmed) return res.status(403).json({ message: 'Only confirmed participants can view expenses' });
    res.json({ expenses: trip.expenses || [] });
  } catch (error) {
    res.status(500).json({ message: 'Unable to fetch expenses', error: error.message });
  }
});

// Get settlement for a trip
router.get('/:id/settlement', auth, async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id).populate('participants', 'username fullName');
    if (!trip) return res.status(404).json({ message: 'Trip not found' });
    const balances = new Map();
    const members = [trip.host.toString(), ...trip.participants.map(p => p._id ? p._id.toString() : p.toString())];
    members.forEach(id => balances.set(id, 0));
    (trip.expenses || []).forEach(exp => {
      const payer = exp.paidBy.toString();
      const group = (exp.sharedWith && exp.sharedWith.length) ? exp.sharedWith.map(id => id.toString()) : members;
      const share = Number(exp.amount) / group.length;
      balances.set(payer, (balances.get(payer) || 0) + Number(exp.amount));
      group.forEach(uid => balances.set(uid, (balances.get(uid) || 0) - share));
    });
    const debtors = [];
    const creditors = [];
    balances.forEach((value, id) => {
      if (value < -0.01) debtors.push({ id, amount: -value });
      else if (value > 0.01) creditors.push({ id, amount: value });
    });
    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);
    const transfers = [];
    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      const d = debtors[i];
      const c = creditors[j];
      const amt = Math.min(d.amount, c.amount);
      transfers.push({ from: d.id, to: c.id, amount: Number(amt.toFixed(2)) });
      d.amount -= amt; c.amount -= amt;
      if (d.amount <= 0.01) i++;
      if (c.amount <= 0.01) j++;
    }
    res.json({ transfers, balances: Object.fromEntries(balances) });
  } catch (error) {
    res.status(500).json({ message: 'Unable to compute settlement', error: error.message });
  }
});

// Geocode highlights to coordinates (limited & cached into trip.highlights)
router.post('/:id/geocode-highlights', auth, async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ message: 'Trip not found' });
    const userId = req.user._id.toString();
    const isConfirmed = trip.host.toString() === userId || trip.participants.some(p => p.user && p.user.toString() === userId && ['host', 'confirmed'].includes(p.status));
    if (!isConfirmed) return res.status(403).json({ message: 'Only confirmed participants can geocode highlights' });

    const country = trip.destination?.country || '';

    // Auto-geocode destination if missing
    if (trip.destination && trip.destination.city && (!trip.destination.coordinates || !trip.destination.coordinates.lat)) {
      try {
        const q = `${trip.destination.city}, ${country}`.trim();
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`;
        const resp = await axios.get(url, { headers: { 'User-Agent': 'SocioSphere/1.0' }, timeout: 5000 });
        if (Array.isArray(resp.data) && resp.data[0]) {
          const lat = Number(resp.data[0].lat);
          const lng = Number(resp.data[0].lon);
          if (!isNaN(lat) && !isNaN(lng)) {
            trip.destination.coordinates = { lat, lng };
          }
        }
      } catch (e) { console.error('Dest geocode failed', e.message); }
    }

    const seen = new Set();
    const max = 8;
    let count = 0;

    for (const h of (trip.highlights || [])) {
      if (h.coordinates && typeof h.coordinates.lat === 'number' && typeof h.coordinates.lng === 'number') continue;
      const label = (h.label || '').trim();
      if (!label) continue;
      if (seen.has(label)) continue;
      seen.add(label);
      if (count >= max) break;
      count++;
      try {
        const q = `${label}, ${country}`.trim();
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`;
        const resp = await axios.get(url, {
          headers: {
            'User-Agent': 'SocioSphere/1.0 (+https://sociosphere.app)'
          },
          timeout: 10000
        });
        if (Array.isArray(resp.data) && resp.data[0]) {
          const lat = Number(resp.data[0].lat);
          const lng = Number(resp.data[0].lon);
          if (!isNaN(lat) && !isNaN(lng)) {
            h.coordinates = { lat, lng };
          }
        }
        // Fallback: try details text snippet
        if (!h.coordinates && h.details) {
          const snippet = (h.details.split(/[.,;]/)[0] || '').trim();
          if (snippet) {
            const q2 = `${snippet}, ${country}`.trim();
            const url2 = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q2)}&format=json&limit=1`;
            const resp2 = await axios.get(url2, {
              headers: { 'User-Agent': 'SocioSphere/1.0 (+https://sociosphere.app)' },
              timeout: 10000
            });
            if (Array.isArray(resp2.data) && resp2.data[0]) {
              const lat = Number(resp2.data[0].lat);
              const lng = Number(resp2.data[0].lon);
              if (!isNaN(lat) && !isNaN(lng)) {
                h.coordinates = { lat, lng };
              }
            }
          }
        }
        await new Promise(r => setTimeout(r, 500));
      } catch (e) {
        // ignore failures per item
      }
    }

    await trip.save();
    res.json({ highlights: trip.highlights || [] });
  } catch (error) {
    res.status(500).json({ message: 'Unable to geocode highlights', error: error.message });
  }
});

// Save AI itinerary highlights
router.post('/:id/itinerary', auth, async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ message: 'Trip not found' });
    if (trip.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only host can update itinerary' });
    }
    const { highlights } = req.body || {};
    if (!Array.isArray(highlights) || !highlights.length) return res.status(400).json({ message: 'No highlights provided' });
    trip.highlights = highlights;
    await trip.save();
    res.json({ message: 'Itinerary saved', highlights });
  } catch (error) {
    res.status(500).json({ message: 'Unable to save itinerary', error: error.message });
  }
});

// --- Polls endpoints ---
router.get('/:id/polls', auth, async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ message: 'Trip not found' });
    res.json(trip.polls || []);
  } catch (error) {
    res.status(500).json({ message: 'Unable to fetch polls', error: error.message });
  }
});

router.post('/:id/polls', auth, async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ message: 'Trip not found' });
    
    const isMember = trip.host.toString() === req.user._id.toString() ||
      trip.participants.some((p) => p.user.toString() === req.user._id.toString());
    if (!isMember) return res.status(403).json({ message: 'Not part of this trip' });

    const { question, options } = req.body;
    if (!question || !Array.isArray(options) || options.length < 2) {
      return res.status(400).json({ message: 'Question and at least 2 options required' });
    }

    trip.polls = trip.polls || [];
    const poll = {
      _id: new mongoose.Types.ObjectId(),
      question,
      options: options.map(text => ({ _id: new mongoose.Types.ObjectId(), text, votes: [] })),
      status: 'active',
      createdBy: req.user._id,
      createdAt: new Date()
    };
    trip.polls.push(poll);
    await trip.save();
    res.json(poll);
  } catch (error) {
    res.status(500).json({ message: 'Unable to create poll', error: error.message });
  }
});

router.post('/:id/polls/:pollId/vote', auth, async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ message: 'Trip not found' });
    
    const poll = trip.polls?.find(p => p._id.toString() === req.params.pollId);
    if (!poll) return res.status(404).json({ message: 'Poll not found' });

    const { optionId, clear } = req.body;
    const option = poll.options.find(o => o._id.toString() === optionId);
    if (!option) return res.status(404).json({ message: 'Option not found' });

    if (clear) {
      // Clear vote - remove from all options
      poll.options.forEach(opt => {
        opt.votes = opt.votes.filter(id => id.toString() !== req.user._id.toString());
      });
    } else {
      // First, remove user's vote from all other options in this poll
      poll.options.forEach(opt => {
        opt.votes = opt.votes.filter(id => id.toString() !== req.user._id.toString());
      });

      // Add vote to selected option
      option.votes.push(req.user._id);
    }
    
    await trip.save();
    res.json(poll);
  } catch (error) {
    res.status(500).json({ message: 'Unable to vote', error: error.message });
  }
});

// --- Media/Album endpoints ---
router.get('/:id/media', auth, async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ message: 'Trip not found' });
    res.json(trip.media || []);
  } catch (error) {
    res.status(500).json({ message: 'Unable to fetch media', error: error.message });
  }
});

router.post('/:id/media', auth, async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ message: 'Trip not found' });
    
    const isMember = trip.host.toString() === req.user._id.toString() ||
      trip.participants.some((p) => p.user.toString() === req.user._id.toString());
    if (!isMember) return res.status(403).json({ message: 'Not part of this trip' });

    const { url, type } = req.body;
    if (!url) return res.status(400).json({ message: 'URL is required' });

    trip.media = trip.media || [];
    trip.media.push({
      _id: new mongoose.Types.ObjectId(),
      url,
      type: type || 'image',
      uploadedBy: req.user._id,
      uploadedAt: new Date()
    });
    await trip.save();
    res.json({ message: 'Media uploaded', media: trip.media });
  } catch (error) {
    res.status(500).json({ message: 'Unable to upload media', error: error.message });
  }
});

// --- Chat endpoints ---
router.get('/:id/chat', auth, async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id).populate('chat.sender', 'username fullName profilePicture');
    if (!trip) return res.status(404).json({ message: 'Trip not found' });
    res.json(trip.chat || []);
  } catch (error) {
    res.status(500).json({ message: 'Unable to fetch chat', error: error.message });
  }
});

router.post('/:id/chat', auth, async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ message: 'Trip not found' });
    
    const isMember = trip.host.toString() === req.user._id.toString() ||
      trip.participants.some((p) => p.user.toString() === req.user._id.toString());
    if (!isMember) return res.status(403).json({ message: 'Not part of this trip' });

    const { content } = req.body;
    if (!content) return res.status(400).json({ message: 'Message content required' });

    trip.chat = trip.chat || [];
    const message = {
      _id: new mongoose.Types.ObjectId(),
      sender: req.user._id,
      content,
      createdAt: new Date()
    };
    trip.chat.push(message);
    await trip.save();
    
    // Populate sender info
    await trip.populate('chat.sender', 'username fullName profilePicture');
    res.json(message);
  } catch (error) {
    res.status(500).json({ message: 'Unable to send message', error: error.message });
  }
});

module.exports = router;
