import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parents[1]))

from analysis import normalize, split_ingredients, load_rules, compatibility

def test_normalize():
    assert normalize("Aqua") == "water"
    assert normalize(" Fragrance ") == "parfum"

def test_split():
    assert split_ingredients("Aqua, Glycerin; Parfum") == ["Aqua","Glycerin","Parfum"]

def test_rules_load():
    assert "glycerin" in load_rules()["all"]

def test_compatibility_unknown_data():
    a={"name":"A","ingredients":[]}
    b={"name":"B","ingredients":["Glycerin"]}
    r=compatibility(a,b)
    assert r["status"]=="unknown"
