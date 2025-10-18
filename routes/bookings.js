const express = require('express');
const router = express.Router();

// Get all bookings by user email
router.get('/', async (req, res) => {
    try {
        const { bookingsCollection, verifyFireBaseToken } = req.app.locals.db;
        
        verifyFireBaseToken(req, res, async () => {
            const email = req.query.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'Forbidden Access' });
            }

            const query = { userEmail: email };
            const bookings = await bookingsCollection.find(query).toArray();
            res.send(bookings);
        });
    } catch (error) {
        res.status(500).send({ error: 'Failed to fetch bookings' });
    }
});

// Get a single booking by ID
router.get('/:id', async (req, res) => {
    try {
        const { bookingsCollection, ObjectId, verifyFireBaseToken } = req.app.locals.db;
        
        verifyFireBaseToken(req, res, async () => {
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
        });
    } catch (error) {
        console.error('Error fetching booking:', error);
        res.status(500).send({ error: 'Failed to fetch booking details' });
    }
});

// Add a new booking
router.post('/', async (req, res) => {
    try {
        const { bookingsCollection, verifyFireBaseToken } = req.app.locals.db;
        
        verifyFireBaseToken(req, res, async () => {
            const email = req.query.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'Forbidden Access' });
            }

            const newBooking = req.body;
            const result = await bookingsCollection.insertOne(newBooking);
            res.send(result);
        });
    } catch (error) {
        res.status(500).send({ error: 'Failed to create booking' });
    }
});

// Update a booking (e.g., status change)
router.patch('/:id', async (req, res) => {
    try {
        const { bookingsCollection, ObjectId, verifyFireBaseToken } = req.app.locals.db;
        
        verifyFireBaseToken(req, res, async () => {
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
        });
    } catch (error) {
        res.status(500).send({ error: 'Failed to update booking' });
    }
});

// Delete a booking
router.delete('/:id', async (req, res) => {
    try {
        const { bookingsCollection, ObjectId, verifyFireBaseToken } = req.app.locals.db;
        
        verifyFireBaseToken(req, res, async () => {
            const email = req.query.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'Forbidden Access' });
            }

            const id = req.params.id;
            const result = await bookingsCollection.deleteOne({ _id: new ObjectId(id) });
            res.send(result);
        });
    } catch (error) {
        res.status(500).send({ error: 'Failed to delete booking' });
    }
});

module.exports = router;