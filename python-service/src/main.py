"""
DataDash Python Microservice
FastAPI service for data processing, cleaning, and analysis
"""

import os
import json
import uuid
import logging
from pathlib import Path
from typing import Optional

import pandas as pd
import numpy as np
from fastapi import FastAPI, File, UploadFile, HTTPException, Form, Query
from fastapi.middleware.cors import CORSMiddleware
import aiofiles

from cleaner import DataCleaner, detect_column_types
from analyzer import suggest_visualizations, compute_chart_data, compute_kpi

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="DataDash Processing Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "/app/uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# In-memory dataset cache (use Redis in production for multi-instance)
_df_cache: dict[str, pd.DataFrame] = {}


def load_dataframe(file_path: str) -> pd.DataFrame:
    """Load a DataFrame from file, with caching."""
    if file_path in _df_cache:
        return _df_cache[file_path].copy()

    path = Path(file_path)
    ext = path.suffix.lower()

    try:
        if ext == '.csv':
            # Try to detect encoding
            try:
                df = pd.read_csv(path, encoding='utf-8')
            except UnicodeDecodeError:
                df = pd.read_csv(path, encoding='latin-1')
        elif ext in ('.xlsx', '.xls'):
            df = pd.read_excel(path)
        else:
            raise ValueError(f"Unsupported file type: {ext}")

        _df_cache[file_path] = df
        return df.copy()
    except Exception as e:
        logger.error(f"Failed to load file {file_path}: {e}")
        raise


@app.get("/health")
async def health():
    return {"status": "ok", "service": "python-processing"}


@app.post("/api/process")
async def process_file(
    file: UploadFile = File(...),
    file_type: str = Form(...),
    dataset_id: str = Form(...),
):
    """
    Process uploaded file: clean data, detect types, save cleaned version.
    """
    try:
        # Save uploaded file temporarily
        temp_path = UPLOAD_DIR / f"temp_{uuid.uuid4()}.{file_type}"
        async with aiofiles.open(temp_path, 'wb') as f:
            content = await file.read()
            await f.write(content)

        logger.info(f"Processing file for dataset {dataset_id}")

        # Load the dataframe
        df = load_dataframe(str(temp_path))

        # Clean the data
        cleaner = DataCleaner(df)
        cleaned_df, cleaning_report = cleaner.clean()

        # Save cleaned file
        cleaned_path = UPLOAD_DIR / f"cleaned_{dataset_id}.csv"
        cleaned_df.to_csv(cleaned_path, index=False)

        # Cache cleaned dataframe
        _df_cache[str(cleaned_path)] = cleaned_df

        # Detect column types
        columns_metadata = detect_column_types(cleaned_df)

        # Cleanup temp file
        temp_path.unlink(missing_ok=True)

        logger.info(f"Dataset {dataset_id} processed: {len(cleaned_df)} rows, {len(cleaned_df.columns)} cols")

        return {
            "dataset_id": dataset_id,
            "row_count": len(cleaned_df),
            "column_count": len(cleaned_df.columns),
            "cleaned_file_path": str(cleaned_path),
            "columns_metadata": columns_metadata,
            "cleaning_report": cleaning_report,
        }

    except Exception as e:
        logger.error(f"Processing failed for dataset {dataset_id}: {e}")
        # Cleanup
        if 'temp_path' in locals():
            temp_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/preview/{dataset_id}")
async def get_preview(
    dataset_id: str,
    file_path: str = Query(...),
    rows: int = Query(default=100, le=1000),
):
    """Return the first N rows of a dataset as JSON."""
    try:
        df = load_dataframe(file_path)
        preview_df = df.head(rows)

        # Convert to JSON-safe format
        result = []
        for _, row in preview_df.iterrows():
            record = {}
            for col in preview_df.columns:
                val = row[col]
                if pd.isna(val) if not isinstance(val, (list, dict)) else False:
                    record[col] = None
                elif hasattr(val, 'isoformat'):
                    record[col] = val.isoformat()
                elif isinstance(val, (np.integer,)):
                    record[col] = int(val)
                elif isinstance(val, (np.floating,)):
                    record[col] = float(val)
                else:
                    record[col] = str(val) if not isinstance(val, (str, int, float, bool)) else val
            result.append(record)

        return {
            "rows": result,
            "total_rows": len(df),
            "columns": list(df.columns),
            "preview_rows": len(result),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/suggestions/{dataset_id}")
async def get_suggestions(
    dataset_id: str,
    file_path: str = Query(...),
):
    """Get smart visualization suggestions for a dataset."""
    try:
        df = load_dataframe(file_path)
        columns_metadata = detect_column_types(df)
        suggestions = suggest_visualizations(df, columns_metadata)

        return {
            "dataset_id": dataset_id,
            "columns": columns_metadata,
            "suggestions": suggestions,
            "summary": {
                "total_rows": len(df),
                "total_columns": len(df.columns),
                "numeric_columns": len([c for c in columns_metadata if c['type'] == 'numeric']),
                "date_columns": len([c for c in columns_metadata if c['type'] == 'date']),
                "categorical_columns": len([c for c in columns_metadata if c['type'] == 'categorical']),
                "text_columns": len([c for c in columns_metadata if c['type'] == 'text']),
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/chart-data/{dataset_id}")
async def get_chart_data(
    dataset_id: str,
    file_path: str = Query(...),
    x_column: str = Query(...),
    y_column: Optional[str] = Query(default=None),
    aggregation: str = Query(default="sum"),
    chart_type: str = Query(default="bar"),
    filters: Optional[str] = Query(default=None),
):
    """Compute and return chart-ready data."""
    try:
        df = load_dataframe(file_path)

        parsed_filters = None
        if filters:
            try:
                parsed_filters = json.loads(filters)
            except json.JSONDecodeError:
                pass

        data = compute_chart_data(
            df=df,
            x_column=x_column,
            y_column=y_column,
            aggregation=aggregation,
            chart_type=chart_type,
            filters=parsed_filters,
        )

        return data
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Chart data error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/kpi/{dataset_id}")
async def get_kpi(
    dataset_id: str,
    file_path: str = Query(...),
    column: str = Query(...),
    aggregation: str = Query(default="sum"),
    filters: Optional[str] = Query(default=None),
):
    """Compute a KPI value."""
    try:
        df = load_dataframe(file_path)

        if filters:
            try:
                parsed_filters = json.loads(filters)
                # Apply filters (simplified)
                for col, val in parsed_filters.items():
                    if col in df.columns and isinstance(val, list):
                        df = df[df[col].isin(val)]
            except Exception:
                pass

        result = compute_kpi(df, column, aggregation)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
