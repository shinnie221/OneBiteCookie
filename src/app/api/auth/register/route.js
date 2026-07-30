import { db } from '@/lib/firebase';
import { ref, get, push, set, query, orderByChild, equalTo } from 'firebase/database';
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

    const usersRef = ref(db, 'users');
    const emailQuery = query(usersRef, orderByChild('email'), equalTo(email));
    const snapshot = await get(emailQuery);

    if (snapshot.exists()) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 400 });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    
    const newUserRef = push(usersRef);
    const user = {
      name,
      email,
      password: hashedPassword,
      role: 'customer',
      createdAt: new Date().toISOString()
    };
    
    await set(newUserRef, user);

    const safeUser = {
      id: newUserRef.key,
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
