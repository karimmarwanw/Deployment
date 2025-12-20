const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Vote = require('../models/Vote');

const calculateUserKarma = async (userId) => {
  if (!userId) return 0;

  const [posts, comments] = await Promise.all([
    Post.find({ author: userId }).select('_id'),
    Comment.find({ author: userId }).select('_id')
  ]);

  const postIds = posts.map((post) => post._id);
  const commentIds = comments.map((comment) => comment._id);

  if (postIds.length === 0 && commentIds.length === 0) {
    return 0;
  }

  const voteMatch = { $or: [] };

  if (postIds.length > 0) {
    voteMatch.$or.push({ post: { $in: postIds } });
  }

  if (commentIds.length > 0) {
    voteMatch.$or.push({ comment: { $in: commentIds } });
  }

  const [upvoteCount, downvoteCount] = await Promise.all([
    Vote.countDocuments({ ...voteMatch, voteType: 'upvote' }),
    Vote.countDocuments({ ...voteMatch, voteType: 'downvote' })
  ]);

  return upvoteCount - downvoteCount;
};

module.exports = { calculateUserKarma };
