export async function callAnthropic(
  system: string,
  user: string,
  model = 'claude-haiku-4-5',
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured. Set it in your environment variables.');
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2000,
      system,
      messages: [{ role: 'user', content: user }],
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Anthropic API error ${res.status}: ${text.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    content: Array<{ type: string; text: string }>;
  };

  const textBlock = json.content.find((b) => b.type === 'text');
  if (!textBlock) throw new Error('No text content in Anthropic response');
  return textBlock.text;
}
