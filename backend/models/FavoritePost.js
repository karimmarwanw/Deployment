const mongoose = require('mongoose');

const favoritePostSchema = new mongoose.Schema({
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

// Ensure one favorite post entry per user per post
favoritePostSchema.index({ user: 1, post: 1 }, { unique: true });

module.exports = mongoose.model('FavoritePost', favoritePostSchema);

