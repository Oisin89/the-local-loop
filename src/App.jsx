import { useState, useEffect, useMemo, useRef } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  doc, setDoc, getDoc, updateDoc, addDoc,
  collection, query, orderBy, limit, onSnapshot,
  serverTimestamp, increment, writeBatch
} from "firebase/firestore";
import { auth, db } from "./firebase";
import LoginScreen from "./LoginScreen";
import CommunityTab from "./CommunityTab";
import ActivitiesTab from "./ActivitiesTab";
import "./App.css";

// ─── Icons ───────────────────────────────────────────────────────────────────

function IconHome({ active }) {
  const c = active ? "var(--accent)" : "var(--icon)";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function IconActivity({ active }) {
  const c = active ? "var(--accent)" : "var(--icon)";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round">
      <path d="M12 2a5 5 0 0 1 5 5c0 5-5 11-5 11S7 12 7 7a5 5 0 0 1 5-5z" />
      <circle cx="12" cy="7" r="2" />
    </svg>
  );
}

function IconCommunity({ active }) {
  const c = active ? "var(--accent)" : "var(--icon)";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconProfile({ active }) {
  const c = active ? "var(--accent)" : "var(--icon)";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

// ─── Live date hook ───────────────────────────────────────────────────────────

function useLiveDate() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isSameDay(ts, date) {
  if (!ts) return false;
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toDateString() === date.toDateString();
}

function isYesterday(ts) {
  if (!ts) return false;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return isSameDay(ts, yesterday);
}

function formatTime(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

const ACTIVITY_COLORS = {
  "Shower":          "#378ADD",
  "Bath":            "#5B9BD5",
  "Dishwasher":      "#9B59B6",
  "Washing machine": "#E67E22",
  "Garden watering": "#27AE60",
  "Car washing":     "#E74C3C",
  "Toilet flush":    "#16A085",
  "Tap running":     "#2ECC71",
  "Other":           "#95A5A6",
};

// ─── Badge definitions ────────────────────────────────────────────────────────

function groupByDay(activities) {
  const map = {};
  activities.forEach(a => {
    const d = toDate(a.createdAt);
    if (!d) return;
    const key = d.toDateString();
    map[key] = (map[key] || 0) + (a.litres || 0);
  });
  return map;
}

function computeStreak(activities, dailyGoal) {
  const now = new Date();
  let streak = 0;
  for (let i = 0; i < 60; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = d.toDateString();
    const dayActs = activities.filter(a => { const ad = toDate(a.createdAt); return ad && ad.toDateString() === key; });
    const dayTotal = dayActs.reduce((s, a) => s + (a.litres || 0), 0);
    if (dayActs.length > 0 && dayTotal <= dailyGoal) {
      streak++;
    } else if (i === 0 && dayActs.length === 0) {
      continue;
    } else {
      break;
    }
  }
  return streak;
}

export const BADGE_DEFS = [
  {
    id: "first_drop",
    name: "First Drop",
    desc: "Log your first water activity",
    emoji: "💧",
    color: "#4A97E8",
    check: ({ activities }) => activities.length >= 1,
  },
  {
    id: "goal_getter",
    name: "Goal Getter",
    desc: "Finish a day under your daily goal",
    emoji: "🎯",
    color: "#27AE60",
    check: ({ activities, dailyGoal }) =>
      Object.values(groupByDay(activities)).some(t => t > 0 && t <= dailyGoal),
  },
  {
    id: "eco_saver",
    name: "Eco Saver",
    desc: "Use under 100 L in a single day",
    emoji: "🌱",
    color: "#27AE60",
    check: ({ activities }) =>
      Object.values(groupByDay(activities)).some(t => t > 0 && t <= 100),
  },
  {
    id: "logger_10",
    name: "Tracking Pro",
    desc: "Log 10 water activities",
    emoji: "📊",
    color: "#9B59B6",
    check: ({ activities }) => activities.length >= 10,
  },
  {
    id: "challenge_first",
    name: "Challenge Accepted",
    desc: "Complete your first daily challenge",
    emoji: "⭐",
    color: "#C9A30A",
    check: ({ challengesCompleted }) => challengesCompleted >= 1,
  },
  {
    id: "streak_3",
    name: "On a Roll",
    desc: "Hit your daily goal 3 days in a row",
    emoji: "🔥",
    color: "#E67E22",
    check: ({ streak }) => streak >= 3,
  },
  {
    id: "challenge_7",
    name: "Challenge Champ",
    desc: "Complete 7 daily challenges",
    emoji: "🏅",
    color: "#C9A30A",
    check: ({ challengesCompleted }) => challengesCompleted >= 7,
  },
  {
    id: "streak_7",
    name: "Week Warrior",
    desc: "Hit your daily goal 7 days in a row",
    emoji: "⚡",
    color: "#F1C40F",
    check: ({ streak }) => streak >= 7,
  },
  {
    id: "streak_14",
    name: "Fortnight Flow",
    desc: "Hit your daily goal 14 days in a row",
    emoji: "🌊",
    color: "#4A97E8",
    check: ({ streak }) => streak >= 14,
  },
  {
    id: "streak_30",
    name: "Water Hero",
    desc: "Hit your daily goal 30 days in a row",
    emoji: "🏆",
    color: "#C9A30A",
    check: ({ streak }) => streak >= 30,
  },
  {
    id: "quiz_1",
    name: "Brain Teaser",
    desc: "Answer your first daily quiz correctly",
    emoji: "🧠",
    color: "#7C63D4",
    check: ({ quizCorrectCount }) => quizCorrectCount >= 1,
  },
  {
    id: "quiz_3",
    name: "Water Scholar",
    desc: "Answer 3 daily quizzes correctly",
    emoji: "🎓",
    color: "#7C63D4",
    check: ({ quizCorrectCount }) => quizCorrectCount >= 3,
  },
  {
    id: "quiz_7",
    name: "Quiz Expert",
    desc: "Answer 7 daily quizzes correctly",
    emoji: "💡",
    color: "#7C63D4",
    check: ({ quizCorrectCount }) => quizCorrectCount >= 7,
  },
];

// ─── Water equivalent helper ──────────────────────────────────────────────────

function waterEquivalent(litres) {
  if (!litres || litres <= 0) return null;
  if (litres >= 160) {
    const n = (litres / 80).toFixed(1);
    return `${n} bath${parseFloat(n) !== 1 ? "s" : ""}`;
  }
  if (litres >= 40) {
    const n = (litres / 40).toFixed(1);
    return `${n} shower${parseFloat(n) !== 1 ? "s" : ""}`;
  }
  if (litres >= 12) {
    const n = Math.round(litres / 12);
    return `${n} dishwasher cycle${n !== 1 ? "s" : ""}`;
  }
  const n = Math.round(litres / 4);
  return `${n} toilet flush${n !== 1 ? "es" : ""}`;
}

// ─── WaterDropMascot ──────────────────────────────────────────────────────────
// Armless design — all expression through body shape, eyes, and mouth.
// Body animations applied directly to the <svg> element (HTML context) so
// CSS transform-origin works reliably without SVG-specific quirks.
function WaterDropMascot({ mood = 'idle' }) {
  const isOver = mood === 'over';
  const bodyColor   = isOver ? '#E24B4A' : '#378ADD';
  const bodyLight   = isOver ? '#F07070' : '#68B8FF';
  const strokeColor = isOver ? '#8B1A1A' : '#1a3a6e';

  const mouthD =
    mood === 'over'        ? 'M 20 59 Q 26 54 32 59' :
    mood === 'celebrating' ? 'M 17 57 Q 26 65 35 57' :
                             'M 20 58 Q 26 63 32 58';

  // Scale exercising from the base (squash-and-stretch feels grounded)
  const svgStyle = {
    overflow: 'visible',
    flexShrink: 0,
    display: 'block',
    animation:
      mood === 'exercising'  ? 'mascot-sqstretch 0.85s ease-in-out infinite' :
      mood === 'celebrating' ? 'mascot-shimmy    0.7s  ease-in-out infinite' :
      mood === 'over'        ? 'mascot-shake     0.3s  ease-in-out infinite' :
      mood === 'drinking'    ? 'mascot-gulp      1.8s  ease-in-out infinite' :
                               'mascot-bob       2.4s  ease-in-out infinite',
    transformOrigin: mood === 'exercising' ? 'center bottom' : 'center center',
  };

  const halfLidded  = mood === 'drinking';
  const celebrating = mood === 'celebrating';

  return (
    <svg width="52" height="70" viewBox="0 0 52 70"
      style={svgStyle} aria-hidden="true">
      <defs>
        <linearGradient id="mgGrad" x1="0.3" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor={bodyLight} />
          <stop offset="100%" stopColor={bodyColor} />
        </linearGradient>
      </defs>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <path d="M 26 2 C 42 16, 46 36, 46 50 A 20 20 0 0 1 6 50 C 6 36, 10 16, 26 2 Z"
        fill="url(#mgGrad)" />
      <ellipse cx="34" cy="18" rx="4.5" ry="6.5"
        fill="rgba(255,255,255,0.22)" transform="rotate(-22 34 18)" />

      {/* ── Drinking: bubbles rising inside body ──────────────────────────── */}
      {mood === 'drinking' && (
        <>
          <circle cx="22" cy="50" r="2" fill="rgba(255,255,255,0.4)">
            <animate attributeName="cy"      values="50;28;50" dur="1.6s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.7;0;0.7" dur="1.6s" repeatCount="indefinite" />
          </circle>
          <circle cx="30" cy="50" r="1.5" fill="rgba(255,255,255,0.35)">
            <animate attributeName="cy"      values="50;32;50" dur="1.6s" begin="0.55s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.6;0;0.6" dur="1.6s" begin="0.55s" repeatCount="indefinite" />
          </circle>
        </>
      )}

      {/* ── Face ──────────────────────────────────────────────────────────── */}
      {/* Left eye */}
      <circle cx="19" cy="46" r="3.8" fill="white" />
      {celebrating
        ? <path d="M 16 46 Q 19 43.5 22 46" fill={strokeColor} />
        : <circle cx="20" cy="47" r="2.1" fill={strokeColor} />}
      {/* Blink cover: static half-lid for drinking, animated blink otherwise */}
      {halfLidded
        ? <rect x="15.2" y="42.2" width="7.6" height="2.4" rx="3.8" fill={bodyColor} />
        : <rect x="15.2" y="42.2" width="7.6" height="0"   rx="3.8" fill={bodyColor}>
            <animate attributeName="height"
              values="0;0;7.6;0;0" keyTimes="0;0.8;0.86;0.92;1"
              dur="3s" repeatCount="indefinite" />
          </rect>
      }

      {/* Right eye */}
      <circle cx="33" cy="46" r="3.8" fill="white" />
      {celebrating
        ? <path d="M 30 46 Q 33 43.5 36 46" fill={strokeColor} />
        : <circle cx="34" cy="47" r="2.1" fill={strokeColor} />}
      {halfLidded
        ? <rect x="29.2" y="42.2" width="7.6" height="2.4" rx="3.8" fill={bodyColor} />
        : <rect x="29.2" y="42.2" width="7.6" height="0"   rx="3.8" fill={bodyColor}>
            <animate attributeName="height"
              values="0;0;7.6;0;0" keyTimes="0;0.8;0.86;0.92;1"
              dur="3s" repeatCount="indefinite" />
          </rect>
      }

      {/* Mouth */}
      <path d={mouthD} stroke={strokeColor} strokeWidth="2" fill="none" strokeLinecap="round" />

      {/* ── Celebrating: sparkles ─────────────────────────────────────────── */}
      {mood === 'celebrating' && (
        <>
          <text x="42" y="18" fontSize="11" style={{ animation: 'mascot-sparkle 0.5s ease-in-out infinite' }}>✨</text>
          <text x="1"  y="22" fontSize="9"  style={{ animation: 'mascot-sparkle 0.5s ease-in-out infinite 0.15s' }}>⭐</text>
        </>
      )}

      {/* ── Over: sweat drop ──────────────────────────────────────────────── */}
      {mood === 'over' && (
        <path d="M 39 21 C 41 17, 44 15, 44 20 A 3.2 3.2 0 0 1 38 20 Z"
          fill="rgba(74,151,232,0.8)"
          style={{ animation: 'mascot-sweat 2s ease-in-out infinite' }} />
      )}
    </svg>
  );
}

// ─── Gauge ────────────────────────────────────────────────────────────────────

function Gauge({ used, goal, streak = 0 }) {
  const rawPct = goal > 0 ? Math.round((used / goal) * 100) : 0;
  const over = rawPct > 100;
  const fillPct = Math.min(rawPct, 100);
  const ringColor = over ? "#E24B4A" : "#378ADD";

  // Dynamic status message
  const remaining = goal - used;
  let statusMsg, statusColor;
  if (used === 0) {
    statusMsg = "Nothing logged yet today";
    statusColor = "var(--text2)";
  } else if (rawPct < 50) {
    statusMsg = `${remaining} L left. Great start!`;
    statusColor = "#27AE60";
  } else if (rawPct < 80) {
    statusMsg = `${remaining} L left today`;
    statusColor = "var(--accent)";
  } else if (rawPct < 100) {
    statusMsg = `Only ${remaining} L left, slow down!`;
    statusColor = "#E67E22";
  } else if (rawPct === 100) {
    statusMsg = "Daily goal hit. Well done!";
    statusColor = "#27AE60";
  } else {
    statusMsg = `${used - goal} L over today's goal`;
    statusColor = "#E24B4A";
  }

  // Water drop geometry (viewBox 0 0 90 122)
  const dropPath = "M 45 5 C 65 30, 83 60, 83 82 A 38 38 0 0 1 7 82 C 7 60, 25 30, 45 5 Z";
  const dropBottom = 120;
  const dropTip = 5;
  const totalDropH = dropBottom - dropTip;
  const waterY = dropBottom - (fillPct / 100) * totalDropH;

  // Mascot mood derived from usage
  const mascotMood =
    over         ? 'over'        :
    rawPct >= 75 ? 'celebrating' :
    rawPct >= 51 ? 'exercising'  :
    rawPct >= 20 ? 'drinking'    :
                   'idle';

  return (
    <div className="gauge-card" style={over ? { borderColor: "rgba(226,75,74,0.4)" } : {}}>
      {/* Water droplet */}
      <div style={{ flexShrink: 0 }}>
        <svg width="90" height="122" viewBox="0 0 90 122">
          <defs>
            <clipPath id="dropClip">
              <path d={dropPath} />
            </clipPath>
          </defs>
          {/* Track fill */}
          <path d={dropPath} fill={over ? "rgba(226,75,74,0.15)" : "rgba(55,138,221,0.15)"} />
          {/* Rising water fill */}
          <rect
            x="0" y={waterY}
            width="90" height={Math.max(0, dropBottom - waterY + 4)}
            clipPath="url(#dropClip)"
            fill={ringColor}
            opacity="0.88"
            style={{ transition: "y 0.6s ease, height 0.6s ease" }}
          />
          {/* Outline */}
          <path d={dropPath} fill="none"
            stroke={over ? "rgba(226,75,74,0.55)" : "rgba(55,138,221,0.45)"}
            strokeWidth="1.5" />
          {/* Text backdrop */}
          <rect x="27" y="65" width="36" height="33" rx="6"
            fill="rgba(0,0,0,0.22)" clipPath="url(#dropClip)" />
          {/* Labels */}
          <text x="45" y="77" textAnchor="middle" fontSize="9.5" fontWeight="500"
            fill="rgba(255,255,255,0.82)" fontFamily="DM Sans, sans-serif">today</text>
          <text x="45" y="92" textAnchor="middle" fontSize="14" fontWeight="700"
            fill="white" fontFamily="DM Mono, monospace">{rawPct}%</text>
        </svg>
      </div>
      {/* Info */}
      <div style={{ flex: 1, minWidth: 0, overflow: "hidden", maxWidth: 148 }}>
        <div style={{
          fontSize: 28, fontWeight: 700, fontFamily: "var(--mono)",
          color: over ? "#E24B4A" : "var(--accent-dark)",
          letterSpacing: "-0.5px", lineHeight: 1.1,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
        }}>
          {used} L
        </div>
        <div style={{ fontSize: 13, color: "var(--text2)", marginTop: 4 }}>
          of {goal} L daily goal
        </div>
        {/* Status message + streak badge */}
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 7, minWidth: 0 }}>
          <span style={{
            fontSize: 12, fontWeight: 500,
            color: statusColor,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            transition: "color 0.3s"
          }}>
            {statusMsg}
          </span>
          {!over && waterEquivalent(goal - used) && (
            <span style={{ fontSize: 11, color: "var(--text2)", marginTop: 0, opacity: 0.8 }}>
              ≈ {waterEquivalent(goal - used)} remaining
            </span>
          )}
          {streak > 0 && (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              background: "rgba(201,163,34,0.15)",
              border: "0.5px solid rgba(201,163,34,0.3)",
              borderRadius: 99, padding: "3px 9px",
              alignSelf: "flex-start",
            }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="#C9A30A" stroke="none">
                <path d="M12 2c0 0-1 4-4 6 0 0 1-5-3-6 0 0-2 6 1 10-1 0-2-1-2-1 0 0 0 7 8 9 8-2 8-9 8-9s-1 1-2 1c3-4 1-10 1-10s-3 1-3 6c-3-2-4-6-4-6z"/>
              </svg>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#C9A30A", fontFamily: "var(--mono)" }}>
                {streak} day streak
              </span>
            </div>
          )}
        </div>
      </div>
      {/* Mascot */}
      <WaterDropMascot mood={mascotMood} />
    </div>
  );
}

// ─── Quick Log ────────────────────────────────────────────────────────────────

const QUICK_PRESETS = [
  { type: "Shower",           emoji: "🚿", litres: 40 },
  { type: "Toilet flush",     emoji: "🚽", litres: 4  },
  { type: "Tap running",      emoji: "🚰", litres: 6  },
  { type: "Dishwasher",       emoji: "🍽️", litres: 12 },
  { type: "Bath",             emoji: "🛁", litres: 80 },
];

function QuickLog({ user }) {
  const [justLogged, setJustLogged] = useState(null);

  const log = async (preset) => {
    if (!user || justLogged) return;
    try {
      await addDoc(collection(db, "users", user.uid, "activities"), {
        type:      preset.type,
        litres:    preset.litres,
        createdAt: serverTimestamp(),
      });
      setJustLogged(preset.type);
      setTimeout(() => setJustLogged(null), 1500);
    } catch (e) { console.error(e); }
  };

  return (
    <div className="section">
      <div className="section-label">Quick log</div>
      <div className="quick-log-row">
        {QUICK_PRESETS.map(p => {
          const done = justLogged === p.type;
          return (
            <button
              key={p.type}
              className={`quick-log-btn${done ? " logged" : ""}`}
              onClick={() => log(p)}
            >
              <span className="quick-log-emoji">{done ? "✓" : p.emoji}</span>
              <span className="quick-log-name">{p.type.split(" ")[0]}</span>
              <span className="quick-log-litres">{p.litres} L</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Conservation Tips ────────────────────────────────────────────────────────

const TIPS = [
  "Turn off the tap while brushing your teeth; you can save up to 6 litres per minute.",
  "A 4-minute shower uses about 32 litres. Try cutting one minute to save 8 litres daily.",
  "Fix a dripping tap. A slow drip can waste over 5,000 litres a year.",
  "Run your dishwasher only when full; it uses the same water regardless of load size.",
  "Water your garden in the early morning to reduce evaporation by up to 25%.",
  "A full bath uses around 80 litres. Switching to a shower can halve that.",
  "Collect rainwater for watering plants; a water butt can hold up to 200 litres.",
  "Only boil as much water as you need; it saves energy and water.",
  "Use a bowl when washing vegetables instead of running the tap.",
  "Check for hidden leaks; a simple dye tablet in your toilet cistern reveals silent leaks.",
  "Washing a full load of laundry uses the same water as a half load, so wait until it's full.",
  "A hosepipe uses up to 1,000 litres per hour. Use a watering can instead.",
];

function ConservationTips() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex(i => (i + 1) % TIPS.length);
        setVisible(true);
      }, 300);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="section">
      <div className="tips-card">
        <div className="tips-header">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C9A30A" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span className="tips-label">Conservation tip</span>
        </div>
        <p className="tips-text" style={{ opacity: visible ? 1 : 0, transition: "opacity 0.3s ease" }}>
          {TIPS[index]}
        </p>
        <div className="tips-dots">
          {TIPS.map((_, i) => (
            <div
              key={i}
              className="tips-dot"
              style={{ opacity: i === index ? 1 : 0.25, transform: i === index ? "scale(1.3)" : "scale(1)" }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Week helpers ─────────────────────────────────────────────────────────────

function getWeekRange(refDate, offsetWeeks = 0) {
  const d = new Date(refDate);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1; // Monday = start
  const monday = new Date(d);
  monday.setDate(d.getDate() - diff + offsetWeeks * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
}

function toDate(ts) {
  if (!ts) return null;
  return ts.toDate ? ts.toDate() : new Date(ts);
}

function useWeekStats(activities, dailyGoal, now) {
  const thisWeek = getWeekRange(now, 0);
  const lastWeek = getWeekRange(now, -1);

  const inRange = (a, range) => {
    const d = toDate(a.createdAt);
    return d && d >= range.start && d <= range.end;
  };

  const thisWeekActs = activities.filter(a => inRange(a, thisWeek));
  const lastWeekActs = activities.filter(a => inRange(a, lastWeek));

  const thisTotal = thisWeekActs.reduce((s, a) => s + (a.litres || 0), 0);
  const lastTotal = lastWeekActs.reduce((s, a) => s + (a.litres || 0), 0);

  const vsLastWeek = lastTotal > 0
    ? Math.round(((thisTotal - lastTotal) / lastTotal) * 100)
    : null;

  // Goals met this week (days where total <= dailyGoal)
  const dayTotals = {};
  thisWeekActs.forEach(a => {
    const d = toDate(a.createdAt);
    if (!d) return;
    const key = d.toDateString();
    dayTotals[key] = (dayTotals[key] || 0) + (a.litres || 0);
  });
  const goalsMet = Object.values(dayTotals).filter(t => t <= dailyGoal).length;

  // Streak: consecutive days (ending today or yesterday) where goal was met
  let streak = 0;
  for (let i = 0; i < 60; i++) {
    const checkDate = new Date(now);
    checkDate.setDate(now.getDate() - i);
    const key = checkDate.toDateString();
    const dayActivities = activities.filter(a => {
      const d = toDate(a.createdAt);
      return d && d.toDateString() === key;
    });
    const dayTotal = dayActivities.reduce((s, a) => s + (a.litres || 0), 0);
    if (dayActivities.length > 0 && dayTotal <= dailyGoal) {
      streak++;
    } else if (i === 0 && dayActivities.length === 0) {
      // Today has no activities yet — skip, don't break streak
      continue;
    } else {
      break;
    }
  }

  return { thisTotal, vsLastWeek, goalsMet, streak };
}

// ─── Daily Challenge ─────────────────────────────────────────────────────────

const CHALLENGES = [
  { text: "Turn the tap off while brushing your teeth", saving: 6 },
  { text: "Have a shower instead of a bath today", saving: 48 },
  { text: "Only boil as much water as you need", saving: 2 },
  { text: "Run the dishwasher on a full load only", saving: 12 },
  { text: "Water plants before 8am or after 7pm", saving: 15 },
  { text: "Fix or report any dripping tap you spot today", saving: 30 },
  { text: "Wash vegetables in a bowl, not under running water", saving: 8 },
  { text: "Keep your shower to under 4 minutes", saving: 24 },
  { text: "Fill the washing machine before running it", saving: 30 },
  { text: "Use a watering can instead of a hose", saving: 50 },
  { text: "Defrost food in the fridge, not under the tap", saving: 10 },
  { text: "Collect any unused drinking water for houseplants", saving: 5 },
  { text: "Rinse dishes in a basin, not under running water", saving: 15 },
  { text: "Check your toilet for silent leaks today", saving: 20 },
];

function DailyChallenge({ user }) {
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  const now = new Date();
  const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
  const challenge = CHALLENGES[dayOfYear % CHALLENGES.length];
  const todayStr = now.toDateString();

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, "users", user.uid)).then(snap => {
      const data = snap.data();
      if (data?.challengeDate === todayStr && data?.challengeDone) setDone(true);
    });
  }, [user]);

  const markDone = async () => {
    if (done || saving) return;
    setSaving(true);
    await updateDoc(doc(db, "users", user.uid), {
      challengeDate: todayStr,
      challengeDone: true,
      challengesCompleted: increment(1),
    });
    setDone(true);
    setSaving(false);
  };

  return (
    <div className="section">
      <div className="challenge-card">
        <div className="challenge-header">
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="#27AE60" stroke="none">
              <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
            </svg>
            <span className="challenge-label">Today's challenge</span>
          </div>
          <span className="challenge-saving">saves ~{challenge.saving} L</span>
        </div>
        <p className="challenge-text">{challenge.text}</p>
        <button className={`challenge-btn${done ? " done" : ""}`} onClick={markDone} disabled={done}>
          {done ? (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Done. Nice work!
            </>
          ) : saving ? "Saving…" : "Mark as done"}
        </button>
      </div>
    </div>
  );
}

// ─── Personal Best ────────────────────────────────────────────────────────────

function PersonalBest({ activities, dailyGoal }) {
  if (activities.length === 0) return null;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 60);

  const byDay = {};
  activities.forEach(a => {
    const d = toDate(a.createdAt);
    if (!d || d < cutoff) return;
    const key = d.toDateString();
    byDay[key] = (byDay[key] || 0) + (a.litres || 0);
  });

  const entries = Object.entries(byDay);
  if (entries.length < 2) return null;

  const [bestKey, bestTotal] = entries.reduce((best, curr) =>
    curr[1] < best[1] ? curr : best
  );

  const savedVsGoal = dailyGoal - bestTotal;
  const bestDate = new Date(bestKey);
  const isRecent = (new Date() - bestDate) < 7 * 86400000;
  const dateLabel = isRecent
    ? bestDate.toLocaleDateString("en-GB", { weekday: "long" })
    : bestDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  const byType = {};
  activities.forEach(a => {
    byType[a.type] = (byType[a.type] || 0) + (a.litres || 0);
  });
  const topType = Object.entries(byType).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="section">
      <div className="section-label">Personal best</div>
      <div className="card-block">
        <div className="pb-row" style={{ borderBottom: "0.5px solid var(--border)" }}>
          <span className="pb-icon">🏅</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="pb-value">{bestTotal} L</div>
            <div className="pb-lbl">Lowest day, {dateLabel}</div>
          </div>
          {savedVsGoal > 0 && (
            <span className="pb-badge">{savedVsGoal} L under goal</span>
          )}
        </div>
        {topType && (
          <div className="pb-row">
            <span className="pb-icon">💧</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="pb-value">{topType[0]}</div>
              <div className="pb-lbl">Biggest water use overall</div>
            </div>
            <span style={{ fontSize: 13, color: "var(--text2)", fontFamily: "var(--mono)", flexShrink: 0 }}>
              {topType[1]} L
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Weather Nudge ────────────────────────────────────────────────────────────

function WeatherNudge() {
  const [nudge, setNudge] = useState(null);
  const [temp, setTemp] = useState(null);
  const [icon, setIcon] = useState(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const res = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude}&longitude=${coords.longitude}&current=temperature_2m,precipitation,weather_code`
          );
          const data = await res.json();
          const { temperature_2m: t, precipitation: p, weather_code: code } = data.current;
          const roundT = Math.round(t);
          setTemp(roundT);
          let msg, ic;
          if (p > 2 || (code >= 51 && code <= 82)) {
            msg = "It's raining. Put a water butt out and collect it for the garden.";
            ic = "🌧";
          } else if (roundT >= 26) {
            msg = `It's ${roundT}° today. Water your garden after 7pm to cut evaporation by up to 25%.`;
            ic = "☀️";
          } else if (roundT >= 18) {
            msg = `Nice ${roundT}° today. Check garden soil moisture before reaching for the hose.`;
            ic = "🌤";
          } else if (roundT < 8) {
            msg = `Cold at ${roundT}°. Plants need significantly less water in cold weather.`;
            ic = "🧊";
          } else {
            msg = `Mild ${roundT}° today. A good time to check for dripping taps or leaky fittings.`;
            ic = "🌡";
          }
          setNudge(msg);
          setIcon(ic);
        } catch { /* silently fail */ }
      },
      () => {} /* permission denied — hide component */
    );
  }, []);

  if (!nudge) return null;

  return (
    <div className="section">
      <div className="weather-card">
        <div className="weather-header">
          <span className="weather-icon-emoji">{icon}</span>
          <span className="weather-label">Local weather tip</span>
          {temp !== null && <span className="weather-temp">{temp}°C</span>}
        </div>
        <p className="weather-text">{nudge}</p>
      </div>
    </div>
  );
}

// ─── Daily Quiz ───────────────────────────────────────────────────────────────

const QUIZ_QUESTIONS = [
  { q: "How many litres does the average UK person use per day?",
    options: ["80 L", "150 L", "230 L"], correct: 1,
    fact: "The UK average is about 150 litres per person per day, equivalent to roughly 6 full bathtubs." },
  { q: "How much water does a typical 5-minute shower use?",
    options: ["10 L", "40 L", "75 L"], correct: 1,
    fact: "A standard shower head uses around 8 litres per minute, so 5 minutes = ~40 litres." },
  { q: "How much does a full bath typically use?",
    options: ["40 L", "80 L", "140 L"], correct: 1,
    fact: "A full bath uses around 80 litres, about twice as much as a 5-minute shower." },
  { q: "How much water does a hosepipe use per hour?",
    options: ["200 L", "600 L", "1,000 L"], correct: 2,
    fact: "A hosepipe uses up to 1,000 litres per hour, the same as six days of drinking water for one person." },
  { q: "What percentage of Earth's water is available freshwater?",
    options: ["0.3%", "3%", "10%"], correct: 0,
    fact: "Only about 0.3% of all water on Earth is accessible freshwater; the rest is saltwater or locked in ice." },
  { q: "How much water does a dripping tap waste per year?",
    options: ["500 L", "5,500 L", "15,000 L"], correct: 1,
    fact: "A slow drip can waste over 5,500 litres a year, enough for 68 full baths." },
  { q: "How many litres does a modern low-flush toilet use per flush?",
    options: ["3–4 L", "9–12 L", "15–20 L"], correct: 0,
    fact: "Modern dual-flush toilets use just 3–4 litres on a half flush, down from 13 litres for older models." },
  { q: "How much water does a washing machine use per cycle?",
    options: ["20 L", "50 L", "100 L"], correct: 1,
    fact: "Most modern washing machines use around 50 litres per cycle. Always run full loads to make it count." },
  { q: "How many litres does a running tap produce per minute?",
    options: ["2 L", "6 L", "12 L"], correct: 1,
    fact: "A standard tap runs at about 6 litres per minute; leaving it on while brushing wastes up to 12 litres." },
  { q: "How much water is needed to produce 1 kg of beef?",
    options: ["500 L", "5,000 L", "15,000 L"], correct: 2,
    fact: "It takes roughly 15,000 litres of water to produce just 1 kg of beef, mostly for growing animal feed." },
  { q: "What time of day is best to water your garden to reduce evaporation?",
    options: ["Midday", "Early morning", "Afternoon"], correct: 1,
    fact: "Watering early morning reduces evaporation by up to 25% compared to watering during the heat of the day." },
  { q: "How many litres does a full dishwasher cycle typically use?",
    options: ["6 L", "12 L", "25 L"], correct: 1,
    fact: "A full dishwasher cycle uses around 12 litres, far less than washing the same dishes by hand (up to 60 L)." },
  { q: "How much of the human body is made up of water?",
    options: ["40%", "60%", "80%"], correct: 1,
    fact: "About 60% of the human body is water. Staying well hydrated is essential for basic body functions." },
  { q: "Which country has the highest per-person daily water use?",
    options: ["Australia", "United States", "United Kingdom"], correct: 1,
    fact: "The US averages around 380 litres per person per day, more than double the UK average." },
];

function DailyQuiz({ user }) {
  const [answered, setAnswered] = useState(null); // index of chosen option, or null
  const [saving, setSaving] = useState(false);

  const now = new Date();
  const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
  const q = QUIZ_QUESTIONS[dayOfYear % QUIZ_QUESTIONS.length];
  const todayStr = now.toDateString();

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, "users", user.uid)).then(snap => {
      const data = snap.data();
      if (data?.quizDate === todayStr && data?.quizAnswer != null) {
        setAnswered(data.quizAnswer);
      }
    });
  }, [user]);

  const choose = async (idx) => {
    if (answered !== null || saving) return;
    setSaving(true);
    setAnswered(idx);
    const update = { quizDate: todayStr, quizAnswer: idx };
    if (idx === q.correct) update.quizCorrectCount = increment(1);
    await updateDoc(doc(db, "users", user.uid), update);
    setSaving(false);
  };

  const isRevealed = answered !== null;

  return (
    <div className="section">
      <div className="quiz-card">
        <div className="quiz-header">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7C63D4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span className="quiz-label">Daily quiz</span>
        </div>
        <p className="quiz-question">{q.q}</p>
        <div className="quiz-options">
          {q.options.map((opt, i) => {
            let state = "idle";
            if (isRevealed) {
              if (i === q.correct) state = "correct";
              else if (i === answered) state = "wrong";
              else state = "dim";
            }
            return (
              <button
                key={i}
                className={`quiz-option ${state}`}
                onClick={() => choose(i)}
                disabled={isRevealed}
              >
                {opt}
              </button>
            );
          })}
        </div>
        {isRevealed && (
          <p className="quiz-fact">
            {answered === q.correct ? "✓ Correct! " : "✗ Not quite: "}
            {q.fact}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Weekly Bar Chart ─────────────────────────────────────────────────────────

function WeeklyChart({ activities, dailyGoal, now }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(now.getDate() - 6 + i);
    return d;
  });

  const totals = days.map(d =>
    activities
      .filter(a => { const ad = toDate(a.createdAt); return ad && ad.toDateString() === d.toDateString(); })
      .reduce((s, a) => s + (a.litres || 0), 0)
  );

  const maxVal = Math.max(...totals, dailyGoal, 1);
  const chartH = 80;
  const slotW = 40;
  const barW = 26;
  const barOffset = (slotW - barW) / 2;
  const viewW = slotW * 7;

  const goalY = chartH - (dailyGoal / maxVal) * chartH;

  return (
    <div className="section">
      <div className="section-label">Last 7 days</div>
      <div className="stat-card" style={{ padding: "16px 14px 12px" }}>
        <svg width="100%" height={chartH + 28} viewBox={`0 0 ${viewW} ${chartH + 28}`} preserveAspectRatio="xMidYMid meet">
          {/* Dashed goal line */}
          <line x1={0} y1={goalY} x2={viewW} y2={goalY}
            stroke="rgba(226,75,74,0.5)" strokeWidth="1" strokeDasharray="4 3" />

          {days.map((d, i) => {
            const total = totals[i];
            const hasData = total > 0;
            const barH = hasData ? Math.max((total / maxVal) * chartH, 4) : 2;
            const x = i * slotW + barOffset;
            const y = chartH - barH;
            const isToday = d.toDateString() === now.toDateString();
            const over = total > dailyGoal && hasData;
            const fill = over ? "#E24B4A" : isToday ? "var(--accent)" : hasData ? "var(--accent-light)" : "var(--border)";
            const label = d.toLocaleDateString("en-GB", { weekday: "short" }).slice(0, 2);

            return (
              <g key={i}>
                <rect x={x} y={y} width={barW} height={barH} rx={5} fill={fill} opacity={hasData ? 1 : 0.5} />
                <text x={x + barW / 2} y={chartH + 16} textAnchor="middle"
                  fontSize="10" fontWeight={isToday ? 700 : 400}
                  fill={isToday ? "var(--accent)" : "var(--text2)"}
                  fontFamily="DM Sans, sans-serif">
                  {label}
                </text>
              </g>
            );
          })}
        </svg>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
          <svg width="18" height="8" viewBox="0 0 18 8">
            <line x1="0" y1="4" x2="18" y2="4" stroke="rgba(226,75,74,0.5)" strokeWidth="1.5" strokeDasharray="4 3"/>
          </svg>
          <span style={{ fontSize: 11, color: "var(--text2)" }}>Daily goal</span>
        </div>
      </div>
    </div>
  );
}

// ─── Notifications Popup ──────────────────────────────────────────────────────

function formatAge(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function NotificationsPopup({ user, notifications, onClose }) {
  useEffect(() => {
    if (!user || notifications.length === 0) return;
    const unread = notifications.filter(n => !n.read);
    if (unread.length === 0) return;
    const batch = writeBatch(db);
    unread.forEach(n => {
      batch.update(doc(db, "users", user.uid, "notifications", n.id), { read: true });
    });
    batch.commit();
  }, []);

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-sheet" onClick={e => e.stopPropagation()}>
        <div className="settings-sheet-handle" />
        <div className="settings-sheet-header">
          <span className="settings-sheet-title">Notifications</span>
          <button className="settings-close-btn" onClick={onClose}>✕</button>
        </div>
        {notifications.length === 0 ? (
          <div className="empty-state" style={{ padding: "24px 20px" }}>
            <p>No notifications yet.</p>
            <p style={{ marginTop: 6 }}>Earn badges and connect with friends to see updates here.</p>
          </div>
        ) : (
          <div style={{ padding: "0 20px 8px" }}>
            <div className="card-block">
              {notifications.map((n, i) => (
                <div
                  key={n.id}
                  className="notif-item"
                  style={{ borderBottom: i < notifications.length - 1 ? "0.5px solid var(--border)" : "none" }}
                >
                  <span className="notif-item-emoji">{n.emoji || "🔔"}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="notif-item-title">{n.title}</div>
                    {n.body && <div className="notif-item-body">{n.body}</div>}
                  </div>
                  <span className="notif-item-time">{formatAge(n.createdAt)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Household Water Audit ────────────────────────────────────────────────────

const AUDIT_QUESTIONS = [
  {
    id: "people",
    emoji: "🏠",
    q: "How many people live in your household?",
    options: [
      { label: "Just me",    value: 1   },
      { label: "2 people",   value: 2   },
      { label: "3 people",   value: 3   },
      { label: "4 or more",  value: 4.5 },
    ],
  },
  {
    id: "showerFreq",
    emoji: "🚿",
    q: "How often does each person shower or bathe?",
    options: [
      { label: "Every day",           value: 7   },
      { label: "Every other day",     value: 3.5 },
      { label: "2–3 times a week",    value: 2.5 },
    ],
  },
  {
    id: "showerMins",
    emoji: "⏱",
    q: "How long is a typical shower?",
    options: [
      { label: "Under 5 minutes",   value: 4    },
      { label: "5–10 minutes",      value: 7.5  },
      { label: "Over 10 minutes",   value: 13   },
    ],
  },
  {
    id: "washing",
    emoji: "🫧",
    q: "How often do you run the washing machine per week?",
    options: [
      { label: "5–7 times",      value: 6   },
      { label: "3–4 times",      value: 3.5 },
      { label: "1–2 times",      value: 1.5 },
    ],
  },
  {
    id: "garden",
    emoji: "🌱",
    q: "Do you water a garden or outdoor plants?",
    options: [
      { label: "Yes, most days",         value: 20 },
      { label: "Occasionally",           value: 7  },
      { label: "No garden / rarely",     value: 0  },
    ],
  },
];

function calcAuditResult(ans) {
  const people      = ans.people;
  const showerFreq  = ans.showerFreq;  // times/week per person
  const showerMins  = ans.showerMins;  // minutes
  const washing     = ans.washing;     // cycles/week
  const garden      = ans.garden;      // L/day

  // Per-person daily estimates
  const showerDay  = (showerFreq / 7) * showerMins * 8; // 8 L/min flow
  const toiletDay  = 5 * 4;   // ~5 flushes × 4 L
  const tapMiscDay = 14;       // cooking, drinking, teeth, etc.
  const perPerson  = showerDay + toiletDay + tapMiscDay;

  // Shared household daily
  const washingDay = (washing * 50) / 7; // 50 L per cycle
  const total      = Math.round(perPerson * people + washingDay + garden);
  const perPersonDay = Math.round(total / people);

  // Build up to 3 personalised recommendations
  const recs = [];
  if (showerMins >= 7.5) {
    const saving = Math.round((showerMins - 4) * 8 * (showerFreq / 7) * people);
    recs.push({
      emoji: "🚿",
      text: `Cutting showers to under 5 minutes could save your household ~${saving} L/day.`,
      saving,
    });
  }
  if (washing >= 5) {
    recs.push({
      emoji: "🫧",
      text: "Running the washing machine every other day instead of daily saves around 25 L. Always wait for a full load.",
      saving: 25,
    });
  }
  if (garden >= 15) {
    const saving = Math.round(garden * 0.25);
    recs.push({
      emoji: "🌱",
      text: `Watering before 8am or after 7pm cuts evaporation by up to 25%, saving ~${saving} L/day.`,
      saving,
    });
  }
  if (recs.length < 2) {
    recs.push({
      emoji: "🔧",
      text: "A dripping tap wastes up to 5,500 L a year. Check all taps and report leaks promptly.",
      saving: 15,
    });
  }
  if (recs.length < 3) {
    recs.push({
      emoji: "💧",
      text: "Turning off the tap while brushing your teeth saves up to 12 L per person per day.",
      saving: 12,
    });
  }

  return { perPersonDay, total, people, recs: recs.slice(0, 3) };
}

function HouseholdAuditPopup({ user, onComplete }) {
  const [step, setStep]     = useState(0);
  const [answers, setAnswers] = useState({});
  const [result, setResult]  = useState(null);
  const [saving, setSaving]  = useState(false);

  const isResult = step === AUDIT_QUESTIONS.length;

  const choose = (value) => {
    const q = AUDIT_QUESTIONS[step];
    const next = { ...answers, [q.id]: value };
    setAnswers(next);
    if (step + 1 === AUDIT_QUESTIONS.length) setResult(calcAuditResult(next));
    setStep(s => s + 1);
  };

  const handleDone = async () => {
    setSaving(true);
    try { await updateDoc(doc(db, "users", user.uid), { auditCompleted: true }); } catch {}
    onComplete();
  };

  const progress = (step / AUDIT_QUESTIONS.length) * 100;

  return (
    <div className="settings-overlay">
      <div className="settings-sheet" style={{ maxHeight: "92%" }}>
        <div className="settings-sheet-handle" />

        {!isResult ? (
          <div style={{ padding: "14px 20px 28px" }}>
            {/* Progress bar */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
              <div style={{ flex: 1, height: 3, background: "var(--border)", borderRadius: 99, overflow: "hidden" }}>
                <div style={{ height: "100%", background: "var(--accent)", borderRadius: 99, width: `${progress}%`, transition: "width 0.3s ease" }} />
              </div>
              <span style={{ fontSize: 11, color: "var(--text2)", flexShrink: 0 }}>
                {step + 1} / {AUDIT_QUESTIONS.length}
              </span>
            </div>

            <div style={{ fontSize: 30, marginBottom: 10 }}>{AUDIT_QUESTIONS[step].emoji}</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text)", lineHeight: 1.4, marginBottom: 20 }}>
              {AUDIT_QUESTIONS[step].q}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {AUDIT_QUESTIONS[step].options.map(opt => (
                <button key={opt.label} className="audit-option-btn" onClick={() => choose(opt.value)}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        ) : result ? (
          <div style={{ padding: "14px 20px 28px", overflowY: "auto" }}>
            <div style={{ fontSize: 30, marginBottom: 8 }}>📊</div>
            <div style={{ fontSize: 17, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>
              Your water audit results
            </div>
            <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 18 }}>
              Estimated from your household's habits.
            </div>

            {/* Usage estimate */}
            <div className="card-block" style={{ marginBottom: 16, padding: "14px 14px 12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 10, borderBottom: "0.5px solid var(--border)", marginBottom: 10 }}>
                <span style={{ fontSize: 13, color: "var(--text2)" }}>Est. per person / day</span>
                <span style={{ fontSize: 19, fontWeight: 700, fontFamily: "var(--mono)", color: result.perPersonDay <= 150 ? "#27AE60" : "#E24B4A" }}>
                  {result.perPersonDay} L
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 13, color: "var(--text2)" }}>UK average</span>
                <span style={{ fontSize: 14, fontWeight: 600, fontFamily: "var(--mono)", color: "var(--text2)" }}>150 L</span>
              </div>
              <div className="impact-bar-track">
                <div className="impact-bar-fill" style={{
                  width: `${Math.min((result.perPersonDay / 150) * 100, 100)}%`,
                  background: result.perPersonDay <= 150 ? "#27AE60" : "#E24B4A",
                }} />
              </div>
              <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 8 }}>
                {result.perPersonDay <= 150
                  ? `You're ${150 - result.perPersonDay} L/day below the UK average. Great start! 🎉`
                  : `You're ${result.perPersonDay - 150} L/day above the UK average. There is room to improve.`}
              </div>
            </div>

            {/* Recommendations */}
            <div className="section-label" style={{ marginBottom: 10 }}>Top tips for your household</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 20 }}>
              {result.recs.map((r, i) => (
                <div key={i} style={{
                  background: "var(--bg2)", borderRadius: 12, padding: "11px 13px",
                  border: "0.5px solid var(--border)", display: "flex", gap: 10, alignItems: "flex-start",
                }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{r.emoji}</span>
                  <div>
                    <p style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.5 }}>{r.text}</p>
                    {r.saving > 0 && (
                      <span style={{ fontSize: 11, color: "#27AE60", fontWeight: 600, marginTop: 4, display: "block" }}>
                        saves ~{r.saving} L/day
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button className="add-btn" onClick={handleDone} disabled={saving}>
              {saving ? "Saving…" : "Start tracking my usage →"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ─── Settings Popup ───────────────────────────────────────────────────────────

function SettingsPopup({ user, dailyGoal, onGoalChange, onClose }) {
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput]     = useState(dailyGoal);
  const [saving, setSaving]           = useState(false);

  const handleSignOut = () => { signOut(auth); onClose(); };

  const saveGoal = async () => {
    const val = parseInt(goalInput);
    if (!val || val <= 0) return;
    setSaving(true);
    await updateDoc(doc(db, "users", user.uid), { dailyGoal: val });
    onGoalChange(val);
    setSaving(false);
    setEditingGoal(false);
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-sheet" onClick={e => e.stopPropagation()}>
        <div className="settings-sheet-handle" />
        <div className="settings-sheet-header">
          <span className="settings-sheet-title">Settings</span>
          <button className="settings-close-btn" onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: "0 20px 8px" }}>
          <div className="card-block">
            <div className="pref-row" onClick={() => { setEditingGoal(true); setGoalInput(dailyGoal); }}>
              <span className="pref-label">Daily goal</span>
              {editingGoal ? (
                <div className="goal-edit-row" onClick={e => e.stopPropagation()}>
                  <input
                    className="goal-input"
                    type="number"
                    value={goalInput}
                    onChange={e => setGoalInput(e.target.value)}
                    autoFocus
                  />
                  <span className="litres-unit">L</span>
                  <button className="goal-save-btn" onClick={saveGoal} disabled={saving}>
                    {saving ? "…" : "Save"}
                  </button>
                  <button className="goal-cancel-btn" onClick={() => setEditingGoal(false)}>Cancel</button>
                </div>
              ) : (
                <span className="pref-val">{dailyGoal} L ›</span>
              )}
            </div>
            <div className="pref-row">
              <span className="pref-label">Notifications</span>
              <span className="pref-val">On ›</span>
            </div>
            <div className="pref-row">
              <span className="pref-label">Units</span>
              <span className="pref-val">Litres ›</span>
            </div>
            <div className="pref-row">
              <span className="pref-label">Household size</span>
              <span className="pref-val">2 people ›</span>
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <button className="signout-btn" onClick={handleSignOut}>Sign out</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Home Tab ─────────────────────────────────────────────────────────────────

function HomeTab({ user, activities, dailyGoal, onGoalChange, onOpenSettings, unreadCount = 0, onOpenNotifications, auditCompleted, onOpenAudit }) {
  const now = useLiveDate();
  const today = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const firstName = user?.displayName?.split(" ")[0] || "there";
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const todayTotal = activities
    .filter(a => isSameDay(a.createdAt, now))
    .reduce((sum, a) => sum + (a.litres || 0), 0);

  const { thisTotal, vsLastWeek, goalsMet, streak } = useWeekStats(activities, dailyGoal, now);

  const recent = activities.slice(0, 5);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">{greeting}, {firstName}</div>
          <div className="greeting">{today}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button className="header-icon-btn" onClick={onOpenNotifications} aria-label="Notifications" style={{ position: "relative" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--icon)" strokeWidth="1.8" strokeLinecap="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {unreadCount > 0 && (
              <span className="bell-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
            )}
          </button>
          <button className="header-icon-btn" onClick={onOpenSettings} aria-label="Settings">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--icon)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
        </div>
      </div>

      <Gauge used={todayTotal} goal={dailyGoal} streak={streak} />

      <QuickLog user={user} />

      <DailyChallenge user={user} />

      {!auditCompleted && (
        <div className="section">
          <div className="audit-invite-card">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 26 }}>🏠</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", lineHeight: 1.3 }}>
                  Discover your water footprint
                </div>
                <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 2 }}>
                  5 quick questions to get a personalised estimate
                </div>
              </div>
            </div>
            <button className="audit-start-btn" onClick={onOpenAudit}>
              Take the household audit →
            </button>
          </div>
        </div>
      )}

      <ConservationTips />

      <DailyQuiz user={user} />

      <WeatherNudge />

      <div className="section">
        <div className="section-label">Recent activity</div>
        {recent.length === 0 ? (
          <div className="empty-state" style={{ padding: "16px 0" }}>
            <p>No activities logged yet.</p>
            <p>Head to the Activities tab to get started.</p>
          </div>
        ) : (
          <div className="activity-list">
            {recent.map(a => (
              <div className="activity-item" key={a.id}>
                <div className="activity-dot" style={{ background: ACTIVITY_COLORS[a.type] || "#95A5A6" }} />
                <span className="activity-name">{a.type}</span>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 13, color: "var(--text2)", fontFamily: "var(--mono)" }}>{a.litres} L</div>
                  <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 2 }}>
                    {isSameDay(a.createdAt, now) ? "Today" : isYesterday(a.createdAt) ? "Yesterday" : ""} {formatTime(a.createdAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <PersonalBest activities={activities} dailyGoal={dailyGoal} />

      {/* ── This Week stats ── */}
      <div className="section">
        <div className="section-label">This week</div>
        <div className="stat-row">
          <div className="stat-card">
            <div className="stat-value">{thisTotal} L</div>
            <div className="stat-lbl">Total used</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{
              color: vsLastWeek === null ? "var(--text2)" : vsLastWeek <= 0 ? "#27AE60" : "#E24B4A"
            }}>
              {vsLastWeek === null ? "n/a" : `${vsLastWeek > 0 ? "+" : ""}${vsLastWeek}%`}
            </div>
            <div className="stat-lbl">vs last week</div>
          </div>
        </div>
      </div>

      <WeeklyChart activities={activities} dailyGoal={dailyGoal} now={now} />

      <div style={{ padding: "4px 20px 28px", textAlign: "center" }}>
        <p style={{ fontSize: 11, color: "var(--text2)", lineHeight: 1.6, opacity: 0.65 }}>
          😊 App designed by Jesica Balakumar for the Tolworth Hook Community Project
        </p>
      </div>
    </div>
  );
}

// ─── Profile Tab ──────────────────────────────────────────────────────────────

function ProfileTab({ user, earnedBadgeIds }) {
  const initials = user?.displayName
    ? user.displayName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  const earnedCount = earnedBadgeIds.length;

  return (
    <div className="page">
      <div className="profile-header">
        {user?.photoURL ? (
          <img src={user.photoURL} alt="avatar" className="profile-avatar-img" />
        ) : (
          <div className="profile-avatar">{initials}</div>
        )}
        <div>
          <div className="profile-name">{user?.displayName || "User"}</div>
          <div className="profile-sub">{user?.email}</div>
        </div>
      </div>

      <div className="section">
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
          <div className="section-label" style={{ marginBottom: 0 }}>Badges</div>
          <span style={{ fontSize: 12, color: "var(--text2)" }}>
            {earnedCount} / {BADGE_DEFS.length} earned
          </span>
        </div>
        <div className="badge-grid">
          {BADGE_DEFS.map(b => {
            const earned = earnedBadgeIds.includes(b.id);
            return (
              <div key={b.id} className={`badge-card${earned ? " earned" : " locked"}`}>
                <span className="badge-card-emoji">{earned ? b.emoji : "🔒"}</span>
                <div className="badge-card-name">{b.name}</div>
                <div className="badge-card-desc">{b.desc}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Tab Bar ──────────────────────────────────────────────────────────────────

const TABS = [
  { id: "home",       label: "Home",       Icon: IconHome      },
  { id: "activities", label: "Activities", Icon: IconActivity  },
  { id: "community",  label: "Community",  Icon: IconCommunity },
  { id: "profile",    label: "Profile",    Icon: IconProfile   },
];

// ─── App Root ─────────────────────────────────────────────────────────────────

export default function App() {
  const [user,                 setUser]                 = useState(undefined);
  const [activeTab,            setActiveTab]            = useState("home");
  const [dailyGoal,            setDailyGoal]            = useState(150);
  const [activities,           setActivities]           = useState([]);
  const [challengesCompleted,  setChallengesCompleted]  = useState(0);
  const [quizCorrectCount,     setQuizCorrectCount]     = useState(0);
  const [showSettings,         setShowSettings]         = useState(false);
  const [notifications,        setNotifications]        = useState([]);
  const [showNotifications,    setShowNotifications]    = useState(false);
  const [auditCompleted,       setAuditCompleted]       = useState(false);
  const [showAudit,            setShowAudit]            = useState(false);

  // Auth + initial profile load
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        await setDoc(doc(db, "users", firebaseUser.uid), {
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName,
          email: firebaseUser.email.toLowerCase(),
          photoURL: firebaseUser.photoURL,
          lastSeen: serverTimestamp(),
        }, { merge: true });
        setUser(firebaseUser);
      } else {
        setUser(null);
      }
    });
    return unsub;
  }, []);

  // Live listener on user doc — picks up dailyGoal + challengesCompleted changes instantly
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, "users", user.uid), snap => {
      if (!snap.exists()) return;
      const data = snap.data();
      if (data.dailyGoal)                    setDailyGoal(data.dailyGoal);
      if (data.challengesCompleted != null)  setChallengesCompleted(data.challengesCompleted);
      if (data.quizCorrectCount != null)     setQuizCorrectCount(data.quizCorrectCount);
      if (data.auditCompleted != null)       setAuditCompleted(data.auditCompleted);
    });
    return unsub;
  }, [user]);

  // Activities listener
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "users", user.uid, "activities"),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, snap => {
      setActivities(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [user]);

  // Notifications listener
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "users", user.uid, "notifications"),
      orderBy("createdAt", "desc"),
      limit(30)
    );
    const unsub = onSnapshot(q, snap => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [user]);

  // Compute earned badges reactively
  const earnedBadgeIds = useMemo(() => {
    const streak = computeStreak(activities, dailyGoal);
    return BADGE_DEFS
      .filter(b => b.check({ activities, dailyGoal, streak, challengesCompleted, quizCorrectCount }))
      .map(b => b.id);
  }, [activities, dailyGoal, challengesCompleted, quizCorrectCount]);

  // Badge notification generator — runs after earnedBadgeIds is computed
  useEffect(() => {
    if (!user || earnedBadgeIds.length === 0) return;
    const checkAndNotify = async () => {
      const snap = await getDoc(doc(db, "users", user.uid));
      const alreadyNotified = new Set(snap.data()?.notifiedBadges || []);
      const toNotify = earnedBadgeIds.filter(id => !alreadyNotified.has(id));
      if (toNotify.length === 0) return;
      const batch = writeBatch(db);
      toNotify.forEach(badgeId => {
        const badge = BADGE_DEFS.find(b => b.id === badgeId);
        if (!badge) return;
        const notifRef = doc(collection(db, "users", user.uid, "notifications"));
        batch.set(notifRef, {
          type: "badge",
          title: `${badge.emoji} ${badge.name} badge earned!`,
          body: badge.desc,
          emoji: badge.emoji,
          read: false,
          createdAt: serverTimestamp(),
        });
      });
      batch.update(doc(db, "users", user.uid), {
        notifiedBadges: [...alreadyNotified, ...toNotify],
      });
      await batch.commit();
    };
    checkAndNotify();
  }, [earnedBadgeIds, user]);

  if (user === undefined) {
    return (
      <div className="app-frame">
        <div className="app-shell" style={{ alignItems: "center", justifyContent: "center" }}>
          <div className="loading-dot" />
        </div>
      </div>
    );
  }

  if (user === null) return <LoginScreen />;

  const renderTab = () => {
    switch (activeTab) {
      case "home":       return <HomeTab user={user} activities={activities} dailyGoal={dailyGoal} onGoalChange={setDailyGoal} onOpenSettings={() => setShowSettings(true)} unreadCount={notifications.filter(n => !n.read).length} onOpenNotifications={() => setShowNotifications(true)} auditCompleted={auditCompleted} onOpenAudit={() => setShowAudit(true)} />;
      case "activities": return <ActivitiesTab currentUser={user} />;
      case "community":  return <CommunityTab currentUser={user} />;
      case "profile":    return <ProfileTab user={user} earnedBadgeIds={earnedBadgeIds} />;
      default:           return <HomeTab user={user} activities={activities} dailyGoal={dailyGoal} />;
    }
  };

  return (
    <div className="app-frame">
      <div className="app-shell">
        <div className="screen">{renderTab()}</div>
        <div className="tab-bar">
          {TABS.map(({ id, label, Icon }) => (
            <button key={id} className={`tab ${activeTab === id ? "active" : ""}`} onClick={() => setActiveTab(id)}>
              <div className="tab-icon"><Icon active={activeTab === id} /></div>
              <span className="tab-label">{label}</span>
            </button>
          ))}
        </div>
        {showSettings && (
          <SettingsPopup
            user={user}
            dailyGoal={dailyGoal}
            onGoalChange={setDailyGoal}
            onClose={() => setShowSettings(false)}
          />
        )}
        {showNotifications && (
          <NotificationsPopup
            user={user}
            notifications={notifications}
            onClose={() => setShowNotifications(false)}
          />
        )}
        {showAudit && (
          <HouseholdAuditPopup
            user={user}
            onComplete={() => { setAuditCompleted(true); setShowAudit(false); }}
          />
        )}
      </div>
    </div>
  );
}
