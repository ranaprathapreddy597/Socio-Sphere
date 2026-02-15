# Socio-Sphere

A full-stack social networking application that enables users to connect, share content, and build communities in real-time.

## About the Project

Socio-Sphere is a modern social platform designed to provide seamless user interactions through posts, stories, direct messaging, and trip planning features. It combines a robust backend API with a responsive frontend interface to deliver a complete social networking experience.

## Built With

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - NoSQL database
- **Redis** - Caching layer
- **JWT** - Authentication & authorization
- **Sentry** - Error tracking and monitoring

### Frontend
- **HTML5** - Markup
- **CSS3** - Styling with responsive design
- **Vanilla JavaScript** - Client-side logic

### Additional Tools & Services
- AWS S3 - File storage
- SMTP - Email service
- Giphy API - GIF integration
- Hugging Face API - AI features

## Project Structure

```
├── backend/
│   ├── server.js
│   ├── models/          (Database schemas)
│   ├── routes/          (API endpoints)
│   ├── middleware/      (Auth, logging)
│   └── utils/           (Helper functions)
├── frontend/
│   ├── index.html
│   ├── assets/
│   │   ├── css/
│   │   └── js/
│   └── admin.html
└── .gitignore
```

## Getting Started

### Prerequisites
- Node.js (v14+)
- MongoDB
- Redis

### Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/socio-sphere.git
cd sociosphere2
```

2. Install backend dependencies
```bash
cd backend
npm install
```

3. Create `.env` file in backend directory
```
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/sociosphere
JWT_SECRET=your_secret_key
REDIS_URL=redis://localhost:6379
```

4. Start the backend server
```bash
npm start
```

5. Open frontend
```bash
Open `frontend/index.html` in a browser
```

## Key Features

- User authentication with JWT & OTP
- Create and share posts and stories
- Real-time messaging system
- Trip planning and collaboration
- Admin dashboard
- Performance monitoring
- Content moderation
- User leaderboard

## API Endpoints

- `POST /api/auth/register` - Register user
- `POST /api/auth/login` - User login
- `GET/POST /api/posts` - Manage posts
- `GET/POST /api/messages` - Messaging
- `GET /api/users/:id` - User profile
- `GET/POST /api/stories` - Stories
- `GET /api/leaderboard` - Rankings