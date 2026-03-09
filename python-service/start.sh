#!/bin/bash
mkdir -p /tmp/uploads
export UPLOAD_DIR=/tmp/uploads
cd /app
uvicorn src.main:app --host 0.0.0.0 --port ${PORT:-8000}
