import json

from backend.common import engine
from backend.ingest.seed import DEMO_CAMERAS, load_routines, seed_home
from tests.backend.factories import HOME


def test_seed_adds_indoor_cameras_and_maps_all_zones(home, store, gateway, settings, control):
    assert sorted(set(home["devices"].values())) == [
        "bedroom",
        "front_door",
        "kitchen",
        "living_room",
    ]
    names = {d.name for d in gateway.list_devices()}
    assert set(DEMO_CAMERAS) <= names
    assert home["parent_name"] == "Kamala" and home["city"] == "Chennai"


def test_seed_is_idempotent_and_keeps_digest_time(home, store, gateway, settings, control):
    store.put_home({**home, "digest_time": "20:30"})
    before = len(gateway.list_devices())
    again = seed_home(store, gateway, settings, http=control)
    assert len(gateway.list_devices()) == before
    assert again["devices"] == home["devices"]
    assert again["digest_time"] == "20:30"


def test_load_routines_accepts_zone_map_and_skips_unknown_zones(store, tmp_path):
    kitchen = engine.routine_to_dict(engine.new_routine(HOME, "kitchen"))
    garage = engine.routine_to_dict(engine.new_routine(HOME, "garage"))
    path = tmp_path / "routines.json"
    path.write_text(json.dumps({"kitchen": kitchen, "garage": garage}))
    assert load_routines(store, path) == 1
    assert store.get_routine(HOME, "kitchen") == kitchen
    assert load_routines(store, tmp_path / "missing.json") == 0
