const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const Chat = require('../models/Chat');
const ChatInvite = require('../models/ChatInvite');
const ChatMessage = require('../models/ChatMessage');
const User = require('../models/User');
const { createNotification } = require('./notifications');

const resolveUserIds = async (invitees = [], inviteUsernames = []) => {
  const ids = new Set();
  invitees.forEach(id => ids.add(id));

  if (inviteUsernames.length > 0) {
    const users = await User.find({
      username: { $in: inviteUsernames.map(u => new RegExp(`^${u}$`, 'i')) }
    }).select('_id');
    users.forEach(u => ids.add(u._id.toString()));
  }

  return [...ids];
};

// Helper to ensure a user is a member of a chat
const requireMembership = async (chatId, userId) => {
  const chat = await Chat.findById(chatId);
  if (!chat) {
    return { error: 'Chat not found' };
  }
  const isMember = chat.members.some(m => m.toString() === userId);
  if (!isMember) {
    return { error: 'Not a member of this chat' };
  }
  return { chat };
};

// Create a chat with optional invites
router.post(
  '/',
  auth,
  [
    body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Chat name is required (max 100 characters)'),
    body('invitees').optional().isArray().withMessage('Invitees must be an array of user IDs'),
    body('inviteUsernames').optional().isArray().withMessage('Invite usernames must be an array')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, invitees = [], inviteUsernames = [] } = req.body;
      const creatorId = req.user.userId;

      const resolvedInvitees = await resolveUserIds(invitees, inviteUsernames);

      // Create chat with creator as member
      const chat = new Chat({
        name: name.trim(),
        creator: creatorId,
        members: [creatorId]
      });
      await chat.save();

      // Create invites (dedupe and exclude creator)
      const uniqueInvitees = resolvedInvitees.filter(id => id !== creatorId);
      const inviteDocs = uniqueInvitees.map(userId => ({
        chat: chat._id,
        fromUser: creatorId,
        toUser: userId
      }));

      if (inviteDocs.length > 0) {
        await ChatInvite.insertMany(inviteDocs);
      }

      const populated = await Chat.findById(chat._id)
        .populate('creator', 'username')
        .populate('members', 'username');

      // Emit socket event to creator
      const io = req.app.get('io');
      if (io) {
        io.to(`user:${creatorId}`).emit('chat_created', populated);
        
        // Create notifications and emit socket events to invitees
        const Notification = require('../models/Notification');
        for (const userId of uniqueInvitees) {
          await createNotification(
            userId,
            'chat_invite',
            chat._id,
            'Chat',
            creatorId,
            { chatName: populated.name },
            io
          );
          
          io.to(`user:${userId}`).emit('chat_invite_received', {
            chat: populated,
            fromUser: { _id: creatorId, username: req.user.username }
          });
          
          const count = await Notification.countDocuments({ user: userId, read: false });
          io.to(`user:${userId}`).emit('notification_count', { count });
        }
      }

      return res.status(201).json(populated);
    } catch (error) {
      console.error('Create chat error:', error);
      return res.status(500).json({ message: 'Server error' });
    }
  }
);

// Invite more users to an existing chat
router.post(
  '/:id/invite',
  auth,
  [
    body('invitees').optional().isArray().withMessage('Invitees must be an array of user IDs'),
    body('inviteUsernames').optional().isArray().withMessage('Invite usernames must be an array')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { chat, error } = await requireMembership(req.params.id, req.user.userId);
      if (error) {
        return res.status(403).json({ message: error });
      }

      const invitees = req.body.invitees || [];
      const inviteUsernames = req.body.inviteUsernames || [];
      const resolvedInvitees = await resolveUserIds(invitees, inviteUsernames);
      const uniqueInvitees = resolvedInvitees.filter(id => id !== req.user.userId);

      const inviteDocs = uniqueInvitees.map(userId => ({
        chat: chat._id,
        fromUser: req.user.userId,
        toUser: userId
      }));

      if (inviteDocs.length === 0) {
        return res.status(400).json({ message: 'No valid invitees provided' });
      }

      await ChatInvite.insertMany(inviteDocs);
      
      // Emit socket events to invitees
      const io = req.app.get('io');
      if (io) {
        const populatedChat = await Chat.findById(chat._id)
          .populate('creator', 'username')
          .populate('members', 'username');
        
        const Notification = require('../models/Notification');
        for (const userId of uniqueInvitees) {
          await createNotification(
            userId,
            'chat_invite',
            chat._id,
            'Chat',
            req.user.userId,
            { chatName: populatedChat.name },
            io
          );
          
          io.to(`user:${userId}`).emit('chat_invite_received', {
            chat: populatedChat,
            fromUser: { _id: req.user.userId, username: req.user.username }
          });
          
          const count = await Notification.countDocuments({ user: userId, read: false });
          io.to(`user:${userId}`).emit('notification_count', { count });
        }
      }
      
      return res.json({ message: 'Invitations sent' });
    } catch (error) {
      console.error('Invite error:', error);
      return res.status(500).json({ message: 'Server error' });
    }
  }
);

// List chats the user belongs to
router.get('/my', auth, async (req, res) => {
  try {
    const chats = await Chat.find({ members: req.user.userId })
      .sort({ updatedAt: -1 })
      .populate('creator', 'username')
      .populate('members', 'username');

    res.json(chats);
  } catch (error) {
    console.error('List chats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// List invites (incoming/outgoing)
router.get('/invites', auth, async (req, res) => {
  try {
    const direction = req.query.direction === 'outgoing' ? 'outgoing' : 'incoming';
    const query =
      direction === 'outgoing'
        ? { fromUser: req.user.userId }
        : { toUser: req.user.userId };

    const invites = await ChatInvite.find(query)
      .sort({ createdAt: -1 })
      .populate('chat', 'name')
      .populate('fromUser', 'username')
      .populate('toUser', 'username');

    res.json(invites);
  } catch (error) {
    console.error('List invites error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Accept invite
router.post('/invites/:id/accept', auth, async (req, res) => {
  try {
    const invite = await ChatInvite.findById(req.params.id);
    if (!invite) {
      return res.status(404).json({ message: 'Invite not found' });
    }
    if (invite.toUser.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized to respond to this invite' });
    }
    if (invite.status !== 'pending') {
      return res.status(400).json({ message: 'Invite already processed' });
    }

    invite.status = 'accepted';
    invite.respondedAt = new Date();
    await invite.save();

    // Add user to chat members
    const updatedChat = await Chat.findByIdAndUpdate(
      invite.chat,
      { $addToSet: { members: req.user.userId } },
      { new: true }
    )
      .populate('creator', 'username')
      .populate('members', 'username');

    // Emit socket events
    const io = req.app.get('io');
    if (io) {
      // Notify all chat members about new member
      io.to(`chat:${invite.chat}`).emit('chat_member_joined', {
        chat: updatedChat,
        newMember: { _id: req.user.userId, username: req.user.username }
      });
      
      // Notify the user who accepted
      io.to(`user:${req.user.userId}`).emit('chat_invite_accepted', {
        chat: updatedChat
      });
      
      // Notify the inviter
      io.to(`user:${invite.fromUser}`).emit('chat_invite_accepted_by_user', {
        chat: updatedChat,
        acceptedBy: { _id: req.user.userId, username: req.user.username }
      });
    }

    res.json({ message: 'Invite accepted', chat: updatedChat });
  } catch (error) {
    console.error('Accept invite error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Reject invite
router.post('/invites/:id/reject', auth, async (req, res) => {
  try {
    const invite = await ChatInvite.findById(req.params.id);
    if (!invite) {
      return res.status(404).json({ message: 'Invite not found' });
    }
    if (invite.toUser.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized to respond to this invite' });
    }
    if (invite.status !== 'pending') {
      return res.status(400).json({ message: 'Invite already processed' });
    }

    invite.status = 'rejected';
    invite.respondedAt = new Date();
    await invite.save();

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${req.user.userId}`).emit('chat_invite_rejected', {
        inviteId: invite._id,
        chatId: invite.chat
      });
      
      // Notify the inviter
      io.to(`user:${invite.fromUser}`).emit('chat_invite_rejected_by_user', {
        chatId: invite.chat,
        rejectedBy: { _id: req.user.userId, username: req.user.username }
      });
    }

    res.json({ message: 'Invite rejected' });
  } catch (error) {
    console.error('Reject invite error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Send a message in a chat
router.post(
  '/:id/messages',
  auth,
  [
    body('content').trim().isLength({ min: 1, max: 5000 }).withMessage('Message content is required'),
    body('replyTo').optional().isMongoId().withMessage('ReplyTo must be a valid message ID')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { chat, error } = await requireMembership(req.params.id, req.user.userId);
      if (error) {
        return res.status(403).json({ message: error });
      }

      // If replying to a message, verify it exists and is in the same chat
      if (req.body.replyTo) {
        const replyToMessage = await ChatMessage.findById(req.body.replyTo);
        if (!replyToMessage) {
          return res.status(404).json({ message: 'Message to reply to not found' });
        }
        if (replyToMessage.chat.toString() !== chat._id.toString()) {
          return res.status(400).json({ message: 'Cannot reply to message from different chat' });
        }
      }

      const message = new ChatMessage({
        chat: chat._id,
        sender: req.user.userId,
        content: req.body.content.trim(),
        replyTo: req.body.replyTo || null
      });
      await message.save();

      // Update chat timestamp for sorting
      await Chat.findByIdAndUpdate(chat._id, { updatedAt: new Date() });

      const populated = await ChatMessage.findById(message._id)
        .populate('sender', 'username')
        .populate('replyTo', 'content sender createdAt')
        .populate({
          path: 'replyTo',
          populate: { path: 'sender', select: 'username' }
        });

      // Emit socket event (though socket handler also does this, this ensures consistency)
      // The socket handler will handle real-time messages, but REST endpoint can still be used
      const io = req.app.get('io');
      if (io) {
        io.to(`chat:${chat._id}`).emit('new_message', populated);
      }

      res.status(201).json(populated);
    } catch (error) {
      console.error('Send message error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Get messages for a chat
router.get('/:id/messages', auth, async (req, res) => {
  try {
    const { chat, error } = await requireMembership(req.params.id, req.user.userId);
    if (error) {
      return res.status(403).json({ message: error });
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);

    const messages = await ChatMessage.find({ chat: chat._id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('sender', 'username')
      .populate('replyTo', 'content sender createdAt')
      .populate({
        path: 'replyTo',
        populate: { path: 'sender', select: 'username' }
      });

    // Return oldest first for UI convenience
    res.json(messages.reverse());
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Leave a chat
router.post('/:id/leave', auth, async (req, res) => {
  try {
    const { chat, error } = await requireMembership(req.params.id, req.user.userId);
    if (error) {
      return res.status(403).json({ message: error });
    }

    // Check if user is the creator (optional: prevent creator from leaving, or allow it)
    // For now, we'll allow anyone to leave, including the creator

    // Remove user from chat members
    const updatedChat = await Chat.findByIdAndUpdate(
      chat._id,
      { $pull: { members: req.user.userId } },
      { new: true }
    )
      .populate('creator', 'username')
      .populate('members', 'username');

    // Emit socket events
    const io = req.app.get('io');
    if (io) {
      // Notify all remaining chat members about the user leaving
      io.to(`chat:${chat._id}`).emit('chat_member_left', {
        chat: updatedChat,
        leftMember: { _id: req.user.userId, username: req.user.username }
      });
      
      // Notify the user who left
      io.to(`user:${req.user.userId}`).emit('chat_left', {
        chatId: chat._id
      });
    }

    res.json({ message: 'Left chat successfully', chat: updatedChat });
  } catch (error) {
    console.error('Leave chat error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
