import https from 'https';
import http from 'http';
import { logger } from '../lib/logger';

interface SlackBlock {
  type: string;
  text?: { type: string; text: string; emoji?: boolean };
  fields?: { type: string; text: string }[];
}

interface SlackPayload {
  text: string;
  blocks?: SlackBlock[];
}

/**
 * Send a Slack message to a webhook URL.
 * Silently swallows errors so it never breaks the caller.
 */
export async function sendSlackAlert(webhookUrl: string, payload: SlackPayload): Promise<void> {
  if (!webhookUrl) return;
  try {
    const body = JSON.stringify(payload);
    const url = new URL(webhookUrl);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;

    await new Promise<void>((resolve, reject) => {
      const req = lib.request(
        {
          hostname: url.hostname,
          port: url.port || (isHttps ? 443 : 80),
          path: url.pathname + url.search,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
          },
        },
        (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => {
            if ((res.statusCode ?? 0) >= 400) {
              reject(new Error(`Slack webhook returned ${res.statusCode}: ${data}`));
            } else {
              resolve();
            }
          });
        },
      );
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  } catch (err) {
    logger.warn('Failed to send Slack alert', { err });
  }
}

const SEVERITY_EMOJI: Record<string, string> = {
  CRITICAL: '🔴',
  HIGH: '🟠',
  MEDIUM: '🟡',
  LOW: '🟢',
};

export function driftAlertPayload(opts: {
  agentName: string;
  severity: string;
  summary: string;
  baseUrl: string;
}): SlackPayload {
  const emoji = SEVERITY_EMOJI[opts.severity] ?? '⚠️';
  return {
    text: `${emoji} Drift detected in *${opts.agentName}*`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${emoji} *Drift Detected — ${opts.agentName}*\n*Severity:* ${opts.severity}\n*Summary:* ${opts.summary}`,
        },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Severity*\n${opts.severity}` },
          { type: 'mrkdwn', text: `*View in Provenant*\n<${opts.baseUrl}/drift|Open Drift Reports>` },
        ],
      },
    ],
  };
}

export function policyViolationPayload(opts: {
  policyName: string;
  agentName: string;
  severity: string;
  description: string;
  baseUrl: string;
}): SlackPayload {
  const emoji = SEVERITY_EMOJI[opts.severity] ?? '⚠️';
  return {
    text: `${emoji} Policy violation in *${opts.agentName}*`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${emoji} *Policy Violation — ${opts.policyName}*\n*Agent:* ${opts.agentName}\n*Severity:* ${opts.severity}\n${opts.description}`,
        },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Policy*\n${opts.policyName}` },
          { type: 'mrkdwn', text: `*View in Provenant*\n<${opts.baseUrl}/policies|Open Policies>` },
        ],
      },
    ],
  };
}
