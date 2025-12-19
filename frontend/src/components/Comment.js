import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Comment.css';

const Comment = ({ comment, user, onUpdate, depth = 0, postAuthor = null }) => {
  const [currentComment, setCurrentComment] = useState(comment);
  const [voting, setVoting] = useState(false);
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(comment.content || '');
  const [deleting, setDeleting] = useState(false);

  // Sync state when comment prop changes (e.g., after replies are fetched)
  useEffect(() => {
    if (comment && comment._id) {
      setCurrentComment(comment);
    }
  }, [comment]);

  const handleVote = async (type) => {
    if (!user) return;
    if (voting) return; // Prevent double-clicking the same button

    try {
      setVoting(true);
      const response = await axios.post(`/comments/${comment._id}/${type}`);
      // Preserve replies and all other comment data when updating comment after vote
      setCurrentComment({
        ...response.data,
        replies: currentComment.replies || comment.replies || [],
        author: response.data.author || currentComment.author || comment.author,
        post: response.data.post || currentComment.post || comment.post,
        content: response.data.content || currentComment.content || comment.content,
        createdAt: response.data.createdAt || currentComment.createdAt || comment.createdAt
      });
    } catch (error) {
      console.error('Error voting:', error);
      // Don't update state on error
    } finally {
      setVoting(false);
    }
  };

  const handleReply = async (e) => {
    e.preventDefault();
    if (!user || !replyText.trim()) return;

    try {
      setSubmitting(true);
      await axios.post('/comments', {
        content: replyText,
        post: comment.post,
        parentComment: comment._id
      });
      setReplyText('');
      setShowReply(false);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error submitting reply:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const getVoteStatus = () => {
    if (!user) return { upvoted: false, downvoted: false };
    // Use the upvoted/downvoted fields from backend if available, otherwise fallback to arrays
    if (currentComment.upvoted !== undefined || currentComment.downvoted !== undefined) {
      return {
        upvoted: currentComment.upvoted || false,
        downvoted: currentComment.downvoted || false
      };
    }
    // Fallback for old structure (if comments still use arrays temporarily)
    return {
      upvoted: currentComment.upvotes?.some(id => id === user._id || id === user.id) || false,
      downvoted: currentComment.downvotes?.some(id => id === user._id || id === user.id) || false
    };
  };

  const voteStatus = getVoteStatus();
  const score = currentComment.score !== undefined 
    ? currentComment.score 
    : (currentComment.upvotes?.length || 0) - (currentComment.downvotes?.length || 0);
  const maxDepth = 5;
  const replies = currentComment.replies || comment.replies || [];
  const hasReplies = replies.length > 0;
  const timeAgo = getTimeAgo(new Date(currentComment.createdAt));

  const normalizeId = (entity) => {
    if (!entity) return null;
    if (typeof entity === 'string') return entity;
    return entity._id || entity.id || null;
  };

  const commentAuthorId = normalizeId(currentComment.author);
  const userId = normalizeId(user);
  const postAuthorId = normalizeId(postAuthor);

  // Check if user is comment author
  const isCommentAuthor = Boolean(userId && commentAuthorId && commentAuthorId === userId);

  // Check if user is post author
  const isPostAuthor = Boolean(userId && postAuthorId && postAuthorId === userId);

  const isCommentByPostAuthor = Boolean(postAuthorId && commentAuthorId && commentAuthorId === postAuthorId);
  const replyCount = replies.length;
  const wasEdited = currentComment.updatedAt && currentComment.updatedAt !== currentComment.createdAt;
  const isNewComment = (() => {
    if (!currentComment.createdAt) return false;
    const ageInMinutes = (Date.now() - new Date(currentComment.createdAt).getTime()) / 60000;
    return ageInMinutes <= 10;
  })();

  const commentClasses = [
    'comment',
    depth > 0 ? 'reply' : '',
    isCommentAuthor ? 'comment-by-you' : '',
    isCommentByPostAuthor ? 'comment-by-op' : ''
  ]
    .filter(Boolean)
    .join(' ');

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!editText.trim() || submitting) return;

    try {
      setSubmitting(true);
      const response = await axios.put(`/comments/${currentComment._id}`, {
        content: editText.trim()
      });
      setCurrentComment({
        ...response.data,
        replies: currentComment.replies || [],
        post: currentComment.post
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Error editing comment:', error);
      alert('Failed to edit comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this comment?')) {
      return;
    }

    try {
      setDeleting(true);
      await axios.delete(`/comments/${currentComment._id}`);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error deleting comment:', error);
      alert('Failed to delete comment');
      setDeleting(false);
    }
  };

  function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 4) return `${weeks}w ago`;
    const months = Math.floor(days / 30);
    return `${months}mo ago`;
  }

  if (isCollapsed) {
    return (
      <div className={commentClasses}>
        <div className="comment-left">
          <div className="comment-avatar">
            {currentComment.author?.avatar ? (
              <img src={currentComment.author.avatar} alt={currentComment.author.username} />
            ) : (
              <div className="avatar-placeholder">
                {(currentComment.author?.username || 'U')[0].toUpperCase()}
              </div>
            )}
          </div>
          {hasReplies && (
            <button 
              className="collapse-button"
              onClick={() => setIsCollapsed(false)}
              aria-expanded="false"
              aria-label={`Expand comment${replyCount ? ` with ${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}` : ''}`}
            >
              <span className="collapse-icon">+</span>
              {replyCount > 0 && <span className="collapse-count">{replyCount}</span>}
            </button>
          )}
        </div>
        <div className="comment-content-collapsed">
          <div className="comment-header">
            <span className="comment-author">u/{currentComment.author?.username || 'Unknown'}</span>
            <span className="comment-time">{timeAgo}</span>
          </div>
          <div className="comment-text-collapsed">
            [collapsed]
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={commentClasses}>
      <div className="comment-left">
        <div className="comment-avatar">
          {currentComment.author?.avatar ? (
            <img src={currentComment.author.avatar} alt={currentComment.author.username} />
          ) : (
            <div className="avatar-placeholder">
              {(currentComment.author?.username || 'U')[0].toUpperCase()}
            </div>
          )}
        </div>
        {hasReplies && (
          <button 
            className="collapse-button"
            onClick={() => setIsCollapsed(true)}
            aria-expanded="true"
            aria-label={`Collapse comment${replyCount ? ` with ${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}` : ''}`}
          >
            <span className="collapse-icon">−</span>
            {replyCount > 0 && <span className="collapse-count">{replyCount}</span>}
          </button>
        )}
        {!hasReplies && depth > 0 && <div className="collapse-spacer"></div>}
      </div>

      <div className="comment-content">
        <div className="comment-header">
          <span className="comment-author">u/{currentComment.author?.username || 'Unknown'}</span>
          {isCommentByPostAuthor && (
            <span className="comment-badge comment-badge-op" title="Original poster">
              OP
            </span>
          )}
          {isCommentAuthor && (
            <span className="comment-badge comment-badge-you" title="This is your comment">
              You
            </span>
          )}
          {isNewComment && (
            <span className="comment-badge comment-badge-new">
              New
            </span>
          )}
          <span className="comment-time">{timeAgo}</span>
          {wasEdited && <span className="comment-edited" title={`Edited ${getTimeAgo(new Date(currentComment.updatedAt))}`}>Edited</span>}
        </div>

        {isEditing ? (
          <form onSubmit={handleEdit} className="edit-comment-form">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={4}
              maxLength={10000}
              className="edit-comment-input"
              disabled={submitting}
            />
            <div className="edit-comment-actions">
              <button
                type="button"
                className="cancel-edit"
                onClick={() => {
                  setIsEditing(false);
                  setEditText(currentComment.content || '');
                }}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="save-edit"
                disabled={submitting || !editText.trim()}
              >
                {submitting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        ) : (
          <div className="comment-text">
            {currentComment.content}
          </div>
        )}

        <div className="comment-actions">
          <div className={`vote-button-combined ${voteStatus.upvoted ? 'upvoted' : ''} ${voteStatus.downvoted ? 'downvoted' : ''}`}>
            <button
              className="vote-arrow-button upvote-arrow"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleVote('upvote');
              }}
              disabled={!user || voting}
              type="button"
              aria-label="Upvote"
            >
              <span className="vote-icon">▲</span>
            </button>
            <span className="vote-score">{score}</span>
            <button
              className="vote-arrow-button downvote-arrow"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleVote('downvote');
              }}
              disabled={!user || voting}
              type="button"
              aria-label="Downvote"
            >
              <span className="vote-icon">▼</span>
            </button>
          </div>
          
          {user && depth < maxDepth && (
            <button
              className="reply-button"
              onClick={() => setShowReply(!showReply)}
            >
              💬 Reply
            </button>
          )}
          {isCommentAuthor && !isEditing && (
            <>
              <button
                className="edit-comment-button"
                onClick={() => {
                  setIsEditing(true);
                  setEditText(currentComment.content || '');
                }}
                disabled={deleting}
              >
                ✏️ Edit
              </button>
              <button
                className="delete-comment-button"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : '🗑️ Delete'}
              </button>
            </>
          )}
          {!isCommentAuthor && isPostAuthor && !isEditing && (
            <button
              className="delete-comment-button"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : '🗑️ Delete'}
            </button>
          )}
        </div>

        {showReply && user && (
          <form onSubmit={handleReply} className="reply-form">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write a reply..."
              rows={3}
              maxLength={10000}
              className="reply-input"
            />
            <div className="reply-actions">
              <button
                type="button"
                className="cancel-reply"
                onClick={() => {
                  setShowReply(false);
                  setReplyText('');
                }}
              >
                Cancel
              </button>
              <button type="submit" className="submit-reply" disabled={submitting || !replyText.trim()}>
                {submitting ? 'Posting...' : 'Reply'}
              </button>
            </div>
          </form>
        )}

        {hasReplies && (
          <div className="replies">
            {replies.map(reply => (
              <Comment
                key={reply._id}
                comment={reply}
                user={user}
                onUpdate={onUpdate}
                depth={depth + 1}
                postAuthor={postAuthor}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Comment;
