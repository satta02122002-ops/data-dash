import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import clsx from 'clsx';

const formatValue = (value, format) => {
  if (value === null || value === undefined) return '—';
  const num = parseFloat(value);
  if (isNaN(num)) return value;

  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num);
    case 'percentage':
      return `${num.toFixed(1)}%`;
    case 'number':
      return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(num);
    default:
      return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(num);
  }
};

const ACCENT_COLORS = [
  'from-blue-500 to-blue-600',
  'from-purple-500 to-purple-600',
  'from-green-500 to-green-600',
  'from-orange-500 to-orange-600',
  'from-pink-500 to-pink-600',
  'from-teal-500 to-teal-600',
];

export default function KPICard({ title, value, format = 'number', trend, index = 0, subtitle, icon: Icon }) {
  const accentColor = ACCENT_COLORS[index % ACCENT_COLORS.length];

  const TrendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;
  const trendColor = trend > 0 ? 'text-green-600 dark:text-green-400' : trend < 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-500';

  return (
    <div className="card p-5 hover:shadow-card-hover transition-shadow duration-200 h-full flex flex-col justify-between">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider truncate">
            {title}
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1 truncate">
            {formatValue(value, format)}
          </p>
        </div>
        <div className={clsx('w-10 h-10 rounded-lg bg-gradient-to-br flex items-center justify-center flex-shrink-0 ml-3', accentColor)}>
          {Icon ? <Icon size={18} className="text-white" /> : (
            <div className="w-4 h-4 bg-white/30 rounded" />
          )}
        </div>
      </div>

      {(trend !== undefined || subtitle) && (
        <div className="flex items-center gap-1.5 mt-3">
          {trend !== undefined && (
            <>
              <TrendIcon size={14} className={trendColor} />
              <span className={clsx('text-xs font-medium', trendColor)}>
                {Math.abs(trend).toFixed(1)}%
              </span>
            </>
          )}
          {subtitle && (
            <span className="text-xs text-gray-400 dark:text-gray-500">{subtitle}</span>
          )}
        </div>
      )}
    </div>
  );
}
