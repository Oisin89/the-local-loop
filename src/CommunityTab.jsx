import { useState, useEffect } from "react";
import {
  collection, query, where, getDocs, addDoc,
  deleteDoc, doc, onSnapshot, getDoc, setDoc, serverTimestamp
} from "firebase/firestore";
import { db } from "./firebase";

function Avatar({ initials, bg = "#E1F5EE", color = "#085041", size = 34 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: bg, color, display: "flex",
      alignItems: "center", justifyContent: "center",
      fontSize: size * 0.38, fontWeight: 600, flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}

function getInitials(name) {
  if (!name) return "?";
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

const AVATAR_COLORS = [
  { bg: "#E1F5EE", color: "#085041" },
  { bg: "#E6F1FB", color: "#0C447C" },
  { bg: "#FAEEDA", color: "#633806" },
  { bg: "#FBEAF0", color: "#4B1528" },
  { bg: "#EEEDFE", color: "#26215C" },
];

function getAvatarColor(uid) {
  const idx = uid ? uid.charCodeAt(0) % AVATAR_COLORS.length : 0;
  return AVATAR_COLORS[idx];
}

export default function CommunityTab({ currentUser }) {
  const [tab, setTab] = useState("friends");
  const [friends, setFriends] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [searchEmail, setSearchEmail] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [searchStatus, setSearchStatus] = useState("");
  const [loading, setLoading] = useState(false);

  // Listen to friendships
  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, "friendships"),
      where("uids", "array-contains", currentUser.uid)
    );
    const unsub = onSnapshot(q, async (snap) => {
      const friendUids = snap.docs.map(d => {
        const data = d.data();
        return { docId: d.id, uid: data.uids.find(u => u !== currentUser.uid) };
      });
      const profiles = await Promise.all(
        friendUids.map(async ({ docId, uid }) => {
          const userDoc = await getDoc(doc(db, "users", uid));
          return { docId, uid, ...userDoc.data() };
        })
      );
      setFriends(profiles);
    });
    return unsub;
  }, [currentUser]);

  // Listen to incoming requests
  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, "friend_requests"),
      where("toUid", "==", currentUser.uid),
      where("status", "==", "pending")
    );
    const unsub = onSnapshot(q, async (snap) => {
      const requests = await Promise.all(
        snap.docs.map(async (d) => {
          const data = d.data();
          const userDoc = await getDoc(doc(db, "users", data.fromUid));
          return { docId: d.id, ...data, fromUser: userDoc.data() };
        })
      );
      setIncoming(requests);
    });
    return unsub;
  }, [currentUser]);

  // Listen to outgoing requests
  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, "friend_requests"),
      where("fromUid", "==", currentUser.uid),
      where("status", "==", "pending")
    );
    const unsub = onSnapshot(q, async (snap) => {
      const requests = await Promise.all(
        snap.docs.map(async (d) => {
          const data = d.data();
          const userDoc = await getDoc(doc(db, "users", data.toUid));
          return { docId: d.id, ...data, toUser: userDoc.data() };
        })
      );
      setOutgoing(requests);
    });
    return unsub;
  }, [currentUser]);

  const searchUser = async () => {
    setSearchStatus("");
    setSearchResult(null);
    if (!searchEmail.trim()) return;
    if (searchEmail.trim().toLowerCase() === currentUser.email.toLowerCase()) {
      setSearchStatus("That's your own email!");
      return;
    }
    setLoading(true);
    try {
      const q = query(collection(db, "users"), where("email", "==", searchEmail.trim().toLowerCase()));
      const snap = await getDocs(q);
      if (snap.empty) {
        setSearchStatus("No user found with that email. They may need to sign in first.");
      } else {
        const userData = { uid: snap.docs[0].id, ...snap.docs[0].data() };
        // Check if already friends
        const fq = query(collection(db, "friendships"), where("uids", "array-contains", currentUser.uid));
        const fsnap = await getDocs(fq);
        const alreadyFriends = fsnap.docs.some(d => d.data().uids.includes(userData.uid));
        if (alreadyFriends) {
          setSearchStatus("You're already friends with this person.");
        } else {
          // Check if request already sent
          const rq = query(
            collection(db, "friend_requests"),
            where("fromUid", "==", currentUser.uid),
            where("toUid", "==", userData.uid),
            where("status", "==", "pending")
          );
          const rsnap = await getDocs(rq);
          if (!rsnap.empty) {
            setSearchStatus("You've already sent this person a request.");
          } else {
            setSearchResult(userData);
          }
        }
      }
    } catch (err) {
      setSearchStatus("Something went wrong. Try again.");
    }
    setLoading(false);
  };

  const sendRequest = async (toUser) => {
    try {
      await addDoc(collection(db, "friend_requests"), {
        fromUid: currentUser.uid,
        toUid: toUser.uid,
        status: "pending",
        createdAt: serverTimestamp(),
      });
      setSearchResult(null);
      setSearchEmail("");
      setSearchStatus(`Request sent to ${toUser.displayName || toUser.email}!`);
    } catch (err) {
      setSearchStatus("Failed to send request.");
    }
  };

  const acceptRequest = async (request) => {
    try {
      await setDoc(doc(db, "friendships", `${request.fromUid}_${currentUser.uid}`), {
        uids: [request.fromUid, currentUser.uid],
        createdAt: serverTimestamp(),
      });
      await deleteDoc(doc(db, "friend_requests", request.docId));
    } catch (err) {
      console.error(err);
    }
  };

  const declineRequest = async (request) => {
    try {
      await deleteDoc(doc(db, "friend_requests", request.docId));
    } catch (err) {
      console.error(err);
    }
  };

  const cancelRequest = async (request) => {
    try {
      await deleteDoc(doc(db, "friend_requests", request.docId));
    } catch (err) {
      console.error(err);
    }
  };

  const removeFriend = async (friend) => {
    if (!window.confirm(`Remove ${friend.displayName || friend.email} from your community?`)) return;
    try {
      await deleteDoc(doc(db, "friendships", friend.docId));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">Community</div>
        {incoming.length > 0 && (
          <div className="notif-badge">{incoming.length}</div>
        )}
      </div>

      {/* Sub-tabs */}
      <div className="subtab-row">
        {["friends", "requests", "add"].map((t) => (
          <button
            key={t}
            className={`subtab ${tab === t ? "active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t === "friends" ? `Friends${friends.length > 0 ? ` (${friends.length})` : ""}` :
             t === "requests" ? `Requests${incoming.length > 0 ? ` · ${incoming.length}` : ""}` :
             "Add friend"}
          </button>
        ))}
      </div>

      {/* Friends list */}
      {tab === "friends" && (
        <div className="section">
          {friends.length === 0 ? (
            <div className="empty-state">
              <p>No friends yet.</p>
              <p>Use the "Add friend" tab to invite people.</p>
            </div>
          ) : (
            <div className="activity-list">
              {friends.map((f) => {
                const colors = getAvatarColor(f.uid);
                return (
                  <div className="activity-item" key={f.uid} style={{ alignItems: "center" }}>
                    <Avatar initials={getInitials(f.displayName || f.email)} bg={colors.bg} color={colors.color} />
                    <div style={{ flex: 1 }}>
                      <div className="activity-name">{f.displayName || "User"}</div>
                      <div className="activity-detail">{f.email}</div>
                    </div>
                    <button className="icon-btn" onClick={() => removeFriend(f)} title="Remove friend">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Requests */}
      {tab === "requests" && (
        <div className="section">
          {incoming.length > 0 && (
            <>
              <div className="section-label">Incoming</div>
              <div className="activity-list" style={{ marginBottom: 20 }}>
                {incoming.map((r) => {
                  const colors = getAvatarColor(r.fromUid);
                  return (
                    <div className="activity-item" key={r.docId} style={{ flexDirection: "column", alignItems: "stretch", gap: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <Avatar initials={getInitials(r.fromUser?.displayName || r.fromUser?.email)} bg={colors.bg} color={colors.color} />
                        <div style={{ flex: 1 }}>
                          <div className="activity-name">{r.fromUser?.displayName || "User"}</div>
                          <div className="activity-detail">{r.fromUser?.email}</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="accept-btn" onClick={() => acceptRequest(r)}>Accept</button>
                        <button className="decline-btn" onClick={() => declineRequest(r)}>Decline</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {outgoing.length > 0 && (
            <>
              <div className="section-label">Sent</div>
              <div className="activity-list">
                {outgoing.map((r) => {
                  const colors = getAvatarColor(r.toUid);
                  return (
                    <div className="activity-item" key={r.docId} style={{ alignItems: "center" }}>
                      <Avatar initials={getInitials(r.toUser?.displayName || r.toUser?.email)} bg={colors.bg} color={colors.color} />
                      <div style={{ flex: 1 }}>
                        <div className="activity-name">{r.toUser?.displayName || "User"}</div>
                        <div className="activity-detail">{r.toUser?.email}</div>
                      </div>
                      <button className="icon-btn" onClick={() => cancelRequest(r)} title="Cancel request">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {incoming.length === 0 && outgoing.length === 0 && (
            <div className="empty-state">
              <p>No pending requests.</p>
            </div>
          )}
        </div>
      )}

      {/* Add friend */}
      {tab === "add" && (
        <div className="section">
          <div className="section-label">Search by email</div>
          <div className="search-row">
            <input
              className="search-input"
              type="email"
              placeholder="friend@email.com"
              value={searchEmail}
              onChange={(e) => { setSearchEmail(e.target.value); setSearchStatus(""); setSearchResult(null); }}
              onKeyDown={(e) => e.key === "Enter" && searchUser()}
            />
            <button className="search-btn" onClick={searchUser} disabled={loading}>
              {loading ? "…" : "Search"}
            </button>
          </div>

          {searchStatus && (
            <p className="search-status">{searchStatus}</p>
          )}

          {searchResult && (
            <div className="activity-item" style={{ marginTop: 12, alignItems: "center" }}>
              <Avatar
                initials={getInitials(searchResult.displayName || searchResult.email)}
                bg={getAvatarColor(searchResult.uid).bg}
                color={getAvatarColor(searchResult.uid).color}
              />
              <div style={{ flex: 1 }}>
                <div className="activity-name">{searchResult.displayName || "User"}</div>
                <div className="activity-detail">{searchResult.email}</div>
              </div>
              <button className="add-friend-btn" onClick={() => sendRequest(searchResult)}>Add</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
