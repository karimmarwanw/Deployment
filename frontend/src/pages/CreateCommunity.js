import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import InterestsSelection from '../components/InterestsSelection';
import './CreateCommunity.css';

const CreateCommunity = ({ user }) => {
  const [step, setStep] = useState(1); // 1: community info, 2: topics
  const [formData, setFormData] = useState({
    name: '',
    displayName: '',
    description: ''
  });
  const [topics, setTopics] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const value = e.target.value;
    if (e.target.name === 'name') {
      // Only allow lowercase letters, numbers, and underscores
      const sanitized = value.toLowerCase().replace(/[^a-z0-9_]/g, '');
      setFormData({ ...formData, name: sanitized });
    } else {
      setFormData({ ...formData, [e.target.name]: value });
    }
  };

  const handleCommunityInfoSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.name.length < 3) {
      setError('Community name must be at least 3 characters');
      return;
    }

    // Move to topics step
    setStep(2);
  };

  const handleFinalSubmit = async () => {
    setError('');
    setLoading(true);

    try {
      const response = await axios.post('/communities', {
        ...formData,
        topics: topics
      });
      navigate(`/r/${response.data.name}`);
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to create community');
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    // Allow skipping topics
    await handleFinalSubmit();
  };

  if (step === 1) {
    return (
      <div className="container">
        <div className="main-content">
          <div className="create-community-card">
            <h1>Create a Community</h1>
            {error && <div className="error-message">{error}</div>}
            <form onSubmit={handleCommunityInfoSubmit}>
              <div className="form-group">
                <label htmlFor="name">Name</label>
                <div className="input-with-prefix">
                  <span className="input-prefix">r/</span>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    minLength={3}
                    maxLength={21}
                    pattern="[a-z0-9_]+"
                  />
                </div>
                <p className="form-hint">Community names must be between 3-21 characters, and can only contain letters, numbers, and underscores.</p>
              </div>
              <div className="form-group">
                <label htmlFor="displayName">Display Name</label>
                <input
                  type="text"
                  id="displayName"
                  name="displayName"
                  value={formData.displayName}
                  onChange={handleChange}
                  required
                  maxLength={100}
                />
              </div>
              <div className="form-group">
                <label htmlFor="description">Description (Optional)</label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  maxLength={500}
                  rows={4}
                />
              </div>
              <div className="form-actions">
                <button type="button" className="cancel-button" onClick={() => navigate(-1)}>
                  Cancel
                </button>
                <button type="submit" className="submit-button">
                  Next
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="main-content">
        <div className="create-community-card interests-card">
          <h1>Add topics</h1>
          {error && <div className="error-message">{error}</div>}
          <InterestsSelection
            selectedInterests={topics}
            onSelectionChange={setTopics}
            maxSelections={3}
          />
          <div className="interests-actions">
            <button
              type="button"
              className="cancel-button"
              onClick={() => setStep(1)}
            >
              Back
            </button>
            <button
              type="button"
              className="cancel-button"
              onClick={handleSkip}
              disabled={loading}
            >
              Skip
            </button>
            <button
              type="button"
              className="submit-button"
              onClick={handleFinalSubmit}
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Community'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateCommunity;

