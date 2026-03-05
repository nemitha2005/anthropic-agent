import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyChiLH5YWhWbYu1hO9qtrwKQZiyvxk9_Yk",
  authDomain: "anthropic-agent-5a907.firebaseapp.com",
  projectId: "anthropic-agent-5a907",
  storageBucket: "anthropic-agent-5a907.firebasestorage.app",
  messagingSenderId: "380264062364",
  appId: "1:380264062364:web:142a2b9e0e351dea223c59",
  measurementId: "G-9QLPP20XE6",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);

export { app, auth };
