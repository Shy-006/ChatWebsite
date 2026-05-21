# 💬 Relatime Chat

A full-stack, secure, and feature-rich real-time chat application built using the MERN stack (MongoDB, Express, React, Node.js) with WebSockets (Socket.io) and Redis. It features secure HTTP-Only JWT authentication, real-time message updates, status indicators, and clean modern styling.

---

## 🚀 Key Features

- **Real-Time Messaging**: Instant, low-latency message delivery using WebSockets (`socket.io`).
- **Secure Token Authentication**: Dual-token system using Access and Refresh JWT tokens stored in secure, `HttpOnly` cookies. Features seamless client-side automatic token refreshing.
- **Dynamic Conversations**: Automatic detection and addition of new chat participants without needing to refresh the page.
- **Online/Offline Status**: Live indicators displaying who is currently online in your chats.
- **Read Receipts**: Real-time read status updates when a conversation is opened.
- **Privacy-focused Chat Deletion**: Supports soft-deleting chat histories on a per-user basis. If one user deletes the chat, it only vanishes from their side, remaining visible to the recipient.
- **Rich User Experience**: Clean, responsive, glassmorphic dark UI, toast alerts, emoji selector, and sleek typography.

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 19 (via Vite)
- **Routing**: React Router v7
- **HTTP Client**: Axios (configured with interceptors for token refresh)
- **Real-time Client**: Socket.io-client
- **Styling**: Vanilla CSS (Premium Dark Theme)
- **Utilities**: Emoji Picker React, React Hot Toast, Lucide React

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB (Mongoose ODM)
- **Caching/Session**: Redis
- **Real-time Server**: Socket.io (with WebSocket authentication middleware)
- **Security**: JSON Web Tokens (JWT), Cookie-parser, CORS

---

## 📁 Repository Structure

```text
relatime chat/
├── client/                 # Frontend React application
│   ├── public/             # Static assets
│   ├── src/
│   │   ├── components/     # UI Components (ChatWindow, Sidebar, etc.)
│   │   ├── pages/          # Pages (Login, Signup, Chat)
│   │   ├── services/       # API and Axios helper configurations
│   │   └── App.jsx         # App Routing & Auth verification wrapper
│   ├── package.json
│   ├── vercel.json         # Vercel deployment SPA rewrite configuration
│   └── vite.config.js
│
├── server/                 # Backend Node.js API
│   ├── config/             # DB & Redis connection helpers
│   ├── controllers/        # Request handlers (auth, chat, message)
│   ├── middleware/         # Auth verification middlewares
│   ├── models/             # Mongoose schemas (User, Chat, Message)
│   ├── routes/             # API Router endpoints
│   ├── index.js            # Main entry point & Socket.io server logic
│   └── package.json
```

---

## ⚙️ Local Development Setup

### Prerequisites
- Node.js installed locally
- MongoDB database (local or Mongo Atlas)
- Redis server running locally or hosted

### 1. Backend Setup
1. Navigate to the `server/` directory:
   ```bash
   cd server
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the `server/` directory and configure the environment variables:
   ```env
   PORT=5000
   MONGO_URI=your_mongodb_connection_string
   REDIS_URL=redis://localhost:6379
   ACCESS_TOKEN_SECRET=your_access_token_secret
   REFRESH_TOKEN_SECRET=your_refresh_token_secret
   FRONTEND_URL=http://localhost:5173
   ```
4. Start the backend server:
   ```bash
   npm start
   ```

### 2. Frontend Setup
1. Navigate to the `client/` directory:
   ```bash
   cd ../client
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file (optional, defaults to `http://localhost:5000/api`):
   ```env
   VITE_API_URL=http://localhost:5000/api
   ```
4. Start the frontend development server:
   ```bash
   npm run dev
   ```

---

## 🌐 Deployment Details

### Frontend (Vercel)
The client includes custom `vercel.json` rewrites to properly handle Single Page Application (SPA) client-side routing on Vercel:
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```
This ensures routes like `/login` or `/signup` do not result in `404: NOT_FOUND` errors on refreshing.

### Environment variables in Vercel:
Ensure `VITE_API_URL` is set to your deployed backend API URL (e.g. `https://your-backend.onrender.com/api`).
