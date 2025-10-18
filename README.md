# Rentizo Server

## Overview

Rentizo is a modern, fully responsive rental management platform client application built with React. It provides a seamless and user-friendly experience for users to browse available vehicles, book rentals, and manage their bookings efficiently. The platform supports multiple user roles including customers, car owners, and administrators, each with tailored dashboards and features.

The application is designed with performance, accessibility, and smooth animations in mind, ensuring an engaging experience across devices — from desktops to smartphones.

### Technologies Used

Rentizo client leverages a robust and modern tech stack, including:

- **React.js** for building interactive user interfaces
- **React Router** for dynamic routing and navigation
- **Tailwind CSS** and **DaisyUI** for utility-first styling and component design
- **Framer Motion** for smooth animations and transitions
- **React Icons** for scalable iconography
- **Axios** for handling HTTP requests to backend APIs
- **Express** for backend
- **MongoDB** for Database

This combination of technologies enables Rentizo to deliver a scalable, maintainable, and visually appealing rental platform.


---

## Table of Contents
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [Configuration](#configuration)
- [Live-Link](https://rentizo.web.app/)

---

## Features

- User authentication (signup, login, logout)
- Browse and search available rental cars
- Booking management and history
- Responsive design for mobile and desktop
- Interactive dashboards for users, car owners, and admins
- Real-time notifications and alerts
- Integration with backend APIs for car and booking data

---

## Installation

1. Clone the repository (client side):
   ```bash
   git clone https://github.com/sharifulislamudoy/Rentizo-Client
   cd Rentizo-Client

2. Clone the repository (server side):
   ```bash
   git clone https://github.com/sharifulislamudoy/Rentizo-Server
   cd Rentizo-Server
   
4. Install dependencies and run
   ```bash
   npm install
   npm run dev
   nodemon index.js

## Usage

After setting up and running the development server locally (`npm start` or `yarn start`), you can use the Rentizo client as follows:

1. **Browse Available Cars**  
   - On the homepage, view featured and available rental cars.
   - Use search and filter options to find cars by location, type, price, or availability.

2. **User Authentication**  
   - Register a new account or log in using your credentials.
   - Use social login options if enabled (Google, Facebook, etc.).

3. **Book a Car**  
   - Select a car you want to rent.
   - Choose rental dates and confirm your booking.
   - View your active and past bookings in your user dashboard.

4. **Manage Bookings**  
   - Modify or cancel existing bookings from your dashboard.
   - Receive notifications and reminders for upcoming bookings.

5. **Owner Dashboard (if applicable)**  
   - For car owners, add and manage your listed vehicles.
   - Track bookings and earnings.

6. **Admin Dashboard (if applicable)**  
   - Manage users, bookings, and vehicle listings.
   - Access analytics and reports.

---

## Configuration

To properly run the Rentizo client, you need to configure environment variables and API endpoints.

### Environment Variables

Create a `.env` file in the root of the project and add the following variables:

   ```env
DB_USER=Rentizo_User
DB_PASSWORD=Z8xxmBEYs0C9P1gJ
NODE_ENV=production
JWT_SECRET=9a3ad2f70cdc2129fae7b7c55a1464be710929994179708928c688600cabc74a2eaa1c514ac7836c07f75da339944b025f48e11bc985f8b4ab40116e89331ce2

