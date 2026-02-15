const express = require('express');
const router = express.Router();
const Trip = require('../models/Trip');
const Post = require('../models/Post');
const User = require('../models/User');

// Utility: shuffle array (Fisher-Yates)
function shuffle(arr = []) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// GET /api/explore/foryou
// Returns a mixed feed: trips + posts + creators
router.get('/foryou', async (req, res) => {
  try {
    // Trending trips: by participant count, then recency
    const trips = await Trip.aggregate([
      { $addFields: { participantsCount: { $size: { $ifNull: ['$participants', []] } } } },
      { $sort: { participantsCount: -1, startDate: -1, createdAt: -1 } },
      { $limit: 5 },
      {
        $project: {
          _id: 1,
          title: 1,
          destination: 1,
          coverImage: 1,
          estimatedCost: 1,
          participants: 1,
          maxParticipants: 1,
          startDate: 1,
          endDate: 1,
          host: 1,
          type: { $literal: 'trip' }
        }
      }
    ]);

    // Popular posts: by engagement (likes + comments)
    const posts = await Post.aggregate([
      {
        $addFields: {
          engagementScore: {
            $add: [
              { $size: { $ifNull: ['$likes', []] } },
              { $size: { $ifNull: ['$comments', []] } }
            ]
          }
        }
      },
      { $sort: { engagementScore: -1, createdAt: -1 } },
      { $limit: 5 },
      {
        $project: {
          _id: 1,
          content: 1,
          mediaUrl: 1,
          image: 1,
          author: 1,
          likes: 1,
          comments: 1,
          createdAt: 1,
          type: { $literal: 'post' }
        }
      }
    ]);

    // Recommended creators: by follower count, then recent activity
    const creators = await User.aggregate([
      {
        $addFields: {
          followersCount: { $size: { $ifNull: ['$followers', []] } }
        }
      },
      { $sort: { followersCount: -1, lastActiveAt: -1 } },
      { $limit: 5 },
      {
        $project: {
          _id: 1,
          username: 1,
          fullName: 1,
          profilePicture: 1,
          location: 1,
          followers: 1,
          badges: 1,
          type: { $literal: 'creator' }
        }
      }
    ]);

    const mixed = shuffle([...(trips || []), ...(posts || []), ...(creators || [])]);
    res.json({ items: mixed });
  } catch (err) {
    console.error('Explore foryou error:', err);
    res.status(500).json({ message: 'Failed to load explore feed' });
  }
});

// GET /api/explore/nearby?neLat&neLng&swLat&swLng
// Returns items within bounding box (trips + creators)
router.get('/nearby', async (req, res) => {
  try {
    const { neLat, neLng, swLat, swLng } = req.query;
    const bounds = [neLat, neLng, swLat, swLng].map(Number);
    if (bounds.some(v => Number.isNaN(v))) {
      return res.status(400).json({ message: 'Bounds required: neLat, neLng, swLat, swLng' });
    }

    const [neLatNum, neLngNum, swLatNum, swLngNum] = bounds;

    const tripQuery = {
      'destination.coordinates.lat': { $gte: swLatNum, $lte: neLatNum },
      'destination.coordinates.lng': { $gte: swLngNum, $lte: neLngNum }
    };

    const userQuery = {
      'location.coordinates.lat': { $gte: swLatNum, $lte: neLatNum },
      'location.coordinates.lng': { $gte: swLngNum, $lte: neLngNum }
    };

    const [trips, creators] = await Promise.all([
      Trip.find(tripQuery)
        .select('title destination coverImage participants maxParticipants host')
        .limit(50)
        .lean(),
      User.find(userQuery)
        .select('username profilePicture location badges')
        .limit(50)
        .lean()
    ]);

    const tripItems = (trips || []).map(t => ({
      ...t,
      type: 'trip',
      coordinates: t.destination?.coordinates
    }));

    const creatorItems = (creators || []).map(u => ({
      ...u,
      type: 'creator',
      coordinates: u.location?.coordinates
    }));

    res.json({ items: [...tripItems, ...creatorItems] });
  } catch (err) {
    console.error('Explore nearby error:', err);
    res.status(500).json({ message: 'Failed to load nearby content' });
  }
});

module.exports = router;
