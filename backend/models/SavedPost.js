const mongoose = require('mongoose');

const savedPostSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Ensure one saved post entry per user per post
savedPostSchema.index({ user: 1, post: 1 }, { unique: true });

module.exports = mongoose.model('SavedPost', savedPostSchema);

