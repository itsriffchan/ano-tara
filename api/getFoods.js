import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
  // --- Security & CORS Restriction ---
  const origin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : null);

  if (origin) {
    // Only allow these EXACT websites. No exceptions.
    const allowedOrigins = [
      'http://localhost:5173', // For local development
      'https://ano-tara-kz4es5jzu-itsriffchans-projects.vercel.app', // Your exact Vercel deployment
      'https://ano-tara.ochre.vercel.app' // Your production Vercel deployment
    ];

    if (!allowedOrigins.includes(origin)) {
      return res.status(403).json({ error: 'Forbidden: Unauthorized host' });
    }

    // Set headers to allow the request for authorized origins
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    // If it's a preflight CORS check, respond immediately
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
  }
  // -----------------------------------

  const { budget } = req.query;

  if (!budget) {
    return res.status(400).json({ error: 'Budget is required' });
  }

  try {
    // Access the secure API key from Vercel's backend environment variables
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

    console.log("Using API Key (first 10 chars):", apiKey ? apiKey.substring(0, 10) : "NOT SET");

    if (!apiKey) {
      return res.status(500).json({ error: 'API key not configured on Vercel backend' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `You must respond with ONLY a valid JSON array. No text before or after. No markdown code blocks.
[
  {"display": "Food1", "search": "Search1"},
  {"display": "Food2", "search": "Search2"}
]

Now, generate exactly 12 trending or popular food items in the Philippines based on this budget: ${budget} PHP.

Budget rules:
- 50-100 PHP: Only cheap street foods (Fishball, Kikiam, Taho, Siomai, Pandesal)
- 100-300 PHP: Local fast food and carinderia meals
- 300+ PHP: Premium options (Cafes, K-BBQ, Buffets, Dubai Chocolate, Wagyu)

Return ONLY the JSON array with no additional text.`;

    console.log("Calling Gemini API...");
    const result = await model.generateContent(prompt);
    console.log("Got result object:", !!result);
    
    if (!result || !result.response) {
      return res.status(500).json({ error: 'Empty response from Gemini API' });
    }
    
    const rawText = result.response.text();
    console.log("Raw Gemini response length:", rawText.length);
    console.log("Raw response:", rawText);
    
    if (!rawText || rawText.trim().length === 0) {
      return res.status(500).json({ error: 'Gemini returned empty response' });
    }
    
    // Extract JSON array from the response
    let cleanJson = null;
    
    // Try to find JSON array
    const startIdx = rawText.indexOf('[');
    const endIdx = rawText.lastIndexOf(']');
    
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      cleanJson = rawText.substring(startIdx, endIdx + 1).trim();
    }
    
    if (!cleanJson) {
      console.error("Could not extract JSON. Full response:", rawText);
      return res.status(500).json({ error: 'No JSON array found in response', fullResponse: rawText });
    }
    
    console.log("Extracted JSON:", cleanJson);
    
    let newFoods;
    try {
      newFoods = JSON.parse(cleanJson);
    } catch (parseError) {
      console.error("JSON parse error:", parseError.message);
      console.error("Attempted to parse:", cleanJson.substring(0, 200));
      return res.status(500).json({ error: 'Invalid JSON: ' + parseError.message, attempted: cleanJson.substring(0, 200) });
    }

    if (!Array.isArray(newFoods)) {
      return res.status(500).json({ error: 'Parsed JSON is not an array' });
    }

    if (newFoods.length < 2) {
      return res.status(500).json({ error: `Got only ${newFoods.length} items, need at least 2` });
    }

    return res.status(200).json(newFoods);
    
  } catch (error) {
    console.error("AI Generation Failed:", error);
    return res.status(500).json({ error: error.message || 'Failed to generate foods' });
  }
}
