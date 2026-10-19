# Ender

A mobile web game about crafting creatures, battling, and growing a living companion.

## Project status

The [hosted playtest](https://ender-living-weave.markizard.chatgpt.site) is active but currently owner-only. Its publication was last updated on October 10, 2026; access and publication status were checked on October 19. This is a prototype, not a production release.

The default branch currently contains the project documentation and license, not the hosted game's complete source. Earlier experiments are available on branches including [the-weave-mvp](https://github.com/ghbmrk/Ender/tree/the-weave-mvp), [hero-painter](https://github.com/ghbmrk/Ender/tree/hero-painter), and [ender-2d](https://github.com/ghbmrk/Ender/tree/ender-2d). They are separate prototypes and should not be assumed to match the hosted build.

The full source release must reconcile the deployed source, reproducible builds, asset provenance, and tests. See the [release checklist](docs/OSS-RELEASE.md).

## Open source

Original Ender software and associated documentation are licensed under [MIT](LICENSE). Third-party code, data, and assets retain their own licenses and attribution requirements. This license does not relicense Unreal Engine or third-party engine content. Artwork and dataset rights must be recorded before they are included in a source release.

## ChatGPT integration

ChatGPT subscription usage is planned and is **not implemented**. OpenAI now provides a documented open-source sign-in flow for eligible ChatGPT plans, with separate user permission for AI requests. Identity sign-in alone does not authorize plan usage.

The hosted game's existing access gate is separate from that integration. An OSS license alone does not authorize storing players' subscription tokens on a shared game server. See the [integration design and acceptance criteria](docs/CHATGPT-PLAN.md).

Ender is not claiming OpenAI partnership or endorsement.
