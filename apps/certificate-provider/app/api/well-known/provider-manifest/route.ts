import { NextResponse } from 'next/server';
import { PROVIDER_MANIFEST } from '@/lib/provider-contract';

export async function GET() {
  return NextResponse.json(PROVIDER_MANIFEST);
}
