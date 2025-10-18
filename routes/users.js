const express = require('express');
const router = express.Router();

// Get all users
router.get('/', async (req, res) => {
    try {
        const { usersCollection } = req.app.locals.db;
        const users = await usersCollection.find({}).toArray();
        res.send(users);
    } catch (error) {
        res.status(500).send({ message: 'Failed to fetch users', error: error.message });
    }
});

// Get user by email
router.get('/:email', async (req, res) => {
    try {
        const { usersCollection } = req.app.locals.db;
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

// Create a new user
router.post('/', async (req, res) => {
    try {
        const { usersCollection } = req.app.locals.db;
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

// Update user profile
router.patch('/:email', async (req, res) => {
    try {
        const { usersCollection, verifyFireBaseToken } = req.app.locals.db;
        
        verifyFireBaseToken(req, res, async () => {
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
        });
    } catch (error) {
        res.status(500).send({ message: 'Failed to update profile', error: error.message });
    }
});

module.exports = router;