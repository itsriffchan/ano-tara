import { GoogleGenerativeAI } from '@google/generative-ai';

const FALLBACK_FOODS = {
  '50-100': [
    { display: 'Tusok-tusok', search: 'Fishball Kikiam Kwek Kwek' },
    { display: 'Taho', search: 'Taho' },
    { display: 'Pandesal', search: 'Pandesal' },
    { display: 'Siomai', search: 'Siomai' },
    { display: 'Turon', search: 'Turon' },
    { display: 'Banana Cue', search: 'Banana Cue' },
    { display: 'Camote Cue', search: 'Camote Cue' },
    { display: 'Kwek-Kwek', search: 'Kwek-Kwek' },
    { display: 'Fishball', search: 'Fishball' },
    { display: 'Kikiam', search: 'Kikiam' },
    { display: 'Isaw', search: 'Isaw' },
    { display: 'Pares', search: 'Pares' },
  ],
  '100-300': [
    { display: 'Ilocos Empanada', search: 'Ilocos Empanada' },
    { display: 'Overload Hotdog', search: 'Overload Hotdog' },
    { display: 'Loaded Fries', search: 'Loaded Fries' },
    { display: 'Milk Tea', search: 'Milk Tea' },
    { display: 'Takoyaki', search: 'Takoyaki' },
    { display: 'Korean Corn Dog', search: 'Korean Corn Dog' },
    { display: 'Mango Graham', search: 'Mango Graham' },
    { display: 'Ramen', search: 'Ramen' },
    { display: 'Birria Tacos', search: 'Birria Tacos' },
    { display: 'Chicken Inasal', search: 'Chicken Inasal' },
    { display: 'Pork Sisig', search: 'Pork Sisig' },
    { display: 'Silog Meal', search: 'Tapsilog' },
  ],
  '300+': [
    { display: 'Dubai Chewy Cookie', search: 'Dubai Chewy Cookie' },
    { display: 'Samgyup', search: 'Samgyupsal' },
    { display: 'Bingsu', search: 'Bingsu' },
    { display: 'Matcha', search: 'Matcha Latte' },
    { display: 'Steak', search: 'Steak' },
    { display: 'Buffet', search: 'Buffet' },
    { display: 'Sushi Set', search: 'Sushi Set' },
    { display: 'Shabu-Shabu', search: 'Shabu-Shabu' },
    { display: 'Lobster', search: 'Lobster' },
    { display: 'Truffle Pasta', search: 'Truffle Pasta' },
    { display: 'Wagyu', search: 'Wagyu' },
    { display: 'Craft Cafe', search: 'Specialty Coffee Cafe' },
  ],
};

function normalizeBudget(budget) {
  if (budget === '50-100' || budget === '100-300' || budget === '300+') return budget;
  return '100-300';
}

function asText(value) {
  return String(value || '').trim();
}

function sanitizeFoods(rawFoods) {
  if (!Array.isArray(rawFoods)) return [];

  const cleaned = [];
  const seen = new Set();

  for (const entry of rawFoods) {
    const display = asText(entry?.display).slice(0, 40);
    const search = asText(entry?.search).slice(0, 80);
    if (!display || !search) continue;

    const normalizedItem = { display, search };

    const dedupeKey = `${display.toLowerCase()}|${search.toLowerCase()}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    cleaned.push(normalizedItem);
  }

  return cleaned;
}

function buildResponseFoods(rawFoods, budget) {
  const bucket = normalizeBudget(budget);
  const validated = sanitizeFoods(rawFoods);
  const fallback = FALLBACK_FOODS[bucket];

  // Fill with fallback if AI output is partial/invalid.
  const merged = [...validated];
  const seen = new Set(merged.map((i) => `${i.display.toLowerCase()}|${i.search.toLowerCase()}`));

  for (const item of fallback) {
    const key = `${item.display.toLowerCase()}|${item.search.toLowerCase()}`;
    if (!seen.has(key)) {
      merged.push(item);
      seen.add(key);
    }
    if (merged.length >= 12) break;
  }

  return merged.slice(0, 12);
}

export default async function handler(req, res) {
  // --- Security & CORS Restriction ---
  const origin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : null);

  if (origin) {
    // Only allow these EXACT websites. No exceptions.
    const allowedOrigins = [
      'http://localhost:5173', // For local development
      'https://ano-tara-kz4es5jzu-itsriffchans-projects.vercel.app', 
      'https://ano-tara-ochre.vercel.app', // Your actual production URL
    ];

    if (!allowedOrigins.includes(origin)) {
      console.error(`Unauthorized origin: ${origin}`);
      return res.status(403).json({ error: `Forbidden: Unauthorized host (${origin})` });
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
  const normalizedBudget = normalizeBudget(budget);

  if (!budget) {
    return res.status(400).json({ error: 'Budget is required' });
  }

  try {
    // Access the secure API key from Vercel's backend environment variables
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

    console.log("Using API Key (first 10 chars):", apiKey ? apiKey.substring(0, 10) : "NOT SET");

    if (!apiKey) {
      return res.status(200).json(FALLBACK_FOODS[normalizedBudget]);
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `You must respond with ONLY a valid JSON array. No text before or after. No markdown code blocks.
[
  {"display": "Food1", "search": "Search1"},
  {"display": "Food2", "search": "Search2"}
]

Now, generate exactly 12 trending or popular food items in the Philippines based on this budget: ${normalizedBudget} PHP range.

Budget rules:
- 50-100 PHP: Only cheap street foods (Fishball, Kikiam, Taho, Siomai, Pandesal)
- 100-300 PHP: Local fast food and carinderia meals
- 300+ PHP: Premium options (Cafes, K-BBQ, Buffets, Dubai Chocolate, Wagyu)

Return ONLY the JSON array with no additional text.`;

    console.log("Calling Gemini API...");
    const result = await model.generateContent(prompt);
    console.log("Got result object:", !!result);
    
    if (!result || !result.response) {
      return res.status(200).json(FALLBACK_FOODS[normalizedBudget]);
    }
    
    const rawText = result.response.text();
    console.log("Raw Gemini response length:", rawText.length);
    console.log("Raw response:", rawText);
    
    if (!rawText || rawText.trim().length === 0) {
      return res.status(200).json(FALLBACK_FOODS[normalizedBudget]);
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
      console.error('Could not extract JSON. Full response:', rawText);
      return res.status(200).json(FALLBACK_FOODS[normalizedBudget]);
    }
    
    console.log("Extracted JSON:", cleanJson);
    
    let newFoods;
    try {
      newFoods = JSON.parse(cleanJson);
    } catch (parseError) {
      console.error('JSON parse error:', parseError.message);
      return res.status(200).json(FALLBACK_FOODS[normalizedBudget]);
    }

    const responseFoods = buildResponseFoods(newFoods, normalizedBudget);
    return res.status(200).json(responseFoods);
    
  } catch (error) {
    console.error('AI Generation Failed:', error);
    return res.status(200).json(FALLBACK_FOODS[normalizedBudget]);
  }
}
