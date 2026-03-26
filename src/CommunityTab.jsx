import { useState, useEffect } from "react";
import {
  collection, collectionGroup, query, where, getDocs, addDoc,
  deleteDoc, doc, onSnapshot, getDoc, setDoc, serverTimestamp,
  Timestamp, updateDoc
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

// ─── Community Impact Board ───────────────────────────────────────────────────

function CommunityImpactBoard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const monthName = new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  useEffect(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const run = async () => {
      try {
        // Fetch all activities across every user, then filter by date in JS.
        // This avoids the need for a collection-group index on createdAt.
        const snap = await getDocs(collectionGroup(db, "activities"));
        const thisDocs = snap.docs.filter(d => {
          const ts = d.data().createdAt;
          if (!ts) return false;
          const date = ts.toDate ? ts.toDate() : new Date(ts);
          return date >= monthStart;
        });
        const totalLitres = Math.round(thisDocs.reduce((s, d) => s + (d.data().litres || 0), 0));
        const userIds = new Set(thisDocs.map(d => d.ref.parent.parent.id));
        const activeUsers = userIds.size;
        const daysElapsed = Math.max(1, now.getDate());
        const ukAvgTotal = 150 * activeUsers * daysElapsed;
        const savedVsUK = Math.max(0, ukAvgTotal - totalLitres);
        const avgPerDay = activeUsers > 0 ? Math.round(totalLitres / (activeUsers * daysElapsed)) : 0;
        const pctVsUK = avgPerDay > 0 ? Math.round(((150 - avgPerDay) / 150) * 100) : null;
        setStats({ totalLitres, activeUsers, savedVsUK, avgPerDay, pctVsUK });
      } catch (e) {
        console.error("Impact board error:", e);
      }
      setLoading(false);
    };

    run();
  }, []);

  const toComparison = (litres) => {
    if (litres <= 0) return null;
    if (litres >= 800) return `${Math.round(litres / 80)} baths`;
    return `${Math.round(litres / 40)} showers`;
  };

  return (
    <div className="section">
      <div className="section-label">Community impact · {monthName}</div>
      <div className="impact-card">
        {loading ? (
          <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text2)", fontSize: 13 }}>
            Calculating community data…
          </div>
        ) : stats && stats.activeUsers > 0 ? (
          <>
            {/* Hero number */}
            <div className="impact-hero">
              <div className="impact-hero-number">
                {stats.savedVsUK > 0
                  ? stats.savedVsUK.toLocaleString("en-GB")
                  : stats.totalLitres.toLocaleString("en-GB")}
              </div>
              <div className="impact-hero-unit">
                {stats.savedVsUK > 0 ? "litres saved vs UK average" : "litres logged this month"}
              </div>
              {stats.savedVsUK > 0 && toComparison(stats.savedVsUK) && (
                <div className="impact-hero-equiv">
                  ≈ {toComparison(stats.savedVsUK)} worth of water
                </div>
              )}
            </div>

            <div className="impact-divider" />

            {/* Three stats */}
            <div className="impact-stats-row">
              <div className="impact-stat">
                <div className="impact-stat-value">{stats.activeUsers}</div>
                <div className="impact-stat-lbl">members active</div>
              </div>
              <div className="impact-stat">
                <div className="impact-stat-value">{stats.avgPerDay} L</div>
                <div className="impact-stat-lbl">avg / person / day</div>
              </div>
              <div className="impact-stat">
                <div className="impact-stat-value" style={{
                  color: stats.pctVsUK > 0 ? "#27AE60" : stats.pctVsUK < 0 ? "#E24B4A" : "var(--text)"
                }}>
                  {stats.pctVsUK !== null
                    ? `${stats.pctVsUK > 0 ? "-" : "+"}${Math.abs(stats.pctVsUK)}%`
                    : "n/a"}
                </div>
                <div className="impact-stat-lbl">vs UK avg</div>
              </div>
            </div>

            {/* Progress bar: community avg vs 150 L UK avg */}
            {stats.avgPerDay > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontSize: 11, color: "var(--text2)" }}>
                    Community avg {stats.avgPerDay} L/day
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text2)" }}>UK avg 150 L</span>
                </div>
                <div className="impact-bar-track">
                  <div className="impact-bar-fill" style={{
                    width: `${Math.min((stats.avgPerDay / 150) * 100, 100)}%`,
                    background: stats.avgPerDay <= 150 ? "#27AE60" : "#E24B4A",
                  }} />
                </div>
              </div>
            )}

            {/* Monthly community target */}
            {(() => {
              const MONTHLY_TARGET = 100000;
              const saved = Math.max(0, stats.savedVsUK || 0);
              const pct = Math.min(Math.round((saved / MONTHLY_TARGET) * 100), 100);
              return (
                <div className="community-target">
                  <div className="community-target-header">
                    <span className="community-target-label">🎯 Monthly community goal</span>
                    <span className="community-target-progress">
                      {saved.toLocaleString("en-GB")} / {MONTHLY_TARGET.toLocaleString("en-GB")} L
                    </span>
                  </div>
                  <div className="impact-bar-track">
                    <div className="impact-bar-fill" style={{
                      width: `${pct}%`,
                      background: pct >= 100 ? "#27AE60" : "var(--accent)",
                    }} />
                  </div>
                  <div className="community-target-sub">
                    {pct >= 100
                      ? "🎉 Community target reached this month. Amazing work!"
                      : `${pct}% there; ${(MONTHLY_TARGET - saved).toLocaleString("en-GB")} L to go this month`}
                  </div>
                </div>
              );
            })()}
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "16px 0", color: "var(--text2)", fontSize: 13 }}>
            No community data yet this month. Start logging to contribute!
          </div>
        )}
      </div>
    </div>
  );
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
        .sort((a, b) => {
          // Users with 0 L logged are inactive — always sink to the bottom
          if (a.total === 0 && b.total === 0) return 0;
          if (a.total === 0) return 1;
          if (b.total === 0) return -1;
          return a.total - b.total;
        });

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

// ─── Challenges hook ──────────────────────────────────────────────────────────

function useChallenges(currentUser) {
  const [challenges, setChallenges] = useState([]);

  useEffect(() => {
    if (!currentUser) return;

    let asChallengerDocs = [];
    let asOpponentDocs = [];

    const merge = () => {
      const seen = new Set();
      const all = [...asChallengerDocs, ...asOpponentDocs].filter(c => {
        if (seen.has(c.id)) return false;
        seen.add(c.id);
        return true;
      });
      all.sort((a, b) => {
        const ta = a.createdAt?.toDate?.() ?? new Date(0);
        const tb = b.createdAt?.toDate?.() ?? new Date(0);
        return tb - ta;
      });
      setChallenges(all);
    };

    const unsub1 = onSnapshot(
      query(collection(db, "challenges"), where("challengerId", "==", currentUser.uid)),
      snap => { asChallengerDocs = snap.docs.map(d => ({ id: d.id, ...d.data() })); merge(); }
    );
    const unsub2 = onSnapshot(
      query(collection(db, "challenges"), where("opponentId", "==", currentUser.uid)),
      snap => { asOpponentDocs = snap.docs.map(d => ({ id: d.id, ...d.data() })); merge(); }
    );

    return () => { unsub1(); unsub2(); };
  }, [currentUser?.uid]);

  return challenges;
}

// ─── Challenge Card ───────────────────────────────────────────────────────────

function ChallengeCard({ challenge, currentUser, onAccept, onDecline }) {
  const isChallenger = challenge.challengerId === currentUser.uid;
  const theirName    = isChallenger ? challenge.opponentName  : challenge.challengerName;
  const theirId      = isChallenger ? challenge.opponentId    : challenge.challengerId;

  const [myTotal,    setMyTotal]    = useState(null);
  const [theirTotal, setTheirTotal] = useState(null);
  const [myDays,     setMyDays]     = useState(0);
  const [loadingStats, setLoadingStats] = useState(false);

  const isActive = challenge.status === "active";
  const endDate  = challenge.endDate?.toDate?.();
  const now      = new Date();
  const isPast   = isActive && endDate && endDate < now;
  const daysLeft = endDate && !isPast ? Math.max(0, Math.ceil((endDate - now) / 86400000)) : null;

  useEffect(() => {
    if (!isActive || !challenge.startDate) return;
    const startDate = challenge.startDate.toDate();
    const end       = challenge.endDate.toDate();

    const fetchUserStats = async (uid) => {
      try {
        const snap = await getDocs(
          query(collection(db, "users", uid, "activities"), where("createdAt", ">=", startDate))
        );
        const filtered = snap.docs.filter(d => {
          const ts = d.data().createdAt;
          return (ts?.toDate?.() ?? new Date(ts)) <= end;
        });
        const total = Math.round(filtered.reduce((s, d) => s + (d.data().litres || 0), 0));
        const days  = new Set(filtered.map(d => {
          const ts = d.data().createdAt;
          return (ts?.toDate?.() ?? new Date(ts)).toDateString();
        })).size;
        return { total, days };
      } catch { return { total: 0, days: 0 }; }
    };

    setLoadingStats(true);
    Promise.all([fetchUserStats(currentUser.uid), fetchUserStats(theirId)]).then(([mine, theirs]) => {
      setMyTotal(mine.total);
      setMyDays(mine.days);
      setTheirTotal(theirs.total);
      setLoadingStats(false);
    });
  }, [challenge.id, isActive]);

  // Result for past challenges
  let winner = null, resultText = null;
  if (isPast && myTotal !== null && theirTotal !== null) {
    const minDays = Math.min(myDays, /* theirDays */ myDays); // conservative
    if (minDays < 3) {
      resultText = "Insufficient data. Both users need at least 3 days of logging.";
    } else if (myTotal < theirTotal) {
      winner = "me";
      resultText = `🎉 You win! You used ${myTotal} L vs their ${theirTotal} L.`;
    } else if (theirTotal < myTotal) {
      winner = "them";
      resultText = `${shortName(theirName)} wins. They used ${theirTotal} L vs your ${myTotal} L. Keep going!`;
    } else {
      winner = "draw";
      resultText = `🤝 It's a draw! Both used ${myTotal} L. Great effort from both sides.`;
    }
  }

  const statusLabel = isPast ? "Challenge ended" :
    isActive         ? "Active challenge" :
    challenge.status === "pending"  ? (isChallenger ? "Waiting for response" : "Incoming challenge") :
    challenge.status === "declined" ? "Declined" : "Challenge";

  const accentColor = isActive && !isPast ? "var(--accent)" : "var(--text2)";

  return (
    <div className="chal-card">
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 13 }}>⚡</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: accentColor, textTransform: "uppercase", letterSpacing: "0.7px" }}>
            {statusLabel}
          </span>
        </div>
        {daysLeft !== null && (
          <span style={{ fontSize: 11, color: "var(--text2)", fontFamily: "var(--mono)" }}>{daysLeft}d left</span>
        )}
      </div>

      {/* Participants */}
      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>
        <span style={{ color: "var(--accent-dark)", fontWeight: 700 }}>You</span>
        <span style={{ color: "var(--text2)", fontSize: 11, margin: "0 5px" }}>vs</span>
        <span>{shortName(theirName) || "Friend"}</span>
      </div>

      {/* Pending: accept/decline or waiting */}
      {challenge.status === "pending" && !isChallenger && (
        <div style={{ display: "flex", gap: 8 }}>
          <button className="accept-btn" onClick={() => onAccept(challenge)}>Accept</button>
          <button className="decline-btn" onClick={() => onDecline(challenge)}>Decline</button>
        </div>
      )}
      {challenge.status === "pending" && isChallenger && (
        <span style={{ fontSize: 12, color: "var(--text2)" }}>
          Waiting for {shortName(theirName)} to respond…
        </span>
      )}

      {/* Active: live progress bars */}
      {isActive && !isPast && (
        loadingStats ? (
          <span style={{ fontSize: 12, color: "var(--text2)" }}>Loading progress…</span>
        ) : myTotal !== null ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {[
              { label: "You",               total: myTotal,    color: myTotal <= theirTotal ? "#27AE60" : "#E24B4A", isMe: true  },
              { label: shortName(theirName), total: theirTotal, color: theirTotal < myTotal  ? "#27AE60" : "#E24B4A", isMe: false },
            ].map(({ label, total, color, isMe }) => (
              <div key={label}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: isMe ? 700 : 500, color: isMe ? "var(--accent-dark)" : "var(--text)" }}>{label}</span>
                  <span style={{ fontSize: 12, fontFamily: "var(--mono)", color: isMe ? "var(--accent)" : "var(--text2)" }}>{total} L</span>
                </div>
                <div className="impact-bar-track">
                  <div className="impact-bar-fill" style={{
                    width: `${(myTotal + theirTotal) > 0 ? Math.round((total / (myTotal + theirTotal)) * 100) : 50}%`,
                    background: color,
                  }} />
                </div>
              </div>
            ))}
            <span style={{ fontSize: 11, color: "var(--text2)" }}>Lower usage wins · {myDays}/{7} days logged</span>
          </div>
        ) : null
      )}

      {/* Past: result */}
      {isPast && (
        loadingStats ? (
          <span style={{ fontSize: 12, color: "var(--text2)" }}>Calculating result…</span>
        ) : resultText ? (
          <div className={`chal-result ${winner === "me" ? "win" : winner === "draw" ? "draw" : "lose"}`}>
            {resultText}
          </div>
        ) : null
      )}

      {/* Declined */}
      {challenge.status === "declined" && (
        <span style={{ fontSize: 12, color: "var(--text2)" }}>
          {isChallenger ? `${shortName(theirName)} declined this challenge.` : "You declined this challenge."}
        </span>
      )}
    </div>
  );
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
  const challenges = useChallenges(currentUser);

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

  const sendChallenge = async (friend) => {
    // Check if either party already has an active challenge (filter from live state)
    const myActive = challenges.find(c =>
      c.status === "active" &&
      (c.challengerId === currentUser.uid || c.opponentId === currentUser.uid)
    );
    if (myActive) {
      alert("You already have an active challenge this week! Finish it before starting another.");
      return;
    }
    // Check opponent's active challenges via a quick Firestore fetch
    try {
      const [snap1, snap2] = await Promise.all([
        getDocs(query(collection(db, "challenges"), where("challengerId", "==", friend.uid), where("status", "==", "active"))),
        getDocs(query(collection(db, "challenges"), where("opponentId",  "==", friend.uid), where("status", "==", "active"))),
      ]);
      if (!snap1.empty || !snap2.empty) {
        alert(`${friend.displayName || "Your friend"} already has an active challenge this week. Try again next week!`);
        return;
      }
    } catch { /* permission denied is fine — means no active challenge */ }

    // Check for existing pending challenge between these two
    const alreadyPending = challenges.find(c =>
      c.status === "pending" &&
      ((c.challengerId === currentUser.uid && c.opponentId === friend.uid) ||
       (c.challengerId === friend.uid     && c.opponentId === currentUser.uid))
    );
    if (alreadyPending) {
      alert("There's already a pending challenge between you two!");
      return;
    }

    try {
      await addDoc(collection(db, "challenges"), {
        challengerId:   currentUser.uid,
        challengerName: currentUser.displayName,
        opponentId:     friend.uid,
        opponentName:   friend.displayName,
        status:         "pending",
        createdAt:      serverTimestamp(),
      });
      await addDoc(collection(db, "users", friend.uid, "notifications"), {
        type:      "challenge",
        title:     "⚡ You've been challenged!",
        body:      `${currentUser.displayName || "Someone"} challenged you to a 7-day water saving contest.`,
        emoji:     "⚡",
        read:      false,
        createdAt: serverTimestamp(),
      });
    } catch (err) { console.error("sendChallenge:", err); }
  };

  const acceptChallenge = async (challenge) => {
    // Prevent accepting if already in an active challenge
    const myActive = challenges.find(c =>
      c.id !== challenge.id &&
      c.status === "active" &&
      (c.challengerId === currentUser.uid || c.opponentId === currentUser.uid)
    );
    if (myActive) {
      alert("You already have an active challenge! Finish it first.");
      return;
    }
    try {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 7);
      await updateDoc(doc(db, "challenges", challenge.id), {
        status:    "active",
        startDate: serverTimestamp(),
        endDate:   Timestamp.fromDate(endDate),
      });
      await addDoc(collection(db, "users", challenge.challengerId, "notifications"), {
        type:      "challenge_accepted",
        title:     "Challenge accepted! ⚡",
        body:      `${currentUser.displayName || "Your friend"} accepted your 7-day water challenge. Game on!`,
        emoji:     "⚡",
        read:      false,
        createdAt: serverTimestamp(),
      });
    } catch (err) { console.error("acceptChallenge:", err); }
  };

  const declineChallenge = async (challenge) => {
    try {
      await updateDoc(doc(db, "challenges", challenge.id), { status: "declined" });
    } catch (err) { console.error("declineChallenge:", err); }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">Community</div>
        {incoming.length > 0 && (
          <div className="notif-badge">{incoming.length}</div>
        )}
      </div>

      {/* ── Community Impact Board ── */}
      <CommunityImpactBoard />

      {/* ── Active challenge (pinned below impact board) ── */}
      {(() => {
        const active = challenges.find(c =>
          c.status === "active" &&
          (c.challengerId === currentUser.uid || c.opponentId === currentUser.uid)
        );
        if (!active) return null;
        return (
          <div className="section">
            <ChallengeCard
              challenge={active}
              currentUser={currentUser}
              onAccept={acceptChallenge}
              onDecline={declineChallenge}
            />
          </div>
        );
      })()}

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
                      {p.streak > 0 ? `🔥 ${p.streak}d` : "0d"}
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
        {["friends", "requests", "add"].map((t) => {
          const label =
            t === "friends"  ? `Friends${friends.length > 0 ? ` (${friends.length})` : ""}` :
            t === "requests" ? `Requests${incoming.length > 0 ? ` · ${incoming.length}` : ""}` :
            "Add friend";
          return (
            <button key={t} className={`subtab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
              {label}
            </button>
          );
        })}
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
                const existingChallenge = challenges.find(c =>
                  (c.challengerId === currentUser.uid && c.opponentId === f.uid) ||
                  (c.challengerId === f.uid && c.opponentId === currentUser.uid)
                );
                const chalBtnDisabled = existingChallenge?.status === "active" || existingChallenge?.status === "pending";
                const chalBtnClass = `chal-btn${existingChallenge?.status === "pending" ? " pending" : existingChallenge?.status === "active" ? " active" : ""}`;
                const chalBtnTitle =
                  existingChallenge?.status === "active"  ? "Active challenge. Tap to view." :
                  existingChallenge?.status === "pending" ? "Challenge pending. Tap to view." :
                  "Challenge to a 7-day water saving contest";
                return (
                  <div className="activity-item" key={f.uid} style={{ alignItems: "center" }}>
                    <Avatar initials={getInitials(f.displayName || f.email)} bg={colors.bg} color={colors.color} />
                    <div style={{ flex: 1 }}>
                      <div className="activity-name">{f.displayName || "User"}</div>
                      <div className="activity-detail">{f.email}</div>
                    </div>
                    <button
                      className={chalBtnClass}
                      onClick={() => !chalBtnDisabled && sendChallenge(f)}
                      title={chalBtnTitle}
                    >
                      ⚡
                    </button>
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

      {/* ── Challenges ── */}
      {tab === "challenges" && (
        <div className="section">
          {challenges.length === 0 ? (
            <div className="empty-state">
              <p>No challenges yet.</p>
              <p>Go to the Friends tab and tap ⚡ Challenge next to a friend to start a 7-day contest!</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Active first, then pending, then the rest */}
              {[
                ...challenges.filter(c => c.status === "active"),
                ...challenges.filter(c => c.status === "pending"),
                ...challenges.filter(c => c.status !== "active" && c.status !== "pending"),
              ].map(c => (
                <ChallengeCard
                  key={c.id}
                  challenge={c}
                  currentUser={currentUser}
                  onAccept={acceptChallenge}
                  onDecline={declineChallenge}
                />
              ))}
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
