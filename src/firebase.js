import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Web app's Firebase configuration provided by user
const firebaseConfig = {
  apiKey: "AIzaSyBIo_hvlnDKHrXdLjPX3SBDPUj3v7rapF8",
  authDomain: "ctf-4-4fe40.firebaseapp.com",
  projectId: "ctf-4-4fe40",
  storageBucket: "ctf-4-4fe40.firebasestorage.app",
  messagingSenderId: "608990631784",
  appId: "1:608990631784:web:d3f05af88f82b7b46128dd",
  measurementId: "G-8K4WBE6B72"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
