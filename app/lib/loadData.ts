import { PapersData } from './schema';

export async function getPapersForDate(date: string): Promise<PapersData> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const url = `${baseUrl}/data/papers-${date}.json`;
  
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      next: { revalidate: 0 }
    });
    
    if (!res.ok) {
      throw new Error(`Failed to fetch papers for ${date}: ${res.status}`);
    }
    
    const data: PapersData = await res.json();
    return data;
  } catch (error) {
    throw new Error(`Failed to load papers for ${date}: ${error}`);
  }
}

export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

