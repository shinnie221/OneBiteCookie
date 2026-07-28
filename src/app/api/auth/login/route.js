import { getDb, queryOne } from '@/lib/db';
import { signToken } from '@/lib/auth';
import { seedDatabase } from '@/lib/seed';
import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    await seedDatabase();
    const db = await getDb();
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const staff = queryOne(db, 'SELECT * FROM staff WHERE email = ?', [email]);
    if (!staff) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const validPassword = bcrypt.compareSync(password, staff.password);
    if (!validPassword) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = signToken({ id: staff.id, email: staff.email, name: staff.name, role: staff.role });

    return NextResponse.json({
      message: 'Login successful',
      token,
      staff: {
        id: staff.id,
        name: staff.name,
        email: staff.email,
        role: staff.role
      }
    });
  } catch (error) {
    console.error('POST /api/auth/login error:', error);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
