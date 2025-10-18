const express = require('express');
const router = express.Router();

// Get all cars
router.get('/', async (req, res) => {
    try {
        const { carsCollection } = req.app.locals.db;
        const cars = await carsCollection.find({}).toArray();
        res.send(cars);
    } catch (error) {
        res.status(500).send({ message: 'Error retrieving cars', error });
    }
});

// Get cars added by a specific user
router.get('/by-email', async (req, res) => {
    try {
        const { carsCollection, verifyFireBaseToken } = req.app.locals.db;
        
        // Apply middleware manually
        verifyFireBaseToken(req, res, async () => {
            const email = req.query.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'Forbidden Access' });
            }

            const query = { 'addedBy.email': email };
            const cars = await carsCollection.find(query).toArray();
            res.send(cars);
        });
    } catch (error) {
        res.status(500).send({ message: 'Error retrieving cars by email', error: error.message });
    }
});

// Get a single car by ID
router.get('/:id', async (req, res) => {
    try {
        const { carsCollection, ObjectId } = req.app.locals.db;
        const id = req.params.id;
        
        if (!ObjectId.isValid(id)) {
            return res.status(400).send({ error: 'Invalid Car ID format' });
        }
        
        const car = await carsCollection.findOne({ _id: new ObjectId(id) });
        if (!car) {
            return res.status(404).send({ error: 'Car not found' });
        }
        res.send(car);
    } catch (error) {
        res.status(500).send({ error: 'Failed to fetch car', error: error.message });
    }
});

// Add a new car
router.post('/', async (req, res) => {
    try {
        const { carsCollection, verifyFireBaseToken } = req.app.locals.db;
        
        verifyFireBaseToken(req, res, async () => {
            const email = req.query.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'Forbidden Access' });
            }

            const newCar = req.body;
            const result = await carsCollection.insertOne(newCar);
            res.send(result);
        });
    } catch (error) {
        res.status(500).send({ error: 'Failed to add car', error: error.message });
    }
});

// Update a car's details
router.patch('/:id', async (req, res) => {
    try {
        const { carsCollection, ObjectId, verifyFireBaseToken } = req.app.locals.db;
        
        verifyFireBaseToken(req, res, async () => {
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
        });
    } catch (err) {
        res.status(500).send({ error: 'Failed to update car' });
    }
});

// Delete a car
router.delete('/:id', async (req, res) => {
    try {
        const { carsCollection, ObjectId, verifyFireBaseToken } = req.app.locals.db;
        
        verifyFireBaseToken(req, res, async () => {
            const email = req.query.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'Forbidden Access' });
            }

            const id = req.params.id;
            const result = await carsCollection.deleteOne({ _id: new ObjectId(id) });
            res.send(result);
        });
    } catch (error) {
        res.status(500).send({ error: 'Failed to delete car', error: error.message });
    }
});

// Increment booking count for a car
router.patch('/:id/increment-booking', async (req, res) => {
    try {
        const { carsCollection, ObjectId } = req.app.locals.db;
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

module.exports = router;