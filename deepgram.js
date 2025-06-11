// File: /api/deepgram.js
import { createClient } from "@deepgram/sdk";

export default async function handler(request, response) {
    const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
    if (!deepgramApiKey) {
        return response.status(500).json({ error: "Deepgram API key not configured." });
    }

    const deepgram = createClient(deepgramApiKey);

    try {
        const { result: newKey, error } = await deepgram.keys.create(
            "ScribeAI Temporary Key", // A name for the key
            ["member"], // Permissions
            { timeToLiveInSeconds: 60 } // Key is only valid for 60 seconds
        );

        if (error) {
            throw error;
        }

        response.status(200).json(newKey);
    } catch (error) {
        console.error("Deepgram key creation error:", error);
        response.status(500).json({ error: "Failed to generate temporary key." });
    }
}