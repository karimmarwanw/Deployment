const mongoose = require('mongoose');

const blockingSchema = new mongoose.Schema({
  blocker: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  blocked: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Prevent duplicate block relationships
blockingSchema.index({ blocker: 1, blocked: 1 }, { unique: true });

// Prevent users from blocking themselves
blockingSchema.pre('validate', function(next) {
  if (this.blocker.toString() === this.blocked.toString()) {
    next(new Error('Users cannot block themselves'));
  } else {
    next();
  }
});

module.exports = mongoose.model('Blocking', blockingSchema);

