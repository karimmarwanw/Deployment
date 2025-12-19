# Deployment Guide

This guide will help you deploy the Reddit Clone application to production.

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or MongoDB Atlas)
- Cloudinary account (for image uploads)
- Hugging Face API token (for AI summarization)
- A hosting service (Heroku, Railway, Render, AWS, etc.)

## Pre-Deployment Checklist

- [ ] All environment variables configured
- [ ] MongoDB database set up and accessible
- [ ] Cloudinary account configured
- [ ] Hugging Face API token obtained
- [ ] Strong JWT_SECRET generated
- [ ] Domain names configured (if using custom domains)

## Deployment Steps

### 1. Environment Variables Setup

#### Backend Environment Variables

Create a `.env` file in the `backend/` directory:

```env
PORT=5001
NODE_ENV=production
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_strong_jwt_secret
FRONTEND_URL=https://yourdomain.com
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
HF_TOKEN=your_huggingface_token
```

#### Frontend Environment Variables

Create a `.env` file in the `frontend/` directory:

```env
REACT_APP_API_URL=https://api.yourdomain.com/api
REACT_APP_SOCKET_URL=https://api.yourdomain.com
```

**Note:** Replace `yourdomain.com` with your actual domain names.

### 2. Build the Frontend

```bash
cd frontend
npm install
npm run build
cd ..
```

This creates a `build/` directory in the frontend folder.

### 3. Install Backend Dependencies

```bash
cd backend
npm install --production
cd ..
```

### 4. Start the Production Server

```bash
cd backend
NODE_ENV=production npm start
```

Or use the root script:

```bash
npm run start:prod
```

## Deployment Platforms

### Option 1: Single Server Deployment (Recommended for Small Scale)

Deploy both frontend and backend on the same server:

1. Build the frontend: `npm run build`
2. Set `NODE_ENV=production` in backend `.env`
3. The backend will automatically serve the frontend build
4. Start the backend server

**Pros:**
- Simple setup
- Lower cost
- Single server to manage

**Cons:**
- Less scalable
- Frontend and backend tied together

### Option 2: Separate Frontend and Backend Deployment

Deploy frontend and backend separately:

#### Backend Deployment
- Deploy backend to a Node.js hosting service
- Set `FRONTEND_URL` to your frontend domain
- Ensure CORS is configured correctly

#### Frontend Deployment
- Build frontend: `npm run build`
- Deploy `build/` folder to a static hosting service (Netlify, Vercel, AWS S3, etc.)
- Set `REACT_APP_API_URL` and `REACT_APP_SOCKET_URL` environment variables

**Pros:**
- Better scalability
- Can use CDN for frontend
- Independent scaling

**Cons:**
- More complex setup
- Higher cost
- Need to manage CORS

## Platform-Specific Guides

### Heroku

1. **Install Heroku CLI** and login

2. **Create Heroku app:**
   ```bash
   heroku create your-app-name
   ```

3. **Set environment variables:**
   ```bash
   heroku config:set NODE_ENV=production
   heroku config:set MONGODB_URI=your_mongodb_uri
   heroku config:set JWT_SECRET=your_jwt_secret
   heroku config:set FRONTEND_URL=https://your-app-name.herokuapp.com
   # ... add all other env variables
   ```

4. **Add buildpacks:**
   ```bash
   heroku buildpacks:add heroku/nodejs
   ```

5. **Deploy:**
   ```bash
   git push heroku main
   ```

6. **Build frontend before deployment:**
   Add a `heroku-postbuild` script to root `package.json`:
   ```json
   "heroku-postbuild": "cd frontend && npm install && npm run build"
   ```

### Railway

1. **Connect your repository** to Railway
2. **Set environment variables** in Railway dashboard
3. **Set build command:** `npm run install-all && npm run build`
4. **Set start command:** `cd backend && npm start`
5. **Deploy**

### Render

1. **Create a new Web Service**
2. **Connect your repository**
3. **Set build command:** `npm run install-all && npm run build`
4. **Set start command:** `cd backend && npm start`
5. **Add environment variables** in Render dashboard
6. **Deploy**

### AWS EC2 / DigitalOcean

1. **SSH into your server**
2. **Install Node.js and MongoDB**
3. **Clone your repository**
4. **Set up environment variables**
5. **Build frontend:** `npm run build`
6. **Install PM2:** `npm install -g pm2`
7. **Start with PM2:**
   ```bash
   cd backend
   pm2 start server.js --name reddit-clone
   pm2 save
   pm2 startup
   ```

## Post-Deployment

1. **Test all endpoints** to ensure they're working
2. **Check CORS** configuration if frontend and backend are separate
3. **Monitor logs** for any errors
4. **Set up SSL/HTTPS** (most platforms do this automatically)
5. **Configure domain names** if using custom domains
6. **Set up monitoring** and error tracking (optional but recommended)

## Troubleshooting

### CORS Errors
- Ensure `FRONTEND_URL` matches your actual frontend domain
- Check that CORS is configured correctly in `server.js`
- Verify environment variables are set correctly

### Socket.io Connection Issues
- Ensure `REACT_APP_SOCKET_URL` is set correctly in frontend
- Check that Socket.io CORS configuration matches frontend URL
- Verify WebSocket support on your hosting platform

### MongoDB Connection Issues
- Verify `MONGODB_URI` is correct
- Check MongoDB network access settings (if using Atlas)
- Ensure MongoDB is accessible from your server

### Build Errors
- Ensure all dependencies are installed
- Check Node.js version compatibility
- Review build logs for specific errors

## Security Checklist

- [ ] Strong JWT_SECRET set (use `openssl rand -base64 32`)
- [ ] MongoDB connection string uses authentication
- [ ] CORS configured to only allow your frontend domain
- [ ] Environment variables not committed to git
- [ ] HTTPS/SSL enabled
- [ ] Rate limiting considered (optional)
- [ ] Input validation in place (already implemented)

## Monitoring

Consider setting up:
- **Error tracking:** Sentry, Rollbar
- **Logging:** Winston, Morgan
- **Uptime monitoring:** UptimeRobot, Pingdom
- **Performance monitoring:** New Relic, DataDog

## Scaling Considerations

- Use MongoDB Atlas for managed database
- Consider Redis for caching (optional)
- Use CDN for static assets
- Implement rate limiting
- Use load balancer for multiple instances
- Consider horizontal scaling for backend

