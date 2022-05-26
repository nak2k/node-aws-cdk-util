import { request } from 'https';
import { URL } from 'url';

export interface SlackMessage {
  channel?: string;
  text: string;
  attachments: {
    title?: string;
    title_link?: string;
    text?: string;
    color?: string;
    ts?: number;
    fields?: {
      title: string;
      value: string;
      short?: boolean;
    }[];
  }[];
}

export async function postSlackMessage(message: SlackMessage) {
  if (!process.env.SLACK_WEBHOOK_URL) {
    throw new Error('Missing environment variable SLACK_WEBHOOK_URL');
  }

  const url = new URL(process.env.SLACK_WEBHOOK_URL);

  if (!message.channel) {
    const { SLACK_CHANNEL } = process.env;

    SLACK_CHANNEL && (message.channel = SLACK_CHANNEL);
  }

  return new Promise((resolve, reject) => {
    request(url, { method: 'POST' }, res => {
      res.on('end', resolve);
    })
      .on('error', reject)
      .end(JSON.stringify(message));
  });
}
