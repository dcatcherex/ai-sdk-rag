import { NextResponse } from 'next/server';

/**
 * Returns a safe 500 response that never leaks internal error details
 * (DB connection strings, stack traces, file paths) to clients.
 *
 * Always log the full error server-side before calling this.
 */
export function internalError(error: unknown, context: string): NextResponse {
    console.error(`[${context}]`, error);
    return NextResponse.json(
        { error: 'An internal error occurred. Please try again.' },
        { status: 500 }
    );
}
