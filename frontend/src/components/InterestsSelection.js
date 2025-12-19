import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './InterestsSelection.css';

const InterestsSelection = ({ selectedInterests, onSelectionChange, maxSelections = 3 }) => {
  const [topics, setTopics] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTopics();
  }, []);

  const fetchTopics = async () => {
    try {
      const response = await axios.get('/topics');
      setTopics(response.data);
    } catch (error) {
      console.error('Error fetching topics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTopicToggle = (topic) => {
    if (selectedInterests.includes(topic)) {
      // Remove topic
      onSelectionChange(selectedInterests.filter(t => t !== topic));
    } else {
      // Add topic (if under limit)
      if (selectedInterests.length < maxSelections) {
        onSelectionChange([...selectedInterests, topic]);
      }
    }
  };

  const filteredTopics = Object.keys(topics).filter(category => {
    if (!searchQuery) return true;
    const categoryLower = category.toLowerCase();
    const topicsInCategory = topics[category].topics;
    return categoryLower.includes(searchQuery.toLowerCase()) ||
           topicsInCategory.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
  });

  if (loading) {
    return <div className="interests-loading">Loading topics...</div>;
  }

  return (
    <div className="interests-selection">
      <div className="interests-header">
        <h2>Add topics</h2>
        <p className="interests-subtitle">
          Add up to {maxSelections} topics to help interested redditors find your community.
        </p>
      </div>

      <div className="interests-search">
        <input
          type="text"
          placeholder="Filter topics"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="interests-search-input"
        />
      </div>

      <div className="interests-selected">
        <span className="topics-count">Topics {selectedInterests.length}/{maxSelections}</span>
      </div>

      <div className="interests-categories">
        {filteredTopics.map(category => (
          <div key={category} className="topic-category">
            <h3 className="category-header">
              <span className="category-icon">{topics[category].icon}</span>
              {category}
            </h3>
            <div className="topics-list">
              {topics[category].topics.map(topic => {
                const isSelected = selectedInterests.includes(topic);
                const isDisabled = !isSelected && selectedInterests.length >= maxSelections;
                return (
                  <button
                    key={topic}
                    type="button"
                    className={`topic-tag ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
                    onClick={() => !isDisabled && handleTopicToggle(topic)}
                    disabled={isDisabled}
                  >
                    {topic}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default InterestsSelection;

