import { getFirestore, collection, addDoc } from 'firebase/firestore';
import { app } from '../../firebase/firebase-sdk'; // Make sure app is exported from this file

// Initialize Firestore
const db = getFirestore(app);

export const insertRandomRecord = async () => {
  try {
    // A random example record
    const randomRecord = {
      name: `User_${Math.floor(Math.random() * 1000)}`,
      email: `user${Math.floor(Math.random() * 1000)}@example.com`,
      createdAt: new Date(),
      status: Math.random() > 0.5 ? 'active' : 'inactive'
    };

    // Add a new document with a generated id to a "users" collection
    const docRef = await addDoc(collection(db, "users"), randomRecord);
    console.log("Document written with ID: ", docRef.id);
    return docRef.id;
  } catch (e) {
    console.error("Error adding document: ", e);
    throw e;
  }
};
