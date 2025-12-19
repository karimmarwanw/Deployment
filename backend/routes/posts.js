const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Post = require('../models/Post');
const Community = require('../models/Community');
const Comment = require('../models/Comment');
const Vote = require('../models/Vote');
const SavedPost = require('../models/SavedPost');
const HiddenPost = require('../models/HiddenPost');
const Blocking = require('../models/Blocking');
const { body, validationResult } = require('express-validator');
const axios = require('axios');
const { upload, uploadToCloudinary } = require('../utils/cloudinary');
const { createNotification } = require('./notifications');

// Helper function to enrich posts with vote data, saved, and hidden status
const enrichPostsWithVotes = async (posts, userId = null) => {
  const postIds = posts.map(p => p._id.toString());
  
  // Get all votes for these posts
  const votes = await Vote.find({ post: { $in: postIds } });
  
  // Count votes per post
  const voteCounts = {};
  const userVotes = {};
  
  votes.forEach(vote => {
    const postId = vote.post.toString();
    if (!voteCounts[postId]) {
      voteCounts[postId] = { upvotes: 0, downvotes: 0 };
    }
    if (vote.voteType === 'upvote') {
      voteCounts[postId].upvotes++;
    } else {
      voteCounts[postId].downvotes++;
    }
    
    // Track user's vote if userId is provided
    if (userId && vote.user.toString() === userId) {
      userVotes[postId] = vote.voteType;
    }
  });

  // Get saved and hidden status for user
  let savedPosts = [];
  let hiddenPosts = [];
  if (userId) {
    savedPosts = await SavedPost.find({ user: userId, post: { $in: postIds } });
    hiddenPosts = await HiddenPost.find({ user: userId, post: { $in: postIds } });
  }
  
  const savedPostIds = new Set(savedPosts.map(sp => sp.post.toString()));
  const hiddenPostIds = new Set(hiddenPosts.map(hp => hp.post.toString()));
  
  // Enrich posts with vote data, saved, and hidden status
  return posts.map(post => {
    const postId = post._id.toString();
    const counts = voteCounts[postId] || { upvotes: 0, downvotes: 0 };
    const score = counts.upvotes - counts.downvotes;
    
    const postObj = post.toObject ? post.toObject() : post;
    return {
      ...postObj,
      upvotes: [],
      downvotes: [],
      score,
      upvoteCount: counts.upvotes,
      downvoteCount: counts.downvotes,
      upvoted: userVotes[postId] === 'upvote',
      downvoted: userVotes[postId] === 'downvote',
      saved: savedPostIds.has(postId),
      hidden: hiddenPostIds.has(postId)
    };
  });
};

// @route   POST /api/posts
// @desc    Create a new post
// @access  Private
router.post('/', auth, upload.single('image'), [
  body('title').trim().isLength({ min: 1, max: 300 }).withMessage('Title is required and must be less than 300 characters'),
  body('content').optional().isLength({ max: 40000 }).withMessage('Content must be less than 40000 characters'),
  body('community').notEmpty().withMessage('Community is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, content, community } = req.body;
    let imageUrl = '';
    let imagePublicId = '';

    // Check if community exists
    const communityDoc = await Community.findById(community);
    if (!communityDoc) {
      return res.status(404).json({ message: 'Community not found' });
    }

    // Upload image to Cloudinary if provided
    if (req.file) {
      try {
        const result = await uploadToCloudinary(req.file.buffer);
        imageUrl = result.secure_url;
        imagePublicId = result.public_id;
      } catch (uploadError) {
        console.error('Cloudinary upload error:', uploadError);
        return res.status(500).json({ message: 'Failed to upload image. Please try again.' });
      }
    }

    // Create post
    const post = new Post({
      title,
      content: content || '',
      author: req.user.userId,
      community,
      imageUrl,
      imagePublicId
    });

    await post.save();
    await post.populate('author', 'username');
    await post.populate('community', 'name displayName');

    // Create notifications for community members
    const io = req.app.get('io');
    if (io && communityDoc.members && communityDoc.members.length > 0) {
      const Notification = require('../models/Notification');
      for (const memberId of communityDoc.members) {
        if (memberId.toString() !== req.user.userId) {
          await createNotification(
            memberId,
            'new_post',
            post._id,
            'Post',
            req.user.userId,
            { communityName: communityDoc.name, postTitle: title },
            io
          );
          
          const count = await Notification.countDocuments({ user: memberId, read: false });
          io.to(`user:${memberId}`).emit('notification_count', { count });
        }
      }
    }

    res.status(201).json(post);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/posts
// @desc    Get posts (feed or by community or by author)
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { community, author, sort = 'new', filterByInterests } = req.query;
    let query = {};
    
    if (community) {
      const communityDoc = await Community.findOne({ name: community.toLowerCase() });
      if (!communityDoc) {
        return res.status(404).json({ message: 'Community not found' });
      }
      query.community = communityDoc._id;
    }
    
    if (author) {
      query.author = author;
    }

    // Get userId from token if available
    let userId = null;
    let userInterests = [];
    if (req.headers.authorization) {
      try {
        const token = req.headers.authorization.split(' ')[1];
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.userId;
        
        // If filtering by interests, get user's interests
        if (filterByInterests === 'true' && userId) {
          const User = require('../models/User');
          const user = await User.findById(userId).select('interests');
          if (user && user.interests && user.interests.length > 0) {
            userInterests = user.interests;
          }
        }
      } catch (e) {
        // Invalid token, continue without userId
      }
    }

    // Filter by user interests if requested and user has interests
    if (filterByInterests === 'true' && userInterests.length > 0) {
      // Find communities that have matching topics
      const matchingCommunities = await Community.find({
        topics: { $in: userInterests }
      }).select('_id');
      
      const communityIds = matchingCommunities.map(c => c._id);
      
      // Only show posts from communities matching user interests
      if (communityIds.length > 0) {
        query.community = { $in: communityIds };
      } else {
        // No matching communities, return empty array
        res.json([]);
        return;
      }
    }

    let sortOption = {};
    if (sort === 'hot' || sort === 'top') {
      sortOption = { score: -1, createdAt: -1 };
    } else {
      sortOption = { createdAt: -1 };
    }

    let posts = await Post.find(query)
      .populate('author', 'username karma')
      .populate('community', 'name displayName')
      .sort(sortOption)
      .limit(50);

    // Filter out posts from blocked users if user is authenticated
    if (userId) {
      const blockingRelations = await Blocking.find({
        $or: [
          { blocker: userId },
          { blocked: userId }
        ]
      });
      
      const blockedUserIds = new Set();
      blockingRelations.forEach(block => {
        if (block.blocker.toString() === userId) {
          blockedUserIds.add(block.blocked.toString());
        } else {
          blockedUserIds.add(block.blocker.toString());
        }
      });
      
      // Filter posts by excluding those from blocked users
      posts = posts.filter(post => {
        const authorId = post.author._id.toString();
        return !blockedUserIds.has(authorId);
      });
    }

    // Enrich posts with vote data (this calculates the correct score from votes)
    const enrichedPosts = await enrichPostsWithVotes(posts, userId);
    
    // Update post scores in database to keep them in sync (batch update for efficiency)
    const postIds = posts.map(p => p._id.toString());
    const allVotes = await Vote.find({ post: { $in: postIds } });
    const voteCounts = {};
    
    allVotes.forEach(vote => {
      const postId = vote.post.toString();
      if (!voteCounts[postId]) {
        voteCounts[postId] = { upvotes: 0, downvotes: 0 };
      }
      if (vote.voteType === 'upvote') {
        voteCounts[postId].upvotes++;
      } else {
        voteCounts[postId].downvotes++;
      }
    });
    
    // Update scores in database
    const updatePromises = posts.map(async (post) => {
      const postId = post._id.toString();
      const counts = voteCounts[postId] || { upvotes: 0, downvotes: 0 };
      const calculatedScore = counts.upvotes - counts.downvotes;
      if (post.score !== calculatedScore) {
        await Post.findByIdAndUpdate(post._id, { score: calculatedScore });
      }
    });
    await Promise.all(updatePromises);
    
    res.json(enrichedPosts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/posts/:id/votes
// @desc    Get voters for a post (post author only)
// @access  Private
router.get('/:id/votes', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).select('author');
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (post.author.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized to view voters' });
    }

    const votes = await Vote.find({ post: req.params.id })
      .populate('user', 'username avatar')
      .sort({ createdAt: -1 });

    const upvotes = [];
    const downvotes = [];
    votes.forEach(vote => {
      const entry = {
        _id: vote.user?._id,
        username: vote.user?.username,
        avatar: vote.user?.avatar,
        voteType: vote.voteType,
        createdAt: vote.createdAt
      };
      if (vote.voteType === 'upvote') {
        upvotes.push(entry);
      } else {
        downvotes.push(entry);
      }
    });

    res.json({
      upvotes,
      downvotes
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/posts/:id
// @desc    Get a single post
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('author', 'username karma')
      .populate('community', 'name displayName');

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

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

    const enrichedPosts = await enrichPostsWithVotes([post], userId);
    res.json(enrichedPosts[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/posts/:id/upvote
// @desc    Upvote a post
// @access  Private
router.post('/:id/upvote', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const userId = req.user.userId;

    // Find existing vote
    let vote = await Vote.findOne({ user: userId, post: post._id });
    let isNewVote = false;

    if (vote) {
      if (vote.voteType === 'upvote') {
        // Remove upvote (toggle off)
        await Vote.findByIdAndDelete(vote._id);
      } else {
        // Change from downvote to upvote
        vote.voteType = 'upvote';
        await vote.save();
        isNewVote = true;
      }
    } else {
      // Create new upvote
      vote = new Vote({
        user: userId,
        post: post._id,
        voteType: 'upvote'
      });
      await vote.save();
      isNewVote = true;
    }

    // Update post score based on votes
    const allVotes = await Vote.find({ post: post._id });
    const upvoteCount = allVotes.filter(v => v.voteType === 'upvote').length;
    const downvoteCount = allVotes.filter(v => v.voteType === 'downvote').length;
    post.score = upvoteCount - downvoteCount;
    await post.save();

    // Get updated post with vote data
    const updatedPost = await Post.findById(post._id)
      .populate('author', 'username karma')
      .populate('community', 'name displayName');
    
    const enrichedPosts = await enrichPostsWithVotes([updatedPost], userId);
    
    // Create notification for post author (if not the voter and it's a new vote)
    const io = req.app.get('io');
    if (isNewVote && post.author.toString() !== userId) {
      await createNotification(
        post.author,
        'vote',
        post._id,
        'Post',
        userId,
        { voteType: 'upvote', postTitle: post.title },
        io
      );
      
      if (io) {
        const Notification = require('../models/Notification');
        const count = await Notification.countDocuments({ user: post.author, read: false });
        io.to(`user:${post.author}`).emit('notification_count', { count });
      }
    }
    
    res.json(enrichedPosts[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/posts/:id/downvote
// @desc    Downvote a post
// @access  Private
router.post('/:id/downvote', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const userId = req.user.userId;

    // Find existing vote
    let vote = await Vote.findOne({ user: userId, post: post._id });
    let isNewVote = false;

    if (vote) {
      if (vote.voteType === 'downvote') {
        // Remove downvote (toggle off)
        await Vote.findByIdAndDelete(vote._id);
      } else {
        // Change from upvote to downvote
        vote.voteType = 'downvote';
        await vote.save();
        isNewVote = true;
      }
    } else {
      // Create new downvote
      vote = new Vote({
        user: userId,
        post: post._id,
        voteType: 'downvote'
      });
      await vote.save();
      isNewVote = true;
    }

    // Update post score based on all votes
    const allVotes = await Vote.find({ post: post._id });
    const upvoteCount = allVotes.filter(v => v.voteType === 'upvote').length;
    const downvoteCount = allVotes.filter(v => v.voteType === 'downvote').length;
    post.score = upvoteCount - downvoteCount;
    await post.save();

    // Get updated post with vote data
    const updatedPost = await Post.findById(post._id)
      .populate('author', 'username karma')
      .populate('community', 'name displayName');
    
    const enrichedPosts = await enrichPostsWithVotes([updatedPost], userId);
    
    // Create notification for post author (if not the voter and it's a new vote)
    const io = req.app.get('io');
    if (isNewVote && post.author.toString() !== userId) {
      await createNotification(
        post.author,
        'vote',
        post._id,
        'Post',
        userId,
        { voteType: 'downvote', postTitle: post.title },
        io
      );
      
      if (io) {
        const Notification = require('../models/Notification');
        const count = await Notification.countDocuments({ user: post.author, read: false });
        io.to(`user:${post.author}`).emit('notification_count', { count });
      }
    }
    
    res.json(enrichedPosts[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/posts/:id/summarize
// @desc    Generate AI summary for a post using Hugging Face Inference API
// @access  Private
router.post('/:id/summarize', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (post.aiSummary) {
      return res.json({ summary: post.aiSummary });
    }

    const content = post.content || post.title;
    if (!content) {
      return res.status(400).json({ message: 'Post has no content to summarize' });
    }

    // Support both HF_TOKEN and HUGGINGFACE_API_TOKEN for flexibility
    const hfToken = process.env.HF_TOKEN || process.env.HUGGINGFACE_API_TOKEN;
    if (!hfToken) {
      return res.status(503).json({
        message: 'AI service not configured. Please add HF_TOKEN or HUGGINGFACE_API_TOKEN to your backend .env file.'
      });
    }

    const inputText = String(content || '').trim().substring(0, 4000);
    if (!inputText) {
      return res.status(400).json({ message: 'Post has no content to summarize' });
    }

    const model = process.env.HF_SUMMARY_MODEL || 'facebook/bart-large-cnn';

    let summaryText = '';

    // Helper to call Hugging Face Router API directly
    const callRouter = async (modelName) => {
      // Correct endpoint format: https://router.huggingface.co/hf-inference/models/{model}
      const apiUrl = `https://router.huggingface.co/hf-inference/models/${modelName}`;
      
      const response = await axios.post(
        apiUrl,
        {
          inputs: inputText,
          // Parameters optimized for 3-5 sentence summaries
          parameters: {
            max_length: 200,  // Allows for 4-5 sentences
            min_length: 80,    // Ensures at least 3 sentences
            do_sample: false,
            num_beams: 4,     // Better quality summaries
            length_penalty: 0.8  // Encourages longer summaries
          }
        },
        {
          headers: {
            Authorization: `Bearer ${hfToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      const data = response.data;

      // Router returns an array with the result
      if (Array.isArray(data) && data.length > 0) {
        const first = data[0];
        return first.summary_text || first.summary || JSON.stringify(first);
      }

      // Fallback for object response
      if (data && typeof data === 'object') {
        return data.summary_text || data.summary || JSON.stringify(data);
      }

      return 'No summary generated.';
    };

    try {
      summaryText = await callRouter(model);
    } catch (primaryErr) {
      console.warn(
        'HF primary model failed, attempting fallback:',
        primaryErr?.response?.data || primaryErr?.message || primaryErr
      );
      try {
        summaryText = await callRouter('facebook/bart-large-cnn');
      } catch (fallbackErr) {
        const status = fallbackErr?.response?.status || primaryErr?.response?.status;
        const msg =
          fallbackErr?.response?.data?.error ||
          fallbackErr?.response?.data?.message ||
          fallbackErr?.message ||
          primaryErr?.response?.data?.error ||
          primaryErr?.response?.data?.message ||
          primaryErr?.message ||
          'Summary failed due to an AI service error.';
        return res.status(status || 502).json({ message: msg });
      }
    }

    const summary = summaryText || 'No summary generated.';

    post.aiSummary = summary.trim();
    await post.save();

    res.json({ summary: post.aiSummary });
  } catch (error) {
    console.error('HF Summary Error:', error?.response?.data || error?.message || error);
    const msg = error?.message || 'Summary failed due to an error.';
    return res.status(500).json({ message: msg });
  }
});

// @route   POST /api/posts/:id/save
// @desc    Save a post
// @access  Private
router.post('/:id/save', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const userId = req.user.userId;

    // Check if already saved
    const existingSave = await SavedPost.findOne({ user: userId, post: post._id });

    if (existingSave) {
      // Remove save
      await SavedPost.findByIdAndDelete(existingSave._id);
      res.json({ saved: false, message: 'Post unsaved' });
    } else {
      // Add save
      const savedPost = new SavedPost({
        user: userId,
        post: post._id
      });
      await savedPost.save();
      res.json({ saved: true, message: 'Post saved' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/posts/:id/hide
// @desc    Hide a post
// @access  Private
router.post('/:id/hide', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const userId = req.user.userId;

    // Check if already hidden
    const existingHide = await HiddenPost.findOne({ user: userId, post: post._id });

    if (existingHide) {
      // Remove hide
      await HiddenPost.findByIdAndDelete(existingHide._id);
      res.json({ hidden: false, message: 'Post unhidden' });
    } else {
      // Add hide
      const hiddenPost = new HiddenPost({
        user: userId,
        post: post._id
      });
      await hiddenPost.save();
      res.json({ hidden: true, message: 'Post hidden' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/posts/:id
// @desc    Update a post (creator only)
// @access  Private
router.put('/:id', auth, [
  body('title').optional().trim().isLength({ min: 1, max: 300 }).withMessage('Title must be between 1 and 300 characters'),
  body('content').optional().isLength({ max: 40000 }).withMessage('Content must be less than 40000 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Check if user is the author
    if (post.author.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized to edit this post' });
    }

    const { title, content } = req.body;
    const updateFields = {};
    if (title !== undefined) updateFields.title = title;
    if (content !== undefined) updateFields.content = content;
    updateFields.updatedAt = new Date();

    const updatedPost = await Post.findByIdAndUpdate(
      req.params.id,
      { $set: updateFields },
      { new: true, runValidators: true }
    )
      .populate('author', 'username karma')
      .populate('community', 'name displayName');

    // Enrich with vote data
    const enrichedPosts = await enrichPostsWithVotes([updatedPost], req.user.userId);
    res.json(enrichedPosts[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/posts/:id
// @desc    Delete a post (creator only)
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Check if user is the author
    if (post.author.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized to delete this post' });
    }

    // Delete all related data
    await Vote.deleteMany({ post: post._id });
    await SavedPost.deleteMany({ post: post._id });
    await HiddenPost.deleteMany({ post: post._id });
    await Comment.deleteMany({ post: post._id });
    await Post.findByIdAndDelete(req.params.id);

    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
