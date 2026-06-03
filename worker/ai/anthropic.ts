import { createAnthropic } from '@ai-sdk/anthropic';

// Claude via Cloudflare AI Gateway with BYOK.
//
// BYOK contract (confirmed against the dashboard setup): the AI Gateway token
// is passed as the provider apiKey (sent as x-api-key). The gateway recognizes
// that token, authenticates the request, and swaps in the real Anthropic key it
// has stored. There is NO separate cf-aig-authorization header in this mode.
export async function createModel(env: Env) {
  const account = env.CF_ACCOUNT_ID;
  const gateway = env.AI_GATEWAY || 'default-gateway';
  const baseURL = `https://gateway.ai.cloudflare.com/v1/${account}/${gateway}/anthropic`;

  const token = await env.CLOUDFLARE_AI_GATEWAY_TOKEN.get();

  const anthropic = createAnthropic({ baseURL, apiKey: token });

  const modelId = env.MODEL || 'claude-opus-4-8';
  return anthropic(modelId);
}
