import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  collection, deleteDoc, doc,
  onSnapshot, query, orderBy
} from "firebase/firestore";
import { db } from "./firebase";

const ACTIVITY_TYPES = [
  { name: "Shower",          color: "#378ADD", defaultLitres: 45 },
  { name: "Bath",            color: "#5B9BD5", defaultLitres: 80 },
  { name: "Dishwasher",      color: "#9B59B6", defaultLitres: 12 },
  { name: "Washing machine", color: "#E67E22", defaultLitres: 55 },
  { name: "Garden watering", color: "#27AE60", defaultLitres: 30 },
  { name: "Car washing",     color: "#E74C3C", defaultLitres: 150 },
  { name: "Toilet flush",    color: "#16A085", defaultLitres: 6  },
  { name: "Tap running",     color: "#2ECC71", defaultLitres: 8  },
  { name: "Other",           color: "#95A5A6", defaultLitres: 0  },
];

function getActivityColor(name) {
  return ACTIVITY_TYPES.find(a => a.name === name)?.color || "#95A5A6";
}

function formatTime(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

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

// ─── Log Form Modal ───────────────────────────────────────────────────────────

export function LogForm({ onClose, onSave }) {
  const [type, setType] = useState(ACTIVITY_TYPES[0].name);
  const [litres, setLitres] = useState(ACTIVITY_TYPES[0].defaultLitres);
  const [saving, setSaving] = useState(false);

  const handleTypeChange = (name) => {
    setType(name);
    const def = ACTIVITY_TYPES.find(a => a.name === name)?.defaultLitres || 0;
    setLitres(def);
  };

  const handleSave = async () => {
    if (!litres || litres <= 0) return;
    setSaving(true);
    await onSave({ type, litres: Number(litres) });
    setSaving(false);
    onClose();
  };

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Log activity</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="form-group">
          <label className="form-label">Activity type</label>
          <div className="type-grid">
            {ACTIVITY_TYPES.map(a => (
              <button
                key={a.name}
                className={`type-btn ${type === a.name ? "active" : ""}`}
                style={{ "--dot": a.color }}
                onClick={() => handleTypeChange(a.name)}
              >
                <span className="type-dot" style={{ background: a.color }} />
                {a.name}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Litres used</label>
          <div className="litres-row">
            <input
              className="litres-input"
              type="number"
              min="1"
              max="2000"
              value={litres}
              onChange={e => setLitres(e.target.value)}
            />
            <span className="litres-unit">L</span>
          </div>
        </div>

        <button className="add-btn" onClick={handleSave} disabled={saving || !litres || litres <= 0}>
          {saving ? "Saving…" : "Save activity"}
        </button>
      </div>
    </div>,
    document.body
  );
}

// ─── Activities Tab ───────────────────────────────────────────────────────────

export default function ActivitiesTab({ currentUser, onLogClick }) {
  const [activities, setActivities] = useState([]);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, "users", currentUser.uid, "activities"),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, snap => {
      setActivities(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [currentUser]);

  const handleDelete = async (id) => {
    setDeleting(id);
    await deleteDoc(doc(db, "users", currentUser.uid, "activities", id));
    setDeleting(null);
  };

  const now = new Date();
  const todayItems = activities.filter(a => isSameDay(a.createdAt, now));
  const yesterdayItems = activities.filter(a => isYesterday(a.createdAt));
  const earlierItems = activities.filter(a => !isSameDay(a.createdAt, now) && !isYesterday(a.createdAt));

  const renderList = (items) => items.map(a => (
    <div className="activity-item" key={a.id}>
      <div className="activity-dot" style={{ background: getActivityColor(a.type) }} />
      <div style={{ flex: 1 }}>
        <div className="activity-name">{a.type}</div>
        <div className="activity-detail">{formatTime(a.createdAt)}</div>
      </div>
      <span className="activity-meta">{a.litres} L</span>
      <button
        className="delete-btn"
        onClick={() => handleDelete(a.id)}
        disabled={deleting === a.id}
        title="Delete"
      >
        {deleting === a.id ? "…" : "✕"}
      </button>
    </div>
  ));

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">Activities</div>
      </div>

      <div className="section">
        <button className="add-btn" onClick={onLogClick}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Log activity
        </button>
      </div>

      {activities.length === 0 && (
        <div className="empty-state">
          <p>No activities logged yet.</p>
          <p>Tap "Log activity" to get started.</p>
        </div>
      )}

      {todayItems.length > 0 && (
        <div className="section">
          <div className="section-label">Today</div>
          <div className="activity-list">{renderList(todayItems)}</div>
        </div>
      )}

      {yesterdayItems.length > 0 && (
        <div className="section">
          <div className="section-label">Yesterday</div>
          <div className="activity-list">{renderList(yesterdayItems)}</div>
        </div>
      )}

      {earlierItems.length > 0 && (
        <div className="section">
          <div className="section-label">Earlier</div>
          <div className="activity-list">{renderList(earlierItems)}</div>
        </div>
      )}
    </div>
  );
}
