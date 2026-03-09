import React, { useState } from 'react';
import { X, BarChart2, LineChart, PieChart, Table, TrendingUp, LayoutGrid } from 'lucide-react';
import clsx from 'clsx';

const CHART_ICONS = {
  bar: BarChart2,
  line: LineChart,
  area: TrendingUp,
  pie: PieChart,
  table: Table,
  kpi: TrendingUp,
  heatmap: LayoutGrid,
};

export default function AddWidgetPanel({ suggestions, onAdd, onClose, existingWidgets }) {
  const [tab, setTab] = useState('suggestions');

  const existingIds = new Set(existingWidgets.map((w) => w.config?.source_id || ''));

  const allSuggestions = [
    ...(suggestions?.suggestions?.kpis || []),
    ...(suggestions?.suggestions?.charts || []),
  ];

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-white dark:bg-surface-dark shadow-2xl border-l border-gray-200 dark:border-gray-700 z-50 flex flex-col animate-slide-up">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
        <h2 className="font-semibold text-gray-900 dark:text-white">Add Widgets</h2>
        <button onClick={onClose} className="btn-ghost p-1.5">
          <X size={18} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 dark:border-gray-700">
        {['suggestions', 'custom'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              'flex-1 py-3 text-sm font-medium capitalize transition-colors',
              tab === t
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {tab === 'suggestions' && allSuggestions.map((widget) => {
          const Icon = CHART_ICONS[widget.type] || BarChart2;
          return (
            <button
              key={widget.id}
              onClick={() => onAdd({
                type: widget.type,
                title: widget.title,
                config: widget.config,
                position: { x: 0, y: 999, w: widget.type === 'kpi' ? 3 : 6, h: widget.type === 'kpi' ? 2 : 4 },
              })}
              className="w-full text-left p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 group-hover:bg-primary-100 dark:group-hover:bg-primary-900/30 flex items-center justify-center flex-shrink-0 transition-colors">
                  <Icon size={15} className="text-gray-500 group-hover:text-primary-600 dark:group-hover:text-primary-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{widget.title}</p>
                  <p className="text-xs text-gray-400 capitalize">{widget.type}</p>
                </div>
                {widget.recommended && (
                  <span className="badge bg-green-50 dark:bg-green-900/20 text-green-600 text-xs ml-auto flex-shrink-0">✓</span>
                )}
              </div>
            </button>
          );
        })}

        {tab === 'custom' && (
          <CustomWidgetForm
            columns={suggestions?.columns || []}
            onAdd={onAdd}
          />
        )}
      </div>
    </div>
  );
}

function CustomWidgetForm({ columns, onAdd }) {
  const [form, setForm] = useState({
    type: 'bar',
    title: '',
    x_column: '',
    y_column: '',
    aggregation: 'sum',
  });

  const numericCols = columns.filter((c) => c.type === 'numeric');
  const dimCols = columns.filter((c) => c.type !== 'numeric');

  const handleAdd = () => {
    if (!form.x_column) return;
    onAdd({
      type: form.type,
      title: form.title || `${form.y_column || form.x_column} chart`,
      config: {
        x_column: form.x_column,
        y_column: form.y_column || null,
        aggregation: form.aggregation,
        chart_type: form.type,
      },
      position: { x: 0, y: 999, w: 6, h: 4 },
    });
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="label text-xs">Chart Type</label>
        <select className="input text-sm" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
          {['bar', 'line', 'area', 'pie', 'table', 'kpi'].map((t) => (
            <option key={t} value={t}>{t.toUpperCase()}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label text-xs">Title</label>
        <input className="input text-sm" placeholder="Widget title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      </div>
      <div>
        <label className="label text-xs">X / Category Column</label>
        <select className="input text-sm" value={form.x_column} onChange={(e) => setForm({ ...form, x_column: e.target.value })}>
          <option value="">Select column</option>
          {columns.map((c) => <option key={c.name} value={c.name}>{c.name} ({c.type})</option>)}
        </select>
      </div>
      {form.type !== 'kpi' && (
        <div>
          <label className="label text-xs">Y / Value Column</label>
          <select className="input text-sm" value={form.y_column} onChange={(e) => setForm({ ...form, y_column: e.target.value })}>
            <option value="">Select column</option>
            {numericCols.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
        </div>
      )}
      <div>
        <label className="label text-xs">Aggregation</label>
        <select className="input text-sm" value={form.aggregation} onChange={(e) => setForm({ ...form, aggregation: e.target.value })}>
          {['sum', 'mean', 'count', 'min', 'max'].map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      <button onClick={handleAdd} disabled={!form.x_column} className="btn-primary w-full text-sm">
        Add Widget
      </button>
    </div>
  );
}
