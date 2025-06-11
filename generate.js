// File: /api/generate.js

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    // This securely accesses the key you just saved in your Vercel settings.
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    try {
        const { contents } = request.body;
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;

        const geminiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents }),
        });

        if (!geminiResponse.ok) {
            throw new Error(`Gemini API responded with status: ${geminiResponse.status}`);
        }

        const data = await geminiResponse.json();
        return response.status(200).json(data);

    } catch (error) {
        console.error('Error in serverless function:', error.message);
        return response.status(500).json({ error: 'Failed to communicate with the AI service.' });
    }
}