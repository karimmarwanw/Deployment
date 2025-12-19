# Environment Variables Configuration

This document describes all environment variables needed for deployment.

## Backend Environment Variables

Create a `.env` file in the `backend/` directory with the following variables:

```env
# Server Configuration
PORT=5001
NODE_ENV=production

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/reddit-clone
# For MongoDB Atlas, use: mongodb+srv://username:password@cluster.mongodb.net/reddit-clone

# JWT Secret (CHANGE THIS IN PRODUCTION - use a strong random string)
# Generate a secure secret: openssl rand -base64 32
JWT_SECRET=your_jwt_secret_key_here_change_in_production

# Frontend URL (for CORS and Socket.io)
FRONTEND_URL=https://yourdomain.com
# In development: http://localhost:3000

# Cloudinary Configuration (for image uploads)
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# Hugging Face API Token (for AI summarization feature)
# Get your free token from: https://huggingface.co/settings/tokens
HF_TOKEN=your_huggingface_token_here
# Alternative variable name (either one works)
HUGGINGFACE_API_TOKEN=your_huggingface_token_here

# Hugging Face Model (optional - defaults to facebook/bart-large-cnn)
HF_SUMMARY_MODEL=facebook/bart-large-cnn
```

## Frontend Environment Variables

Create a `.env` file in the `frontend/` directory with the following variables:

```env
# Backend API URL
# In production, use your backend domain: https://api.yourdomain.com
# In development, leave empty to use proxy from package.json
REACT_APP_API_URL=https://api.yourdomain.com/api

# Socket.io URL
# In production, use your backend domain: https://api.yourdomain.com
# In development: http://localhost:5001
REACT_APP_SOCKET_URL=https://api.yourdomain.com
```

## Important Notes

1. **Never commit `.env` files to version control** - they are already in `.gitignore`
2. **Generate a strong JWT_SECRET** for production:
   ```bash
   openssl rand -base64 32
   ```
3. **Set NODE_ENV=production** when deploying
4. **Update FRONTEND_URL** to match your actual frontend domain
5. **Update REACT_APP_API_URL and REACT_APP_SOCKET_URL** to match your backend domain

