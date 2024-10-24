import type { Message } from 'ai';

export async function hashMessages(messages: Message[]): Promise<string> {
  // Convert messages to a stable string representation
  const messageString = messages.map(m => `${m.role}:${m.content}`).join('|');
  const encoder = new TextEncoder();
  const data = encoder.encode(messageString);
  
  // Generate SHA-256 hash
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return hashHex;
}
