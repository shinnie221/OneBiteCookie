import { NextResponse } from 'next/server';
import { collection, getDocs, doc, runTransaction } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { verifyAuth } from '@/lib/auth';
import { normalizeBusinessRecord, normalizeBuyer } from '@/lib/business.mjs';

function staff(request) {
    const user = verifyAuth(request);
    return user && ['staff', 'admin'].includes(user.role) ? user : null;
}
export async function GET(request) {
    if (!staff(request)) return NextResponse.json({ error: 'Staff access required' }, { status: 403 });
    try {
        const [records, buyers] = await Promise.all([getDocs(collection(db, 'business_records')), getDocs(collection(db, 'suppliers'))]);
        return NextResponse.json({
            records: records.docs.map(d => ({ ...d.data(), id: d.id })).sort((a, b) => b.date.localeCompare(a.date)),
            buyers: buyers.docs.map(d => ({ ...d.data(), id: d.id })).sort((a, b) => a.name.localeCompare(b.name)),
        });
    } catch {
        return NextResponse.json({ error: 'Could not load business records. Please retry.' }, { status: 500 });
    }
}
export async function PUT(request) {
    const user = staff(request);
    if (!user) return NextResponse.json({ error: 'Staff access required' }, { status: 403 });
    let body, record;
    try {
        body = await request.json();
        if (!['buyer', 'record'].includes(body.kind) || !/^[a-zA-Z0-9_-]{1,100}$/.test(body.id || '') || !Number.isInteger(body.revision) || body.revision < 0) throw new Error('Invalid record identifier or revision.');
        record = body.kind === 'buyer' ? normalizeBuyer(body.record) : normalizeBusinessRecord(body.record);
    } catch (error) {
        return NextResponse.json({ error: error.message || 'Invalid record' }, { status: 400 });
    }
    try {
        const ref = doc(db, body.kind === 'buyer' ? 'suppliers' : 'business_records', body.id);
        await runTransaction(db, async transaction => {
            const existing = await transaction.get(ref);
            const previous = existing.exists() ? existing.data() : null;
            if ((previous?.revision || 0) !== body.revision || (!previous && body.revision !== 0)) throw new Error('CONFLICT');
            if (previous && body.kind === 'record' && previous.channel !== record.channel) throw new Error('CONFLICT');
            if (record.channel === 'wholesale') {
                if (!/^[a-zA-Z0-9_-]{1,100}$/.test(record.buyerId)) throw new Error('BUYER');
                const buyer = await transaction.get(doc(db, 'suppliers', record.buyerId));
                if (!buyer.exists()) throw new Error('BUYER');
            }
            const now = new Date().toISOString();
            transaction.set(ref, { ...record, revision: body.revision + 1, updated_at: now, created_at: previous?.created_at || now, created_by: previous?.created_by || user.name || user.email || 'staff' }, { merge: true });
        });
        return NextResponse.json({ record: { ...record, id: body.id, revision: body.revision + 1 } });
    } catch (error) {
        if (error.message === 'CONFLICT') return NextResponse.json({ error: 'This record was already saved or changed by another staff member. Close the form and refresh before editing again.' }, { status: 409 });
        if (error.message === 'BUYER') return NextResponse.json({ error: 'Choose an existing wholesale buyer.' }, { status: 400 });
        return NextResponse.json({ error: 'Could not save. Refresh the history to check whether it saved before trying again.' }, { status: 500 });
    }
}
