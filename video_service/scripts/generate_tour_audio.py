#!/usr/bin/env python3
"""
Genera los audios narrados del tour guiado (estudiante y docente).
GEMA — Universidad de San Buenaventura Cali 2026

Se corre a mano, una sola vez (o cada vez que cambie el texto de los pasos
en fronted/lib/tour/*.data.json). Reusa el mismo motor Edge TTS que ya
genera la narración de los videos de lección (generator.py), para heredar
el preámbulo de compatibilidad Windows/UTF-8 y el reintento automático si
un audio sale sospechosamente corto.

Uso:
    python scripts/generate_tour_audio.py
"""

import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from generator import _generar_audio_slide_validado  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent.parent
STEPS_DIR = ROOT / "fronted" / "lib" / "tour"
OUTPUT_DIR = ROOT / "fronted" / "public" / "audio" / "tour"

STEP_FILES = ["student-steps.data.json", "admin-steps.data.json"]


async def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    pasos = []
    for filename in STEP_FILES:
        data = json.loads((STEPS_DIR / filename).read_text(encoding="utf-8"))
        pasos.extend(data)

    print(f"🎙️  Generando {len(pasos)} audios del tour con Edge TTS...")
    tareas = []
    for paso in pasos:
        output_path = OUTPUT_DIR / f"{paso['id']}.mp3"
        tareas.append(_generar_audio_slide_validado(paso["body"], str(output_path)))
    await asyncio.gather(*tareas)

    print(f"✓ {len(pasos)} archivos de audio generados en {OUTPUT_DIR}")


if __name__ == "__main__":
    asyncio.run(main())
