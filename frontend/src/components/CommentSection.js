import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Comment from './Comment';
import './CommentSection.css';

const CommentSection = ({ postId, user, postAuthor = null }) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchComments();
  }, [postId]);

  const fetchComments = async () => {
    try {
      const response = await axios.get(`/comments/post/${postId}`);
      setComments(response.data);
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user || !newComment.trim()) return;

    try {
      setSubmitting(true);
      await axios.post('/comments', {
        content: newComment,
        post: postId
      });
      setNewComment('');
      await fetchComments();
    } catch (error) {
      console.error('Error submitting comment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="comment-section">
      <h2 className="comment-section-title">Comments</h2>
      
      {user ? (
        <form onSubmit={handleSubmit} className="comment-form">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="What are your thoughts?"
            rows={4}
            maxLength={10000}
            className="comment-input"
          />
          <div className="comment-form-actions">
            <button type="submit" className="comment-submit" disabled={submitting || !newComment.trim()}>
              {submitting ? 'Posting...' : 'Comment'}
            </button>
          </div>
        </form>
      ) : (
        <div className="login-prompt">
          <p>Please <a href="/login">log in</a> to comment</p>
        </div>
      )}

      {loading ? (
        <div className="loading-comments">Loading comments...</div>
      ) : comments.length === 0 ? (
        <div className="no-comments">No comments yet. Be the first to comment!</div>
      ) : (
        <div className="comments-list">
          {comments.map(comment => (
            <Comment
              key={comment._id}
              comment={comment}
              user={user}
              onUpdate={fetchComments}
              postAuthor={postAuthor}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default CommentSection;

