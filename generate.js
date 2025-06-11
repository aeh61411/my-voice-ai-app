// File: /api/generate.js
export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }
    
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    const { prompt } = request.body;

    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
    };

    const model = 'gemini-1.5-flash-latest';
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

    try {
        const geminiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!geminiResponse.ok) {
            const errorText = await geminiResponse.text();
            throw new Error(`Gemini API error: ${errorText}`);
        }

        const data = await geminiResponse.json();
        // Extract the text from the response and send it back
        const refinedText = data.candidates[0].content.parts[0].text;
        return response.status(200).json({ text: refinedText });
    } catch (error) {
        console.error(error);
        return response.status(500).json({ error: 'Failed to contact the AI service.' });
    }
}