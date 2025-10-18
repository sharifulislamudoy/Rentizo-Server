const express = require('express');
const cors = require('cors');
const app = express();
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 3000;
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const carRoutes = require('./routes/cars');
const bookingRoutes = require('./routes/bookings');
const userRoutes = require('./routes/users');

// Middleware Setup
app.use(
    cors({
        origin: [
            "http://localhost:5173",
            "https://rentizo.web.app",
        ],
        credentials: true,
    })
);
app.use(express.json());
app.use(cookieParser());

// MongoDB connection URI using environment variables
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.jcakfyu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// MongoDB client setup
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

// JWT verification middleware
const verifyFireBaseToken = async (req, res, next) => {
    const token = req?.cookies?.token;
    console.log(token)
    if (!token) {
        return res.status(401).send({ message: 'Unauthorized Access' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: 'Unauthorized Access' });
        }
        req.decoded = decoded;
        next();
    });
};

// Cookie options
const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "none",
};

async function run() {
    try {
        await client.connect();
        console.log("Connected to MongoDB");
        
        const database = client.db("rentizoDB");
        const carsCollection = database.collection("cars");
        const bookingsCollection = database.collection("bookings");
        const usersCollection = database.collection("users");

        // Make collections available to routes
        app.locals.db = {
            carsCollection,
            bookingsCollection,
            usersCollection,
            ObjectId,
            verifyFireBaseToken,
            cookieOptions
        };

        // Routes
        app.use('/auth', authRoutes);
        app.use('/cars', carRoutes);
        app.use('/bookings', bookingRoutes);
        app.use('/users', userRoutes);

    } catch (error) {
        console.error("Failed to connect to MongoDB", error);
    }
}
run().catch(console.dir);

// Basic health check route
app.get('/', (req, res) => {
    res.send('Hello World');
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});