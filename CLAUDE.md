# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an LMS (Learning Management System) web application organized as a monorepo with separate backend and frontend directories.

## Project Structure

```
lms-webapp/
├── backend/          # Express.js API server
│   ├── index.js     # Server entry point with basic routes (/, /health)
│   └── package.json # Uses ES modules ("type": "module")
└── frontend/         # (Not yet implemented)
```

## Development Commands

### Backend

```bash
cd backend
npm install              # Install dependencies
npm run dev             # Start development server on port 3000
```

The backend server runs on `http://localhost:3000` with two endpoints:

- `GET /` - Basic server status check
- `GET /health` - Health check with timestamp

## Technical Details

- **Module System**: Backend uses ES modules (`import`/`export` syntax)
- **Framework**: Express.js v5.2.1
- **Node.js**: ES module imports required
