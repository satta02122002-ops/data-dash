"""
DataDash Data Analysis & Visualization Suggestion Engine
"""

import pandas as pd
import numpy as np
from typing import Any
import logging

logger = logging.getLogger(__name__)


def suggest_visualizations(df: pd.DataFrame, columns_metadata: list[dict]) -> dict:
    """
    Analyze dataset and return smart visualization suggestions.
    Returns KPI suggestions, chart suggestions, and recommended filter columns.
    """
    date_cols = [c for c in columns_metadata if c['type'] == 'date']
    numeric_cols = [c for c in columns_metadata if c['type'] == 'numeric']
    categorical_cols = [c for c in columns_metadata if c['type'] == 'categorical']

    suggestions = {
        'kpis': [],
        'charts': [],
        'filters': [],
        'auto_layout': [],
    }

    # KPI suggestions (for each numeric column)
    for num_col in numeric_cols[:6]:
        col_name = num_col['name']
        total = df[col_name].sum() if not df[col_name].isna().all() else 0
        avg = df[col_name].mean() if not df[col_name].isna().all() else 0

        suggestions['kpis'].append({
            'id': f'kpi_{col_name}',
            'title': _humanize(col_name),
            'column': col_name,
            'metric': 'sum',
            'value': float(round(total, 2)),
            'type': 'kpi',
            'format': _detect_format(col_name, df[col_name]),
            'config': {'column': col_name, 'aggregation': 'sum'},
        })

        if num_col['unique_count'] > 1 and num_col['non_null_count'] > 5:
            suggestions['kpis'].append({
                'id': f'kpi_avg_{col_name}',
                'title': f'Avg {_humanize(col_name)}',
                'column': col_name,
                'metric': 'mean',
                'value': float(round(avg, 2)),
                'type': 'kpi',
                'format': _detect_format(col_name, df[col_name]),
                'config': {'column': col_name, 'aggregation': 'mean'},
            })

    # Line/Area charts: date x numeric combinations
    for date_col in date_cols[:2]:
        for num_col in numeric_cols[:3]:
            suggestions['charts'].append({
                'id': f'line_{date_col["name"]}_{num_col["name"]}',
                'title': f'{_humanize(num_col["name"])} over time',
                'type': 'line',
                'recommended': True,
                'config': {
                    'x_column': date_col['name'],
                    'y_column': num_col['name'],
                    'aggregation': 'sum',
                    'chart_type': 'line',
                },
            })

    # Bar charts: categorical x numeric
    for cat_col in categorical_cols[:3]:
        for num_col in numeric_cols[:2]:
            if cat_col.get('unique_count', 0) <= 30:
                suggestions['charts'].append({
                    'id': f'bar_{cat_col["name"]}_{num_col["name"]}',
                    'title': f'{_humanize(num_col["name"])} by {_humanize(cat_col["name"])}',
                    'type': 'bar',
                    'recommended': cat_col.get('unique_count', 0) <= 15,
                    'config': {
                        'x_column': cat_col['name'],
                        'y_column': num_col['name'],
                        'aggregation': 'sum',
                        'chart_type': 'bar',
                    },
                })

    # Pie charts: categorical columns with low cardinality
    for cat_col in categorical_cols:
        if 2 <= cat_col.get('unique_count', 0) <= 10 and numeric_cols:
            num_col = numeric_cols[0]
            suggestions['charts'].append({
                'id': f'pie_{cat_col["name"]}',
                'title': f'{_humanize(cat_col["name"])} distribution',
                'type': 'pie',
                'recommended': cat_col.get('unique_count', 0) <= 6,
                'config': {
                    'x_column': cat_col['name'],
                    'y_column': num_col['name'],
                    'aggregation': 'sum',
                    'chart_type': 'pie',
                },
            })

    # Table suggestion (always)
    suggestions['charts'].append({
        'id': 'table_main',
        'title': 'Data Table',
        'type': 'table',
        'recommended': True,
        'config': {
            'columns': [c['name'] for c in columns_metadata[:8]],
            'chart_type': 'table',
            'page_size': 10,
        },
    })

    # Filter suggestions
    for date_col in date_cols:
        suggestions['filters'].append({
            'column': date_col['name'],
            'type': 'date_range',
            'label': _humanize(date_col['name']),
        })

    for cat_col in categorical_cols:
        if cat_col.get('unique_count', 0) <= 30:
            suggestions['filters'].append({
                'column': cat_col['name'],
                'type': 'multi_select',
                'label': _humanize(cat_col['name']),
                'options': list(cat_col.get('top_values', {}).keys()),
            })

    # Build auto layout
    layout_y = 0
    # KPIs row
    for i, kpi in enumerate(suggestions['kpis'][:4]):
        suggestions['auto_layout'].append({
            'widget_id': kpi['id'],
            'x': i * 3, 'y': 0, 'w': 3, 'h': 2,
        })
    if suggestions['kpis']:
        layout_y = 2

    # Charts
    chart_positions = [(0, layout_y, 6, 4), (6, layout_y, 6, 4),
                       (0, layout_y + 4, 6, 4), (6, layout_y + 4, 6, 4)]
    for i, chart in enumerate(suggestions['charts'][:4]):
        if i < len(chart_positions):
            x, y, w, h = chart_positions[i]
            suggestions['auto_layout'].append({
                'widget_id': chart['id'],
                'x': x, 'y': y, 'w': w, 'h': h,
            })

    return suggestions


def compute_chart_data(
    df: pd.DataFrame,
    x_column: str,
    y_column: str | None,
    aggregation: str = 'sum',
    chart_type: str = 'bar',
    filters: dict | None = None,
) -> dict:
    """Compute aggregated chart data from DataFrame."""

    # Apply filters
    if filters:
        for col, filter_val in filters.items():
            if col not in df.columns:
                continue
            if isinstance(filter_val, dict):
                if 'min' in filter_val and filter_val['min'] is not None:
                    df = df[df[col] >= filter_val['min']]
                if 'max' in filter_val and filter_val['max'] is not None:
                    df = df[df[col] <= filter_val['max']]
                if 'values' in filter_val and filter_val['values']:
                    df = df[df[col].isin(filter_val['values'])]
            elif isinstance(filter_val, list):
                df = df[df[col].isin(filter_val)]

    if chart_type == 'table':
        columns = [x_column] + ([y_column] if y_column else [])
        result_df = df[columns].head(1000) if all(c in df.columns for c in columns) else df.head(1000)
        return {
            'type': 'table',
            'columns': list(result_df.columns),
            'rows': result_df.fillna('').values.tolist(),
            'total': len(df),
        }

    if x_column not in df.columns:
        raise ValueError(f"Column '{x_column}' not found")

    # Group by x_column
    if y_column and y_column in df.columns:
        try:
            grouped = df.groupby(x_column)[y_column]
            agg_map = {
                'sum': grouped.sum,
                'mean': grouped.mean,
                'count': grouped.count,
                'min': grouped.min,
                'max': grouped.max,
            }
            agg_func = agg_map.get(aggregation, grouped.sum)
            result = agg_func()
        except Exception:
            result = df.groupby(x_column)[y_column].sum()
    else:
        result = df[x_column].value_counts()

    # Handle datetime index
    result = result.dropna()
    if hasattr(result.index, 'dtype') and pd.api.types.is_datetime64_any_dtype(result.index):
        result.index = result.index.strftime('%Y-%m-%d')

    # Sort
    if chart_type in ('line', 'area'):
        result = result.sort_index()
    else:
        result = result.sort_values(ascending=False).head(50)

    labels = [str(l) for l in result.index.tolist()]
    values = [round(float(v), 4) if not np.isnan(float(v)) else 0 for v in result.values.tolist()]

    return {
        'type': chart_type,
        'labels': labels,
        'datasets': [{
            'label': y_column or x_column,
            'data': values,
        }],
        'total_records': len(df),
    }


def compute_kpi(df: pd.DataFrame, column: str, aggregation: str = 'sum') -> dict:
    """Compute a single KPI value."""
    if column not in df.columns:
        raise ValueError(f"Column '{column}' not found")

    series = pd.to_numeric(df[column], errors='coerce').dropna()

    agg_map = {
        'sum': float(series.sum()),
        'mean': float(series.mean()),
        'count': int(series.count()),
        'min': float(series.min()),
        'max': float(series.max()),
    }

    value = agg_map.get(aggregation, float(series.sum()))

    return {
        'value': round(value, 2),
        'aggregation': aggregation,
        'column': column,
        'count': int(len(series)),
    }


def _humanize(col_name: str) -> str:
    """Convert snake_case or camelCase column names to human-readable labels."""
    # Handle snake_case
    result = col_name.replace('_', ' ').replace('-', ' ')
    # Handle camelCase
    result = re.sub(r'([a-z])([A-Z])', r'\1 \2', result)
    return result.strip().title()


def _detect_format(col_name: str, series: pd.Series) -> str:
    """Detect if a numeric column represents currency, percentage, etc."""
    col_lower = col_name.lower()
    if any(kw in col_lower for kw in ['price', 'revenue', 'cost', 'amount', 'sales', 'profit', 'income']):
        return 'currency'
    if any(kw in col_lower for kw in ['rate', 'percent', 'pct', 'ratio', '%']):
        return 'percentage'
    max_val = series.max() if not series.isna().all() else 0
    if max_val > 1000:
        return 'number'
    return 'decimal'


import re
