import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { signToken } from '@/lib/auth';
import { seedDatabase } from '@/lib/seed';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    await seedDatabase();
    const { uid, email, displayName } = await request.json();

    if (!uid || !email) {
      return NextResponse.json({ error: 'Firebase UID and email are required' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const usersRef = collection(db, 'users');

    // Check if user already exists by email
    const emailQuery = query(usersRef, where('email', '==', cleanEmail));
    const snapshot = await getDocs(emailQuery);

    let user;

    if (!snapshot.empty) {
      // Existing user — link Google account
      const userDoc = snapshot.docs[0];
      user = { id: userDoc.id, ...userDoc.data() };
    } else {
      // New user — assign admin role only for designated admin emails
      const adminEmails = ['shinniecheng221@gmail.com', 'yunxuanhuang60@gmail.com'];
      const isAdmin = adminEmails.includes(cleanEmail);
      const newUser = {
        name: displayName || cleanEmail.split('@')[0],
        email: cleanEmail,
        password: '', // No password for Google-only users
        role: isAdmin ? 'admin' : 'customer',
        authProvider: 'google',
        firebaseUid: uid,
        createdAt: new Date().toISOString()
      };

      const docRef = await addDoc(usersRef, newUser);
      user = { id: docRef.id, ...newUser };
    }

    const token = signToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    });

    return NextResponse.json({
      message: 'Google login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('POST /api/auth/google error:', error);
    return NextResponse.json({ error: `Google login failed: ${error.message}` }, { status: 500 });
  }
}
