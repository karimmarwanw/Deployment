import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './PostMenu.css';

const PostMenu = ({ post, user, onUpdate, onEdit, onDelete, onHide }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [saved, setSaved] = useState(post.saved || false);
  const [hidden, setHidden] = useState(post.hidden || false);
  const [loading, setLoading] = useState(false);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  const isOwner = user && post.author && (
    post.author._id === user._id || 
    post.author === user._id ||
    (typeof post.author === 'string' && post.author === user._id)
  );

  // Update saved and hidden state when post prop changes
  useEffect(() => {
    setSaved(post.saved || false);
    setHidden(post.hidden || false);
  }, [post.saved, post.hidden]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target) &&
          buttonRef.current && !buttonRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen]);

  const handleSave = async () => {
    if (!user || loading) return;

    try {
      setLoading(true);
      const response = await axios.post(`/posts/${post._id}/save`);
      setSaved(response.data.saved);
      if (onUpdate) onUpdate();
      setIsOpen(false);
    } catch (error) {
      console.error('Error saving post:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleHide = async () => {
    if (!user || loading) return;

    try {
      setLoading(true);
      const response = await axios.post(`/posts/${post._id}/hide`);
      setHidden(response.data.hidden);
      // If post was hidden (not unhidden), notify parent to remove it
      if (response.data.hidden && onHide) {
        onHide(post._id);
      } else if (onUpdate) {
        // For other updates (like unhiding)
        onUpdate();
      }
      setIsOpen(false);
    } catch (error) {
      console.error('Error hiding post:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    if (onEdit) onEdit();
    setIsOpen(false);
  };

  const handleDelete = async () => {
    if (!user || loading) return;
    
    if (!window.confirm('Are you sure you want to delete this post?')) {
      return;
    }

    try {
      setLoading(true);
      await axios.delete(`/posts/${post._id}`);
      if (onDelete) onDelete();
      setIsOpen(false);
    } catch (error) {
      console.error('Error deleting post:', error);
      alert('Failed to delete post');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="post-menu-container">
      <button
        ref={buttonRef}
        className="post-menu-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Post menu"
      >
        ⋮
      </button>
      
      {isOpen && (
        <div ref={menuRef} className="post-menu">
          <button
            className="post-menu-item"
            onClick={handleSave}
            disabled={loading}
          >
            <span className="menu-icon">🔖</span>
            {saved ? 'Unsave' : 'Save'}
          </button>
          
          <button
            className="post-menu-item"
            onClick={handleHide}
            disabled={loading}
          >
            <span className="menu-icon">👁️‍🗨️</span>
            {hidden ? 'Unhide' : 'Hide'}
          </button>

          {isOwner && (
            <>
              <button
                className="post-menu-item"
                onClick={handleEdit}
                disabled={loading}
              >
                <span className="menu-icon">✏️</span>
                Edit
              </button>
              
              <button
                className="post-menu-item danger"
                onClick={handleDelete}
                disabled={loading}
              >
                <span className="menu-icon">🗑️</span>
                Delete
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default PostMenu;

