const express = require('express');
const cors = require('cors');
const app = express();
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const nodemailer = require('nodemailer');
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

// Nodemailer transporter setup
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
    }
});

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

// Admin verification middleware
const verifyAdmin = async (req, res, next) => {
    try {
        const email = req.decoded.email;
        const database = client.db("rentizoDB");
        const usersCollection = database.collection("users");

        const user = await usersCollection.findOne({ email });
        if (!user || user.role !== 'admin') {
            return res.status(403).send({ message: 'Admin access required' });
        }
        next();
    } catch (error) {
        res.status(500).send({ message: 'Error verifying admin access' });
    }
};

// 🔥 FIXED: Increment booking count endpoint
app.patch('/cars/:id/increment', async (req, res) => {
  try {
    const id = req.params.id;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ error: 'Invalid car ID format' });
    }

    const database = client.db("rentizoDB");
    const carsCollection = database.collection("cars");

    const result = await carsCollection.updateOne(
      { _id: new ObjectId(id) },
      { 
        $inc: { bookingCount: 1 },
        $set: { updatedAt: new Date() }
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).send({ error: 'Car not found' });
    }

    res.send({ 
      success: true, 
      message: 'Booking count incremented successfully',
      result 
    });
  } catch (error) {
    console.error('Error increasing booking count:', error);
    res.status(500).send({ error: 'Failed to increase booking count' });
  }
});

// Contact form submission endpoint
app.post('/api/contact', async (req, res) => {
    try {
        const { name, email, subject, message } = req.body;

        if (!name || !email || !subject || !message) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        const adminMailOptions = {
            from: process.env.GMAIL_USER,
            to: 'surifroton301@gmail.com',
            subject: `New Contact Form Submission: ${subject}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333; border-bottom: 2px solid #00BFA6; padding-bottom: 10px;">
                        New Contact Form Submission
                    </h2>
                    <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; border-left: 4px solid #00BFA6;">
                        <p><strong>Name:</strong> ${name}</p>
                        <p><strong>Email:</strong> ${email}</p>
                        <p><strong>Subject:</strong> ${subject}</p>
                        <p><strong>Message:</strong></p>
                        <div style="background: white; padding: 15px; border-radius: 5px; margin-top: 10px;">
                            ${message.replace(/\n/g, '<br>')}
                        </div>
                    </div>
                </div>
            `
        };

        const userMailOptions = {
            from: process.env.GMAIL_USER,
            to: email,
            subject: 'Thank you for contacting Rentizo',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #00BFA6; text-align: center;">Thank You for Contacting Rentizo!</h2>
                    <div style="background: #f0f8ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <p>Dear <strong>${name}</strong>,</p>
                        <p>Thank you for reaching out to us. We have received your message and our team will get back to you within 2 business hours.</p>
                        <p>Best regards,<br><strong>The Rentizo Team</strong></p>
                    </div>
                </div>
            `
        };

        await transporter.sendMail(adminMailOptions);
        await transporter.sendMail(userMailOptions);

        if (client.db()) {
            const database = client.db("rentizoDB");
            const contactsCollection = database.collection("contactSubmissions");
            await contactsCollection.insertOne({
                name,
                email,
                subject,
                message,
                submittedAt: new Date(),
                ip: req.ip
            });
        }

        res.json({
            success: true,
            message: 'Message sent successfully! We will get back to you soon.'
        });

    } catch (error) {
        console.error('Error sending contact form:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send message. Please try again later.'
        });
    }
});

// ==================== ADMIN SPECIFIC ENDPOINTS ====================

// Get all users (Admin only)
app.get('/admin/users', verifyFireBaseToken, verifyAdmin, async (req, res) => {
    try {
        const database = client.db("rentizoDB");
        const usersCollection = database.collection("users");

        const users = await usersCollection.find({}).toArray();
        res.send(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).send({ message: 'Failed to fetch users', error: error.message });
    }
});

// Update user role (Admin only)
app.patch('/admin/users/:id/role', verifyFireBaseToken, verifyAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        const { role } = req.body;

        if (!role || !['user', 'car-owner', 'admin'].includes(role)) {
            return res.status(400).send({ message: 'Invalid role specified' });
        }

        const database = client.db("rentizoDB");
        const usersCollection = database.collection("users");

        const result = await usersCollection.updateOne(
            { _id: new ObjectId(userId) },
            {
                $set: {
                    role: role,
                    updatedAt: new Date()
                }
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).send({ message: 'User not found' });
        }

        res.send({
            success: true,
            message: `User role updated to ${role} successfully`
        });
    } catch (error) {
        console.error('Error updating user role:', error);
        res.status(500).send({ message: 'Failed to update user role', error: error.message });
    }
});


// Get admin dashboard statistics
app.get('/admin/stats', verifyFireBaseToken, verifyAdmin, async (req, res) => {
    try {
        const database = client.db("rentizoDB");
        const usersCollection = database.collection("users");
        const carsCollection = database.collection("cars");
        const bookingsCollection = database.collection("bookings");
        const paymentsCollection = database.collection("payments");

        const totalUsers = await usersCollection.countDocuments();
        const totalOwners = await usersCollection.countDocuments({ role: 'car-owner' });
        const totalCars = await carsCollection.countDocuments();
        const totalBookings = await bookingsCollection.countDocuments();

        // Calculate total revenue from payments
        const payments = await paymentsCollection.find({}).toArray();
        const totalRevenue = payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);

        res.send({
            totalUsers,
            totalOwners,
            totalCars,
            totalBookings,
            totalRevenue: `$${totalRevenue.toLocaleString()}`,
            monthlyGrowth: "+12%" // You can calculate this based on actual data
        });
    } catch (error) {
        console.error('Error fetching admin stats:', error);
        res.status(500).send({ message: 'Failed to fetch admin statistics', error: error.message });
    }
});

// Get all cars for admin
app.get('/admin/cars', verifyFireBaseToken, verifyAdmin, async (req, res) => {
    try {
        const database = client.db("rentizoDB");
        const carsCollection = database.collection("cars");

        const cars = await carsCollection.find({}).toArray();
        res.send(cars);
    } catch (error) {
        console.error('Error fetching cars for admin:', error);
        res.status(500).send({ message: 'Failed to fetch cars', error: error.message });
    }
});

// Update car status (Admin only)
app.patch('/admin/cars/:id/status', verifyFireBaseToken, verifyAdmin, async (req, res) => {
    try {
        const carId = req.params.id;
        const { status } = req.body;

        if (!status || !['pending', 'approved', 'rejected'].includes(status)) {
            return res.status(400).send({ message: 'Invalid status specified' });
        }

        const database = client.db("rentizoDB");
        const carsCollection = database.collection("cars");

        const result = await carsCollection.updateOne(
            { _id: new ObjectId(carId) },
            {
                $set: {
                    status: status,
                    updatedAt: new Date()
                }
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).send({ message: 'Car not found' });
        }

        res.send({
            success: true,
            message: `Car status updated to ${status} successfully`
        });
    } catch (error) {
        console.error('Error updating car status:', error);
        res.status(500).send({ message: 'Failed to update car status', error: error.message });
    }
});

// Get all bookings for admin
app.get('/admin/bookings', verifyFireBaseToken, verifyAdmin, async (req, res) => {
    try {
        const database = client.db("rentizoDB");
        const bookingsCollection = database.collection("bookings");

        const bookings = await bookingsCollection.find({}).toArray();
        res.send(bookings);
    } catch (error) {
        console.error('Error fetching bookings for admin:', error);
        res.status(500).send({ message: 'Failed to fetch bookings', error: error.message });
    }
});

// Delete user (Admin only)
app.delete('/admin/users/:id', verifyFireBaseToken, verifyAdmin, async (req, res) => {
    try {
        const userId = req.params.id;

        const database = client.db("rentizoDB");
        const usersCollection = database.collection("users");
        const carsCollection = database.collection("cars");
        const bookingsCollection = database.collection("bookings");
        const paymentsCollection = database.collection("payments");

        // First, check if user exists
        const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
        if (!user) {
            return res.status(404).send({ message: 'User not found' });
        }

        // Delete user's cars
        await carsCollection.deleteMany({ 'addedBy.email': user.email });

        // Delete user's bookings
        await bookingsCollection.deleteMany({ userEmail: user.email });

        // Delete user's payments
        await paymentsCollection.deleteMany({ userEmail: user.email });

        // Finally, delete the user
        const result = await usersCollection.deleteOne({ _id: new ObjectId(userId) });

        if (result.deletedCount === 0) {
            return res.status(404).send({ message: 'User not found' });
        }

        res.send({
            success: true,
            message: 'User and all associated data deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).send({ message: 'Failed to delete user', error: error.message });
    }
});
// Get comprehensive analytics data
app.get('/admin/analytics', verifyFireBaseToken, verifyAdmin, async (req, res) => {
    try {
        const database = client.db("rentizoDB");
        const usersCollection = database.collection("users");
        const carsCollection = database.collection("cars");
        const bookingsCollection = database.collection("bookings");
        const paymentsCollection = database.collection("payments");

        // Basic counts
        const totalUsers = await usersCollection.countDocuments();
        const totalOwners = await usersCollection.countDocuments({ role: 'car-owner' });
        const totalCars = await carsCollection.countDocuments();
        const totalBookings = await bookingsCollection.countDocuments();

        // Revenue calculations
        const payments = await paymentsCollection.find({}).toArray();
        const totalRevenue = payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);

        // Monthly revenue (current month)
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        const monthlyPayments = payments.filter(payment => {
            const paymentDate = new Date(payment.createdAt);
            return paymentDate.getMonth() === currentMonth && paymentDate.getFullYear() === currentYear;
        });
        const monthlyRevenue = monthlyPayments.reduce((sum, payment) => sum + (payment.amount || 0), 0);

        // Pending payments
        const pendingPaymentsData = await paymentsCollection.find({ status: 'pending' }).toArray();
        const pendingPayments = pendingPaymentsData.reduce((sum, payment) => sum + (payment.amount || 0), 0);

        // User distribution
        const userDistribution = [
            { name: 'Regular Users', value: totalUsers - totalOwners },
            { name: 'Car Owners', value: totalOwners }
        ];

        // Car status distribution
        const approvedCars = await carsCollection.countDocuments({ status: 'approved' });
        const pendingCars = await carsCollection.countDocuments({ status: 'pending' });
        const rejectedCars = await carsCollection.countDocuments({ status: 'rejected' });

        const carStatusData = [
            { status: 'Approved', count: approvedCars },
            { status: 'Pending', count: pendingCars },
            { status: 'Rejected', count: rejectedCars }
        ];

        // Active bookings
        const activeBookings = await bookingsCollection.countDocuments({
            status: { $in: ['confirmed', 'active'] }
        });

        // Monthly bookings trend (last 6 months)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const monthlyBookingsData = await bookingsCollection.aggregate([
            {
                $match: {
                    createdAt: { $gte: sixMonthsAgo }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: "$createdAt" },
                        month: { $month: "$createdAt" }
                    },
                    bookings: { $sum: 1 }
                }
            },
            {
                $sort: { "_id.year": 1, "_id.month": 1 }
            }
        ]).toArray();

        const monthlyBookings = monthlyBookingsData.map(item => ({
            month: `${item._id.year}-${item._id.month}`,
            bookings: item.bookings
        }));

        // Revenue trend (last 6 months)
        const revenueTrendData = await paymentsCollection.aggregate([
            {
                $match: {
                    createdAt: { $gte: sixMonthsAgo },
                    status: 'completed'
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: "$createdAt" },
                        month: { $month: "$createdAt" }
                    },
                    revenue: { $sum: "$amount" }
                }
            },
            {
                $sort: { "_id.year": 1, "_id.month": 1 }
            }
        ]).toArray();

        const revenueTrend = revenueTrendData.map(item => ({
            month: `${item._id.year}-${item._id.month}`,
            revenue: item.revenue
        }));

        // Additional metrics
        const availableCars = await carsCollection.countDocuments({
            status: 'approved',
            availability: true
        });

        // Calculate growth percentages (simplified - you can implement actual comparison with previous period)
        const userGrowth = 12; // Example growth percentage
        const revenueGrowth = 8; // Example growth percentage

        // Calculate additional metrics
        const avgBookingValue = totalBookings > 0 ? Math.round(totalRevenue / totalBookings) : 0;
        const occupancyRate = totalCars > 0 ? Math.round((activeBookings / totalCars) * 100) : 0;

        // Repeat customers (users with more than 1 booking)
        const repeatCustomersData = await bookingsCollection.aggregate([
            {
                $group: {
                    _id: "$userEmail",
                    bookingCount: { $sum: 1 }
                }
            },
            {
                $match: {
                    bookingCount: { $gt: 1 }
                }
            }
        ]).toArray();

        const repeatCustomers = repeatCustomersData.length;

        // Cancellation rate
        const cancelledBookings = await bookingsCollection.countDocuments({ status: 'cancelled' });
        const cancellationRate = totalBookings > 0 ? Math.round((cancelledBookings / totalBookings) * 100) : 0;

        res.send({
            // Basic counts
            totalUsers,
            totalOwners,
            totalCars,
            totalBookings,

            // Revenue metrics
            totalRevenue: `$${totalRevenue.toLocaleString()}`,
            monthlyRevenue: `$${monthlyRevenue.toLocaleString()}`,
            pendingPayments: `$${pendingPayments.toLocaleString()}`,
            pendingCount: pendingPaymentsData.length,

            // Growth metrics
            userGrowth,
            revenueGrowth,
            ownerPercentage: totalUsers > 0 ? Math.round((totalOwners / totalUsers) * 100) : 0,

            // Additional metrics
            activeBookings,
            availableCars,
            avgBookingValue: `$${avgBookingValue}`,
            occupancyRate: `${occupancyRate}%`,
            repeatCustomers,
            cancellationRate: `${cancellationRate}%`,

            // Chart data
            userDistribution,
            carStatusData,
            monthlyBookings,
            revenueTrend
        });
    } catch (error) {
        console.error('Error fetching analytics:', error);
        res.status(500).send({ message: 'Failed to fetch analytics data', error: error.message });
    }
});

async function run() {
    try {
        const database = client.db("rentizoDB");
        const carsCollection = database.collection("cars");
        const bookingsCollection = database.collection("bookings");
        const usersCollection = database.collection("users");
        const paymentsCollection = database.collection("payments");

        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "none",
        };

        app.post('/jwt', async (req, res) => {
            const userData = req.body;

            const existingUser = await usersCollection.findOne({ email: userData.email });
            if (!existingUser) {
                await usersCollection.insertOne({
                    name: userData.name,
                    email: userData.email,
                    role: 'user',
                    status: 'active',
                    createdAt: new Date()
                });
            }

            const token = jwt.sign(userData, process.env.JWT_SECRET, { expiresIn: '1d' });
            res.cookie('token', token, cookieOptions);
            res.send({ success: true, message: 'Login successfully' });
        });

        app.post('/logout', async (req, res) => {
            res.clearCookie('token', { ...cookieOptions, maxAge: 0 });
            res.send({ success: true, message: 'Logged out successfully' });
        });

        // Update user role (for users to update their own role)
        app.patch('/users/:email/role', verifyFireBaseToken, async (req, res) => {
            try {
                const email = req.params.email;
                if (email !== req.decoded.email) {
                    return res.status(403).send({ message: 'Forbidden Access' });
                }

                const { role } = req.body;

                if (!role || !['user', 'car-owner', 'admin'].includes(role)) {
                    return res.status(400).send({ message: 'Invalid role specified' });
                }

                const result = await usersCollection.updateOne(
                    { email },
                    { $set: { role: role, updatedAt: new Date() } }
                );

                if (result.matchedCount === 0) {
                    return res.status(404).send({ message: 'User not found' });
                }

                res.send({
                    success: true,
                    message: `Role updated to ${role} successfully`
                });
            } catch (error) {
                console.error('Error updating user role:', error);
                res.status(500).send({ message: 'Failed to update user role', error: error.message });
            }
        });

        app.get('/cars', async (req, res) => {
            try {
                const cars = await carsCollection.find({}).toArray();
                res.send(cars);
            } catch (error) {
                res.status(500).send({ message: 'Error retrieving cars', error });
            }
        });

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

        app.post('/create-payment-intent', verifyFireBaseToken, async (req, res) => {
            try {
                const { amount, currency = 'usd', bookingId } = req.body;

                if (!amount || !bookingId) {
                    return res.status(400).send({ error: 'Amount and booking ID are required' });
                }

                const amountNumber = parseInt(amount);
                if (isNaN(amountNumber)) {
                    return res.status(400).send({ error: 'Amount must be a valid number' });
                }

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

        app.post('/payments', verifyFireBaseToken, async (req, res) => {
            try {
                const paymentData = req.body;

                if (!paymentData.bookingId || !paymentData.paymentIntentId || !paymentData.amount) {
                    return res.status(400).send({ error: 'Missing required payment fields' });
                }

                const existingPayment = await paymentsCollection.findOne({
                    paymentIntentId: paymentData.paymentIntentId
                });

                if (existingPayment) {
                    return res.status(400).send({ error: 'Payment already processed' });
                }

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

        app.post('/cars', verifyFireBaseToken, async (req, res) => {
            const email = req.query.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'Forbidden Access' });
            }

            const newCar = req.body;
            const result = await carsCollection.insertOne(newCar);
            res.send(result);
        });

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
                    status: 'active',
                    createdAt: new Date()
                };

                const result = await usersCollection.insertOne(newUser);
                res.send({ success: true, message: 'User created successfully', result });
            } catch (error) {
                res.status(500).send({ message: 'Failed to create user', error: error.message });
            }
        });

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

        app.delete('/cars/:id', verifyFireBaseToken, async (req, res) => {
            const email = req.query.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'Forbidden Access' });
            }

            const id = req.params.id;
            const result = await carsCollection.deleteOne({ _id: new ObjectId(id) });
            res.send(result);
        });

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