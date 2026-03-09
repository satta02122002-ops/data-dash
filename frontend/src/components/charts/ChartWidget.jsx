import React, { useState, useRef } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ScatterChart, Scatter, ZAxis,
} from 'recharts';
import { Download, Settings2, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import html2canvas from 'html2canvas';
import { useQuery } from 'react-query';
import { datasetApi } from '../../services/api';
import KPICard from '../dashboard/KPICard';
import DataTable from './DataTable';

const COLORS = [
  '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4',
  '#ec4899', '#84cc16', '#f97316', '#6366f1',
];

const formatTick = (value) => {
  if (typeof value !== 'number') return value;
  if (Math.abs(value) >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toFixed(value % 1 === 0 ? 0 : 1);
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium text-gray-900 dark:text-white mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color }} className="text-xs">
          {entry.name}: {typeof entry.value === 'number' ? formatTick(entry.value) : entry.value}
        </p>
      ))}
    </div>
  );
};

function ChartRenderer({ type, data, config }) {
  if (!data || !data.labels) {
    return <div className="flex items-center justify-center h-full text-gray-400 text-sm">No data available</div>;
  }

  const chartData = data.labels.map((label, i) => ({
    name: String(label).length > 15 ? String(label).slice(0, 15) + '…' : String(label),
    fullName: label,
    value: data.datasets?.[0]?.data?.[i] ?? 0,
  }));

  const commonProps = {
    data: chartData,
    margin: { top: 5, right: 10, left: 0, bottom: 5 },
  };

  switch (type) {
    case 'bar':
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--tw-color-gray-100, #f3f4f6)" opacity={0.5} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={formatTick} width={55} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" fill={COLORS[0]} radius={[4, 4, 0, 0]} maxBarSize={50}
              label={chartData.length <= 8 ? { position: 'top', fontSize: 10, formatter: formatTick } : false} />
          </BarChart>
        </ResponsiveContainer>
      );

    case 'line':
      return (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={formatTick} width={55} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="value" stroke={COLORS[0]} strokeWidth={2.5}
              dot={{ fill: COLORS[0], r: 3 }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      );

    case 'area':
      return (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart {...commonProps}>
            <defs>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS[0]} stopOpacity={0.3} />
                <stop offset="95%" stopColor={COLORS[0]} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={formatTick} width={55} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="value" stroke={COLORS[0]} fill="url(#areaGrad)" strokeWidth={2.5} />
          </AreaChart>
        </ResponsiveContainer>
      );

    case 'pie':
      return (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%"
              outerRadius="75%" innerRadius="40%" paddingAngle={2} label={({ name, percent }) =>
                percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : ''
              } labelLine={false}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      );

    default:
      return <div className="flex items-center justify-center h-full text-gray-400 text-sm">Unsupported chart type</div>;
  }
}

export default function ChartWidget({ widget, datasetId, filePath, filters, onEdit, isEditing }) {
  const chartRef = useRef(null);
  const { type, config, title } = widget;

  const { data, isLoading, error } = useQuery(
    ['chartData', datasetId, config, filters],
    () => datasetApi.chartData(datasetId, {
      x_column: config.x_column,
      y_column: config.y_column,
      aggregation: config.aggregation || 'sum',
      chart_type: type,
      filters: filters && Object.keys(filters).length > 0 ? JSON.stringify(filters) : undefined,
      file_path: filePath,
    }).then((r) => r.data),
    {
      enabled: !!datasetId && !!config.x_column && type !== 'kpi',
      staleTime: 60000,
      retry: false,
    }
  );

  const downloadPNG = async () => {
    if (!chartRef.current) return;
    const canvas = await html2canvas(chartRef.current, { backgroundColor: null });
    const link = document.createElement('a');
    link.download = `${title || 'chart'}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  // KPI widget
  if (type === 'kpi') {
    return <KPICard title={title || config.column} value={config.value} format={config.format} />;
  }

  // Table widget
  if (type === 'table') {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-2 flex-shrink-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{title}</h3>
        </div>
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-primary-500" /></div>
        ) : data ? (
          <DataTable columns={data.columns} rows={data.rows} />
        ) : null}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" ref={chartRef}>
      {/* Widget header */}
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{title}</h3>
        <div className="flex items-center gap-1">
          <button onClick={downloadPNG} className="btn-ghost p-1.5" title="Download PNG">
            <Download size={14} />
          </button>
          {isEditing && onEdit && (
            <button onClick={onEdit} className="btn-ghost p-1.5" title="Edit widget">
              <Settings2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Chart area */}
      <div className="flex-1 min-h-0">
        {isLoading && (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="animate-spin text-primary-500" />
          </div>
        )}
        {error && (
          <div className="h-full flex items-center justify-center text-red-400 text-sm">
            Failed to load chart data
          </div>
        )}
        {!isLoading && !error && data && (
          <ChartRenderer type={type} data={data} config={config} />
        )}
      </div>
    </div>
  );
}
