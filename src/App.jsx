import { useState, useEffect } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  doc, setDoc, getDoc, updateDoc,
  collection, query, orderBy, onSnapshot,
  serverTimestamp
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

// ─── Gauge ────────────────────────────────────────────────────────────────────

function Gauge({ used, goal }) {
  const rawPct = goal > 0 ? Math.round((used / goal) * 100) : 0;
  const over = rawPct > 100;
  const fillPct = Math.min(rawPct, 100);
  const ringColor = over ? "#E24B4A" : "#378ADD";

  // Water drop geometry (viewBox 0 0 90 122)
  const dropPath = "M 45 5 C 65 30, 83 60, 83 82 A 38 38 0 0 1 7 82 C 7 60, 25 30, 45 5 Z";
  const dropBottom = 120;
  const dropTip = 5;
  const totalDropH = dropBottom - dropTip;
  const waterY = dropBottom - (fillPct / 100) * totalDropH;

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
      <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
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
        {/* Progress bar with live % label */}
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 7 }}>
          <div style={{
            flex: 1,
            background: over ? "rgba(226,75,74,0.15)" : "rgba(55,138,221,0.15)",
            borderRadius: 99, height: 5, overflow: "hidden"
          }}>
            <div style={{
              height: "100%",
              width: `${fillPct}%`,
              background: ringColor,
              borderRadius: 99,
              transition: "width 0.6s ease, background 0.3s"
            }} />
          </div>
          <span style={{
            fontSize: 11, fontWeight: 700,
            color: ringColor,
            fontFamily: "var(--mono)",
            flexShrink: 0, minWidth: 34, textAlign: "right"
          }}>
            {rawPct}%
          </span>
        </div>
        {over && (
          <div style={{ fontSize: 11, color: "#E24B4A", marginTop: 6, fontWeight: 600 }}>
            {used - goal} L over daily goal
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Conservation Tips ────────────────────────────────────────────────────────

const TIPS = [
  "Turn off the tap while brushing your teeth — you can save up to 6 litres per minute.",
  "A 4-minute shower uses about 32 litres. Try cutting one minute to save 8 litres daily.",
  "Fix a dripping tap — a slow drip can waste over 5,000 litres a year.",
  "Run your dishwasher only when full — it uses the same water regardless of load size.",
  "Water your garden in the early morning to reduce evaporation by up to 25%.",
  "A full bath uses around 80 litres. Switching to a shower can halve that.",
  "Collect rainwater for watering plants — a water butt can hold up to 200 litres.",
  "Only boil as much water as you need — it saves energy and water.",
  "Use a bowl when washing vegetables instead of running the tap.",
  "Check for hidden leaks — a simple dye tablet in your toilet cistern reveals silent leaks.",
  "Washing a full load of laundry uses the same water as a half load — wait until it's full.",
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
    }, 7000);
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

// ─── Home Tab ─────────────────────────────────────────────────────────────────

function HomeTab({ user, activities, dailyGoal }) {
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
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--icon)" strokeWidth="1.8" strokeLinecap="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      </div>

      <Gauge used={todayTotal} goal={dailyGoal} />

      {/* ── This Week stats ── */}
      <div className="section">
        <div className="section-label">This week</div>
        <div className="stat-row" style={{ marginBottom: 10 }}>
          <div className="stat-card">
            <div className="stat-value">{thisTotal} L</div>
            <div className="stat-lbl">Total used</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{
              color: vsLastWeek === null ? "var(--text2)" : vsLastWeek <= 0 ? "#27AE60" : "#E24B4A"
            }}>
              {vsLastWeek === null ? "—" : `${vsLastWeek > 0 ? "+" : ""}${vsLastWeek}%`}
            </div>
            <div className="stat-lbl">vs last week</div>
          </div>
        </div>
        <div className="stat-row">
          <div className="stat-card">
            <div className="stat-value">{goalsMet}</div>
            <div className="stat-lbl">Goals met</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{streak}-day</div>
            <div className="stat-lbl">streak</div>
          </div>
        </div>
      </div>

      <ConservationTips />

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
    </div>
  );
}

// ─── Profile Tab ──────────────────────────────────────────────────────────────

function ProfileTab({ user, dailyGoal, onGoalChange }) {
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput]     = useState(dailyGoal);
  const [saving, setSaving]           = useState(false);

  const handleSignOut = () => signOut(auth);
  const initials = user?.displayName
    ? user.displayName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  const saveGoal = async () => {
    const val = parseInt(goalInput);
    if (!val || val <= 0) return;
    setSaving(true);
    await updateDoc(doc(db, "users", user.uid), { dailyGoal: val });
    onGoalChange(val);
    setSaving(false);
    setEditingGoal(false);
  };

  const BADGES = ["7-day streak", "Goal crusher", "Eco saver"];

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
        <div className="section-label">Badges</div>
        <div className="badge-row">
          {BADGES.map(b => <div className="badge" key={b}>{b}</div>)}
        </div>
      </div>

      <div className="section">
        <div className="section-label">Settings</div>
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
      </div>

      <div className="section">
        <button className="signout-btn" onClick={handleSignOut}>Sign out</button>
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
  const [user,       setUser]       = useState(undefined);
  const [activeTab,  setActiveTab]  = useState("home");
  const [dailyGoal,  setDailyGoal]  = useState(150);
  const [activities, setActivities] = useState([]);

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

        const snap = await getDoc(doc(db, "users", firebaseUser.uid));
        if (snap.exists() && snap.data().dailyGoal) {
          setDailyGoal(snap.data().dailyGoal);
        }

        setUser(firebaseUser);
      } else {
        setUser(null);
      }
    });
    return unsub;
  }, []);

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
      case "home":       return <HomeTab user={user} activities={activities} dailyGoal={dailyGoal} />;
      case "activities": return <ActivitiesTab currentUser={user} />;
      case "community":  return <CommunityTab currentUser={user} />;
      case "profile":    return <ProfileTab user={user} dailyGoal={dailyGoal} onGoalChange={setDailyGoal} />;
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
      </div>
    </div>
  );
}
