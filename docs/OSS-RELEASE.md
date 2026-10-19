# Open-source release checklist

This documentation and license change is not a complete source release.

- [ ] Recover the exact source revision behind the hosted mobile playtest from its source repository. The previous working environment is no longer populated; do not reconstruct missing changes from conversation summaries.
- [ ] Compare the deployed source against the public prototype branches and choose one canonical game source.
- [ ] Remove credentials, local databases, private player data, recorded account requests, and deployment-specific tokens before publication. Preserve configuration examples without secrets.
- [ ] Record licenses and provenance for every dependency, bundled dataset, font, image, animation, and generated asset. Keep required third-party notices. Exclude Unreal binaries and content that cannot be redistributed.
- [ ] Publish the reconciled source with pinned dependencies, clean-install instructions, environment examples, database migrations, save behavior, and a deployment guide that does not depend on the owner's private credentials.
- [ ] Run the relevant unit, integration, and browser checks from a fresh checkout. Old passing results are historical evidence, not validation of this release.
- [ ] Use Game Studio's UI and playtest workflows when available to compare the current mobile build with reference images. Preserve the existing runtime unless a measured problem warrants changing it.
- [ ] Recheck loading time, touch targets, text size, reduced motion, save recovery, and iOS/Android play. The previous reported load time was about 5.8 seconds, above the five-second goal; this has not been retested.
- [ ] Choose and implement the ChatGPT integration described in [CHATGPT-PLAN.md](CHATGPT-PLAN.md), or explicitly ship without it.
- [ ] Decide the playtest audience separately from the code license. The current hosted site remains owner-only until its owner authorizes a sharing change.

Last status check: October 19, 2026. Hosting reports the site active and owner-only; no gameplay tests were rerun as part of this documentation change.
