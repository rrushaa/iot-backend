// Import required modules
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');

// Initialize Express app
const app = express();

// Set up middleware
app.use(bodyParser.json());

// MongoDB connection URI (replace <username>, <password>, and <dbname> with your MongoDB Atlas credentials)

// const mongoURI = 'mongodb+srv://2022sanketdhuri:WKm6WEKmHe80Mgql@cluster0.91iy5uo.mongodb.net/iot';

// Connect to MongoDB
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.log(err));

// Create a Mongoose schema
const dataSchema = new mongoose.Schema({
    content: {
        type: String,
        required: true
    }
});

// Create a Mongoose model
const Data = mongoose.model('Data', dataSchema);

// Define a route to handle POST requests
app.post('/api/data', (req, res) => {
    const { content } = req.body;

    // Create a new instance of Data model
    const newData = new Data({
        content: content
    });

    // Save the data to MongoDB
    newData.save()
        .then(data => {
            res.json(data);
        })
        .catch(err => {
            console.error(err);
            res.status(500).send('Server Error');
        });
});

// Define the port for the server to listen on
const port = process.env.PORT || 3000;

// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

// Define a route for the homepage
app.get('/', (req, res) => {
    res.send('Hello, world!');
});
