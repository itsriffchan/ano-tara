import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
  const { budget } = req.query;

  if (!budget) {
    return res.status(400).json({ error: 'Budget is required' });
  }

  try {
    // Access the secure API key from Vercel's backend environment variables
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'API key not configured on Vercel backend' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
      You are a highly strict budget food picker for the Philippines.
      The user's EXACT budget is: ${budget} PHP.
      
      CRITICAL RULES:
      - For "50-100": ONLY suggest extremely cheap street foods, bakeries, or snacks (like Fishball, Kikiam, Kwek Kwek, Taho, Siomai, Pandesal). NO sit-down meals or expensive foods.
      - For "100-300": Suggest local fast food, budget carinderia meals, or mid-tier trends. 
      - For "300+": Suggest ONLY premium options like Cafes, K-BBQ, Buffets, or expensive trending foods (like Dubai Chocolate, Wagyu, High-end Matcha). YOU MUST EXCLUDE ALL CHEAP STREET FOODS. Do NOT suggest Isaw, Fishball, or Taho for a 300+ budget.
      
      Generate exactly 12 trending or popular food items in the Philippines that STRICTLY obey these rules.
      Return ONLY a JSON array of objects. Do not include markdown formatting like \`\`\`json.
      Each object must have exactly two keys:
      - "display": A short, punchy name (max 15 chars) to display on a slot machine UI.
      - "search": The formal, specific name to search on Google Maps to find local stores selling it.
    `;

    const result = await model.generateContent(prompt);
    const cleanJson = result.response.text().replace(/```json/gi, '').replace(/```/g, '').trim();
    const newFoods = JSON.parse(cleanJson);

    if (Array.isArray(newFoods) && newFoods.length >= 2) {
      return res.status(200).json(newFoods);
    } else {
      return res.status(500).json({ error: 'Invalid AI response format' });
    }
  } catch (error) {
    console.error("AI Generation Failed:", error);
    return res.status(500).json({ error: error.message || 'Failed to generate foods' });
  }
}
