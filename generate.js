// File: /api/generate.js (This handles all Gemini AI requests)

export default async function handler(request, response) {
    // 1. Check if the request method is POST.
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    // 2. Securely get the API key from Vercel's environment variables.
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
        return response.status(500).json({ error: 'API key is not configured on the server.' });
    }

    // 3. Get the prompt and instructions from the request body sent by your app.
    const { contents, systemInstruction } = request.body;

    // 4. Build the payload in the exact format the Gemini API expects.
    const payload = {
        contents,
        // Add the systemInstruction object only if it was provided in the request
        ...(systemInstruction && { systemInstruction }),
        // Add safety settings to prevent the AI from being overly restrictive.
        safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
        ],
    };

    // 5. Set up the correct API endpoint URL.
    const model = 'gemini-1.5-flash-latest';
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

    // 6. Send the request to the Gemini API and return the response to your app.
    try {
        const geminiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!geminiResponse.ok) {
            const errorBody = await geminiResponse.text();
            console.error("Gemini API Error:", errorBody);
            throw new Error(`The AI service returned an error. Status: ${geminiResponse.status}`);
        }

        const data = await geminiResponse.json();
        return response.status(200).json(data);

    } catch (error) {
        console.error('Error in serverless function:', error.message);
        return response.status(500).json({ error: 'An internal server error occurred while contacting the AI.' });
    }
}