import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDjhEHNIehM7y6oANA3hj6UT_KDJyI_9ZQ",
  authDomain: "the-local-loop-c2da3.firebaseapp.com",
  projectId: "the-local-loop-c2da3",
  storageBucket: "the-local-loop-c2da3.firebasestorage.app",
  messagingSenderId: "934831324282",
  appId: "1:934831324282:web:b088bd9720733090fc8fc3",
  measurementId: "G-5SWNFDGWWC",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);
