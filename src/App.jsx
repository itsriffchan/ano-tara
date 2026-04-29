import { useState, useRef, useEffect } from 'react'
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

const MapComponent = ({ userCoords, searchQuery }) => {
  const mapRef = useRef(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (!window.google || !mapRef.current || initialized.current) return; // Prevent double init!
    initialized.current = true;

    const defaultLocation = { lat: 14.5995, lng: 120.9842 }; // Manila fallback
    const location = userCoords || defaultLocation;

    const map = new window.google.maps.Map(mapRef.current, {
      center: location,
      zoom: 15,
      mapTypeControl: false,
      streetViewControl: false,
    });

    if (userCoords) {
      new window.google.maps.Marker({
        position: location,
        map: map,
        title: "You are here",
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: "#4285F4",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
      });
    }

    const request = {
      location: location,
      radius: '5000',
      query: searchQuery
    };

    const service = new window.google.maps.places.PlacesService(map);
    service.textSearch(request, (results, status) => {
      if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
        const bounds = new window.google.maps.LatLngBounds();
        if (userCoords) {
          bounds.extend(new window.google.maps.LatLng(userCoords.lat, userCoords.lng));
        }

        results.forEach((place) => {
          new window.google.maps.Marker({
            map,
            position: place.geometry.location,
            title: place.name
          });
          bounds.extend(place.geometry.location);
        });
        
        map.fitBounds(bounds);
      }
    });

  }, [userCoords, searchQuery]);

  return <div ref={mapRef} style={{ width: '100%', height: '100%', borderRadius: '8px' }} />;
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
  const [showMap, setShowMap] = useState(false);
  const [userCoords, setUserCoords] = useState(null);
  const [isLocating, setIsLocating] = useState(false);

  const transitionRef = useRef("none");
  const itemsRef = useRef(null);
  const spinningRef = useRef(false);
  const spinIdRef = useRef(0);

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

  const fetchFoods = async (budgetRange, currentSpinId) => {
    try {
      const response = await fetch(`/api/getFoods?budget=${encodeURIComponent(budgetRange)}`);
      
      if (!response.ok) {
        throw new Error('API request failed');
      }

      const newFoods = await response.json();
      
      if (spinIdRef.current !== currentSpinId || !spinningRef.current) {
        console.warn("Fetch finished too late or was superseded. Dropping result.");
        return;
      }

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

    spinIdRef.current += 1;
    fetchFoods(budgetRange, spinIdRef.current);
  };

  const handleSpin = () => {
    if (spinningRef.current) return;
    initAudio();
    setSpinning(true);
    spinningRef.current = true;
    setDecided(false);
    setShowMap(false);

    // Increased spin duration to 6 seconds to give the AI plenty of time
    transitionRef.current = "transform 6s cubic-bezier(0.1, 0.7, 0.1, 1)";

    // Pre-calculate target. Use a fixed length of 12 for the distance calculation
    // even if foodsList changes length mid-spin, the target distance remains valid.
    const minSpins = 12 * 12; // increased total spins to match 6 seconds
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
    }, 6000); // 6 seconds
  };

  const handleTaraClick = () => {
    if (selectedFood) {
      if (!userCoords && "geolocation" in navigator) {
        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setUserCoords({
              lat: position.coords.latitude,
              lng: position.coords.longitude
            });
            setIsLocating(false);
            setShowMap(true);
          },
          (error) => {
            console.warn("Geolocation failed or denied:", error);
            setIsLocating(false);
            setShowMap(true);
          },
          { enableHighAccuracy: true, timeout: 10000 }
        );
      } else {
        setShowMap(true);
      }
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

      <div className={`tara-btn-wrapper ${decided && !showMap ? 'visible' : ''}`}>
        <button
          className="tara-btn"
          onClick={handleTaraClick}
          disabled={isLocating}
        >
          {isLocating ? 'locating...' : 'ano, tara?'}
        </button>
        <button
          className="reroll-btn"
          onClick={handleSpin}
        >
          ayoko nyan 💀
        </button>
      </div>

      {showMap && selectedFood && (
        <div className="map-modal" onClick={() => setShowMap(false)}>
          <div className="map-container" onClick={(e) => e.stopPropagation()}>
            <button className="close-map-btn" onClick={() => setShowMap(false)}>✕</button>
            <MapComponent userCoords={userCoords} searchQuery={selectedFood.search} />
          </div>
        </div>
      )}
    </div>
  )
}

export default App
