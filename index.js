const express = require('express');
const cors = require('cors');
const app = express();
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 3000;
require('dotenv').config();

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

async function run() {
    try {
        const database = client.db("rentizoDB");
        const carsCollection = database.collection("cars");
        const bookingsCollection = database.collection("bookings");
        const usersCollection = database.collection("users");


        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "none",
        };

        app.post('/jwt', async (req, res) => {
            const userData = req.body; // { name, email }

            // Store user if not exists
            const existingUser = await usersCollection.findOne({ email: userData.email });
            if (!existingUser) {
                await usersCollection.insertOne({
                    name: userData.name,
                    email: userData.email,
                    role: 'user',
                    createdAt: new Date()
                });
            }

            const token = jwt.sign(userData, process.env.JWT_SECRET, { expiresIn: '1d' });
            res.cookie('token', token, cookieOptions);
            res.send({ success: true, message: 'Login successfully' });
        });


        // Clear JWT cookie on logout
        app.post('/logout', async (req, res) => {
            res.clearCookie('token', { ...cookieOptions, maxAge: 0 });
            res.send({ success: true, message: 'Logged out successfully' });
        });

        // Get all cars
        app.get('/cars', async (req, res) => {
            try {
                const cars = await carsCollection.find({}).toArray();
                res.send(cars);
            } catch (error) {
                res.status(500).send({ message: 'Error retrieving cars', error });
            }
        });


        // Get cars added by a specific user
        app.get('/cars/by-email', verifyFireBaseToken, async (req, res) => {
            const email = req.query.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'Forbidden Access' });
            }

            try {
                const query = { 'addedBy.email': email };
                const cars = await carsCollection.find(query).toArray();
                res.send(cars);
            } catch (error) {
                res.status(500).send({ message: 'Error retrieving cars by email', error: error.message });
            }
        });

        // Get a single car by ID
        app.get('/cars/:id', async (req, res) => {
            const id = req.params.id;
            if (!ObjectId.isValid(id)) {
                return res.status(400).send({ error: 'Invalid Car ID format' });
            }
            const car = await carsCollection.findOne({ _id: new ObjectId(id) });
            if (!car) {
                return res.status(404).send({ error: 'Car not found' });
            }
            res.send(car);
        });

        app.get('/users', async (req, res) => {
            try {
                const users = await usersCollection.find({}).toArray();
                res.send(users);
            } catch (error) {
                res.status(500).send({ message: 'Failed to fetch users', error: error.message });
            }
        });

        app.get('/users/:email', async (req, res) => {
            try {
                const email = req.params.email;
                const user = await usersCollection.findOne({ email });
                if (!user) {
                    return res.status(404).send({ message: 'User not found' });
                }
                res.send(user);
            } catch (error) {
                res.status(500).send({ message: 'Failed to fetch user', error: error.message });
            }
        });


        // Add a new car
        app.post('/cars', verifyFireBaseToken, async (req, res) => {
            const email = req.query.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'Forbidden Access' });
            }

            const newCar = req.body;
            const result = await carsCollection.insertOne(newCar);
            res.send(result);
        });

        // Create a new user
        app.post('/users', async (req, res) => {
            try {
                const { name, email } = req.body;

                if (!name || !email) {
                    return res.status(400).send({ message: 'Name and email are required' });
                }

                // Check if user already exists
                const existingUser = await usersCollection.findOne({ email });
                if (existingUser) {
                    return res.send({ message: 'User already exists', user: existingUser });
                }

                const newUser = {
                    name,
                    email,
                    role: 'user', // Default role
                    createdAt: new Date()
                };

                const result = await usersCollection.insertOne(newUser);
                res.send({ success: true, message: 'User created successfully', result });
            } catch (error) {
                res.status(500).send({ message: 'Failed to create user', error: error.message });
            }
        });


        // Update a car's details
        app.patch('/cars/:id', verifyFireBaseToken, async (req, res) => {
            try {
                const email = req.query.email;
                if (email !== req.decoded.email) {
                    return res.status(403).send({ message: 'Forbidden Access' });
                }

                const id = req.params.id;
                const updatedCar = req.body;
                const result = await carsCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: updatedCar }
                );
                res.send(result);
            } catch (err) {
                res.status(500).send({ error: 'Failed to update car' });
            }
        });

        // Delete a car
        app.delete('/cars/:id', verifyFireBaseToken, async (req, res) => {
            const email = req.query.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'Forbidden Access' });
            }

            const id = req.params.id;
            const result = await carsCollection.deleteOne({ _id: new ObjectId(id) });
            res.send(result);
        });

        // Get all bookings by user email
        app.get('/bookings', verifyFireBaseToken, async (req, res) => {
            try {
                const email = req.query.email;
                if (email !== req.decoded.email) {
                    return res.status(403).send({ message: 'Forbidden Access' });
                }

                const query = { userEmail: email };
                const bookings = await bookingsCollection.find(query).toArray();
                res.send(bookings);
            } catch (error) {
                res.status(500).send({ error: 'Failed to fetch bookings' });
            }
        });

        // Add a new booking
        app.post('/bookings', verifyFireBaseToken, async (req, res) => {
            try {
                const email = req.query.email;
                if (email !== req.decoded.email) {
                    return res.status(403).send({ message: 'Forbidden Access' });
                }

                const newBooking = req.body;
                const result = await bookingsCollection.insertOne(newBooking);
                res.send(result);
            } catch (error) {
                res.status(500).send({ error: 'Failed to create booking' });
            }
        });

        // Update a booking (e.g., status change)
        app.patch('/bookings/:id', verifyFireBaseToken, async (req, res) => {
            try {
                const email = req.query.email;
                if (email !== req.decoded.email) {
                    return res.status(403).send({ message: 'Forbidden Access' });
                }

                const id = req.params.id;
                const updates = req.body;
                const result = await bookingsCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: updates }
                );
                res.send(result);
            } catch (error) {
                res.status(500).send({ error: 'Failed to update booking' });
            }
        });

        // Delete a booking
        app.delete('/bookings/:id', verifyFireBaseToken, async (req, res) => {
            try {
                const email = req.query.email;
                if (email !== req.decoded.email) {
                    return res.status(403).send({ message: 'Forbidden Access' });
                }

                const id = req.params.id;
                const result = await bookingsCollection.deleteOne({ _id: new ObjectId(id) });
                res.send(result);
            } catch (error) {
                res.status(500).send({ error: 'Failed to delete booking' });
            }
        });

        // Increment booking count for a car (e.g., after a booking)
        app.patch('/bookings/:id/increment', async (req, res) => {
            try {
                const id = req.params.id;
                const result = await carsCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $inc: { bookingCount: 1 } }
                );
                res.send(result);
            } catch (error) {
                res.status(500).send({ error: 'Failed to increase booking count' });
            }
        });
    } finally {
        // MongoDB client will stay connected while the server is running
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
