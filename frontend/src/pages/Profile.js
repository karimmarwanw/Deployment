import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import PostCard from '../components/PostCard';
import './Profile.css';

const Profile = ({ user: currentUser }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [profileUser, setProfileUser] = useState(null);
  const [activeTab, setActiveTab] = useState('posts');
  const [posts, setPosts] = useState([]);
  const [comments, setComments] = useState([]);
  const [savedPosts, setSavedPosts] = useState([]);
  const [hiddenPosts, setHiddenPosts] = useState([]);
  const [upvotedPosts, setUpvotedPosts] = useState([]);
  const [downvotedPosts, setDownvotedPosts] = useState([]);
  const [favoriteCommunities, setFavoriteCommunities] = useState([]);
  const [joinedCommunities, setJoinedCommunities] = useState([]);
  const [createdCommunities, setCreatedCommunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ bio: '', avatar: '' });
  const [actionLoading, setActionLoading] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [error, setError] = useState('');
  
  // Fix undefined ID issue - if id is undefined and we have currentUser, redirect
  useEffect(() => {
    if (!id && currentUser && currentUser._id) {
      navigate(`/profile/${currentUser._id}`, { replace: true });
      return;
    }
    if (id === 'undefined' && currentUser && currentUser._id) {
      navigate(`/profile/${currentUser._id}`, { replace: true });
      return;
    }
  }, [id, currentUser, navigate]);

  const userId = id && id !== 'undefined' ? id : (currentUser?._id || currentUser?.id);

  const isOwnProfile = currentUser && (currentUser._id === userId || currentUser.id === userId);

  useEffect(() => {
    if (userId) {
      fetchProfile();
      fetchTabData(activeTab);
    }
  }, [userId, activeTab]);

  const fetchProfile = async () => {
    if (!userId) return;
    try {
      const userResponse = await axios.get(`/users/${userId}`);
      setProfileUser(userResponse.data);
      setEditForm({ bio: userResponse.data.bio || '', avatar: userResponse.data.avatar || '' });
      setAvatarPreview(userResponse.data.avatar || null);
      setAvatarFile(null);
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTabData = async (tab) => {
    if (!userId) return;
    try {
      switch (tab) {
        case 'posts':
          const postsResponse = await axios.get(`/posts?author=${userId}`);
          setPosts(postsResponse.data);
          break;
        case 'comments':
          const commentsResponse = await axios.get(`/users/${userId}/comments`);
          setComments(commentsResponse.data);
          break;
        case 'saved':
          const savedResponse = await axios.get(`/users/${userId}/posts/saved`);
          setSavedPosts(savedResponse.data);
          break;
        case 'upvoted':
          const upvotedResponse = await axios.get(`/users/${userId}/posts/upvoted`);
          setUpvotedPosts(upvotedResponse.data);
          break;
        case 'downvoted':
          const downvotedResponse = await axios.get(`/users/${userId}/posts/downvoted`);
          setDownvotedPosts(downvotedResponse.data);
          break;
        case 'hidden':
          const hiddenResponse = await axios.get(`/users/${userId}/posts/hidden`);
          setHiddenPosts(hiddenResponse.data);
          break;
        case 'communities':
          const communitiesResponse = await axios.get(`/users/${userId}/communities/favorites`);
          setFavoriteCommunities(communitiesResponse.data);
          break;
        case 'joined-communities':
          const joinedResponse = await axios.get(`/users/${userId}/communities/joined`);
          setJoinedCommunities(joinedResponse.data);
          break;
        case 'created-communities':
          const createdResponse = await axios.get(`/users/${userId}/communities/created`);
          setCreatedCommunities(createdResponse.data);
          break;
        default:
          break;
      }
    } catch (error) {
      console.error(`Error fetching ${tab}:`, error);
    }
  };

  const handleAvatarChange = (e) => {
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

      setAvatarFile(file);
      setError('');

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview(profileUser?.avatar || null);
  };

  const handleSave = async () => {
    if (!userId) return;
    setError('');
    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('bio', editForm.bio || '');
      
      if (avatarFile) {
        formData.append('avatar', avatarFile);
      }

      const token = localStorage.getItem('token');
      const response = await axios.put(`/users/${userId}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: token ? `Bearer ${token}` : ''
        }
      });
      
      setProfileUser(response.data);
      setAvatarFile(null);
      setEditing(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      setError(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setActionLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!userId || !currentUser) return;
    setActionLoading(true);
    try {
      await axios.post(`/users/${userId}/follow`);
      // Refresh profile to get updated follow status
      await fetchProfile();
    } catch (error) {
      console.error('Error following user:', error);
      alert(error.response?.data?.message || 'Failed to follow user');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnfollow = async () => {
    if (!userId || !currentUser) return;
    setActionLoading(true);
    try {
      await axios.post(`/users/${userId}/unfollow`);
      // Refresh profile to get updated follow status
      await fetchProfile();
    } catch (error) {
      console.error('Error unfollowing user:', error);
      alert(error.response?.data?.message || 'Failed to unfollow user');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBlock = async () => {
    if (!userId || !currentUser) return;
    if (!window.confirm('Are you sure you want to block this user? You will not see their content and they will not see yours.')) {
      return;
    }
    setActionLoading(true);
    try {
      await axios.post(`/users/${userId}/block`);
      // Refresh profile to get updated block status
      await fetchProfile();
    } catch (error) {
      console.error('Error blocking user:', error);
      alert(error.response?.data?.message || 'Failed to block user');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnblock = async () => {
    if (!userId || !currentUser) return;
    setActionLoading(true);
    try {
      await axios.post(`/users/${userId}/unblock`);
      // Refresh profile to get updated block status
      await fetchProfile();
    } catch (error) {
      console.error('Error unblocking user:', error);
      alert(error.response?.data?.message || 'Failed to unblock user');
    } finally {
      setActionLoading(false);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'posts':
        return (
          <div className="profile-posts">
            <h2>Posts</h2>
            {posts.length === 0 ? (
              <p className="no-posts">No posts yet</p>
            ) : (
              <div className="posts-list">
                {posts.map(post => (
                  <PostCard key={post._id} post={post} user={currentUser} />
                ))}
              </div>
            )}
          </div>
        );
      case 'comments':
        return (
          <div className="profile-comments">
            <h2>Comments</h2>
            {comments.length === 0 ? (
              <p className="no-posts">No comments yet</p>
            ) : (
              <div className="comments-list">
                {comments.map(comment => (
                  <div key={comment._id} className="profile-comment-item">
                    <div className="profile-comment-post">
                      <Link to={`/post/${comment.post?._id || comment.post}`}>
                        {comment.post?.title || 'Post'}
                      </Link>
                    </div>
                    <div className="profile-comment-content">
                      <p>{comment.content}</p>
                      <span className="profile-comment-meta">
                        {new Date(comment.createdAt).toLocaleDateString()} • 
                        Score: {comment.score || 0}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      case 'saved':
        return (
          <div className="profile-posts">
            <h2>Saved Posts</h2>
            {savedPosts.length === 0 ? (
              <p className="no-posts">No saved posts</p>
            ) : (
              <div className="posts-list">
                {savedPosts.map(post => (
                  <PostCard key={post._id} post={{ ...post, saved: true }} user={currentUser} />
                ))}
              </div>
            )}
          </div>
        );
      case 'upvoted':
        return (
          <div className="profile-posts">
            <h2>Upvoted Posts</h2>
            {upvotedPosts.length === 0 ? (
              <p className="no-posts">No upvoted posts</p>
            ) : (
              <div className="posts-list">
                {upvotedPosts.map(post => (
                  <PostCard key={post._id} post={post} user={currentUser} />
                ))}
              </div>
            )}
          </div>
        );
      case 'downvoted':
        return (
          <div className="profile-posts">
            <h2>Downvoted Posts</h2>
            {downvotedPosts.length === 0 ? (
              <p className="no-posts">No downvoted posts</p>
            ) : (
              <div className="posts-list">
                {downvotedPosts.map(post => (
                  <PostCard key={post._id} post={post} user={currentUser} />
                ))}
              </div>
            )}
          </div>
        );
      case 'hidden':
        return (
          <div className="profile-posts">
            <h2>Hidden Posts</h2>
            {hiddenPosts.length === 0 ? (
              <p className="no-posts">No hidden posts</p>
            ) : (
              <div className="posts-list">
                {hiddenPosts.map(post => (
                  <PostCard key={post._id} post={{ ...post, hidden: true }} user={currentUser} />
                ))}
              </div>
            )}
          </div>
        );
      case 'communities':
        return (
          <div className="profile-communities">
            <h2>Favorite Communities</h2>
            {favoriteCommunities.length === 0 ? (
              <div className="no-favorite-communities">
                <div className="empty-state-icon">⭐</div>
                <p>No favorite communities yet</p>
                <p className="empty-state-subtitle">Start favoriting communities to see them here!</p>
              </div>
            ) : (
              <div className="communities-list">
                {favoriteCommunities.map(community => (
                  <Link
                    key={community._id}
                    to={`/r/${community.name}`}
                    className="community-card"
                  >
                    <div className="community-card-header">
                      <div style={{ flex: 1 }}>
                        <h3>r/{community.name}</h3>
                        {community.displayName && community.displayName !== community.name && (
                          <p style={{ color: '#818384', fontSize: '12px', margin: '4px 0 0 0' }}>
                            {community.displayName}
                          </p>
                        )}
                      </div>
                      <span className="community-members">
                        {community.memberCount || 0}
                      </span>
                    </div>
                    {community.description && (
                      <p className="community-description">{community.description}</p>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      case 'joined-communities':
        return (
          <div className="profile-communities">
            <h2>Joined Communities</h2>
            {joinedCommunities.length === 0 ? (
              <div className="no-favorite-communities">
                <div className="empty-state-icon">👥</div>
                <p>No joined communities yet</p>
                <p className="empty-state-subtitle">Join communities to see them here.</p>
              </div>
            ) : (
              <div className="communities-list">
                {joinedCommunities.map(community => (
                  <div key={community._id} className="community-card community-card-compact">
                    <div className="community-card-header">
                      <div style={{ flex: 1 }}>
                        <Link to={`/r/${community.name}`} className="community-card-link">
                          <h3>r/{community.name}</h3>
                        </Link>
                        {community.displayName && community.displayName !== community.name && (
                          <p className="community-card-display">{community.displayName}</p>
                        )}
                      </div>
                      <span className="community-members">
                        {community.memberCount || 0}
                      </span>
                    </div>
                    {community.description && (
                      <p className="community-description">{community.description}</p>
                    )}
                    {isOwnProfile && (
                      <div className="community-card-actions">
                        <button
                          className="community-leave-button"
                          onClick={async () => {
                            try {
                              await axios.post(`/communities/${community.name}/leave`);
                              setJoinedCommunities(prev => prev.filter(c => c._id !== community._id));
                            } catch (error) {
                              console.error('Error leaving community:', error);
                              alert(error.response?.data?.message || 'Failed to leave community');
                            }
                          }}
                        >
                          Leave
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      case 'created-communities':
        return (
          <div className="profile-communities">
            <h2>Created Communities</h2>
            {createdCommunities.length === 0 ? (
              <div className="no-favorite-communities">
                <div className="empty-state-icon">🛠️</div>
                <p>No created communities yet</p>
                <p className="empty-state-subtitle">Create a community to see it here.</p>
              </div>
            ) : (
              <div className="communities-list">
                {createdCommunities.map(community => (
                  <Link
                    key={community._id}
                    to={`/r/${community.name}`}
                    className="community-card"
                  >
                    <div className="community-card-header">
                      <div style={{ flex: 1 }}>
                        <h3>r/{community.name}</h3>
                        {community.displayName && community.displayName !== community.name && (
                          <p className="community-card-display">{community.displayName}</p>
                        )}
                      </div>
                      <span className="community-members">
                        {community.memberCount || 0}
                      </span>
                    </div>
                    {community.description && (
                      <p className="community-description">{community.description}</p>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return <div className="loading">Loading profile...</div>;
  }

  if (!profileUser || !userId) {
    return <div className="error">User not found</div>;
  }

  // Show blocked message if user is blocked by profile owner
  if (profileUser.isBlockedBy && !isOwnProfile) {
    return (
      <div className="container">
        <div className="main-content">
          <div className="profile-header">
            <div className="profile-avatar">
              {profileUser.avatar ? (
                <img src={profileUser.avatar} alt={profileUser.username} />
              ) : (
                <div className="avatar-placeholder">
                  {profileUser.username[0].toUpperCase()}
                </div>
              )}
            </div>
            <div className="profile-info">
              <h1>u/{profileUser.username}</h1>
              <div className="blocked-message">
                <p>You are blocked by this user. You cannot view their profile or interact with their content.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="main-content">
        <div className="profile-header">
          <div className="profile-avatar">
            {profileUser.avatar ? (
              <img src={profileUser.avatar} alt={profileUser.username} />
            ) : (
              <div className="avatar-placeholder">
                {profileUser.username[0].toUpperCase()}
              </div>
            )}
          </div>
          <div className="profile-info">
            <h1>u/{profileUser.username}</h1>
            <div className="profile-stats">
              <span>Karma: {profileUser.karma || 0}</span>
              <span>Joined: {new Date(profileUser.createdAt).toLocaleDateString()}</span>
              {profileUser.followerCount !== undefined && (
                <>
                  <span>{profileUser.followerCount || 0} Followers</span>
                  <span>{profileUser.followingCount || 0} Following</span>
                </>
              )}
            </div>
            <div className="profile-actions">
              {isOwnProfile ? (
                <>
                  <button
                    className="edit-button"
                    onClick={() => {
                      if (editing) {
                        handleSave();
                      } else {
                        setEditing(true);
                        setError('');
                      }
                    }}
                    disabled={actionLoading}
                  >
                    {editing ? (actionLoading ? 'Saving...' : 'Save') : 'Edit Profile'}
                  </button>
                  {editing && (
                    <button
                      className="cancel-button"
                      onClick={() => {
                        setEditing(false);
                        setAvatarFile(null);
                        setAvatarPreview(profileUser?.avatar || null);
                        setEditForm({ bio: profileUser?.bio || '', avatar: profileUser?.avatar || '' });
                        setError('');
                      }}
                      disabled={actionLoading}
                      style={{ marginLeft: 'var(--spacing-sm)' }}
                    >
                      Cancel
                    </button>
                  )}
                </>
              ) : currentUser && (
                <div className="profile-action-buttons">
                  {profileUser.isBlocked ? (
                    <button
                      className="unblock-button"
                      onClick={handleUnblock}
                      disabled={actionLoading}
                    >
                      {actionLoading ? 'Unblocking...' : 'Unblock'}
                    </button>
                  ) : (
                    <>
                      {profileUser.isFollowing ? (
                        <button
                          className="unfollow-button"
                          onClick={handleUnfollow}
                          disabled={actionLoading}
                        >
                          {actionLoading ? 'Unfollowing...' : 'Unfollow'}
                        </button>
                      ) : (
                        <button
                          className="follow-button"
                          onClick={handleFollow}
                          disabled={actionLoading || profileUser.isBlockedBy}
                        >
                          {actionLoading ? 'Following...' : 'Follow'}
                        </button>
                      )}
                      <button
                        className="block-button"
                        onClick={handleBlock}
                        disabled={actionLoading || profileUser.isBlocked}
                      >
                        {actionLoading ? 'Blocking...' : 'Block'}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {editing && isOwnProfile && (
          <div className="edit-section">
            {error && <div className="error-message">{error}</div>}
            <div className="form-group">
              <label>Bio</label>
              <textarea
                value={editForm.bio}
                onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                maxLength={500}
                rows={4}
              />
            </div>
            <div className="form-group">
              <label>Profile Picture</label>
              <div className="avatar-upload-container">
                {avatarPreview && (
                  <div className="avatar-preview-container">
                    <img src={avatarPreview} alt="Avatar preview" className="avatar-preview" />
                    {avatarFile && (
                      <button type="button" className="remove-avatar-btn" onClick={removeAvatar}>
                        ✕
                      </button>
                    )}
                  </div>
                )}
                <label htmlFor="avatar-upload" className="avatar-upload-label">
                  <span className="upload-icon">📷</span>
                  {avatarPreview ? 'Change Picture' : 'Upload Picture'}
                </label>
                <input
                  type="file"
                  id="avatar-upload"
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                  onChange={handleAvatarChange}
                  style={{ display: 'none' }}
                />
              </div>
            </div>
          </div>
        )}

        {profileUser.bio && (
          <div className="profile-bio">
            <p>{profileUser.bio}</p>
          </div>
        )}

        <div className="profile-tabs">
          <button
            className={`profile-tab ${activeTab === 'posts' ? 'active' : ''}`}
            onClick={() => setActiveTab('posts')}
          >
            Posts
          </button>
          <button
            className={`profile-tab ${activeTab === 'comments' ? 'active' : ''}`}
            onClick={() => setActiveTab('comments')}
          >
            Comments
          </button>
          {isOwnProfile && (
            <>
              <button
                className={`profile-tab ${activeTab === 'saved' ? 'active' : ''}`}
                onClick={() => setActiveTab('saved')}
              >
                Saved
              </button>
              <button
                className={`profile-tab ${activeTab === 'upvoted' ? 'active' : ''}`}
                onClick={() => setActiveTab('upvoted')}
              >
                Upvotes
              </button>
              <button
                className={`profile-tab ${activeTab === 'downvoted' ? 'active' : ''}`}
                onClick={() => setActiveTab('downvoted')}
              >
                Downvotes
              </button>
              <button
                className={`profile-tab ${activeTab === 'hidden' ? 'active' : ''}`}
                onClick={() => setActiveTab('hidden')}
              >
                Hidden
              </button>
              <button
                className={`profile-tab ${activeTab === 'communities' ? 'active' : ''}`}
                onClick={() => setActiveTab('communities')}
              >
                Favorite Communities
              </button>
              <button
                className={`profile-tab ${activeTab === 'joined-communities' ? 'active' : ''}`}
                onClick={() => setActiveTab('joined-communities')}
              >
                Joined Communities
              </button>
              <button
                className={`profile-tab ${activeTab === 'created-communities' ? 'active' : ''}`}
                onClick={() => setActiveTab('created-communities')}
              >
                Created Communities
              </button>
            </>
          )}
        </div>

        {renderContent()}
      </div>
    </div>
  );
};

export default Profile;
