// File: /api/deepgram.js
import { createClient } from "@deepgram/sdk";

export default async function handler(request, response) {
    const deepgramApiKey = process.env.DEEPGRAM_API_KEY;

    // Create a new Deepgram client
    const deepgram = createClient(deepgramApiKey);

    try {
        // We create a temporary key that is only valid for a few minutes
        const { result: newKey, error } = await deepgram.keys.create(
            "ScribeAI Temporary Key",
            ["member"],
            { timeToLiveInSeconds: 60 * 2 } // Key is valid for 2 minutes
        );
        if (error) throw error;
        // Send the temporary key back to the client
        return response.status(200).json(newKey);
    } catch (error) {
        console.error("Deepgram key creation error:", error);
        return response.status(500).json({ error: "Failed to get temporary transcription key." });
    }
}