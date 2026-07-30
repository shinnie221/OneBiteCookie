import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { signToken } from '@/lib/auth';
import { seedDatabase } from '@/lib/seed';
import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    await seedDatabase();
    const { name, email, password } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email and password are required' }, { status: 400 });
    }

    const usersRef = collection(db, 'users');
    const emailQuery = query(usersRef, where('email', '==', email));
    const snapshot = await getDocs(emailQuery);

    if (!snapshot.empty) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 400 });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    
    const user = {
      name,
      email,
      password: hashedPassword,
      role: 'customer',
      createdAt: new Date().toISOString()
    };
    
    const docRef = await addDoc(usersRef, user);

    const safeUser = {
      id: docRef.id,
      name,
      email,
      role: 'customer'
    };

    const token = signToken(safeUser);

    return NextResponse.json({
      message: 'Registration successful',
      token,
      user: safeUser
    }, { status: 201 });
  } catch (error) {
    console.error('POST /api/auth/register error:', error);
    return NextResponse.json({ error: `Registration failed: ${error.message}` }, { status: 500 });
  }
}
