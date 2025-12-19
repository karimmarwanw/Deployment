const mongoose = require('mongoose');

const favoriteCommunitySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  community: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Community',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Ensure one favorite community entry per user per community
favoriteCommunitySchema.index({ user: 1, community: 1 }, { unique: true });

module.exports = mongoose.model('FavoriteCommunity', favoriteCommunitySchema);

