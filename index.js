const express = require('express');
const cors = require('cors');
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 3000;
require('dotenv').config();

app.use(cors());
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.jcakfyu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)



        await client.connect();
        // Send a ping to confirm a successful connection
        const database = client.db("rentizoDB");
        const carsCollection = database.collection("cars");

        // 🔹 Get All Cars or Cars by Email
        app.get('/cars', async (req, res) => {
            const email = req.query.email;
            let query = {};
            if (email) query['addedBy.email'] = email;
            const cars = await carsCollection.find(query).toArray();
            res.send(cars);
        });
        // 🔹 Get Selected Cars or Cars by Email
        app.get('/cars/:id', async (req, res) => {
            const id = req.params.id;
            const cars = await carsCollection.findOne({ _id: new ObjectId(id) });
            if (!cars) {
                return res.status(404).send({ error: 'Car not found' });
            }
            res.send(cars);
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
        app.patch('/cars/book/:id', async (req, res) => {
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