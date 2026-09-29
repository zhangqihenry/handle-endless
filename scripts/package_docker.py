"""Package the built site and dependency-free Node server for Synology Compose deployment."""
import hashlib
import json
import shutil
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parent.parent
version = json.loads((root / "package.json").read_text())["version"]
name = f"Handle_Endless-{version}-docker"
output = root / "releases"
stage = output / name
if not (root / "dist/index.html").exists():
    raise SystemExit("请先运行 pnpm build")
if stage.exists():
    shutil.rmtree(stage)
stage.mkdir(parents=True)
shutil.copytree(root / "dist", stage / "www")
(stage / "data").mkdir()
shutil.copy2(root / "public/extra-idioms.json", stage / "data/extra-idioms.json")
(stage / "server").mkdir()
for file in ("index.mjs", "config.json", "catalog.json"):
    shutil.copy2(root / "server" / file, stage / "server" / file)
for file in ("compose.yaml",):
    shutil.copy2(root / "deploy" / file, stage / file)
shutil.copy2(root / "docs/SYNOLOGY.md", stage / "README.md")
shutil.copy2(root / "docs/EXTRA_IDIOMS.md", stage / "EXTRA_IDIOMS.md")
shutil.copy2(root / "LICENSE", stage / "LICENSE")
shutil.copy2(root / "UPSTREAM.md", stage / "UPSTREAM.md")
(stage / ".env.example").write_text("HANDLE_PORT=13863\nCOOKIE_SECURE=false\n", encoding="utf-8")
archive = output / f"{name}.zip"
with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as z:
    for file in sorted(stage.rglob("*")):
        if file.is_file():
            z.write(file, file.relative_to(output))
checksum = hashlib.sha256(archive.read_bytes()).hexdigest()
archive.with_suffix(".zip.sha256").write_text(f"{checksum}  {archive.name}\n")
print(f"{archive}\nSHA256 {checksum}")
