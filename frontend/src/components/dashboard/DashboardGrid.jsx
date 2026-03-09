import React, { useState, useCallback } from 'react';
import GridLayout from 'react-grid-layout';
import { useResizeObserver } from '../../hooks/useResizeObserver';
import ChartWidget from '../charts/ChartWidget';
import KPICard from './KPICard';
import clsx from 'clsx';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const CARD_ROW_HEIGHT = 60;
const COLS = 12;

export default function DashboardGrid({
  widgets = [],
  datasetId,
  filePath,
  filters,
  isEditing,
  onLayoutChange,
  onWidgetEdit,
  onWidgetDelete,
}) {
  const [containerRef, { width }] = useResizeObserver();

  const layout = widgets.map((w) => ({
    i: w.id,
    x: w.position?.x ?? 0,
    y: w.position?.y ?? 0,
    w: w.position?.w ?? 4,
    h: w.position?.h ?? 3,
    minW: 2,
    minH: 2,
  }));

  const handleLayoutChange = useCallback((newLayout) => {
    if (!isEditing || !onLayoutChange) return;
    const positions = newLayout.map((item) => ({
      id: item.i,
      position: { x: item.x, y: item.y, w: item.w, h: item.h },
    }));
    onLayoutChange(positions);
  }, [isEditing, onLayoutChange]);

  if (!widgets.length) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
          <span className="text-2xl">📊</span>
        </div>
        <h3 className="text-gray-900 dark:text-white font-semibold mb-1">No widgets yet</h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          {isEditing ? 'Add widgets from the panel on the right' : 'Enable edit mode to add widgets'}
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full">
      {width > 0 && (
        <GridLayout
          layout={layout}
          cols={COLS}
          rowHeight={CARD_ROW_HEIGHT}
          width={width}
          isDraggable={isEditing}
          isResizable={isEditing}
          onLayoutChange={handleLayoutChange}
          margin={[12, 12]}
          containerPadding={[0, 0]}
          draggableHandle=".drag-handle"
        >
          {widgets.map((widget) => (
            <div key={widget.id} className={clsx('card overflow-hidden group', isEditing && 'ring-2 ring-transparent hover:ring-primary-300 dark:hover:ring-primary-700')}>
              {isEditing && (
                <div className="drag-handle absolute inset-0 cursor-move z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-primary-500/5 rounded-xl" />
              )}
              <div className="p-4 h-full" style={{ position: 'relative', zIndex: 1 }}>
                <ChartWidget
                  widget={widget}
                  datasetId={datasetId}
                  filePath={filePath}
                  filters={filters}
                  isEditing={isEditing}
                  onEdit={() => onWidgetEdit?.(widget)}
                />
              </div>
              {isEditing && (
                <button
                  onClick={() => onWidgetDelete?.(widget.id)}
                  className="absolute top-2 right-2 z-20 w-6 h-6 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </GridLayout>
      )}
    </div>
  );
}
