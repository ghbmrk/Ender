# ChatGPT plan integration

Status: design only; no authentication or inference implementation in this change.
Documentation reviewed October 19, 2026. Recheck the current contract before implementation.

## Product goal

Let a player optionally connect their own eligible ChatGPT plan to power Ender's companion and crafting assistance. Keep the core game usable without that connection, with the existing deterministic provider as the fallback. Results must pass the game's existing validation; AI output must not become the authority for combat outcomes, inventory, currency, or rewards.

## Supported deployment choices

1. **Open-source, user-controlled runtime:** use OpenAI's documented OSS registration flow in a local companion or self-hosted runtime controlled solely by that user. Keep credentials protected locally. The mobile web interface remains the player surface; mobile compatibility with the selected runtime still needs a tested design. A desktop-only companion is not a complete mobile solution.
2. **Shared hosted service:** pursue the partner route for a remotely hosted integration. The OSS documentation explicitly directs paid or remotely hosted apps to the interest form. Do not assume the local flow can be moved into a shared Cloudflare Worker or game database.

No runtime choice or partner approval is implemented or claimed here.

## Implementation contract

- Use Ender's own application identity and the official supported OAuth flow. Never reuse another application's client ID or ask for passwords, session cookies, or pasted bearer tokens.
- Persist a stable opaque host identifier per installation. Use fresh state, nonce, and PKCE values for each authorization attempt; bind the callback to that attempt.
- Retain the issued client ID before token exchange. Verify the ID token's signature, issuer, audience, expiry, and nonce.
- Treat identity and plan authorization separately. Enable AI calls only after checking the actual granted plan-usage scope.
- Keep persistent authentication credentials local and under the user's control. Do not persist subscription tokens in the shared hosted game's database, logs, browser analytics, or repository.
- Discover available models for the connected account. Follow the documented Responses API contract, including streaming and disabled response storage; do not infer access to image generation, other API products, or arbitrary cloud compute.
- Show connection state, whether plan usage is enabled, a way to manage usage, and a disconnect action. Do not charge to unlock use of a connected ChatGPT plan.
- Requests must serve the authenticated user's activity. Require explicit consent for background companion activity; another player's battle or shared-world event must not consume that user's allowance.
- Handle refused consent, expiry, revocation, unavailable models, limits, and interrupted streams with clear player language and a fallback.
- Keep game sessions, save ownership, and server-side game authorization independent of an inference token.

## Acceptance criteria

- Real sign-in, consent, model discovery, and one completed request work with a consenting eligible test account.
- Identity-only sign-in never enables AI requests.
- Tampered state, invalid tokens, a mismatched returning identity, and revoked permissions fail closed.
- Account switching never mixes credentials, saves, usage, or pending requests.
- Disconnect and exhausted limits restore the fallback without losing progress.
- Credentials never appear in network traces sent to the game server, logs, screenshots, build artifacts, or source control.
- Mobile play is tested on physical iOS and Android devices; a loopback callback must not be assumed to work from a remote shared host.
- Existing game tests and the no-connection experience still pass. Tests that currently forbid all live inference must distinguish the default offline path from explicitly authorized optional inference.
- No claim of partnership, successful live authentication, or subscription support is made before that behavior is verified.

## Official sources

- [Quickstart](https://developers.openai.com/siwc/quickstart)
- [OSS and locally hosted overview](https://developers.openai.com/siwc/token-sharing-open-source)
- [Registration and sign-in](https://developers.openai.com/siwc/token-sharing-open-source/sign-in)
- [OpenAI's worked OSS example](https://developers.openai.com/cookbook/articles/sign-in-with-chatgpt)
- [Sign in with ChatGPT terms](https://openai.com/policies/sign-in-with-chatgpt-terms/)
- [Partner interest form](https://openai.com/form/sign-in-with-chatgpt-interest/)
