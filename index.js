const express = require('express');
const cors = require('cors');
const app = express();
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 3000;
const Stripe = require('stripe');
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
const stripe = Stripe(process.env.Stripe_Secret_Key);

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
        const paymentsCollection = database.collection("payments"); // New collection for payments

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

        // Update user profile
        app.patch('/users/:email', verifyFireBaseToken, async (req, res) => {
            try {
                const email = req.params.email;
                if (email !== req.decoded.email) {
                    return res.status(403).send({ message: 'Forbidden Access' });
                }

                const updates = req.body;
                const result = await usersCollection.updateOne(
                    { email },
                    { $set: updates }
                );

                if (result.matchedCount === 0) {
                    return res.status(404).send({ message: 'User not found' });
                }

                res.send({ success: true, message: 'Profile updated successfully' });
            } catch (error) {
                res.status(500).send({ message: 'Failed to update profile', error: error.message });
            }
        });

        app.get('/bookings/:id', verifyFireBaseToken, async (req, res) => {
            try {
                const id = req.params.id;

                if (!ObjectId.isValid(id)) {
                    return res.status(400).send({ error: 'Invalid booking ID format' });
                }

                const booking = await bookingsCollection.findOne({
                    _id: new ObjectId(id)
                });

                if (!booking) {
                    return res.status(404).send({ error: 'Booking not found' });
                }

                if (booking.userEmail !== req.decoded.email) {
                    return res.status(403).send({ message: 'Forbidden Access' });
                }

                res.send(booking);
            } catch (error) {
                console.error('Error fetching booking:', error);
                res.status(500).send({ error: 'Failed to fetch booking details' });
            }
        });

        // Create Payment Intent - FIXED ROUTE
        app.post('/create-payment-intent', verifyFireBaseToken, async (req, res) => {
            try {
                const { amount, currency = 'usd', bookingId } = req.body;

                if (!amount || !bookingId) {
                    return res.status(400).send({ error: 'Amount and booking ID are required' });
                }

                // Validate amount is a number
                const amountNumber = parseInt(amount);
                if (isNaN(amountNumber)) {
                    return res.status(400).send({ error: 'Amount must be a valid number' });
                }

                // Create a PaymentIntent with the order amount and currency
                const paymentIntent = await stripe.paymentIntents.create({
                    amount: amountNumber,
                    currency: currency,
                    automatic_payment_methods: {
                        enabled: true,
                    },
                    metadata: {
                        bookingId: bookingId,
                        userEmail: req.decoded.email,
                    },
                });

                res.send({
                    clientSecret: paymentIntent.client_secret,
                    paymentIntentId: paymentIntent.id,
                });
            } catch (error) {
                console.error('Error creating payment intent:', error);
                res.status(500).send({ error: 'Failed to create payment intent: ' + error.message });
            }
        });

        // Save payment data to database
        app.post('/payments', verifyFireBaseToken, async (req, res) => {
            try {
                const paymentData = req.body;
                
                // Validate required fields
                if (!paymentData.bookingId || !paymentData.paymentIntentId || !paymentData.amount) {
                    return res.status(400).send({ error: 'Missing required payment fields' });
                }

                // Check if payment already exists
                const existingPayment = await paymentsCollection.findOne({
                    paymentIntentId: paymentData.paymentIntentId
                });

                if (existingPayment) {
                    return res.status(400).send({ error: 'Payment already processed' });
                }

                // Insert payment data
                const result = await paymentsCollection.insertOne({
                    ...paymentData,
                    createdAt: new Date(),
                    status: 'completed'
                });

                res.send({
                    success: true,
                    message: 'Payment saved successfully',
                    paymentId: result.insertedId
                });
            } catch (error) {
                console.error('Error saving payment:', error);
                res.status(500).send({ error: 'Failed to save payment: ' + error.message });
            }
        });

        // Get payments by user email
        app.get('/payments', verifyFireBaseToken, async (req, res) => {
            try {
                const email = req.query.email;
                if (email !== req.decoded.email) {
                    return res.status(403).send({ message: 'Forbidden Access' });
                }

                const payments = await paymentsCollection.find({ userEmail: email }).toArray();
                res.send(payments);
            } catch (error) {
                console.error('Error fetching payments:', error);
                res.status(500).send({ error: 'Failed to fetch payments' });
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

                const existingUser = await usersCollection.findOne({ email });
                if (existingUser) {
                    return res.send({ message: 'User already exists', user: existingUser });
                }

                const newUser = {
                    name,
                    email,
                    role: 'user',
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
    res.send('Rentizo Server is running');
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});