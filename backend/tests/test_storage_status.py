import importlib
from collections import namedtuple

module = importlib.import_module("app.db.sqlite_db")


def test_storage_measures_database_and_wal(tmp_path, monkeypatch):
    path = tmp_path / "test.db"
    path.write_bytes(b"x" * 100)
    (tmp_path / "test.db-wal").write_bytes(b"x" * 25)
    monkeypatch.setattr(module, "DB_PATH", path)
    disk = namedtuple("Disk", "total used free")(1000, 600, 400)
    monkeypatch.setattr(module.shutil, "disk_usage", lambda _: disk)
    db = module._SQLiteDB()
    db._ready = True
    status = db.storage_status()
    assert status["available"] is True
    assert status["databaseBytes"] == 100
    assert status["walBytes"] == 25
    assert status["storageBytes"] == 125
    assert status["diskFreeBytes"] == 400
    assert status["diskTotalBytes"] == 1000


def test_missing_database_does_not_report_zero_size(tmp_path, monkeypatch):
    monkeypatch.setattr(module, "DB_PATH", tmp_path / "missing.db")
    status = module._SQLiteDB().storage_status()
    assert status["available"] is False
    assert status["measurementError"]
    assert "storageBytes" not in status
