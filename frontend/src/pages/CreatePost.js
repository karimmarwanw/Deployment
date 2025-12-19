import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './CreatePost.css';

const CreatePost = ({ user }) => {
  const { name } = useParams();
  const [community, setCommunity] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    content: ''
  });
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (name) {
      fetchCommunity();
    }
  }, [name]);

  const fetchCommunity = async () => {
    try {
      const response = await axios.get(`/communities/${name}`);
      setCommunity(response.data);
    } catch (error) {
      console.error('Error fetching community:', error);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file size (10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError('Image size must be less than 10MB');
        return;
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        setError('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.');
        return;
      }

      setImage(file);
      setError('');

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImage(null);
    setImagePreview(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const submitData = new FormData();
      submitData.append('title', formData.title);
      submitData.append('content', formData.content);
      submitData.append('community', community._id);
      
      if (image) {
        submitData.append('image', image);
      }

      const token = localStorage.getItem('token');
      const response = await axios.post('/posts', submitData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: token ? `Bearer ${token}` : ''
        }
      });
      navigate(`/post/${response.data._id}`);
    } catch (error) {
      setError(error.response?.data?.message || error.response?.data?.errors?.[0]?.msg || 'Failed to create post');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="main-content">
        <div className="create-post-card">
          <h1>Create a post</h1>
          {community && (
            <p className="community-info">Posting to r/{community.name}</p>
          )}
          {error && <div className="error-message">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <input
                type="text"
                name="title"
                placeholder="Title"
                value={formData.title}
                onChange={handleChange}
                required
                maxLength={300}
                className="title-input"
              />
            </div>
            <div className="form-group">
              <textarea
                name="content"
                placeholder="Text (optional)"
                value={formData.content}
                onChange={handleChange}
                maxLength={40000}
                rows={10}
                className="content-input"
              />
            </div>
            <div className="form-group">
              <label htmlFor="image-upload" className="image-upload-label">
                <span className="upload-icon">📷</span>
                {image ? 'Change Image' : 'Add Image (optional)'}
              </label>
              <input
                type="file"
                id="image-upload"
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                onChange={handleImageChange}
                style={{ display: 'none' }}
              />
              {imagePreview && (
                <div className="image-preview-container">
                  <img src={imagePreview} alt="Preview" className="image-preview" />
                  <button type="button" className="remove-image-btn" onClick={removeImage}>
                    ✕
                  </button>
                </div>
              )}
            </div>
            <div className="form-actions">
              <button type="button" className="cancel-button" onClick={() => navigate(-1)}>
                Cancel
              </button>
              <button type="submit" className="submit-button" disabled={loading || !community}>
                {loading ? 'Posting...' : 'Post'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreatePost;

