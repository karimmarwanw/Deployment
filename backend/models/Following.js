const mongoose = require('mongoose');

const followingSchema = new mongoose.Schema({
  follower: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  following: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Prevent duplicate follow relationships
followingSchema.index({ follower: 1, following: 1 }, { unique: true });

// Prevent users from following themselves
followingSchema.pre('validate', function(next) {
  if (this.follower.toString() === this.following.toString()) {
    next(new Error('Users cannot follow themselves'));
  } else {
    next();
  }
});

module.exports = mongoose.model('Following', followingSchema);

