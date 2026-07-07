"""
Microservicio de generación de videos — CodePath AI
Puerto: 8001
El backend Node.js llama a este servicio cuando el docente solicita un video.
"""

import os
import json
from pathlib import Path
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import uvicorn
from generator import generar_video
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env")

BASE_URL = os.environ.get("VIDEO_SERVICE_BASE_URL", "http://localhost:8001")

app = FastAPI(title="CodePath Video Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Servir los videos como archivos estáticos
OUTPUT_DIR = Path(__file__).parent / "output"
OUTPUT_DIR.mkdir(exist_ok=True)
app.mount("/videos", StaticFiles(directory=str(OUTPUT_DIR)), name="videos")


class VideoRequest(BaseModel):
    tema: str
    subtema: str
    nivel: str = "medio"          # "fácil" | "medio" | "avanzado"
    api_key: Optional[str] = None # Si no se pasa, usa OPENAI_API_KEY del entorno


class VideoResponse(BaseModel):
    success: bool
    video_url: str
    titulo: str
    duracion_estimada: str
    slides: int
    filename: str
    slides_data: list = []
    message: str = ""


@app.get("/health")
def health():
    return {"status": "ok", "service": "video-generator"}


@app.post("/api/generate", response_model=VideoResponse)
def generate(req: VideoRequest):
    """
    Genera un video educativo y lo guarda en /output.
    Devuelve la URL del video para accederlo como estático.
    """
    api_key = req.api_key or os.environ.get("OPENAI_API_KEY")
    if not api_key or api_key == "sk-...":
        raise HTTPException(status_code=400, detail="Se requiere una API key de OpenAI válida")

    try:
        video_path = generar_video(
            tema=req.tema,
            subtema=req.subtema,
            nivel=req.nivel,
            output_dir=str(OUTPUT_DIR),
            api_key=api_key,
        )

        filename = Path(video_path).name
        json_path = video_path.replace(".mp4", ".json")

        titulo = req.tema
        duracion = "2-4 minutos"
        slides_count = 5
        slides_data: list = []

        if Path(json_path).exists():
            with open(json_path, encoding="utf-8") as f:
                guion = json.load(f)
            titulo          = guion.get("titulo", req.tema)
            duracion        = guion.get("duracion_estimada", "2-4 minutos")
            slides_data     = guion.get("slides", [])
            slides_count    = len(slides_data)

        video_url = f"{BASE_URL}/videos/{filename}"

        return VideoResponse(
            success=True,
            video_url=video_url,
            titulo=titulo,
            duracion_estimada=duracion,
            slides=slides_count,
            filename=filename,
            slides_data=slides_data,
            message="Video generado exitosamente",
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/videos")
def list_videos():
    """Lista todos los videos generados."""
    videos = []
    for mp4 in OUTPUT_DIR.glob("*.mp4"):
        json_path = mp4.with_suffix(".json")
        info = {"filename": mp4.name, "url": f"{BASE_URL}/videos/{mp4.name}"}
        if json_path.exists():
            with open(json_path, encoding="utf-8") as f:
                guion = json.load(f)
            info["titulo"]   = guion.get("titulo", mp4.stem)
            info["duracion"] = guion.get("duracion_estimada", "?")
            info["slides"]   = len(guion.get("slides", []))
        videos.append(info)
    return {"success": True, "data": videos}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
