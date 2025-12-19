import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './CreatePost.css';

const EditPost = ({ user }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPost();
  }, [id]);

  const fetchPost = async () => {
    try {
      const response = await axios.get(`/posts/${id}`);
      const post = response.data;
      
      // Check if user is the author
      if (post.author?._id !== user?._id && post.author !== user?._id) {
        setError('You are not authorized to edit this post');
        return;
      }

      setTitle(post.title || '');
      setContent(post.content || '');
    } catch (error) {
      console.error('Error fetching post:', error);
      setError('Failed to load post');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      await axios.put(`/posts/${id}`, { title, content });
      navigate(`/post/${id}`);
    } catch (error) {
      console.error('Error updating post:', error);
      setError(error.response?.data?.message || 'Failed to update post');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (error && !title) {
    return <div className="error">{error}</div>;
  }

  return (
    <div className="container">
      <div className="main-content">
        <div className="create-post-form">
          <h2>Edit Post</h2>
          
          {error && <div className="error-message">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="title">Title</label>
              <input
                type="text"
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={300}
                required
              />
              <span className="char-count">{title.length}/300</span>
            </div>

            <div className="form-group">
              <label htmlFor="content">Content (Optional)</label>
              <textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                maxLength={40000}
                rows={10}
              />
              <span className="char-count">{content.length}/40000</span>
            </div>

            <div className="form-actions">
              <button type="button" onClick={() => navigate(-1)} className="cancel-button">
                Cancel
              </button>
              <button type="submit" disabled={submitting} className="submit-button">
                {submitting ? 'Updating...' : 'Update Post'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EditPost;

