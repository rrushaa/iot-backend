

//------------------------------------JARVIS----------------------------------------------------

// Define the Jarvis schema
const jarvisSchema = new mongoose.Schema({
    userInputAudio: {
        type: String,
        required: true
    },
    openAIResponse: {
        type: Object
    },
    outputText: {
        type: String
    },
    audioLink: {
        type: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Create a Mongoose model for Jarvis data
const Jarvis = mongoose.model('Jarvis', jarvisSchema, 'Jarvis');

// Define the /api/jarvis endpoint
app.post('/api/jarvis', async (req, res) => {
    try {
        const { userInputAudio } = req.body;

        // Call the OpenAI API for audio transcriptions
        const audioTranscriptionResponse = await axios.post('https://api.openai.com/v1/audio/transcriptions', {
            model: 'whisper-1',
            file: userInputAudio
        }, {
            headers: {
                'Authorization': `Bearer ${APIKey}`,
                'Content-Type': 'multipart/form-data'
            }
        });

        const audioText = audioTranscriptionResponse.data.text;

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
                    content: audioText
                }
            ]
        }, {
            headers: {
                'Authorization': `Bearer ${APIKey}`,
                'Content-Type': 'application/json'
            }
        });

        const assistantResponse = chatCompletionResponse.data.choices[0].message.content;

        // Call the OpenAI API for text-to-speech
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

        // Upload the audio file to GitHub
        const fileName = `audio_${Date.now()}.mp3`;
        const audioContent = Buffer.from(textToSpeechResponse.data, 'binary');
        const audioLink = await uploadFileToGitHub(fileName, audioContent);

        // Save the Jarvis data to MongoDB
        const newJarvisData = new Jarvis({
            userInputAudio,
            openAIResponse: chatCompletionResponse.data,
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

// Function to upload file to GitHub
async function uploadFileToGitHub(fileName, fileContent) {
    try {
        const accessToken = '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';
        const repositoryOwner = 'sanket-25';
        const repositoryName = 'cdn';
        const apiUrl = `https://api.github.com/repos/${repositoryOwner}/${repositoryName}/contents/${fileName}`;

        const form = new FormData();
        form.append('message', 'Add file via API');
        form.append('content', fileContent, { filename: fileName });
        form.append('branch', 'main');

        const response = await axios.put(apiUrl, form, {
            headers: {
                'Authorization': `token ${accessToken}`,
                ...form.getHeaders()
            }
        });

        return response.data.content.download_url;
    } catch (error) {
        console.error('Error uploading file to GitHub:', error);
        throw error;
    }
}