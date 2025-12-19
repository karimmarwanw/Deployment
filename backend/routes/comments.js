const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Comment = require('../models/Comment');
const Post = require('../models/Post');
const Vote = require('../models/Vote');
const Blocking = require('../models/Blocking');
const { body, validationResult } = require('express-validator');
const { createNotification } = require('./notifications');

// Helper function to enrich comments with vote data
const enrichCommentsWithVotes = async (comments, userId = null) => {
  const commentIds = comments.map(c => c._id.toString());
  
  // Get all votes for these comments
  const votes = await Vote.find({ comment: { $in: commentIds } });
  
  // Count votes per comment
  const voteCounts = {};
  const userVotes = {};
  
  votes.forEach(vote => {
    const commentId = vote.comment.toString();
    if (!voteCounts[commentId]) {
      voteCounts[commentId] = { upvotes: 0, downvotes: 0 };
    }
    if (vote.voteType === 'upvote') {
      voteCounts[commentId].upvotes++;
    } else {
      voteCounts[commentId].downvotes++;
    }
    
    // Track user's vote if userId is provided
    if (userId && vote.user.toString() === userId) {
      userVotes[commentId] = vote.voteType;
    }
  });
  
  // Enrich comments with vote data
  return comments.map(comment => {
    const commentId = comment._id.toString();
    const counts = voteCounts[commentId] || { upvotes: 0, downvotes: 0 };
    const score = counts.upvotes - counts.downvotes;
    
    const commentObj = comment.toObject ? comment.toObject() : comment;
    return {
      ...commentObj,
      upvotes: [],
      downvotes: [],
      score,
      upvoteCount: counts.upvotes,
      downvoteCount: counts.downvotes,
      upvoted: userVotes[commentId] === 'upvote',
      downvoted: userVotes[commentId] === 'downvote'
    };
  });
};

// @route   POST /api/comments
// @desc    Create a new comment
// @access  Private
router.post('/', auth, [
  body('content').trim().isLength({ min: 1, max: 10000 }).withMessage('Comment content is required'),
  body('post').notEmpty().withMessage('Post ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { content, post, parentComment } = req.body;

    // Check if post exists
    const postDoc = await Post.findById(post);
    if (!postDoc) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Create comment
    const comment = new Comment({
      content,
      author: req.user.userId,
      post,
      parentComment: parentComment || null
    });

    await comment.save();

    // Update post comment count
    postDoc.commentCount += 1;
    await postDoc.save();

    await comment.populate('author', 'username karma');
    if (parentComment) {
      await comment.populate('parentComment');
    }

    // Create notification for post author (if not the commenter)
    const io = req.app.get('io');
    if (postDoc.author.toString() !== req.user.userId) {
      await createNotification(
        postDoc.author,
        'comment',
        comment._id,
        'Comment',
        req.user.userId,
        { postId: postDoc._id.toString(), postTitle: postDoc.title },
        io
      );
      
      if (io) {
        const Notification = require('../models/Notification');
        const count = await Notification.countDocuments({ user: postDoc.author, read: false });
        io.to(`user:${postDoc.author}`).emit('notification_count', { count });
      }
    }

    res.status(201).json(comment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/comments/post/:postId
// @desc    Get all comments for a post
// @access  Public
router.get('/post/:postId', async (req, res) => {
  try {
    // Get userId from token if available
    let userId = null;
    if (req.headers.authorization) {
      try {
        const token = req.headers.authorization.split(' ')[1];
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.userId;
      } catch (e) {
        // Invalid token, continue without userId
      }
    }

    let blockedUserIds = new Set();
    if (userId) {
      const blockingRelations = await Blocking.find({
        $or: [
          { blocker: userId },
          { blocked: userId }
        ]
      });
      
      blockingRelations.forEach(block => {
        if (block.blocker.toString() === userId) {
          blockedUserIds.add(block.blocked.toString());
        } else {
          blockedUserIds.add(block.blocker.toString());
        }
      });
    }

    let comments = await Comment.find({ post: req.params.postId })
      .populate('author', 'username karma')
      .sort({ score: -1, createdAt: -1 });

    if (blockedUserIds.size > 0) {
      comments = comments.filter(comment => {
        const authorId = comment.author?._id?.toString();
        return authorId && !blockedUserIds.has(authorId);
      });
    }

    const enriched = await enrichCommentsWithVotes(comments, userId);

    const commentMap = new Map();
    enriched.forEach(comment => {
      commentMap.set(comment._id.toString(), { ...comment, replies: [] });
    });

    const getParentId = (comment) => {
      if (!comment.parentComment) return null;
      if (typeof comment.parentComment === 'string') return comment.parentComment;
      if (comment.parentComment._id) return comment.parentComment._id.toString();
      if (comment.parentComment.id) return comment.parentComment.id.toString();
      if (typeof comment.parentComment.toString === 'function') {
        return comment.parentComment.toString();
      }
      return null;
    };

    const roots = [];
    commentMap.forEach(comment => {
      const parentId = getParentId(comment);
      if (parentId && commentMap.has(parentId)) {
        commentMap.get(parentId).replies.push(comment);
      } else if (!parentId) {
        roots.push(comment);
      }
    });

    const sortTree = (nodes) => {
      nodes.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
      nodes.forEach(node => {
        if (node.replies && node.replies.length > 0) {
          sortTree(node.replies);
        }
      });
    };

    sortTree(roots);

    res.json(roots);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/comments/:id/upvote
// @desc    Upvote a comment
// @access  Private
router.post('/:id/upvote', auth, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    const userId = req.user.userId;

    // Find existing vote
    let vote = await Vote.findOne({ user: userId, comment: comment._id });

    if (vote) {
      if (vote.voteType === 'upvote') {
        // Remove upvote (toggle off)
        await Vote.findByIdAndDelete(vote._id);
      } else {
        // Change from downvote to upvote
        vote.voteType = 'upvote';
        await vote.save();
      }
    } else {
      // Create new upvote
      vote = new Vote({
        user: userId,
        comment: comment._id,
        voteType: 'upvote'
      });
      await vote.save();
    }

    // Update comment score based on all votes
    const allVotes = await Vote.find({ comment: comment._id });
    const upvoteCount = allVotes.filter(v => v.voteType === 'upvote').length;
    const downvoteCount = allVotes.filter(v => v.voteType === 'downvote').length;
    comment.score = upvoteCount - downvoteCount;
    await comment.save();

    // Get updated comment with vote data
    const updatedComment = await Comment.findById(comment._id)
      .populate('author', 'username karma');
    
    const enrichedComments = await enrichCommentsWithVotes([updatedComment], userId);
    res.json(enrichedComments[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/comments/:id/downvote
// @desc    Downvote a comment
// @access  Private
router.post('/:id/downvote', auth, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    const userId = req.user.userId;

    // Find existing vote
    let vote = await Vote.findOne({ user: userId, comment: comment._id });

    if (vote) {
      if (vote.voteType === 'downvote') {
        // Remove downvote (toggle off)
        await Vote.findByIdAndDelete(vote._id);
      } else {
        // Change from upvote to downvote
        vote.voteType = 'downvote';
        await vote.save();
      }
    } else {
      // Create new downvote
      vote = new Vote({
        user: userId,
        comment: comment._id,
        voteType: 'downvote'
      });
      await vote.save();
    }

    // Update comment score based on all votes
    const allVotes = await Vote.find({ comment: comment._id });
    const upvoteCount = allVotes.filter(v => v.voteType === 'upvote').length;
    const downvoteCount = allVotes.filter(v => v.voteType === 'downvote').length;
    comment.score = upvoteCount - downvoteCount;
    await comment.save();

    // Get updated comment with vote data
    const updatedComment = await Comment.findById(comment._id)
      .populate('author', 'username karma');
    
    const enrichedComments = await enrichCommentsWithVotes([updatedComment], userId);
    res.json(enrichedComments[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/comments/:id
// @desc    Update a comment (comment author only)
// @access  Private
router.put('/:id', auth, [
  body('content').trim().isLength({ min: 1, max: 10000 }).withMessage('Comment content is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // Check if user is the comment author
    if (comment.author.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized to edit this comment' });
    }

    const { content } = req.body;
    comment.content = content;
    comment.updatedAt = new Date();
    await comment.save();

    await comment.populate('author', 'username karma');
    
    // Enrich with vote data
    const enrichedComments = await enrichCommentsWithVotes([comment], req.user.userId);
    res.json(enrichedComments[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/comments/:id
// @desc    Delete a comment (comment author OR post author)
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id)
      .populate('post', 'author');
    
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    const userId = req.user.userId;
    const isCommentAuthor = comment.author.toString() === userId;
    const isPostAuthor = comment.post && comment.post.author.toString() === userId;

    // Check if user is the comment author OR post author
    if (!isCommentAuthor && !isPostAuthor) {
      return res.status(403).json({ message: 'Not authorized to delete this comment' });
    }

    // Delete all votes for this comment
    await Vote.deleteMany({ comment: comment._id });

    // Delete all replies (nested comments)
    const replies = await Comment.find({ parentComment: comment._id });
    for (const reply of replies) {
      await Vote.deleteMany({ comment: reply._id });
      await Comment.findByIdAndDelete(reply._id);
    }

    // Update post comment count
    const postDoc = await Post.findById(comment.post);
    if (postDoc) {
      postDoc.commentCount = Math.max(0, postDoc.commentCount - 1 - replies.length);
      await postDoc.save();
    }

    // Delete the comment
    await Comment.findByIdAndDelete(comment._id);

    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
