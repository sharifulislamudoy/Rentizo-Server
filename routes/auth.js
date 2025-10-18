const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

router.post('/jwt', async (req, res) => {
    try {
        const { usersCollection, cookieOptions } = req.app.locals.db;
        const userData = req.body;

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
    } catch (error) {
        res.status(500).send({ message: 'Login failed', error: error.message });
    }
});

// Clear JWT cookie on logout
router.post('/logout', async (req, res) => {
    const { cookieOptions } = req.app.locals.db;
    res.clearCookie('token', { ...cookieOptions, maxAge: 0 });
    res.send({ success: true, message: 'Logged out successfully' });
});

module.exports = router;