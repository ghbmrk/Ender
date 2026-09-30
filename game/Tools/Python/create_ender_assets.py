"""
Creates (or updates in place) Ender's data-driven Unreal assets from Content/Data/*.json.

Run inside the editor (Tools > Execute Python Script...) or headless:
    UnrealEditor-Cmd.exe <path>/Ender.uproject -run=pythonscript -script="<path>/create_ender_assets.py"

Optional arguments (headless: put them inside the -script="..." quotes):
    --only input,abilities,montages,blueprints,enemies,encounters,loot
    --override-rosters     write encounters.json AllowedArchetypes onto the encounter assets
    --force-binder         overwrite BP_Binder StartupAbilities even when already set

Idempotent: existing assets are loaded and overwritten field by field; notify states
on the dedicated "Ender" montage track are removed and re-added.
"""

import json
import os
import re
import sys

import unreal

SECTIONS = ["input", "abilities", "montages", "blueprints", "enemies", "encounters", "loot"]
NOTIFY_TRACK = "Ender"

asset_tools = unreal.AssetToolsHelpers.get_asset_tools()
eal = unreal.EditorAssetLibrary


# ------------------------------------------------------------------ helpers

def log(msg):
    unreal.log("[Ender] " + msg)


def warn(msg):
    unreal.log_warning("[Ender] " + msg)


def data_dir():
    return os.path.join(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_content_dir()), "Data")


def load_json(name):
    with open(os.path.join(data_dir(), name), "r", encoding="utf-8") as f:
        return json.load(f)


def split_path(asset_path):
    folder, name = asset_path.rsplit("/", 1)
    return folder, name


def object_path(asset_path):
    """/Game/X/Y -> /Game/X/Y.Y"""
    return asset_path if "." in asset_path.rsplit("/", 1)[1] else asset_path + "." + asset_path.rsplit("/", 1)[1]


def exists(asset_path):
    return bool(asset_path) and eal.does_asset_exist(asset_path)


def load(asset_path):
    return eal.load_asset(asset_path) if exists(asset_path) else None


def snake(name):
    """UPROPERTY name -> Python property name (AbilityTag -> ability_tag, bTutorial -> tutorial)."""
    if re.match(r"^b[A-Z]", name):
        name = name[1:]
    s = re.sub(r"(.)([A-Z][a-z]+)", r"\1_\2", name)
    s = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", s)
    return s.lower()


def enum_value(enum_cls, name):
    """Find an enum member by its C++ name, whatever Python casing the editor used."""
    wanted = name.replace("_", "").lower()
    for attr in dir(enum_cls):
        if attr.startswith("_"):
            continue
        if attr.replace("_", "").lower() == wanted:
            return getattr(enum_cls, attr)
    raise ValueError("%s has no member %s" % (enum_cls.__name__, name))


def get_or_create(asset_path, asset_class, factory):
    existing = load(asset_path)
    if existing:
        return existing
    folder, name = split_path(asset_path)
    if not eal.does_directory_exist(folder):
        eal.make_directory(folder)
    created = asset_tools.create_asset(name, folder, asset_class, factory)
    if created is None:
        raise RuntimeError("could not create " + asset_path)
    log("created " + asset_path)
    return created


def data_asset(asset_path, cls):
    factory = unreal.DataAssetFactory()
    factory.set_editor_property("data_asset_class", cls)
    return get_or_create(asset_path, cls, factory)


def blueprint(asset_path, parent_class):
    existing = load(asset_path)
    if existing:
        return existing
    factory = unreal.BlueprintFactory()
    factory.set_editor_property("parent_class", parent_class)
    return get_or_create(asset_path, unreal.Blueprint, factory)


def blueprint_class(asset_path):
    if not exists(asset_path):
        return None
    try:
        return eal.load_blueprint_class(asset_path)
    except Exception:
        return None


def native_class(script_path):
    try:
        return unreal.load_class(None, script_path)
    except Exception:
        return None


def set_tag(obj, prop, tag_name):
    tag = unreal.EnderContentLibrary.make_gameplay_tag(tag_name or "")
    try:
        obj.set_editor_property(snake(prop), tag)
    except Exception:
        unreal.EnderContentLibrary.set_property_from_text(obj, prop, '(TagName="%s")' % (tag_name or ""))
    if tag_name and not unreal.BlueprintGameplayTagLibrary.is_gameplay_tag_valid(tag):
        warn("gameplay tag %s is not registered" % tag_name)


def set_prop(obj, prop, value):
    try:
        obj.set_editor_property(snake(prop), value)
    except Exception as e:
        warn("%s.%s: %s" % (obj.get_name(), prop, e))


def save(asset):
    eal.save_loaded_asset(asset, False)


def cdo_of(bp):
    return unreal.get_default_object(bp.generated_class())


# ------------------------------------------------------------------ input

def make_key(name):
    key = unreal.Key()
    try:
        key.set_editor_property("key_name", name)
    except Exception:
        key = unreal.Key(key_name=name)
    return key


def make_modifier(kind, outer, dead_zone):
    if kind == "Negate":
        return unreal.new_object(unreal.InputModifierNegate, outer)
    if kind == "Swizzle":
        m = unreal.new_object(unreal.InputModifierSwizzleAxis, outer)
        m.set_editor_property("order", enum_value(unreal.InputAxisSwizzle, "YXZ"))
        return m
    if kind == "DeadZone":
        m = unreal.new_object(unreal.InputModifierDeadZone, outer)
        m.set_editor_property("lower_threshold", float(dead_zone["lower"]))
        m.set_editor_property("upper_threshold", float(dead_zone["upper"]))
        return m
    raise ValueError("unknown modifier " + kind)


def build_input():
    cfg = load_json("input.json")
    folder = cfg["folder"]
    action_factory = getattr(unreal, "InputAction_Factory", None)
    imc_factory = getattr(unreal, "InputMappingContext_Factory", None)

    actions = {}
    for name, spec in cfg["actions"].items():
        ia = get_or_create(folder + "/" + name, unreal.InputAction, action_factory() if action_factory else None)
        ia.set_editor_property("value_type", enum_value(unreal.InputActionValueType, spec["valueType"]))
        save(ia)
        actions[name] = ia

    imc = get_or_create(folder + "/" + cfg["mappingContext"], unreal.InputMappingContext, imc_factory() if imc_factory else None)
    mappings = []
    for m in cfg["mappings"]:
        mapping = unreal.EnhancedActionKeyMapping()
        mapping.set_editor_property("action", actions[m["action"]])
        mapping.set_editor_property("key", make_key(m["key"]))
        mapping.set_editor_property("modifiers", [make_modifier(k, imc, cfg["deadZone"]) for k in m.get("modifiers", [])])
        mappings.append(mapping)

    # UE 5.5 exposes Mappings directly; later versions wrap them in DefaultKeyMappings.
    try:
        imc.set_editor_property("mappings", mappings)
    except Exception:
        wrapper = imc.get_editor_property("default_key_mappings")
        wrapper.set_editor_property("mappings", mappings)
        imc.set_editor_property("default_key_mappings", wrapper)
    save(imc)
    log("input: %d actions, %d mappings" % (len(actions), len(mappings)))


# ------------------------------------------------------------------ abilities

ABILITY_FOLDER = "/Game/Abilities"
ENUM_FIELDS = {"Priority": "EnderInputPriority", "HitWeight": "EnderHitWeight"}
TAG_FIELDS = {"AbilityTag", "CooldownTag", "DamageType", "CueTag"}
ASSET_FIELDS = {"Montage", "ComboMontage"}
META_FIELDS = {"AbilityClass", "Blueprint"}


def build_abilities():
    cfg = load_json("abilities.json")["abilities"]
    out = {}
    for key, spec in cfg.items():
        da = data_asset("%s/Data/DA_Ability_%s" % (ABILITY_FOLDER, key), unreal.EnderAbilityDefinition)
        for field, value in spec.items():
            if field in META_FIELDS:
                continue
            if field in TAG_FIELDS:
                set_tag(da, field, value)
            elif field in ENUM_FIELDS:
                set_prop(da, field, enum_value(getattr(unreal, ENUM_FIELDS[field]), value))
            elif field in ASSET_FIELDS:
                asset = load(value)
                if asset:
                    set_prop(da, field, asset)
            elif field == "DisplayName":
                set_prop(da, field, unreal.Text(value))
            elif field == "StrikeDistances":
                set_prop(da, field, [float(v) for v in value])
            elif field == "InputSlot":
                set_prop(da, field, int(value))
            else:
                set_prop(da, field, float(value))
        save(da)
        out[key] = da
    log("abilities: %d definitions" % len(out))
    return out


def add_state(anim, cls, start, end, length, props=None):
    start = max(0.0, min(start, length))
    end = max(start, min(end, length))
    if end - start <= 1e-4:
        return
    state = unreal.AnimationLibrary.add_animation_notify_state_event(anim, NOTIFY_TRACK, start, end - start, cls)
    for k, v in (props or {}).items():
        state.set_editor_property(k, v)


def build_montage_notifies():
    cfg = load_json("abilities.json")
    specs = cfg["abilities"]
    classes = {k: native_class(v) for k, v in cfg["notifyStates"].items() if not k.startswith("_")}
    done = 0
    for key, s in specs.items():
        anim = load(s.get("Montage", ""))
        if not anim:
            continue
        length = unreal.AnimationLibrary.get_sequence_length(anim)
        if unreal.AnimationLibrary.does_notify_track_exist(anim, NOTIFY_TRACK):
            unreal.AnimationLibrary.remove_animation_notify_events_by_track(anim, NOTIFY_TRACK)
        else:
            unreal.AnimationLibrary.add_animation_notify_track(anim, NOTIFY_TRACK)

        w, a, r = s.get("Windup", 0.0), s.get("Active", 0.0), s.get("Recovery", 0.0)
        total = w + a + r
        if s.get("Damage", 0.0) > 0.0:
            add_state(anim, classes["AttackWindow"], w, w + a, length)
        for (t0, t1, mul) in ((0.0, w, s.get("MoveMulWindup", 1.0)), (w, w + a, s.get("MoveMulActive", 1.0)), (w + a, total, s.get("MoveMulRecovery", 1.0))):
            if abs(mul - 1.0) > 1e-4:
                add_state(anim, classes["MovementOverride"], t0, t1, length, {"speed_multiplier": float(mul)})
        if s.get("EvadeCancelAt", -1.0) >= 0.0:
            add_state(anim, classes["CancelWindow"], s["EvadeCancelAt"], total, length, {"kind": enum_value(unreal.EnderCancelKind, "Evade")})
        if s.get("SkillCancelAt", -1.0) >= 0.0:
            add_state(anim, classes["CancelWindow"], s["SkillCancelAt"], total, length, {"kind": enum_value(unreal.EnderCancelKind, "Skill")})
        if s.get("InvulnEnd", 0.0) > s.get("InvulnStart", 0.0):
            add_state(anim, classes["Invulnerability"], s["InvulnStart"], s["InvulnEnd"], length)
        if s.get("CueTag"):
            add_state(anim, classes["GameplayCueWindow"], w, w + a, length, {"cue_tag": unreal.EnderContentLibrary.make_gameplay_tag(s["CueTag"])})
        save(anim)
        done += 1
    log("montages: notify states written on %d montage(s)" % done)


def build_blueprints(definitions, force_binder):
    specs = load_json("abilities.json")["abilities"]
    ability_classes = []
    for key, s in specs.items():
        parent = native_class("/Script/Ender." + s["AbilityClass"])
        if not parent:
            warn("missing ability class " + s["AbilityClass"])
            continue
        bp = blueprint("%s/%s" % (ABILITY_FOLDER, s["Blueprint"]), parent)
        unreal.BlueprintEditorLibrary.compile_blueprint(bp)
        da = definitions.get(key) or load("%s/Data/DA_Ability_%s" % (ABILITY_FOLDER, key))
        cdo = cdo_of(bp)
        cdo.set_editor_property("definition", da)
        save(bp)
        ability_classes.append(bp.generated_class())

    binder_path = "/Game/Characters/BP_Binder"
    binder = blueprint(binder_path, native_class("/Script/Ender.EnderPlayerCharacter"))
    unreal.BlueprintEditorLibrary.compile_blueprint(binder)
    cdo = cdo_of(binder)
    current = list(cdo.get_editor_property("startup_abilities") or [])
    if force_binder or not current:
        cdo.set_editor_property("startup_abilities", ability_classes)
        log("BP_Binder StartupAbilities = %d abilities" % len(ability_classes))
    save(binder)


# ------------------------------------------------------------------ enemies / encounters / loot

def build_enemies():
    cfg = load_json("enemies.json")
    out = {}
    for key, s in cfg["enemies"].items():
        da = data_asset("%s/%s" % (cfg["folder"], s["Asset"]), unreal.EnderEnemyDefinition)
        archetype = enum_value(unreal.EnderArchetype, s["Archetype"])
        unreal.EnderEnemyDefinition.apply_rule_defaults(da, archetype)
        cls = blueprint_class(s.get("EnemyClass")) or native_class(s["NativeClass"])
        if cls:
            set_prop(da, "EnemyClass", cls)
        tree = load(s.get("StateTree", ""))
        if tree:
            set_prop(da, "StateTree", tree)
        save(da)
        out[s["Archetype"]] = da
    log("enemies: %d definitions" % len(out))
    return out


def build_encounters(enemies, override_rosters):
    cfg = load_json("encounters.json")
    if not enemies:
        enemy_cfg = load_json("enemies.json")
        enemies = {s["Archetype"]: load("%s/%s" % (enemy_cfg["folder"], s["Asset"])) for s in enemy_cfg["enemies"].values()}
    roster = {enum_value(unreal.EnderArchetype, k): v for k, v in enemies.items() if v and k != "BoundKing"}
    for name, s in cfg["encounters"].items():
        da = data_asset("%s/%s" % (cfg["folder"], name), unreal.EnderEncounterDefinition)
        set_prop(da, "RoomKind", enum_value(unreal.EnderRoomKind, s["RoomKind"]))
        set_prop(da, "bFirstRealmRoster", bool(s["bFirstRealmRoster"]))
        set_prop(da, "SeedOffset", int(s["SeedOffset"]))
        set_prop(da, "EnemyDefinitions", roster)
        set_prop(da, "bOverrideAllowedArchetypes", bool(override_rosters))
        if override_rosters:
            set_prop(da, "AllowedArchetypes", [enum_value(unreal.EnderArchetype, a) for a in s["AllowedArchetypes"]])
        save(da)
    log("encounters: %d definitions" % len(cfg["encounters"]))


def build_loot():
    cfg = load_json("loot.json")
    da = data_asset(cfg["asset"], unreal.EnderLootProfile)
    cls = blueprint_class(cfg.get("LootDropClass")) or native_class(cfg["NativeLootDropClass"])
    if cls:
        set_prop(da, "LootDropClass", cls)
    for field in ("EssenceBundleMin", "EssenceBundleMax", "RoomClearCrowns", "BossCrowns"):
        set_prop(da, field, int(cfg[field]))
    set_prop(da, "ScatterRadius", float(cfg["ScatterRadius"]))
    set_prop(da, "OrdinaryNames", [unreal.Text(n) for n in cfg["OrdinaryNames"]])
    save(da)
    log("loot profile written")


# ------------------------------------------------------------------ main

def parse_args(argv):
    only = set(SECTIONS)
    override_rosters = False
    force_binder = False
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == "--only" and i + 1 < len(argv):
            only = set(x.strip() for x in argv[i + 1].split(",") if x.strip())
            i += 1
        elif a.startswith("--only="):
            only = set(x.strip() for x in a.split("=", 1)[1].split(",") if x.strip())
        elif a == "--override-rosters":
            override_rosters = True
        elif a == "--force-binder":
            force_binder = True
        i += 1
    unknown = only - set(SECTIONS)
    if unknown:
        raise SystemExit("unknown section(s): " + ", ".join(sorted(unknown)))
    return only, override_rosters, force_binder


def main(argv):
    only, override_rosters, force_binder = parse_args(argv)
    definitions, enemies = {}, {}
    with unreal.ScopedSlowTask(len(SECTIONS), "Creating Ender assets") as task:
        task.make_dialog(True)
        for section in SECTIONS:
            task.enter_progress_frame(1, section)
            if section not in only:
                continue
            if section == "input":
                build_input()
            elif section == "abilities":
                definitions = build_abilities()
            elif section == "montages":
                build_montage_notifies()
            elif section == "blueprints":
                build_blueprints(definitions, force_binder)
            elif section == "enemies":
                enemies = build_enemies()
            elif section == "encounters":
                build_encounters(enemies, override_rosters)
            elif section == "loot":
                build_loot()
    log("done")


if __name__ == "__main__":
    main(sys.argv[1:])
