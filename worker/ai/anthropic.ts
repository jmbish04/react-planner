import { createAnthropic } from '@ai-sdk/anthropic';

// Claude via Cloudflare AI Gateway with BYOK.
// The gateway holds the real provider key; we authenticate to the gateway with
// a token pulled from Secrets Store. Swap models/providers by changing MODEL /
// the gateway config — no code change needed.
export async function createModel(env: Env) {
  const account = env.CF_ACCOUNT_ID;
  const gateway = env.AI_GATEWAY || 'default-gateway';
  const baseURL = `https://gateway.ai.cloudflare.com/v1/${account}/${gateway}/anthropic`;

  const token = await env.CLOUDFLARE_AI_GATEWAY_TOKEN.get();

  const anthropic = createAnthropic({
    baseURL,
    // BYOK: the real Anthropic key is injected by AI Gateway. A placeholder keeps
    // the SDK happy; the gateway overrides it when stored keys are configured.
    apiKey: 'byok-via-ai-gateway',
    headers: {
      'cf-aig-authorization': `Bearer ${token}`,
    },
  });

  const modelId = env.MODEL || 'claude-sonnet-4-6';
  return anthropic(modelId);
}
