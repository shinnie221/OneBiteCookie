import { getDb, queryOne, runStmt } from '@/lib/db';
import { signToken } from '@/lib/auth';
import { seedDatabase } from '@/lib/seed';
import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    await seedDatabase();
    const db = await getDb();
    const { name, email, password } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email and password are required' }, { status: 400 });
    }

    const existingUser = queryOne(db, 'SELECT * FROM users WHERE email = ?', [email]);
    if (existingUser) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 400 });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    
    const result = runStmt(db, 
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name, email, hashedPassword, 'customer']
    );

    const userId = result.lastInsertRowid;
    const user = {
      id: userId,
      name,
      email,
      role: 'customer'
    };

    const token = signToken(user);

    return NextResponse.json({
      message: 'Registration successful',
      token,
      user
    }, { status: 201 });
  } catch (error) {
    console.error('POST /api/auth/register error:', error);
    return NextResponse.json({ error: `Registration failed: ${error.message}` }, { status: 500 });
  }
}
