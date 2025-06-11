const express = require('express');
const cors = require('cors');
const app = express();
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 3000;
require('dotenv').config();

app.use(cors({
    origin: ['http://localhost:5173'],
    credentials: true,
}));
app.use(express.json());
app.use(cookieParser());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.jcakfyu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

const verifyFireBaseToken = async (req, res, next) => {

    const token = req?.cookies?.token;

    if (!token) {
        return res.status(401).send({ message: 'Unauthorized Access' })
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: 'Unauthorized Access' })
        }
        req.decoded = decoded;
        next();
    })
}


async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)



        await client.connect();
        // Send a ping to confirm a successful connection
        const database = client.db("rentizoDB");
        const carsCollection = database.collection("cars");
        const bookingsCollection = database.collection("bookings");

        app.post('/jwt', async (req, res) => {
            const userData = req.body;
            const token = jwt.sign(userData, process.env.JWT_SECRET, { expiresIn: '1d' })

            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
            })

            res.send({ success: true,message: 'Login successfully' });
        });

        app.post('/logout', (req, res) => {
            res.clearCookie('token', {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
            });
            res.send({ success: true, message: 'Logged out successfully' });
        });



        // 🔹 Get All Cars
        app.get('/cars', async (req, res) => {
            try {
                const cars = await carsCollection.find({}).toArray();
                res.send(cars);
            } catch (error) {
                res.status(500).send({ message: 'Error retrieving cars', error });
            }
        });

        // 🔹 Get Bookings by User Email
        app.get('/bookings', verifyFireBaseToken, async (req, res) => {
            try {
                const email = req.query.email;
                if (email !== req.decoded.email) {
                    return res.status(403).send({ message: 'Forbidden Access' })
                }
                let query = {};
                if (email) query.userEmail = email;  // <-- change here
                const bookings = await bookingsCollection.find(query).toArray();
                res.send(bookings);
            } catch (error) {
                res.status(500).send({ error: 'Failed to fetch bookings' });
            }
        });


        // 🔹 Get Cars by Email
        app.get('/cars/by-email', verifyFireBaseToken, async (req, res) => {
            const email = req.query.email;

            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'Forbidden Access' })
            }

            try {
                const query = { 'addedBy.email': email };
                const cars = await carsCollection.find(query).toArray();
                res.send(cars);
            } catch (error) {
                res.status(500).send({ message: 'Error retrieving cars by email', error: error.message });
            }
        });

        // 🔹 Get Selected Cars
        app.get('/cars/:id', async (req, res) => {
            const id = req.params.id;
            const cars = await carsCollection.findOne({ _id: new ObjectId(id) });
            if (!cars) {
                return res.status(404).send({ error: 'Car not found' });
            }
            res.send(cars);
        });

        // 🔹 Add New Booking
        app.post('/bookings', async (req, res) => {
            try {
                const newBooking = req.body;
                const result = await bookingsCollection.insertOne(newBooking);
                res.send(result);
            } catch (error) {
                res.status(500).send({ error: 'Failed to create booking' });
            }
        });

        // 🔹 Add New Car
        app.post('/cars', async (req, res) => {
            const newCar = req.body;
            const result = await carsCollection.insertOne(newCar);
            res.send(result);
        });

        // 🔹 Update Car
        app.patch('/cars/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const updatedCar = req.body;

                const result = await carsCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: updatedCar }
                );

                res.send(result);
            } catch (err) {
                console.error('Update Error:', err);
                res.status(500).send({ error: 'Failed to update car' });
            }
        });

        // Increment Booking Count
        app.patch('/bookings/:id/increment', async (req, res) => {
            try {
                const id = req.params.id;
                const result = await carsCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $inc: { bookingCount: 1 } }
                );
                res.send(result);
            } catch (error) {
                console.error('Booking Error:', error);
                res.status(500).send({ error: 'Failed to increase booking count' });
            }
        });

        // 🔹 Update Booking (status, etc.)
        app.patch('/bookings/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const updates = req.body;
                const result = await bookingsCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: updates }
                );
                res.send(result);
            } catch (error) {
                console.error('Update Booking Error:', error);
                res.status(500).send({ error: 'Failed to update booking' });
            }
        });

        // 🔹 Delete Booking
        app.delete('/bookings/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const result = await bookingsCollection.deleteOne({ _id: new ObjectId(id) });
                res.send(result);
            } catch (error) {
                console.error('Delete Booking Error:', error);
                res.status(500).send({ error: 'Failed to delete booking' });
            }
        });




        // 🔹 Delete Car
        app.delete('/cars/:id', async (req, res) => {
            const id = req.params.id;
            const result = await carsCollection.deleteOne({ _id: new ObjectId(id) });
            res.send(result);
        });
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Hello World')
});

app.listen(port, () => {
    console.log(`Server is running on ${port}`)
})