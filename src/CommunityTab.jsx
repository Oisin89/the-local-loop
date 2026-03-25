import { useState, useEffect } from "react";
import {
  collection, query, where, getDocs, addDoc,
  deleteDoc, doc, onSnapshot, getDoc, setDoc, serverTimestamp
} from "firebase/firestore";
import { db } from "./firebase";

// ─── Avatar ───────────────────────────────────────────────────────────────────

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

function shortName(displayName) {
  if (!displayName) return "User";
  const parts = displayName.split(" ");
  return parts.length > 1 ? `${parts[0]} ${parts[1][0]}.` : parts[0];
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

// ─── Leaderboard hook ─────────────────────────────────────────────────────────

function useLeaderboard(currentUser, friends) {
  const [rankings, setRankings] = useState([]);
  const [loadingBoard, setLoadingBoard] = useState(false);
  const friendKey = friends.map(f => f.uid).sort().join(",");

  useEffect(() => {
    if (!currentUser) return;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const fetchTotal = async (uid) => {
      try {
        const snap = await getDocs(
          query(
            collection(db, "users", uid, "activities"),
            where("createdAt", ">=", monthStart)
          )
        );
        return snap.docs.reduce((s, d) => s + (d.data().litres || 0), 0);
      } catch {
        return null; // permission denied or no data
      }
    };

    const run = async () => {
      setLoadingBoard(true);
      const participants = [
        {
          uid: currentUser.uid,
          displayName: currentUser.displayName,
          isMe: true,
        },
        ...friends.map(f => ({ uid: f.uid, displayName: f.displayName, isMe: false })),
      ];

      const withTotals = await Promise.all(
        participants.map(async (p) => ({ ...p, total: await fetchTotal(p.uid) }))
      );

      const valid = withTotals
        .filter(p => p.total !== null)
        .sort((a, b) => a.total - b.total);

      setRankings(valid);
      setLoadingBoard(false);
    };

    run();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.uid, friendKey]);

  return { rankings, loadingBoard };
}

// ─── Leaderboard UI ───────────────────────────────────────────────────────────

const RANK_COLORS = ["#C9A822", "#9098A8", "#A0683A"];

function LeaderboardSection({ rankings, loadingBoard, hasFriends }) {
  if (!hasFriends && !loadingBoard) {
    return (
      <div className="section">
        <div className="section-label">Leaderboard · This Month</div>
        <div className="empty-state" style={{ padding: "20px 0" }}>
          <p>Add friends to see how you stack up this month.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="section">
      <div className="section-label">Leaderboard · This Month</div>

      {loadingBoard ? (
        <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text2)", fontSize: 13 }}>
          Loading…
        </div>
      ) : (
        <div className="card-block">
          {rankings.map((p, i) => {
            const colors = getAvatarColor(p.uid);
            const rankColor = i < 3 ? RANK_COLORS[i] : "var(--text2)";
            const isFirst = i === 0;
            return (
              <div
                key={p.uid}
                className="leaderboard-row"
                style={{
                  borderBottom: i < rankings.length - 1 ? "0.5px solid var(--border)" : "none",
                  background: p.isMe ? "rgba(74,151,232,0.06)" : "transparent",
                }}
              >
                {/* Rank */}
                <span className="leaderboard-rank" style={{ color: rankColor }}>
                  {isFirst ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill={rankColor} stroke="none">
                      <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
                    </svg>
                  ) : i + 1}
                </span>

                {/* Avatar */}
                <Avatar
                  initials={getInitials(p.displayName)}
                  bg={p.isMe ? "var(--accent-bg)" : colors.bg}
                  color={p.isMe ? "var(--accent-dark)" : colors.color}
                  size={36}
                />

                {/* Name */}
                <span className="leaderboard-name" style={{
                  color: p.isMe ? "var(--accent-dark)" : "var(--text)",
                  fontWeight: p.isMe ? 600 : 500,
                }}>
                  {p.isMe ? "You" : shortName(p.displayName)}
                </span>

                {/* Usage */}
                <span className="leaderboard-total" style={{
                  color: p.isMe ? "var(--accent)" : "var(--text2)",
                  fontWeight: p.isMe ? 600 : 400,
                }}>
                  {(p.total || 0).toLocaleString("en-GB")} L
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Streak leaderboard hook ──────────────────────────────────────────────────

function useStreakLeaderboard(currentUser, friends) {
  const [streakRankings, setStreakRankings] = useState([]);
  const [loadingStreak, setLoadingStreak] = useState(false);
  const friendKey = friends.map(f => f.uid).sort().join(",");

  useEffect(() => {
    if (!currentUser) return;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 62);

    const fetchData = async (uid) => {
      try {
        const [actsSnap, userSnap] = await Promise.all([
          getDocs(query(collection(db, "users", uid, "activities"), where("createdAt", ">=", cutoff))),
          getDoc(doc(db, "users", uid)),
        ]);
        const activities = actsSnap.docs.map(d => d.data());
        const dailyGoal = userSnap.data()?.dailyGoal || 150;
        return { activities, dailyGoal };
      } catch { return null; }
    };

    const calcStreak = (activities, dailyGoal) => {
      const now = new Date();
      let streak = 0;
      for (let i = 0; i < 61; i++) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const key = d.toDateString();
        const dayActs = activities.filter(a => {
          const ad = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
          return ad.toDateString() === key;
        });
        const total = dayActs.reduce((s, a) => s + (a.litres || 0), 0);
        if (dayActs.length > 0 && total <= dailyGoal) { streak++; }
        else if (i === 0 && dayActs.length === 0) { continue; }
        else { break; }
      }
      return streak;
    };

    const run = async () => {
      setLoadingStreak(true);
      const participants = [
        { uid: currentUser.uid, displayName: currentUser.displayName, isMe: true },
        ...friends.map(f => ({ uid: f.uid, displayName: f.displayName, isMe: false })),
      ];
      const results = await Promise.all(
        participants.map(async (p) => {
          const data = await fetchData(p.uid);
          if (!data) return null;
          return { ...p, streak: calcStreak(data.activities, data.dailyGoal) };
        })
      );
      setStreakRankings(
        results.filter(Boolean).sort((a, b) => b.streak - a.streak)
      );
      setLoadingStreak(false);
    };

    run();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.uid, friendKey]);

  return { streakRankings, loadingStreak };
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CommunityTab({ currentUser }) {
  const [tab, setTab] = useState("friends");
  const [friends, setFriends] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [searchEmail, setSearchEmail] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [searchStatus, setSearchStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const { rankings, loadingBoard } = useLeaderboard(currentUser, friends);
  const { streakRankings, loadingStreak } = useStreakLeaderboard(currentUser, friends);

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
        const fq = query(collection(db, "friendships"), where("uids", "array-contains", currentUser.uid));
        const fsnap = await getDocs(fq);
        const alreadyFriends = fsnap.docs.some(d => d.data().uids.includes(userData.uid));
        if (alreadyFriends) {
          setSearchStatus("You're already friends with this person.");
        } else {
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
    } catch {
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
      // Notify the recipient that they have a new friend request
      await addDoc(collection(db, "users", toUser.uid, "notifications"), {
        type: "friend_request",
        title: "New friend request 👋",
        body: `${currentUser.displayName || "Someone"} wants to connect with you.`,
        emoji: "👋",
        read: false,
        createdAt: serverTimestamp(),
      });
      setSearchResult(null);
      setSearchEmail("");
      setSearchStatus(`Request sent to ${toUser.displayName || toUser.email}!`);
    } catch {
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
      // Notify the person who sent the request that it was accepted
      await addDoc(collection(db, "users", request.fromUid, "notifications"), {
        type: "friend_accepted",
        title: "Friend request accepted! 🤝",
        body: `${currentUser.displayName || "Someone"} accepted your friend request.`,
        emoji: "🤝",
        read: false,
        createdAt: serverTimestamp(),
      });
    } catch (err) { console.error(err); }
  };

  const declineRequest = async (request) => {
    try { await deleteDoc(doc(db, "friend_requests", request.docId)); }
    catch (err) { console.error(err); }
  };

  const cancelRequest = async (request) => {
    try { await deleteDoc(doc(db, "friend_requests", request.docId)); }
    catch (err) { console.error(err); }
  };

  const removeFriend = async (friend) => {
    if (!window.confirm(`Remove ${friend.displayName || friend.email} from your community?`)) return;
    try { await deleteDoc(doc(db, "friendships", friend.docId)); }
    catch (err) { console.error(err); }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">Community</div>
        {incoming.length > 0 && (
          <div className="notif-badge">{incoming.length}</div>
        )}
      </div>

      {/* ── Monthly usage leaderboard ── */}
      <LeaderboardSection
        rankings={rankings}
        loadingBoard={loadingBoard}
        hasFriends={friends.length > 0}
      />

      {/* ── Streak leaderboard ── */}
      {(friends.length > 0 || loadingStreak) && (
        <div className="section">
          <div className="section-label">Streak leaderboard</div>
          {loadingStreak ? (
            <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text2)", fontSize: 13 }}>Loading…</div>
          ) : (
            <div className="card-block">
              {streakRankings.map((p, i) => {
                const colors = getAvatarColor(p.uid);
                const rankColor = i < 3 ? RANK_COLORS[i] : "var(--text2)";
                return (
                  <div key={p.uid} className="leaderboard-row" style={{
                    borderBottom: i < streakRankings.length - 1 ? "0.5px solid var(--border)" : "none",
                    background: p.isMe ? "rgba(74,151,232,0.06)" : "transparent",
                  }}>
                    <span className="leaderboard-rank" style={{ color: rankColor }}>
                      {i === 0 ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill={rankColor} stroke="none">
                          <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
                        </svg>
                      ) : i + 1}
                    </span>
                    <Avatar
                      initials={getInitials(p.displayName)}
                      bg={p.isMe ? "var(--accent-bg)" : colors.bg}
                      color={p.isMe ? "var(--accent-dark)" : colors.color}
                      size={36}
                    />
                    <span className="leaderboard-name" style={{
                      color: p.isMe ? "var(--accent-dark)" : "var(--text)",
                      fontWeight: p.isMe ? 600 : 500,
                    }}>
                      {p.isMe ? "You" : shortName(p.displayName)}
                    </span>
                    <span className="leaderboard-total" style={{
                      color: p.isMe ? "var(--accent)" : p.streak > 0 ? "#C9A30A" : "var(--text2)",
                      fontWeight: p.isMe || p.streak > 0 ? 600 : 400,
                    }}>
                      {p.streak > 0 ? `🔥 ${p.streak}d` : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Subtabs ── */}
      <div className="subtab-row">
        {["friends", "requests", "add"].map((t) => (
          <button
            key={t}
            className={`subtab ${tab === t ? "active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t === "friends"  ? `Friends${friends.length > 0 ? ` (${friends.length})` : ""}` :
             t === "requests" ? `Requests${incoming.length > 0 ? ` · ${incoming.length}` : ""}` :
             "Add friend"}
          </button>
        ))}
      </div>

      {/* ── Friends list ── */}
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
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Requests ── */}
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
                      <button className="icon-btn" onClick={() => cancelRequest(r)} title="Cancel">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {incoming.length === 0 && outgoing.length === 0 && (
            <div className="empty-state"><p>No pending requests.</p></div>
          )}
        </div>
      )}

      {/* ── Add friend ── */}
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

          {searchStatus && <p className="search-status">{searchStatus}</p>}

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
