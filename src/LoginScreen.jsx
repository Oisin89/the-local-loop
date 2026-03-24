import { signInWithPopup } from "firebase/auth";
import { auth, provider } from "./firebase";

export default function LoginScreen() {
  const handleSignIn = async () => {
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Sign in error:", err);
    }
  };

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-logo">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="24" fill="#E1F5EE" />
            <path d="M24 12c0 0-8 6-8 13a8 8 0 0 0 16 0c0-7-8-13-8-13z" fill="#1D9E75" />
            <path d="M24 20c0 0-4 3-4 6.5a4 4 0 0 0 8 0C28 23 24 20 24 20z" fill="#085041" />
          </svg>
        </div>
        <h1 className="login-title">The Local Loop</h1>
        <p className="login-sub">Track your water usage and compare with your community.</p>
        <button className="google-btn" onClick={handleSignIn}>
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33.2 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 20-9 20-20 0-1.3-.1-2.7-.4-4z" />
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.1 18.9 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4c-7.7 0-14.4 4.4-17.7 10.7z" />
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.4 35.6 26.8 36 24 36c-5.2 0-9.5-2.8-11.3-7l-6.5 5C9.7 39.7 16.4 44 24 44z" />
            <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.9 2.4-2.5 4.4-4.6 5.8l6.2 5.2C40.7 35.7 44 30.3 44 24c0-1.3-.1-2.7-.4-4z" />
          </svg>
          Continue with Google
        </button>
      </div>
    </div>
  );
}
