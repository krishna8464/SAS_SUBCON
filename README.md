# SAS_SUBCON

A subcontractor management application for workforce onboarding, site compliance, supplier management, and mobilization review workflows.

## Features
- User authentication and admin account management
- Site and supplier records
- Designation tracking
- Mobilization and review workflows
- Document upload handling and compliance checks
- EJS-based admin and portal views

## Prerequisites
- Node.js 18+
- MongoDB running locally or a reachable MongoDB connection string

## Setup
1. Install dependencies:
   npm install
2. Copy the sample environment file:
   copy .env.example .env
3. Update the values in `.env` if needed.
4. Start the app:
   npm start

The app listens on port 9002 by default.

## Common routes
- /
- /user/login-page
- /user/manage-users
- /site
- /supplier
- /designation
- /mobilization
- /admin-review

## Development note
This project uses Express, Mongoose, EJS, and MongoDB. The server is designed to work with a local MongoDB instance at MongoDB URI from the `.env` file.
