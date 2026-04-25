import { useState, useRef, useEffect } from 'react'
import { GoogleGenerativeAI } from '@google/generative-ai'
import './App.css'

const DEFAULT_FOODS = [
  { display: "Dubai Chewy Cookie", search: "Dubai Chewy Cookie" },
  { display: "Ilocos Empanada", search: "Ilocos Empanada" },
  { display: "Tanghulu", search: "Tanghulu" },
  { display: "Birria Tacos", search: "Birria Tacos" },
  { display: "Korean Corn Dog", search: "Korean Corn Dog" },
  { display: "Matcha", search: "Matcha Latte" },
  { display: "Mango Graham", search: "Mango Graham" },
  { display: "Samgyup", search: "Samgyupsal" },
  { display: "Ramen", search: "Ramen" },
  { display: "Tusok-tusok", search: "Fishball Kikiam Kwek Kwek" },
  { display: "Takoyaki", search: "Takoyaki" },
  { display: "Bingsu", search: "Bingsu" },
  { display: "Overload Hotdog", search: "Overload Hotdog" },
  { display: "Loaded Fries", search: "Loaded Fries" },
  { display: "Milk Tea", search: "Milk Tea" },
  { display: "Taho", search: "Taho" }
];

const ITEM_HEIGHT = 120; // Match css .slot-item height

let audioCtx = null;
const initAudio = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
};

const playTick = () => {
  if (!audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.type = "sine";
    osc.frequency.setValueAtTime(2500, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1500, audioCtx.currentTime + 0.05);

    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);

    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.05);
  } catch (e) { }
};

const playPing = () => {
  if (!audioCtx) return;
  try {
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(audioCtx.destination);

    osc1.type = "sine";
    osc1.frequency.setValueAtTime(1046.50, audioCtx.currentTime);

    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1318.51, audioCtx.currentTime);

    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.5);

    osc1.start(audioCtx.currentTime);
    osc2.start(audioCtx.currentTime);
    osc1.stop(audioCtx.currentTime + 1.5);
    osc2.stop(audioCtx.currentTime + 1.5);
  } catch (e) { }
};

const getTranslateY = (element) => {
  const style = window.getComputedStyle(element);
  const matrix = style.transform;
  if (matrix === 'none') return 0;
  const match = matrix.match(/matrix.*\((.+)\)/);
  if (match) {
    const parts = match[1].split(', ');
    return parseFloat(parts[5]);
  }
  return 0;
};

function App() {
  const [appState, setAppState] = useState('vibe-check'); // 'vibe-check', 'slot-machine'
  const [foodsList, setFoodsList] = useState(DEFAULT_FOODS);
  const foodsListRef = useRef(DEFAULT_FOODS);

  const [spinning, setSpinning] = useState(false);
  const [decided, setDecided] = useState(false);
  const [position, setPosition] = useState(0);
  const [selectedFood, setSelectedFood] = useState(null);
  const [autoSpin, setAutoSpin] = useState(false);

  const transitionRef = useRef("none");
  const itemsRef = useRef(null);
  const spinningRef = useRef(false);

  // Keep ref in sync with state for timeouts
  useEffect(() => {
    foodsListRef.current = foodsList;
  }, [foodsList]);

  // Handle auto-spin on mount of the slot machine screen
  useEffect(() => {
    if (appState === 'slot-machine' && autoSpin) {
      setAutoSpin(false);
      handleSpin();
    }
  }, [appState, autoSpin]);

  // Duplicate the list multiple times to create a long ribbon for spinning
  const ribbon = Array(15).fill(foodsList).flat();

  const fetchFoods = async (budgetRange) => {
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey || apiKey === 'your_key_here') return;

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      const prompt = `
        You are helping someone decide what to eat in the Philippines.
        The user's budget is: ${budgetRange} PHP.
        
        Generate exactly 12 trending or popular food items in the Philippines that strictly fit this budget.
        - If the budget is 50-100 PHP, ONLY suggest cheap street foods, bakeries, or snacks (like Fishball, Kwek Kwek, Taho, Siomai, Empanada). EXCLUDE expensive meals like Samgyup, Birria Tacos, or premium cafes.
        - If the budget is 100-300 PHP, suggest proper budget meals, fast food, or mid-tier trending foods.
        - If the budget is 300+ PHP, suggest proper meals, cafes, buffets, or slightly premium trending foods (like Samgyupsal, Dubai Chocolate).
        
        Return ONLY a JSON array of objects. Do not include markdown formatting like \`\`\`json.
        Each object must have exactly two keys:
        - "display": A short, punchy name (max 15 chars) to display on a slot machine UI.
        - "search": The formal, specific name to search on Google Maps to find local stores selling it (e.g. "Dubai Chewy Cookie", "Fishball Kikiam Kwek Kwek", "Pares").
      `;

      const result = await model.generateContent(prompt);
      const cleanJson = result.response.text().replace(/```json/gi, '').replace(/```/g, '').trim();
      const newFoods = JSON.parse(cleanJson);

      if (Array.isArray(newFoods) && newFoods.length >= 2) {
        setFoodsList(newFoods);
      }
    } catch (error) {
      console.error("AI Generation Failed. Keeping default foods.", error);
    }
  };

  const handleBudgetSubmit = (budgetRange) => {
    initAudio();
    setAppState('slot-machine');
    setAutoSpin(true);

    // Fetch in the background mid-spin
    fetchFoods(budgetRange);
  };

  const handleSpin = () => {
    if (spinningRef.current) return;
    initAudio();
    setSpinning(true);
    spinningRef.current = true;
    setDecided(false);

    transitionRef.current = "transform 4s cubic-bezier(0.1, 0.7, 0.1, 1)";

    // Pre-calculate target. Use a fixed length of 12 for the distance calculation
    // even if foodsList changes length mid-spin, the target distance remains valid.
    const minSpins = 12 * 8;
    const randomIndex = Math.floor(Math.random() * 12);
    const targetIndex = minSpins + randomIndex;
    const targetPosition = targetIndex * ITEM_HEIGHT;

    let lastItemIndex = Math.floor(position / ITEM_HEIGHT);

    const checkSync = () => {
      if (!spinningRef.current) return;
      if (itemsRef.current) {
        const currentY = Math.abs(getTranslateY(itemsRef.current));
        const currentItemIndex = Math.floor(currentY / ITEM_HEIGHT);
        if (currentItemIndex > lastItemIndex) {
          playTick();
          lastItemIndex = currentItemIndex;
        }
      }
      requestAnimationFrame(checkSync);
    };
    requestAnimationFrame(checkSync);

    setPosition(targetPosition);

    setTimeout(() => {
      setSpinning(false);
      spinningRef.current = false;
      setDecided(true);

      // Grab the latest list that was updated in the background
      const currentList = foodsListRef.current;
      const landedItemIndex = targetIndex % currentList.length;

      setSelectedFood(currentList[landedItemIndex]);
      playPing();

      // Reset position silently for seamless re-spins
      transitionRef.current = "none";
      setPosition(landedItemIndex * ITEM_HEIGHT);
    }, 4000);
  };

  const handleTaraClick = () => {
    if (selectedFood) {
      const query = encodeURIComponent(`${selectedFood.search} near me`);
      window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
    }
  };

  if (appState === 'vibe-check') {
    return (
      <div className="app-container vibe-screen">
        <h1 className="vibe-title">What's the budget today?</h1>
        <div className="budget-buttons">
          <button className="tara-btn vibe-btn" onClick={() => handleBudgetSubmit('50-100')}>
            ₱50 - ₱100 (Tipid Muna)
          </button>
          <button className="tara-btn vibe-btn" onClick={() => handleBudgetSubmit('100-300')}>
            ₱100 - ₱300 (Saktong Busog)
          </button>
          <button className="tara-btn vibe-btn" onClick={() => handleBudgetSubmit('300+')}>
            ₱300+ (Mayaman Era)
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <button className="back-btn" onClick={() => setAppState('vibe-check')}>
        ← Change Budget
      </button>
      <div className={`slot-machine-wrapper ${decided ? 'shifted' : ''}`}>

        <div className={`indicator ${spinning || decided ? 'hidden' : ''}`}>
          ↓ tap to spin!
        </div>

        <div
          className="slot-machine"
          onClick={handleSpin}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSpin(); }}
        >
          <div
            ref={itemsRef}
            className="items-container"
            style={{
              transform: `translateY(-${position}px)`,
              transition: transitionRef.current
            }}
          >
            {ribbon.map((food, index) => (
              <div key={index} className="slot-item">
                {food.display}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={`tara-btn-wrapper ${decided ? 'visible' : ''}`}>
        <button
          className="tara-btn"
          onClick={handleTaraClick}
        >
          ano, tara?
        </button>
        <button
          className="reroll-btn"
          onClick={handleSpin}
        >
          ayoko nyan 💀
        </button>
      </div>
    </div>
  )
}

export default App
