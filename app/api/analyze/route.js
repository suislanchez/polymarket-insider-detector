import { NextResponse } from 'next/server';
import { generateDemoData } from '@/lib/demoData';
import { runFullAnalysis } from '@/lib/detection';

// Cache the demo data so it's consistent across requests
let cachedData = null;
let cachedAnalysis = null;

export async function GET() {
  try {
    if (!cachedData) {
      cachedData = generateDemoData();
      cachedAnalysis = runFullAnalysis(cachedData);
    }

    return NextResponse.json(cachedAnalysis);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    // Reset cache to generate new data
    cachedData = generateDemoData();
    cachedAnalysis = runFullAnalysis(cachedData);

    return NextResponse.json(cachedAnalysis);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
