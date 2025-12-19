const mongoose = require('mongoose');

const chatInviteSchema = new mongoose.Schema({
  chat: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat',
    required: true
  },
  fromUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  toUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'cancelled'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  respondedAt: {
    type: Date
  }
});

chatInviteSchema.index({ chat: 1, toUser: 1, status: 1 });
chatInviteSchema.index({ toUser: 1, status: 1 });
chatInviteSchema.index({ fromUser: 1, status: 1 });

module.exports = mongoose.model('ChatInvite', chatInviteSchema);
