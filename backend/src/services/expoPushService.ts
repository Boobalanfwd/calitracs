import https from 'https';
import http from 'http';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';
const EXPO_API_TIMEOUT_MS = 10_000;

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: 'default' | null;
  badge?: number;
  channelId?: string;
}

export interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

export interface ExpoReceiptResult {
  status: 'ok' | 'error';
  message?: string;
  details?: { error?: string };
}

/**
 * POST JSON to a URL and return parsed response body.
 */
async function postJson(url: string, body: object): Promise<any> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...(process.env.EXPO_ACCESS_TOKEN
          ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` }
          : {}),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve({ data: [] });
        }
      });
    });

    // Give Expo's API a hard deadline — otherwise a stalled socket pins a
    // worker tick forever.
    req.setTimeout(EXPO_API_TIMEOUT_MS, () => {
      req.destroy(new Error('Expo push API request timed out'));
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

/**
 * Send push notifications in batches of 100.
 * Returns array of [token, ticketId | null] pairs for receipt polling.
 */
export async function sendBatch(
  messages: ExpoPushMessage[]
): Promise<Array<{ token: string; ticketId: string | null; error: string | null }>> {
  const results: Array<{ token: string; ticketId: string | null; error: string | null }> = [];
  const BATCH_SIZE = 100;

  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE);
    try {
      const response = await postJson(EXPO_PUSH_URL, batch);
      const tickets: ExpoPushTicket[] = response.data || [];
      batch.forEach((msg, idx) => {
        const ticket = tickets[idx];
        if (ticket?.status === 'ok') {
          results.push({ token: msg.to, ticketId: ticket.id || null, error: null });
        } else {
          results.push({
            token: msg.to,
            ticketId: null,
            error: ticket?.message || 'Unknown Expo error',
          });
        }
      });
    } catch (err: any) {
      // Network error — mark entire batch as failed
      batch.forEach((msg) => {
        results.push({ token: msg.to, ticketId: null, error: err.message || 'Network error' });
      });
      console.error('[ExpoPushService] Batch send error:', err.message);
    }
  }

  return results;
}

/**
 * Poll Expo receipt endpoint for delivery status.
 * Returns map of receiptId → status info.
 */
export async function pollReceipts(
  receiptIds: string[]
): Promise<Record<string, ExpoReceiptResult>> {
  if (receiptIds.length === 0) return {};
  const BATCH_SIZE = 300;
  const allResults: Record<string, ExpoReceiptResult> = {};

  for (let i = 0; i < receiptIds.length; i += BATCH_SIZE) {
    const batch = receiptIds.slice(i, i + BATCH_SIZE);
    try {
      const response = await postJson(EXPO_RECEIPTS_URL, { ids: batch });
      Object.assign(allResults, response.data || {});
    } catch (err: any) {
      console.error('[ExpoPushService] Receipt poll error:', err.message);
    }
  }

  return allResults;
}
