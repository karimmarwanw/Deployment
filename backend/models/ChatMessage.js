const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  chat: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 5000
  },
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatMessage',
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

chatMessageSchema.index({ chat: 1, createdAt: 1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
