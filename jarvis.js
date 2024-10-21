const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const axios = require('axios');
const FormData = require('form-data');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();

// Set up middleware
app.use(bodyParser.json());

// MongoDB connection URI
const mongoURI = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.91iy5uo.mongodb.net/${process.env.DB_NAME}`;
const APIKey = process.env.API_KEY;

// Connect to MongoDB
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

// Define the port for the server to listen on
const port = process.env.PORT || 3000;

// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

// Basic route
app.get('/', (req, res) => {
    res.send('Hello, world!');
});

//------------------------------------JARVIS----------------------------------------------------

// Define the Jarvis schema
const jarvisSchema = new mongoose.Schema({
    userInputAudio: { type: String, required: true },
    openAIResponse: { type: Object },
    outputText: { type: String },
    audioLink: { type: String },
    createdAt: { type: Date, default: Date.now }
});

// Create a Mongoose model for Jarvis data
const Jarvis = mongoose.model('Jarvis', jarvisSchema, 'Jarvis');

// Define the /api/jarvis endpoint
app.post('/api/jarvis', async (req, res) => {
    try {
        const { userInputAudio } = req.body;

        const audioText = await transcribeAudio(userInputAudio);
        const assistantResponse = await getChatCompletion(audioText);
        const audioLink = await convertTextToSpeech(assistantResponse);

        const newJarvisData = new Jarvis({
            userInputAudio,
            openAIResponse: assistantResponse,
            outputText: assistantResponse,
            audioLink
        });
        await newJarvisData.save();

        res.json({ outputText: assistantResponse, audioLink });
    } catch (error) {
        console.error('Error processing request:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Function to transcribe audio
async function transcribeAudio(userInputAudio) {
    const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', {
        model: 'whisper-1',
        file: userInputAudio
    }, {
        headers: {
            'Authorization': `Bearer ${APIKey}`,
            'Content-Type': 'multipart/form-data'
        }
    });
    return response.data.text;
}

// Function to get chat completion
async function getChatCompletion(audioText) {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-3.5-turbo',
        messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: audioText }
        ]
    }, {
        headers: {
            'Authorization': `Bearer ${APIKey}`,
            'Content-Type': 'application/json'
        }
    });
    return response.data.choices[0].message.content;
}

// Function to convert text to speech and upload to GitHub
async function convertTextToSpeech(assistantResponse) {
    const textToSpeechResponse = await axios.post('https://api.openai.com/v1/audio/speech', {
        model: 'tts-1',
        input: assistantResponse,
        voice: 'alloy'
    }, {
        headers: {
            'Authorization': `Bearer ${APIKey}`,
            'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer'
    });

    const fileName = `audio_${Date.now()}.mp3`;
    const audioContent = Buffer.from(textToSpeechResponse.data, 'binary');
    return await uploadFileToGitHub(fileName, audioContent);
}

// Function to upload file to GitHub
async function uploadFileToGitHub(fileName, fileContent) {
    const accessToken = process.env.GITHUB_ACCESS_TOKEN; // Use environment variable
    const repositoryOwner = 'sanket-25';
    const repositoryName = 'cdn';
    const apiUrl = `https://api.github.com/repos/${repositoryOwner}/${repositoryName}/contents/${fileName}`;

    const form = new FormData();
    form.append('message', 'Add file via API');
    form.append('content', fileContent.toString('base64')); // Convert to base64
    form.append('branch', 'main');

    const response = await axios.put(apiUrl, form, {
        headers: {
            'Authorization': `token ${accessToken}`,
            ...form.getHeaders()
        }
    });

    return response.data.content.download_url;
}
