# Reddit Clone

A minimal Reddit clone built with the MERN stack (MongoDB, Express, React, Node.js).

## Features

### Basic Requirements
- ✅ Account creation and login
- ✅ Viewing/Editing user's profile
- ✅ Creating a community
- ✅ Joining/Leaving a community
- ✅ Creating a post on a community
- ✅ Viewing posts of a community
- ✅ Viewing feed page
- ✅ Upvoting/Downvoting posts
- ✅ Commenting on posts
- ✅ Searching for communities and users

### AI Integration Feature
- ✅ AI-powered post summarization using Hugging Face (FREE)

## Tech Stack

### Backend
- Node.js
- Express.js
- MongoDB with Mongoose
- JWT Authentication
- Hugging Face API (FREE - for AI summarization, optional token for better rate limits)

### Frontend
- React
- React Router
- Axios
- CSS (Reddit-inspired styling)

## Setup Instructions

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (local or MongoDB Atlas)
- Hugging Face API Token (REQUIRED - for AI summarization feature)

### Installation

1. **Clone the repository**
   ```bash
   cd "Cursor Reddit"
   ```

2. **Install dependencies**
   ```bash
   npm run install-all
   ```

3. **Set up environment variables**
   
   Create a `.env` file in the `backend` directory:
   ```env
   PORT=5001
   MONGODB_URI=mongodb://localhost:27017/reddit-clone
   JWT_SECRET=your_jwt_secret_key_here_change_in_production
   HUGGINGFACE_API_TOKEN=your_huggingface_token_here
   HF_SUMMARY_MODEL=meta-llama/Llama-3.2-3B-Instruct
   ```
   
   **Note:** Port 5001 is used instead of 5000 because macOS uses port 5000 for AirPlay.
   
   **Getting a FREE Hugging Face API Token (Required):**
   - Go to https://huggingface.co/settings/tokens
   - Create a new token (read access is enough)
   - Copy and paste it into your `.env` file as `HUGGINGFACE_API_TOKEN`
   - The token is required for the AI summarization feature
   
   **Optional:** You can customize the model by setting `HF_SUMMARY_MODEL` in your `.env` file. Default is `meta-llama/Llama-3.2-3B-Instruct`.

4. **Start MongoDB**
   
   Make sure MongoDB is running on your system. If using MongoDB Atlas, update the `MONGODB_URI` in the `.env` file.

5. **Run the application**
   
   In the root directory:
   ```bash
   npm run dev
   ```
   
   This will start both the backend (port 5000) and frontend (port 3000) concurrently.

   Or run them separately:
   
   Backend:
   ```bash
   npm run server
   ```
   
   Frontend:
   ```bash
   npm run client
   ```

6. **Access the application**
   
   Open your browser and navigate to `http://localhost:3000`
   
   **Note:** The backend runs on port 5001 (to avoid conflict with macOS AirPlay on port 5000)

## Project Structure

```
reddit-clone/
├── backend/
│   ├── models/
│   │   ├── User.js
│   │   ├── Community.js
│   │   ├── Post.js
│   │   └── Comment.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── users.js
│   │   ├── communities.js
│   │   ├── posts.js
│   │   ├── comments.js
│   │   └── search.js
│   ├── middleware/
│   │   └── auth.js
│   ├── server.js
│   └── package.json
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── App.js
│   │   └── index.js
│   └── package.json
└── package.json
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (protected)

### Users
- `GET /api/users/:id` - Get user profile
- `PUT /api/users/:id` - Update user profile (protected)

### Communities
- `GET /api/communities` - Get all communities
- `GET /api/communities/:name` - Get community by name
- `POST /api/communities` - Create a community (protected)
- `POST /api/communities/:name/join` - Join a community (protected)
- `POST /api/communities/:name/leave` - Leave a community (protected)

### Posts
- `GET /api/posts` - Get posts (supports query params: community, sort)
- `GET /api/posts/:id` - Get a single post
- `POST /api/posts` - Create a post (protected)
- `POST /api/posts/:id/upvote` - Upvote a post (protected)
- `POST /api/posts/:id/downvote` - Downvote a post (protected)
- `POST /api/posts/:id/summarize` - Generate AI summary (protected)

### Comments
- `GET /api/comments/post/:postId` - Get comments for a post
- `POST /api/comments` - Create a comment (protected)
- `POST /api/comments/:id/upvote` - Upvote a comment (protected)
- `POST /api/comments/:id/downvote` - Downvote a comment (protected)

### Search
- `GET /api/search?q=query&type=all` - Search for communities, users, and posts

## Notes

- The UI is styled to closely match Reddit's dark theme
- JWT tokens are stored in localStorage for authentication
- AI summarization uses Hugging Face Router API (requires free API token)
- All protected routes require a valid JWT token in the Authorization header

## License

This project is for educational purposes.

