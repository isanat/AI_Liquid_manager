#!/bin/bash
python -m uvicorn ai_engine.api.main:app --host 0.0.0.0 --port ${PORT:-8000}
