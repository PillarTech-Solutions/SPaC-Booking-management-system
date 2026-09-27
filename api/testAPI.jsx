import {getFirestore, collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { app } from '../firebase/firebase-sdk';

const db = getFirestore(app);
const COLLECTION_NAME = "users";

export const insertRandomRecord = async (customData = null) => {
  try {
    const record = customData || {
      name: `User_${Math.floor(Math.random() * 1000)}`,
      email: `user${Math.floor(Math.random() * 1000)}@example.com`,
      phone: "082938932",
      createdAt: new Date(),
      role: Math.random() > 0.5 ? 'admin' : 'staff'
    };

    const docRef = await addDoc(collection(db, COLLECTION_NAME), record);
    console.log("Document written with ID: ", docRef.id);
    return docRef.id;
  } catch (e) {
    console.error("Error adding document: ", e);
    throw e;
  }
};

export const getAllUsers = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));
    const users = [];
    querySnapshot.forEach((doc) => {
      users.push({ id: doc.id, ...doc.data() });
    });
    console.log("Fetched users:", users);
    return users;
  } catch (e) {
    console.error("Error getting documents: ", e);
    throw e;
  }
};

export const getUserById = async (id) => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const userData = { id: docSnap.id, ...docSnap.data() };
      console.log("Fetched user:", userData);
      return userData;
    } else {
      console.log("No such document!");
      return null;
    }
  } catch (e) {
    console.error("Error getting document: ", e);
    throw e;
  }
};

export const updateUser = async (id, updatedData) => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    // updatedData should be an object containing the fields to update, e.g. { role: "admin" }
    await updateDoc(docRef, updatedData);
    console.log(`Document with ID ${id} updated successfully`);
  } catch (e) {
    console.error("Error updating document: ", e);
    throw e;
  }
};

export const deleteUser = async (id) => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
    console.log(`Document with ID ${id} deleted successfully`);
  } catch (e) {
    console.error("Error deleting document: ", e);
    throw e;
  }
};
