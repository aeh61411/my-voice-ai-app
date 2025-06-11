// File: /api/generate.js (Corrected and Final Version)

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
        return response.status(500).json({ error: 'API key is not configured on the server.' });
    }

    // BUG FIX: Destructure the expected payload from the client
    const { contents, systemInstruction } = request.body;

    // Construct the correct payload for the Gemini API
    const payload = {
        contents,
        // BUG FIX: Add the systemInstruction to the payload if it exists
        ...(systemInstruction && { systemInstruction }),
        // IMPROVEMENT: Add safety settings
        safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
        ],
    };

    // BUG FIX: The model name was missing from the URL.
    const model = 'gemini-1.5-flash-latest';
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

    try {
        const geminiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!geminiResponse.ok) {
            const errorBody = await geminiResponse.text();
            console.error("Gemini API Error:", errorBody);
            throw new Error(`Gemini API error! Status: ${geminiResponse.status}`);
        }

        const data = await geminiResponse.json();
        return response.status(200).json(data);

    } catch (error) {
        console.error('Error in serverless function:', error.message);
        return response.status(500).json({ error: 'An internal server error occurred while contacting the AI.' });
    }
}