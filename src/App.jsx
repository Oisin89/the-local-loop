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
  const circumference = 2 * Math.PI * 36;
  const ringPct = Math.min(rawPct, 100);
  const offset = circumference - (ringPct / 100) * circumference;
  const ringColor = over ? "#E24B4A" : "#378ADD";

  return (
    <div className="gauge-card" style={over ? { background: "rgba(226,75,74,0.08)", borderColor: "rgba(226,75,74,0.3)" } : {}}>
      <svg className="gauge-ring" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r="36" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="7" />
        <circle cx="44" cy="44" r="36" fill="none" stroke={ringColor} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset} transform="rotate(-90 44 44)" />
        <text x="44" y="40" textAnchor="middle" fontSize="10" fontWeight="600" fill="#ffffff" fontFamily="DM Mono, monospace">today</text>
        <text x="44" y="55" textAnchor="middle" fontSize="14" fontWeight="600" fill={over ? "#E24B4A" : "#ffffff"} fontFamily="DM Mono, monospace">{rawPct}%</text>
      </svg>
      <div className="gauge-info">
        <div className="gauge-litres" style={over ? { color: "#E24B4A" } : {}}>{used} L</div>
        <div className="gauge-sublabel">of {goal} L daily goal</div>
        <div className="gauge-bar-wrap">
          <div className="gauge-bar-fill" style={{ width: "100%", background: over ? "#E24B4A" : undefined }} />
        </div>
        {over && (
          <div style={{ fontSize: 11, color: "#E24B4A", marginTop: 6, fontWeight: 500 }}>
            {used - goal} L over daily goal
          </div>
        )}
      </div>
    </div>
  );
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
