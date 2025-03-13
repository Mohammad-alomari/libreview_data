const express = require('express');
const { VitalClient, VitalEnvironment } = require('@tryvital/vital-node');
const axios = require('axios');
require('dotenv').config();
const app = express();
const port = 3000;

// Vital API configuration
const VITAL_API_KEY = process.env.VITAL_API_KEY;
const BASE_URL = 'https://api.sandbox.eu.tryvital.io'; // EU sandbox base URL

// Initialize Vital client
const vitalClient = new VitalClient({
    apiKey: VITAL_API_KEY,
    environment: VitalEnvironment.SandboxEu, // Change to .Production for live
});

// Middleware
app.use(express.json());
app.use(express.static('public')); // Serve static files from 'public' folder

// Endpoint to check if a user exists by client_user_id
app.post('/check-user', async (req, res) => {
    const { clientUserId } = req.body;

    try {
        const response = await vitalClient.user.getByClientUserId(clientUserId);
        console.log(response)
        res.json({ user_id: response.user_id, exists: true });
    } catch (error) {
        console.error('User does not exist or error:', error);
        res.json({ exists: false });
    }
});

// Endpoint to create a new user
app.post('/create-user', async (req, res) => {
    const { clientUserId } = req.body;

    try {
        const response = await vitalClient.user.create({ clientUserId });
        console.log(response)
        res.json({ userId: response.userId });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ error: 'Failed to create user' });
    }
});

// Endpoint to generate link token
app.post('/generate-link-token', async (req, res) => {
    const { userId } = req.body;

    try {
        const response = await vitalClient.link.token({
            userId,
            provider: 'abbott_libreview',
            // Optionally add redirect_url: 'http://localhost:3000/redirect'
        });
        console.log(response)
        res.json(response);
    } catch (error) {
        console.error('Error generating link token:', error);
        res.status(500).json({ error: 'Failed to generate link token' });
    }
});

// Endpoint to fetch historical data
app.get('/fetch-glucose-data', async (req, res) => {
    const { user_id, start_date, end_date } = req.query;
    console.log('User ID:', user_id);
    console.log('Start_date:', start_date);
    console.log('End_date:', end_date);
    try {
        const response = await vitalClient.vitals.glucoseGrouped(user_id,{
            startDate: start_date,
            endDate: end_date,
        });
        console.log(response)
        res.json(response);
    } catch (error) {
        console.error('Error fetching glucose data:', error);
        res.status(500).json({ error: 'Failed to fetch glucose data' });
    }
});

// Optional redirect handler
app.get('/redirect', (req, res) => {
    res.send('Authentication complete! Return to the main page to fetch your data.');
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});