const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Get all conversations for current user
router.get('/conversations', auth, async (req, res) => {
  try {
    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [
            { sender: req.user._id },
            { receiver: req.user._id }
          ]
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ['$sender', req.user._id] },
              '$receiver',
              '$sender'
            ]
          },
          lastMessage: { $first: '$$ROOT' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      {
        $project: {
          user: {
            _id: 1,
            username: 1,
            fullName: 1,
            profilePicture: 1
          },
          lastMessage: 1
        }
      }
    ]);

    res.json(conversations);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get messages between two users
router.get('/:userId', auth, async (req, res) => {
  try {
    const messages = await Message.find({
      $and: [
        {
          $or: [
            { sender: req.user._id, receiver: req.params.userId },
            { sender: req.params.userId, receiver: req.user._id }
          ]
        },
        { deletedFor: { $ne: req.user._id } }
      ]
    })
    .populate('sender', 'username fullName profilePicture')
    .populate('receiver', 'username fullName profilePicture')
    .sort({ createdAt: 1 });

    // Mark messages as read
    await Message.updateMany(
      { sender: req.params.userId, receiver: req.user._id, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Send message
router.post('/', auth, async (req, res) => {
  try {
    const { receiverId, content, messageType, mediaUrl } = req.body;

    const message = new Message({
      sender: req.user._id,
      receiver: receiverId,
      content,
      messageType: messageType || 'text',
      mediaUrl: mediaUrl || ''
    });

    await message.save();
    await message.populate('sender', 'username fullName profilePicture');
    await message.populate('receiver', 'username fullName profilePicture');

    // Emit real-time message via Socket.IO
    const io = req.app.get('io');
    io.to(`user-${receiverId}`).emit('receive-message', message);

    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete entire conversation (MUST come before DELETE /:id to match correctly)
router.delete('/conversation/:userId', auth, async (req, res) => {
  try {
    // Soft-delete conversation for current user (does not remove for the other party)
    const result = await Message.updateMany(
      {
        $or: [
          { sender: req.user._id, receiver: req.params.userId },
          { sender: req.params.userId, receiver: req.user._id }
        ]
      },
      { $addToSet: { deletedFor: req.user._id } }
    );

    res.json({ message: 'Conversation deleted', modifiedCount: result.modifiedCount });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete message
router.delete('/:id', auth, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    const isSender = message.sender.toString() === req.user._id.toString();
    const isReceiver = message.receiver.toString() === req.user._id.toString();

    if (isSender) {
      await message.deleteOne();
      return res.json({ message: 'Message deleted' });
    }

    if (isReceiver) {
      // Soft-delete for receiver only
      await Message.updateOne({ _id: message._id }, { $addToSet: { deletedFor: req.user._id } });
      return res.json({ message: 'Message hidden' });
    }

    return res.status(403).json({ message: 'Not authorized' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get unread message count
router.get('/unread/count', auth, async (req, res) => {
  try {
    const count = await Message.countDocuments({
      receiver: req.user._id,
      isRead: false
    });

    res.json({ count });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
