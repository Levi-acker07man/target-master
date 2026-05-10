import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCVhzF8Xsp3vCAp8tC2wHvtNAGwKmQEj8Q",
  authDomain: "target-master-5dd70.firebaseapp.com",
  projectId: "target-master-5dd70",
  storageBucket: "target-master-5dd70.firebasestorage.app",
  messagingSenderId: "934513376358",
  appId: "1:934513376358:web:a083a1ed682084539101a7",
  measurementId: "G-VZP7JM5928"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// ----- THIS IS THE NEW PART -----
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});
// --------------------------------

export const db = getFirestore(app);