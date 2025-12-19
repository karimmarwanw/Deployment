const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['message', 'chat_invite', 'comment', 'vote', 'follow', 'new_post'],
    required: true
  },
  read: {
    type: Boolean,
    default: false,
    index: true
  },
  // Reference to the related entity (post, comment, chat, etc.)
  relatedId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  // Type of related entity (Post, Comment, Chat, ChatInvite, User, etc.)
  relatedType: {
    type: String,
    required: true
  },
  // User who triggered the notification (commenter, voter, follower, etc.)
  fromUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Additional data for context
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Index for efficient queries
notificationSchema.index({ user: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);

