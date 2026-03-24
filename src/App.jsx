import { useState, useEffect } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase";
import LoginScreen from "./LoginScreen";
import CommunityTab from "./CommunityTab";
import "./App.css";

// ─── Icons ───────────────────────────────────────────────────────────────────

function IconHome({ active }) {
  const c = active ? "#1D9E75" : "var(--icon)";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function IconActivity({ active }) {
  const c = active ? "#1D9E75" : "var(--icon)";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round">
      <path d="M12 2a5 5 0 0 1 5 5c0 5-5 11-5 11S7 12 7 7a5 5 0 0 1 5-5z" />
      <circle cx="12" cy="7" r="2" />
    </svg>
  );
}

function IconCommunity({ active }) {
  const c = active ? "#1D9E75" : "var(--icon)";
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
  const c = active ? "#1D9E75" : "var(--icon)";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

// ─── Gauge ────────────────────────────────────────────────────────────────────

function Gauge({ used, goal }) {
  const pct = Math.min(100, Math.round((used / goal) * 100));
  const circumference = 2 * Math.PI * 36;
  const offset = circumference - (pct / 100) * circumference;
  return (
    <div className="gauge-card">
      <svg className="gauge-ring" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r="36" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="7" />
        <circle cx="44" cy="44" r="36" fill="none" stroke="#1D9E75" strokeWidth="7" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset} transform="rotate(-90 44 44)" />
        <text x="44" y="40" textAnchor="middle" fontSize="10" fontWeight="600" fill="#085041" fontFamily="DM Mono, monospace">today</text>
        <text x="44" y="55" textAnchor="middle" fontSize="14" fontWeight="600" fill="#085041" fontFamily="DM Mono, monospace">{pct}%</text>
      </svg>
      <div className="gauge-info">
        <div className="gauge-litres">{used} L</div>
        <div className="gauge-sublabel">of {goal} L daily goal</div>
        <div className="gauge-bar-wrap">
          <div className="gauge-bar-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

// ─── Home Tab ─────────────────────────────────────────────────────────────────

function HomeTab({ user }) {
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const firstName = user?.displayName?.split(" ")[0] || "there";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const recentActivities = [
    { name: "Shower", meta: "45 L · 8:12am", color: "#1D9E75" },
    { name: "Dishwasher", meta: "12 L · 7:50am", color: "#378ADD" },
    { name: "Garden watering", meta: "36 L · Yesterday", color: "#BA7517" },
  ];
  const stats = [
    { value: "642 L", label: "Total used" },
    { value: "–18%", label: "vs last week" },
    { value: "4", label: "Goals met" },
    { value: "7-day", label: "streak" },
  ];

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
      <Gauge used={93} goal={150} />
      <div className="section">
        <div className="section-label">This week</div>
        <div className="stat-row">
          {stats.map((s) => (
            <div className="stat-card" key={s.label}>
              <div className="stat-value">{s.value}</div>
              <div className="stat-lbl">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="section">
        <div className="section-label">Recent</div>
        <div className="activity-list">
          {recentActivities.map((a) => (
            <div className="activity-item" key={a.name}>
              <div className="activity-dot" style={{ background: a.color }} />
              <span className="activity-name">{a.name}</span>
              <span className="activity-meta">{a.meta}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Activities Tab ───────────────────────────────────────────────────────────

const ACTIVITIES_DATA = {
  Today: [
    { name: "Shower", detail: "8 min · 8:12am", litres: "45 L", color: "#1D9E75" },
    { name: "Dishwasher", detail: "Eco cycle · 7:50am", litres: "12 L", color: "#378ADD" },
  ],
  Yesterday: [
    { name: "Garden watering", detail: "20 min · 6:00pm", litres: "36 L", color: "#BA7517" },
    { name: "Shower", detail: "7 min · 7:30am", litres: "40 L", color: "#1D9E75" },
    { name: "Washing machine", detail: "Full load · 9:00am", litres: "55 L", color: "#D4537E" },
  ],
};

function ActivitiesTab() {
  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">Activities</div>
      </div>
      <div className="section">
        <button className="add-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Log activity
        </button>
      </div>
      {Object.entries(ACTIVITIES_DATA).map(([day, items]) => (
        <div className="section" key={day}>
          <div className="section-label">{day}</div>
          <div className="activity-list">
            {items.map((a) => (
              <div className="activity-item" key={a.name + a.detail}>
                <div className="activity-dot" style={{ background: a.color }} />
                <div style={{ flex: 1 }}>
                  <div className="activity-name">{a.name}</div>
                  <div className="activity-detail">{a.detail}</div>
                </div>
                <span className="activity-meta">{a.litres}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Profile Tab ──────────────────────────────────────────────────────────────

function ProfileTab({ user }) {
  const handleSignOut = () => signOut(auth);
  const initials = user?.displayName
    ? user.displayName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  const SETTINGS = [
    { label: "Daily goal", value: "150 L" },
    { label: "Notifications", value: "On" },
    { label: "Units", value: "Litres" },
    { label: "Household size", value: "2 people" },
  ];
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
          {BADGES.map((b) => (
            <div className="badge" key={b}>{b}</div>
          ))}
        </div>
      </div>

      <div className="section">
        <div className="section-label">Settings</div>
        <div className="card-block">
          {SETTINGS.map((s) => (
            <div className="pref-row" key={s.label}>
              <span className="pref-label">{s.label}</span>
              <span className="pref-val">{s.value} ›</span>
            </div>
          ))}
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
  { id: "home", label: "Home", Icon: IconHome },
  { id: "activities", label: "Activities", Icon: IconActivity },
  { id: "community", label: "Community", Icon: IconCommunity },
  { id: "profile", label: "Profile", Icon: IconProfile },
];

// ─── App Root ─────────────────────────────────────────────────────────────────

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = loading
  const [activeTab, setActiveTab] = useState("home");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Save/update user profile in Firestore on every login
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

  // Loading state
  if (user === undefined) {
    return (
      <div className="app-shell" style={{ alignItems: "center", justifyContent: "center" }}>
        <div className="loading-dot" />
      </div>
    );
  }

  // Not signed in
  if (user === null) {
    return <LoginScreen />;
  }

  const renderTab = () => {
    switch (activeTab) {
      case "home": return <HomeTab user={user} />;
      case "activities": return <ActivitiesTab />;
      case "community": return <CommunityTab currentUser={user} />;
      case "profile": return <ProfileTab user={user} />;
      default: return <HomeTab user={user} />;
    }
  };

  return (
    <div className="app-shell">
      <div className="status-bar">
        <span>9:41</span>
        <span className="status-icons">
          <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor">
            <rect x="0" y="3" width="3" height="9" rx="1" opacity="0.3" />
            <rect x="4.5" y="2" width="3" height="10" rx="1" opacity="0.6" />
            <rect x="9" y="0.5" width="3" height="11.5" rx="1" />
            <rect x="13.5" y="0" width="2.5" height="12" rx="1" />
          </svg>
          <svg width="25" height="12" viewBox="0 0 25 12" fill="none">
            <rect x="0.5" y="0.5" width="21" height="11" rx="3.5" stroke="currentColor" strokeOpacity="0.35" />
            <rect x="2" y="2" width="16" height="8" rx="2" fill="currentColor" />
            <path d="M23 4.5V7.5C23.8 7.2 24.5 6.4 24.5 6C24.5 5.6 23.8 4.8 23 4.5Z" fill="currentColor" opacity="0.4" />
          </svg>
        </span>
      </div>
      <div className="screen">{renderTab()}</div>
      <div className="tab-bar">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} className={`tab ${activeTab === id ? "active" : ""}`} onClick={() => setActiveTab(id)}>
            <div className="tab-icon"><Icon active={activeTab === id} /></div>
            <span className="tab-label" style={{ color: activeTab === id ? "#1D9E75" : undefined }}>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
