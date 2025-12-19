const mongoose = require('mongoose');

const voteSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    default: null
  },
  comment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
    default: null
  },
  voteType: {
    type: String,
    enum: ['upvote', 'downvote'],
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Ensure one vote per user per post/comment
// This means: 
// - A user can only upvote OR downvote a single comment (not both)
// - But a user can vote on multiple different comments
// Use separate partial indexes to handle post and comment votes uniquely
// Partial indexes only apply when the condition is met, avoiding conflicts with null values
voteSchema.index(
  { user: 1, post: 1 }, 
  { 
    unique: true, 
    partialFilterExpression: { post: { $ne: null } }
  }
);
voteSchema.index(
  { user: 1, comment: 1 }, 
  { 
    unique: true, 
    partialFilterExpression: { comment: { $ne: null } }
  }
);

// Validate that either post or comment is provided
voteSchema.pre('validate', function(next) {
  if (!this.post && !this.comment) {
    next(new Error('Either post or comment must be provided'));
  } else if (this.post && this.comment) {
    next(new Error('Cannot vote on both post and comment simultaneously'));
  } else {
    next();
  }
});

module.exports = mongoose.model('Vote', voteSchema);

