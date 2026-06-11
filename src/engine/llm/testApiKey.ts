import Anthropic from '@anthropic-ai/sdk'

/** Probe a Claude API key with a minimal request. Throws on failure so callers
 *  can surface the error; resolves silently when the key is valid. */
export async function testApiKey(apiKey: string, model: string): Promise<void> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
  await client.messages.create({
    model,
    max_tokens: 1,
    messages: [{ role: 'user', content: 'ok' }],
  })
}
