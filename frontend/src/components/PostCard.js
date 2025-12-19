import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import PostMenu from './PostMenu';
import './PostCard.css';

const PostCard = ({ post, user, onUpdate, onHide }) => {
  const [currentPost, setCurrentPost] = useState(post);
  const [voting, setVoting] = useState(false);
  const navigate = useNavigate();

  const handleVote = async (type) => {
    if (!user) return;
    if (voting) return; // Prevent double-clicking the same button

    try {
      setVoting(true);
      const response = await axios.post(`/posts/${post._id}/${type}`);
      setCurrentPost({
        ...response.data,
        // Preserve any other post data
        community: response.data.community || currentPost.community,
        author: response.data.author || currentPost.author
      });
    } catch (error) {
      console.error('Error voting:', error);
      // Don't update state on error
    } finally {
      setVoting(false);
    }
  };

  const getVoteStatus = () => {
    if (!user) return { upvoted: false, downvoted: false };
    // Use the upvoted/downvoted fields from backend if available, otherwise fallback
    return {
      upvoted: currentPost.upvoted || false,
      downvoted: currentPost.downvoted || false
    };
  };

  const voteStatus = getVoteStatus();
  const score = currentPost.score !== undefined ? currentPost.score : 0;

  return (
    <div className="post-card">
      <div className="post-content">
        <div className="post-header">
          <div className="post-header-left">
            <Link to={`/r/${currentPost.community?.name || currentPost.community}`} className="community-link">
              r/{currentPost.community?.name || currentPost.community}
            </Link>
            <span className="post-meta">
              Posted by{' '}
              <Link to={`/profile/${currentPost.author?._id || currentPost.author}`} className="author-link">
                u/{currentPost.author?.username || 'Unknown'}
              </Link>
              {' '}
              {new Date(currentPost.createdAt).toLocaleDateString()}
            </span>
          </div>
          <PostMenu 
            post={currentPost} 
            user={user}
            onUpdate={() => {
              if (onUpdate) onUpdate();
            }}
            onEdit={() => {
              // Navigate to edit page or show edit modal
              navigate(`/post/${currentPost._id}/edit`);
            }}
            onDelete={() => {
              // Post deleted, refresh or remove from list
              if (onUpdate) onUpdate();
              window.location.reload();
            }}
            onHide={onHide}
          />
        </div>
        
        <Link to={`/post/${currentPost._id}`} className="post-title-link">
          <h3 className="post-title">{currentPost.title}</h3>
        </Link>
        
        {currentPost.imageUrl && (
          <div className="post-image-container">
            <img 
              src={currentPost.imageUrl} 
              alt={currentPost.title} 
              className="post-image"
              loading="lazy"
            />
          </div>
        )}
        
        {currentPost.content && (
          <p className="post-text">{currentPost.content.substring(0, 200)}...</p>
        )}
        
        <div className="post-actions">
          <div className={`vote-button-combined ${voteStatus.upvoted ? 'upvoted' : ''} ${voteStatus.downvoted ? 'downvoted' : ''}`}>
            <button
              className="vote-arrow-button upvote-arrow"
              onClick={() => handleVote('upvote')}
              disabled={!user || voting}
            >
              <span className="vote-icon">▲</span>
            </button>
            <span className="vote-score">{score}</span>
            <button
              className="vote-arrow-button downvote-arrow"
              onClick={() => handleVote('downvote')}
              disabled={!user || voting}
            >
              <span className="vote-icon">▼</span>
            </button>
          </div>
          
          <Link to={`/post/${currentPost._id}`} className="comment-button">
            <span className="comment-icon">💬</span>
            <span className="comment-count">{currentPost.commentCount || 0}</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PostCard;

