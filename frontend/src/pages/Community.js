import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import PostCard from '../components/PostCard';
import Sidebar from '../components/Sidebar';
import './Community.css';

const Community = ({ user }) => {
  const { name } = useParams();
  const [community, setCommunity] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isMember, setIsMember] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [joining, setJoining] = useState(false);
  const [favoriting, setFavoriting] = useState(false);
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchCommunity();
    fetchPosts();
  }, [name]);

  useEffect(() => {
    if (community && user) {
      setIsMember(community.members.some(m => 
        (typeof m === 'object' ? m._id : m) === user._id
      ));
      const creatorId = community.creator?._id || community.creator;
      const userId = user._id || user.id;
      setIsCreator(creatorId && userId && creatorId === userId);
      checkIfFavorited();
    }
  }, [community, user]);

  const checkIfFavorited = async () => {
    if (!user || !community) {
      setIsFavorited(false);
      return;
    }
    try {
      const response = await axios.get(`/users/${user._id}/communities/favorites`);
      if (!response.data || !Array.isArray(response.data)) {
        setIsFavorited(false);
        return;
      }
      // Check if this community is in the favorites list by comparing names (most reliable)
      const favorited = response.data.some(fc => {
        if (!fc) return false;
        const fcName = (fc.name || '').toLowerCase().trim();
        const commName = (community.name || '').toLowerCase().trim();
        return fcName && commName && fcName === commName;
      });
      setIsFavorited(favorited);
    } catch (error) {
      console.error('Error checking favorite status:', error);
      setIsFavorited(false);
    }
  };

  const fetchCommunity = async () => {
    try {
      const response = await axios.get(`/communities/${name}`);
      setCommunity(response.data);
    } catch (error) {
      console.error('Error fetching community:', error);
    }
  };

  const fetchPosts = async () => {
    try {
      const response = await axios.get(`/posts?community=${name}`);
      // Filter out hidden posts
      const filteredPosts = response.data.filter(post => !post.hidden);
      setPosts(filteredPosts);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePostHide = (postId) => {
    // Remove the hidden post from the list
    if (postId) {
      setPosts(prevPosts => prevPosts.filter(post => post._id !== postId));
    }
  };

  const handlePostUpdate = () => {
    // General update handler (for saves, etc.) - no action needed
  };

  const handleJoinLeave = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    try {
      setJoining(true);
      const endpoint = isMember ? 'leave' : 'join';
      await axios.post(`/communities/${name}/${endpoint}`);
      await fetchCommunity();
    } catch (error) {
      console.error('Error joining/leaving community:', error);
    } finally {
      setJoining(false);
    }
  };

  const handleFavorite = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    try {
      setFavoriting(true);
      const response = await axios.post(`/communities/${name}/favorite`);
      // Update state based on response
      if (response.data && typeof response.data.favorited === 'boolean') {
        setIsFavorited(response.data.favorited);
      } else {
        // If response format is unexpected, refresh from server
        await checkIfFavorited();
      }
    } catch (error) {
      console.error('Error favoriting/unfavoriting community:', error);
      const errorMsg = error.response?.data?.message || 'Failed to update favorite status';
      alert(errorMsg);
      // Refresh status on error to ensure UI is correct
      await checkIfFavorited();
    } finally {
      setFavoriting(false);
    }
  };

  const fetchMembers = async () => {
    if (!isCreator) return;
    try {
      setMembersLoading(true);
      const response = await axios.get(`/communities/${name}/members`);
      setMembers(response.data.members || []);
    } catch (error) {
      console.error('Error fetching members:', error);
      alert(error.response?.data?.message || 'Failed to fetch members');
    } finally {
      setMembersLoading(false);
    }
  };

  const handleKickMember = async (memberId) => {
    try {
      await axios.post(`/communities/${name}/members/${memberId}/kick`);
      setMembers(prev => prev.filter(member => member._id !== memberId));
      setCommunity(prev => ({
        ...prev,
        memberCount: Math.max(0, (prev?.memberCount || 0) - 1),
        members: (prev?.members || []).filter(m => (typeof m === 'object' ? m._id : m) !== memberId)
      }));
    } catch (error) {
      console.error('Error removing member:', error);
      alert(error.response?.data?.message || 'Failed to remove member');
    }
  };

  if (loading) {
    return <div className="loading">Loading community...</div>;
  }

  if (!community) {
    return <div className="error">Community not found</div>;
  }

  return (
    <div className="container">
      <div className="main-content">
        <div className="community-header">
          <div className="community-info">
            <h1>r/{community.name}</h1>
            <p className="community-description">{community.description || 'No description'}</p>
            <div className="community-meta">
              <span>{community.memberCount} members</span>
              <span>Created by u/{community.creator?.username || 'Unknown'}</span>
            </div>
          </div>
          <div className="community-actions">
            {user && (
              <>
                <button
                  className={`join-button ${isMember ? 'joined' : ''}`}
                  onClick={handleJoinLeave}
                  disabled={joining}
                >
                  {joining ? '...' : isMember ? 'Joined' : 'Join'}
                </button>
                <button
                  className={`favorite-button ${isFavorited ? 'favorited' : ''}`}
                  onClick={handleFavorite}
                  disabled={favoriting}
                  title={isFavorited ? 'Unfavorite' : 'Favorite'}
                >
                  {favoriting ? '...' : isFavorited ? '★' : '☆'}
                </button>
              </>
            )}
            {user && isCreator && (
              <button
                className="members-button"
                onClick={async () => {
                  const next = !showMembers;
                  setShowMembers(next);
                  if (next) {
                    await fetchMembers();
                  }
                }}
              >
                {showMembers ? 'Hide Members' : 'Manage Members'}
              </button>
            )}
            {user && (
              <Link to={`/r/${name}/submit`} className="create-post-button">
                Create Post
              </Link>
            )}
          </div>
        </div>

        {isCreator && showMembers && (
          <div className="community-members-panel">
            <div className="community-members-header">
              <h2>Members</h2>
              <span className="community-members-count">{members.length}</span>
            </div>
            {membersLoading ? (
              <div className="loading">Loading members...</div>
            ) : members.length === 0 ? (
              <div className="empty-state">No members found</div>
            ) : (
              <div className="community-members-list">
                {members.map(member => (
                  <div key={member._id} className="community-member-row">
                    <div className="community-member-info">
                      {member.avatar ? (
                        <img src={member.avatar} alt={member.username} />
                      ) : (
                        <div className="member-avatar-placeholder">
                          {(member.username || 'U')[0].toUpperCase()}
                        </div>
                      )}
                      <span>u/{member.username}</span>
                    </div>
                    {member._id !== (community.creator?._id || community.creator) && (
                      <button
                        className="kick-button"
                        onClick={() => handleKickMember(member._id)}
                      >
                        Kick
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="posts-list">
          {posts.length === 0 ? (
            <div className="no-posts">
              <p>No posts yet. Be the first to post!</p>
              {user && (
                <Link to={`/r/${name}/submit`} className="create-link">
                  Create Post
                </Link>
              )}
            </div>
          ) : (
            posts
              .filter(post => !post.hidden) // Additional filter for safety
              .map(post => (
                <PostCard 
                  key={post._id} 
                  post={post} 
                  user={user} 
                  onUpdate={handlePostUpdate}
                  onHide={handlePostHide}
                />
              ))
          )}
        </div>
      </div>
      <Sidebar user={user} />
    </div>
  );
};

export default Community;
