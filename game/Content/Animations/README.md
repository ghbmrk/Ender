# Animations

- `Binder/AM_ThreadLash`, `AM_ThreadLash_Combo`, `AM_Sever`, `AM_Bind`, `AM_Unravel`, `AM_WardingSigil`,
  `AM_GrandFracture`, `AM_Evade`, `AM_Draught` — montage names the ability data expects.
- Timing windows are anim notify states from C++ (`ANS_AttackWindow`, `ANS_MovementOverride`, `ANS_CancelWindow`,
  `ANS_Invulnerability`, `ANS_GameplayCueWindow`). `create_ender_assets.py --only montages` writes them on a
  track named `Ender` from the ability values; hand-placed notifies on other tracks are left alone.
- A montage without notify states still plays: the ability falls back to its Definition timeline.
