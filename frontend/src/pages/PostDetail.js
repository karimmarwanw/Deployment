import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import CommentSection from '../components/CommentSection';
import PostMenu from '../components/PostMenu';
import './PostDetail.css';

const PostDetail = ({ user }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [summary, setSummary] = useState('');
  const [loadingSummary, setLoadingSummary] = useState(false);

  useEffect(() => {
    fetchPost();
  }, [id]);

  // Close modal on ESC key press
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && showSummary) {
        setShowSummary(false);
      }
    };

    if (showSummary) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [showSummary]);

  const fetchPost = async () => {
    try {
      const response = await axios.get(`/posts/${id}`);
      setPost(response.data);
      if (response.data.aiSummary) {
        setSummary(response.data.aiSummary);
      }
    } catch (error) {
      console.error('Error fetching post:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (type) => {
    if (!user) return;
    if (voting) return; // Prevent double-clicking the same button

    try {
      setVoting(true);
      const response = await axios.post(`/posts/${id}/${type}`);
      setPost({
        ...response.data,
        // Preserve any other post data
        community: response.data.community || post.community,
        author: response.data.author || post.author,
        content: response.data.content || post.content,
        aiSummary: response.data.aiSummary || post.aiSummary
      });
    } catch (error) {
      console.error('Error voting:', error);
      // Don't update state on error
    } finally {
      setVoting(false);
    }
  };

  const handleSummarize = async () => {
    if (post.aiSummary) {
      setShowSummary(true);
      setSummary(post.aiSummary);
      return;
    }

    try {
      setLoadingSummary(true);
      const response = await axios.post(`/posts/${id}/summarize`);
      setSummary(response.data.summary);
      setShowSummary(true);
      await fetchPost(); // Refresh to get updated post with summary
    } catch (error) {
      console.error('Error generating summary:', error);
      const errorMessage = error.response?.data?.message || 'Failed to generate summary. Please try again.';
      alert(errorMessage);
    } finally {
      setLoadingSummary(false);
    }
  };

  const getVoteStatus = () => {
    if (!user || !post) return { upvoted: false, downvoted: false };
    // Use the upvoted/downvoted fields from backend if available
    return {
      upvoted: post.upvoted || false,
      downvoted: post.downvoted || false
    };
  };

  if (loading) {
    return <div className="loading">Loading post...</div>;
  }

  if (!post) {
    return <div className="error">Post not found</div>;
  }

  const voteStatus = getVoteStatus();
  const score = post.score !== undefined ? post.score : 0;

  return (
    <div className="container">
      <div className="main-content">
        <div className="post-detail">
          <div className="post-content">
            <div className="post-header">
              <div className="post-header-left">
                <Link to={`/r/${post.community?.name || post.community}`} className="community-link">
                  r/{post.community?.name || post.community}
                </Link>
                <span className="post-meta">
                  Posted by{' '}
                  <Link to={`/profile/${post.author?._id || post.author}`} className="author-link">
                    u/{post.author?.username || 'Unknown'}
                  </Link>
                  {' '}
                  {new Date(post.createdAt).toLocaleDateString()}
                </span>
              </div>
              <PostMenu 
                post={post} 
                user={user}
                onUpdate={() => {
                  fetchPost();
                }}
                onEdit={() => {
                  navigate(`/post/${post._id}/edit`);
                }}
                onDelete={() => {
                  navigate('/');
                }}
              />
            </div>

            <h1 className="post-title">{post.title}</h1>

            {post.imageUrl && (
              <div className="post-image-container">
                <img 
                  src={post.imageUrl} 
                  alt={post.title} 
                  className="post-image"
                  loading="lazy"
                />
              </div>
            )}

            {post.content && (
              <div className="post-text">
                <p>{post.content}</p>
              </div>
            )}

            <div className="post-actions-horizontal">
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
              
              <Link to={`#comments`} className="comment-button">
                <span className="comment-icon">💬</span>
                <span className="comment-count">{post.commentCount || 0}</span>
              </Link>
            </div>

            <div className="post-actions">
              <button className="action-button" onClick={handleSummarize} disabled={loadingSummary}>
                {loadingSummary ? (
                  <>
                    <span className="loading-spinner">⏳</span>
                    Generating...
                  </>
                ) : (
                  <>
                    <span>🤖</span>
                    AI Summary
                  </>
                )}
              </button>
              {showSummary && summary && (
                <>
                  <div className="ai-summary-overlay" onClick={() => setShowSummary(false)}></div>
                  <div className="ai-summary-modal ai-summary-visible" onClick={(e) => e.stopPropagation()}>
                    <button className="ai-summary-close" onClick={() => setShowSummary(false)} aria-label="Close">×</button>
                    <div className="ai-summary-header">
                      <div className="ai-summary-icon">🤖</div>
                      <h3>AI Summary</h3>
                      <span className="ai-summary-badge">Powered by AI</span>
                    </div>
                    <div className="ai-summary-content">
                      <p>{summary}</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <CommentSection postId={id} user={user} postAuthor={post?.author} />
      </div>
    </div>
  );
};

export default PostDetail;

