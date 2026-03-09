"""
DataDash Data Cleaning Module
Handles all data cleaning operations for uploaded Excel/CSV files
"""

import pandas as pd
import numpy as np
import re
from datetime import datetime
from dateutil import parser as date_parser
import logging

logger = logging.getLogger(__name__)


class DataCleaner:
    def __init__(self, df: pd.DataFrame):
        self.df = df.copy()
        self.report = {
            'original_rows': len(df),
            'original_cols': len(df.columns),
            'actions': [],
        }

    def clean(self) -> tuple[pd.DataFrame, dict]:
        """Run all cleaning operations and return cleaned DataFrame + report."""
        self._clean_column_names()
        self._remove_empty_rows_cols()
        self._trim_whitespace()
        self._normalize_spacing()
        self._remove_duplicates()
        self._convert_sentence_case()
        self._detect_and_convert_types()
        self._standardize_dates()

        self.report['final_rows'] = len(self.df)
        self.report['final_cols'] = len(self.df.columns)
        self.report['rows_removed'] = self.report['original_rows'] - self.report['final_rows']

        return self.df, self.report

    def _clean_column_names(self):
        """Clean column headers: strip, normalize spaces, remove special chars."""
        original = list(self.df.columns)
        self.df.columns = (
            pd.Series(self.df.columns.astype(str))
            .str.strip()
            .str.replace(r'\s+', ' ', regex=True)
            .str.replace(r'[^\w\s]', '', regex=True)
            .str.strip()
        )
        cleaned = list(self.df.columns)
        changed = [(o, c) for o, c in zip(original, cleaned) if o != c]
        if changed:
            self.report['actions'].append({
                'type': 'column_rename',
                'details': f'Cleaned {len(changed)} column names',
                'changes': changed[:10],
            })

    def _remove_empty_rows_cols(self):
        """Remove rows and columns that are entirely empty."""
        initial_rows = len(self.df)
        initial_cols = len(self.df.columns)

        # Remove columns where all values are NaN
        self.df.dropna(axis=1, how='all', inplace=True)

        # Remove rows where all values are NaN
        self.df.dropna(axis=0, how='all', inplace=True)

        cols_removed = initial_cols - len(self.df.columns)
        rows_removed = initial_rows - len(self.df)

        if cols_removed > 0 or rows_removed > 0:
            self.report['actions'].append({
                'type': 'remove_empty',
                'details': f'Removed {rows_removed} empty rows, {cols_removed} empty columns',
            })

    def _trim_whitespace(self):
        """Trim leading/trailing whitespace from all string columns."""
        str_cols = self.df.select_dtypes(include='object').columns
        for col in str_cols:
            self.df[col] = self.df[col].apply(
                lambda x: x.strip() if isinstance(x, str) else x
            )
        if len(str_cols) > 0:
            self.report['actions'].append({
                'type': 'trim_whitespace',
                'details': f'Trimmed whitespace in {len(str_cols)} text columns',
            })

    def _normalize_spacing(self):
        """Normalize multiple spaces to single space in string columns."""
        str_cols = self.df.select_dtypes(include='object').columns
        for col in str_cols:
            self.df[col] = self.df[col].apply(
                lambda x: re.sub(r'\s+', ' ', x) if isinstance(x, str) else x
            )

    def _remove_duplicates(self):
        """Remove exact duplicate rows."""
        initial = len(self.df)
        self.df.drop_duplicates(inplace=True)
        removed = initial - len(self.df)
        if removed > 0:
            self.report['actions'].append({
                'type': 'remove_duplicates',
                'details': f'Removed {removed} duplicate rows',
            })

    def _convert_sentence_case(self):
        """Convert text columns to proper sentence case (excluding likely codes/IDs)."""
        str_cols = self.df.select_dtypes(include='object').columns
        for col in str_cols:
            # Skip if column name suggests it's an ID or code
            col_lower = col.lower()
            if any(kw in col_lower for kw in ['id', 'code', 'key', 'ref', 'uuid', 'url', 'email']):
                continue

            # Only convert if the column has reasonable text values
            sample = self.df[col].dropna().head(10)
            if sample.empty:
                continue

            # Skip if values look like codes (all caps, short, alphanumeric)
            if all(
                isinstance(v, str) and (len(v) <= 5 or v.isupper() or v.isdigit())
                for v in sample
            ):
                continue

            self.df[col] = self.df[col].apply(
                lambda x: x.strip().capitalize() if isinstance(x, str) and len(x) > 0 else x
            )

    def _detect_and_convert_types(self):
        """Auto-detect and convert column types."""
        for col in self.df.columns:
            if self.df[col].dtype == object:
                # Try numeric conversion
                numeric_series = pd.to_numeric(self.df[col], errors='coerce')
                non_null_original = self.df[col].notna().sum()
                non_null_numeric = numeric_series.notna().sum()

                if non_null_original > 0 and non_null_numeric / non_null_original > 0.85:
                    self.df[col] = numeric_series
                    continue

                # Try date conversion
                if self._looks_like_date_column(col, self.df[col]):
                    try:
                        date_series = pd.to_datetime(self.df[col], errors='coerce', infer_datetime_format=True)
                        if date_series.notna().sum() / max(non_null_original, 1) > 0.7:
                            self.df[col] = date_series
                            continue
                    except Exception:
                        pass

    def _looks_like_date_column(self, col_name: str, series: pd.Series) -> bool:
        """Heuristic: does this column look like it contains dates?"""
        col_lower = col_name.lower()
        date_keywords = ['date', 'time', 'day', 'month', 'year', 'period', 'created', 'updated', 'at', 'on']
        if any(kw in col_lower for kw in date_keywords):
            return True

        # Check sample values
        sample = series.dropna().head(5)
        for val in sample:
            if isinstance(val, str):
                try:
                    date_parser.parse(val, fuzzy=False)
                    return True
                except (ValueError, OverflowError):
                    pass
        return False

    def _standardize_dates(self):
        """Standardize all datetime columns to ISO format."""
        date_cols = self.df.select_dtypes(include=['datetime64', 'datetime64[ns]']).columns
        if len(date_cols) > 0:
            self.report['actions'].append({
                'type': 'standardize_dates',
                'details': f'Standardized {len(date_cols)} date columns to ISO format',
                'columns': list(date_cols),
            })


def detect_column_types(df: pd.DataFrame) -> list[dict]:
    """Analyze columns and return metadata including type, stats, and viz recommendations."""
    columns = []

    for col in df.columns:
        dtype = df[col].dtype
        non_null = df[col].notna().sum()
        null_count = df[col].isna().sum()
        unique_count = df[col].nunique()

        col_info = {
            'name': col,
            'original_name': col,
            'null_count': int(null_count),
            'non_null_count': int(non_null),
            'unique_count': int(unique_count),
        }

        if pd.api.types.is_datetime64_any_dtype(dtype):
            col_info['type'] = 'date'
            col_info['pandas_dtype'] = 'datetime'
            col_info['min'] = str(df[col].min()) if non_null > 0 else None
            col_info['max'] = str(df[col].max()) if non_null > 0 else None
            col_info['suggested_roles'] = ['x_axis', 'filter', 'time_series']
            col_info['suggested_charts'] = ['line', 'area', 'bar']

        elif pd.api.types.is_numeric_dtype(dtype):
            col_info['type'] = 'numeric'
            col_info['pandas_dtype'] = str(dtype)
            col_info['min'] = float(df[col].min()) if non_null > 0 else None
            col_info['max'] = float(df[col].max()) if non_null > 0 else None
            col_info['mean'] = float(df[col].mean()) if non_null > 0 else None
            col_info['sum'] = float(df[col].sum()) if non_null > 0 else None
            col_info['suggested_roles'] = ['metric', 'y_axis', 'kpi']
            col_info['suggested_charts'] = ['bar', 'line', 'kpi', 'area']

        else:
            # Text/Categorical
            cardinality_ratio = unique_count / max(non_null, 1)
            if cardinality_ratio < 0.3 and unique_count <= 50:
                col_info['type'] = 'categorical'
                col_info['suggested_roles'] = ['dimension', 'x_axis', 'filter', 'group_by']
                col_info['suggested_charts'] = ['bar', 'pie', 'heatmap']
                # Top values
                top_values = df[col].value_counts().head(10).to_dict()
                col_info['top_values'] = {str(k): int(v) for k, v in top_values.items()}
            else:
                col_info['type'] = 'text'
                col_info['suggested_roles'] = ['label', 'filter']
                col_info['suggested_charts'] = ['table']

            col_info['pandas_dtype'] = 'object'
            col_info['sample_values'] = [str(v) for v in df[col].dropna().unique()[:5].tolist()]

        columns.append(col_info)

    return columns
