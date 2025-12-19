const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Vote = require('../models/Vote');
const SavedPost = require('../models/SavedPost');
const FavoritePost = require('../models/FavoritePost');
const FavoriteCommunity = require('../models/FavoriteCommunity');
const HiddenPost = require('../models/HiddenPost');
const Following = require('../models/Following');
const Blocking = require('../models/Blocking');
const optionalAuth = require('../middleware/optionalAuth');
const { body, validationResult } = require('express-validator');
const { upload, uploadToCloudinary } = require('../utils/cloudinary');

// @route   GET /api/users/:id/comments
// @desc    Get all comments by a user
// @access  Public
router.get('/:id/comments', async (req, res) => {
  try {
    const comments = await Comment.find({ author: req.params.id })
      .populate('post', 'title')
      .populate('author', 'username karma')
      .sort({ createdAt: -1 })
      .limit(100);

    res.json(comments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/:id/posts/upvoted
// @desc    Get all posts upvoted by a user
// @access  Public
router.get('/:id/posts/upvoted', async (req, res) => {
  try {
    const votes = await Vote.find({ 
      user: req.params.id, 
      voteType: 'upvote',
      post: { $ne: null }
    }).select('post');
    
    const postIds = votes.map(v => v.post).filter(Boolean);
    const posts = await Post.find({ _id: { $in: postIds } })
      .populate('author', 'username karma')
      .populate('community', 'name displayName')
      .sort({ createdAt: -1 })
      .limit(100);

    res.json(posts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/:id/posts/downvoted
// @desc    Get all posts downvoted by a user
// @access  Public
router.get('/:id/posts/downvoted', async (req, res) => {
  try {
    const votes = await Vote.find({ 
      user: req.params.id, 
      voteType: 'downvote',
      post: { $ne: null }
    }).select('post');
    
    const postIds = votes.map(v => v.post).filter(Boolean);
    const posts = await Post.find({ _id: { $in: postIds } })
      .populate('author', 'username karma')
      .populate('community', 'name displayName')
      .sort({ createdAt: -1 })
      .limit(100);

    res.json(posts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/:id/posts/saved
// @desc    Get all saved posts by a user
// @access  Public
router.get('/:id/posts/saved', async (req, res) => {
  try {
    const savedPosts = await SavedPost.find({ user: req.params.id })
      .select('post')
      .sort({ createdAt: -1 })
      .limit(100);
    
    const postIds = savedPosts.map(sp => sp.post).filter(Boolean);
    const posts = await Post.find({ _id: { $in: postIds } })
      .populate('author', 'username karma')
      .populate('community', 'name displayName')
      .sort({ createdAt: -1 });

    res.json(posts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/:id/posts/favorites
// @desc    Get all favorite posts by a user
// @access  Public
router.get('/:id/posts/favorites', async (req, res) => {
  try {
    const favoritePosts = await FavoritePost.find({ user: req.params.id })
      .select('post')
      .sort({ createdAt: -1 })
      .limit(100);
    
    const postIds = favoritePosts.map(fp => fp.post).filter(Boolean);
    const posts = await Post.find({ _id: { $in: postIds } })
      .populate('author', 'username karma')
      .populate('community', 'name displayName')
      .sort({ createdAt: -1 });

    res.json(posts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/:id/communities/favorites
// @desc    Get all favorite communities by a user
// @access  Public
router.get('/:id/communities/favorites', async (req, res) => {
  try {
    const favoriteCommunities = await FavoriteCommunity.find({ user: req.params.id })
      .populate('community', 'name displayName description memberCount')
      .sort({ createdAt: -1 });
    
    const communities = favoriteCommunities.map(fc => fc.community).filter(Boolean);
    res.json(communities);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/:id/posts/hidden
// @desc    Get all hidden posts by a user
// @access  Public
router.get('/:id/posts/hidden', async (req, res) => {
  try {
    const hiddenPosts = await HiddenPost.find({ user: req.params.id })
      .select('post')
      .sort({ createdAt: -1 })
      .limit(100);
    
    const postIds = hiddenPosts.map(hp => hp.post).filter(Boolean);
    const posts = await Post.find({ _id: { $in: postIds } })
      .populate('author', 'username karma')
      .populate('community', 'name displayName')
      .sort({ createdAt: -1 });

    res.json(posts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/users/:id/follow
// @desc    Follow a user
// @access  Private
router.post('/:id/follow', auth, async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const currentUserId = req.user.userId;

    if (targetUserId === currentUserId) {
      return res.status(400).json({ message: 'Cannot follow yourself' });
    }

    // Check if user exists
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if already following
    const existingFollow = await Following.findOne({
      follower: currentUserId,
      following: targetUserId
    });

    if (existingFollow) {
      return res.status(400).json({ message: 'Already following this user' });
    }

    // Check if blocked (either direction)
    const blocked = await Blocking.findOne({
      $or: [
        { blocker: currentUserId, blocked: targetUserId },
        { blocker: targetUserId, blocked: currentUserId }
      ]
    });

    if (blocked) {
      return res.status(400).json({ message: 'Cannot follow - user is blocked' });
    }

    // Create follow relationship
    const following = new Following({
      follower: currentUserId,
      following: targetUserId
    });

    await following.save();
    
    // Create notification for the followed user
    const io = req.app.get('io');
    await createNotification(
      targetUserId,
      'follow',
      targetUserId,
      'User',
      currentUserId,
      {},
      io
    );
    
    // Emit notification count update
    if (io) {
      const Notification = require('../models/Notification');
      const count = await Notification.countDocuments({ user: targetUserId, read: false });
      io.to(`user:${targetUserId}`).emit('notification_count', { count });
    }
    
    res.json({ message: 'User followed successfully', following: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/users/:id/unfollow
// @desc    Unfollow a user
// @access  Private
router.post('/:id/unfollow', auth, async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const currentUserId = req.user.userId;

    const following = await Following.findOneAndDelete({
      follower: currentUserId,
      following: targetUserId
    });

    if (!following) {
      return res.status(404).json({ message: 'Not following this user' });
    }

    res.json({ message: 'User unfollowed successfully', following: false });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/users/:id/block
// @desc    Block a user
// @access  Private
router.post('/:id/block', auth, async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const currentUserId = req.user.userId;

    if (targetUserId === currentUserId) {
      return res.status(400).json({ message: 'Cannot block yourself' });
    }

    // Check if user exists
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if already blocked
    const existingBlock = await Blocking.findOne({
      blocker: currentUserId,
      blocked: targetUserId
    });

    if (existingBlock) {
      return res.status(400).json({ message: 'User already blocked' });
    }

    // Remove follow relationships in both directions
    await Following.deleteMany({
      $or: [
        { follower: currentUserId, following: targetUserId },
        { follower: targetUserId, following: currentUserId }
      ]
    });

    // Create block relationship
    const blocking = new Blocking({
      blocker: currentUserId,
      blocked: targetUserId
    });

    await blocking.save();
    res.json({ message: 'User blocked successfully', blocked: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/users/:id/unblock
// @desc    Unblock a user
// @access  Private
router.post('/:id/unblock', auth, async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const currentUserId = req.user.userId;

    const blocking = await Blocking.findOneAndDelete({
      blocker: currentUserId,
      blocked: targetUserId
    });

    if (!blocking) {
      return res.status(404).json({ message: 'User not blocked' });
    }

    res.json({ message: 'User unblocked successfully', blocked: false });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/:id
// @desc    Get user profile (with optional auth to include follow/block status)
// @access  Public (auth optional)
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('joinedCommunities', 'name displayName memberCount');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get follower and following counts
    const followerCount = await Following.countDocuments({ following: req.params.id });
    const followingCount = await Following.countDocuments({ follower: req.params.id });

    const userObj = user.toObject();
    userObj.followerCount = followerCount;
    userObj.followingCount = followingCount;

    // If user is authenticated, check follow/block status
    if (req.user && req.user.userId) {
      const currentUserId = req.user.userId;
      
      const isFollowing = await Following.findOne({
        follower: currentUserId,
        following: req.params.id
      });

      const isBlocked = await Blocking.findOne({
        blocker: currentUserId,
        blocked: req.params.id
      });

      const isBlockedBy = await Blocking.findOne({
        blocker: req.params.id,
        blocked: currentUserId
      });

      userObj.isFollowing = !!isFollowing;
      userObj.isBlocked = !!isBlocked;
      userObj.isBlockedBy = !!isBlockedBy;
    } else {
      userObj.isFollowing = false;
      userObj.isBlocked = false;
      userObj.isBlockedBy = false;
    }

    res.json(userObj);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/users/:id
// @desc    Update user profile
// @access  Private
router.put('/:id', auth, upload.single('avatar'), [
  body('bio').optional().isLength({ max: 500 }).withMessage('Bio must be less than 500 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (req.user.userId !== req.params.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const { bio } = req.body;
    const updateFields = {};
    if (bio !== undefined) updateFields.bio = bio;

    // Handle avatar file upload
    if (req.file) {
      try {
        const result = await uploadToCloudinary(req.file.buffer, {
          folder: 'reddit-clone/avatars',
          transformation: [
            {
              width: 400,
              height: 400,
              crop: 'fill',
              gravity: 'face',
              quality: 'auto',
              fetch_format: 'auto'
            }
          ]
        });
        updateFields.avatar = result.secure_url;
      } catch (uploadError) {
        console.error('Cloudinary upload error:', uploadError);
        return res.status(500).json({ message: 'Failed to upload avatar. Please try again.' });
      }
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updateFields },
      { new: true, runValidators: true }
    ).select('-password');

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
