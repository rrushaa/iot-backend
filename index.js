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

// MongoDB connection URI (replace <username>, <password>, and <dbname> with your MongoDB Atlas credentials)

const mongoURI = 'mongodb+srv://2022sanketdhuri:WKm6WEKmHe80Mgql@cluster0.91iy5uo.mongodb.net/iot';
const APIKey = process.env.API_KEY;

// Connect to MongoDB
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.log(err));


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



// Create a Mongoose schema
const dataSchema = new mongoose.Schema({
    userInput: {
        type: String,
        required: true
    },
    openAIResponse: {
        type: Object  // Adjust the type as needed based on the structure of the OpenAI API response
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Create a Mongoose model
const Data = mongoose.model('Data', dataSchema, 'Chats');

// Define a route to handle POST requests
app.post('/api/chat', async (req, res) => {
    const { content } = req.body;

    // Call the OpenAI API
    try {
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: 'gpt-3.5-turbo',
            messages: [
                {
                    role: 'system',
                    content: 'You are a helpful assistant.'
                },
                {
                    role: 'user',
                    content: content
                }
            ]
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${APIKey}` // Replace with your OpenAI API key
            }
        });

        const assistantResponse = response.data.choices[0].message.content;

        // Save the user input and OpenAI response to MongoDB
        const newData = new Data({
            userInput: content,
            openAIResponse: response.data
        });
        await newData.save();

        // Return the response from the OpenAI API
        res.json({ responseChat: assistantResponse });
    } catch (error) {
        console.error(error);
        return res.status(500).send('Error calling OpenAI API');
    }
});




const { Schema, model } = require('mongoose');

// Create a Mongoose schema for audio data
const audioSchema = new mongoose.Schema({
    userInput: {
        type: String,
        required: true
    },
    openAIResponse: {
        type: Object  // Adjust the type as needed based on the structure of the OpenAI API response
    },
    audioUrl: {
        type: String,
        required: true
    },
    audioDownloadUrl: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Create a Mongoose model for audio data
const Audio = mongoose.model('Audio', audioSchema, 'Audio');

// Define a route to handle POST requests for audio generation
app.post('/api/audio', async (req, res) => {
    const { content } = req.body;

    try {
        // Call the OpenAI API for chat completions
        const chatCompletionResponse = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: 'gpt-3.5-turbo',
            messages: [
                {
                    role: 'system',
                    content: 'You are a helpful assistant.'
                },
                {
                    role: 'user',
                    content: content
                }
            ]
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${APIKey}` // Replace with your OpenAI API key
            }
        });

        // Get the response from the chat completion API
        const chatCompletionData = chatCompletionResponse.data;

        // Call the OpenAI API for text-to-speech
        const textToSpeechResponse = await axios.post('https://api.openai.com/v1/audio/speech', {
            model: 'tts-1',
            input: chatCompletionData.choices[0].message.content,
            voice: 'alloy'
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${APIKey}` // Replace with your OpenAI API key
            },
            responseType: 'arraybuffer' // Request response as a buffer
        });

        // Generate a random file name
        const fileName = uuidv4() + '.mp3'; // Unique file name with .mp3 extension

        // Upload the audio file to GitHub
        const audioContent = Buffer.from(textToSpeechResponse.data, 'binary');
        const downloadUrl = await uploadFileToGitHub(fileName, audioContent, content, chatCompletionData);

        // Save the download URL to MongoDB
        const audioUrl = `https://sanket-25.github.io/cdn/${fileName}`;
        const newAudio = new Audio({
            userInput: content,
            openAIResponse: chatCompletionData,
            audioUrl: audioUrl,
            audioDownloadUrl: downloadUrl
        });
        await newAudio.save();
        
        res.json({ audioUrl: audioUrl, audioDownloadUrl: downloadUrl });
    } catch (error) {
        console.error(error);
        return res.status(500).send('Error generating audio');
    }
});

const githubToken = process.env.GITHUB_TOKEN;

// Function to upload file to GitHub
async function uploadFileToGitHub(fileName, fileContent, userInput, openAIResponse) {
    const accessToken = githubToken;
    const repositoryOwner = 'sanket-25';
    const repositoryName = 'cdn';
    const apiUrl = `https://api.github.com/repos/${repositoryOwner}/${repositoryName}/contents/${fileName}`;

    try {
        const response = await axios.put(apiUrl, {
            message: `[IOT]:${userInput}? -> ${openAIResponse.choices[0].message.content}`,
            content: Buffer.from(fileContent).toString('base64'), // Convert content to base64
            branch: 'main' // Or specify another branch
        }, {
            headers: {
                Authorization: `token ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        return response.data.content.download_url;
    } catch (error) {
        console.error('Error uploading file to GitHub:', error);
        throw error;
    }
}

