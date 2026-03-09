import React, { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  Edit3, Eye, Save, Share2, Download, Plus, ArrowLeft,
  Loader2, Sun, Moon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { dashboardApi, datasetApi } from '../services/api';
import DashboardGrid from '../components/dashboard/DashboardGrid';
import DashboardFilters from '../components/dashboard/DashboardFilters';
import AddWidgetPanel from '../components/dashboard/AddWidgetPanel';
import clsx from 'clsx';

export default function DashboardEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [activeFilters, setActiveFilters] = useState({});
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [dashboardName, setDashboardName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const dashboardRef = React.useRef(null);

  const { data: dashboard, isLoading } = useQuery(
    ['dashboard', id],
    () => dashboardApi.get(id).then((r) => r.data),
    {
      onSuccess: (d) => setDashboardName(d.name),
    }
  );

  const { data: suggestions } = useQuery(
    ['suggestions', dashboard?.dataset_id],
    () => datasetApi.suggestions(dashboard.dataset_id).then((r) => r.data),
    { enabled: !!dashboard?.dataset_id && isEditing }
  );

  const updateMutation = useMutation(
    (data) => dashboardApi.update(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['dashboard', id]);
        toast.success('Dashboard saved');
      },
      onError: () => toast.error('Failed to save dashboard'),
    }
  );

  const positionsMutation = useMutation(
    (positions) => dashboardApi.updatePositions(id, positions),
    { onSuccess: () => queryClient.invalidateQueries(['dashboard', id]) }
  );

  const addWidgetMutation = useMutation(
    (widgetData) => dashboardApi.addWidget(id, widgetData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['dashboard', id]);
        toast.success('Widget added');
      },
    }
  );

  const deleteWidgetMutation = useMutation(
    (widgetId) => dashboardApi.deleteWidget(id, widgetId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['dashboard', id]);
        toast.success('Widget removed');
      },
    }
  );

  const handleLayoutChange = useCallback(
    (positions) => positionsMutation.mutate(positions),
    [positionsMutation]
  );

  const handleShare = async () => {
    const { data: result } = await dashboardApi.share(id, !dashboard.is_public);
    if (result.is_public && result.share_token) {
      const url = `${window.location.origin}/share/${result.share_token}`;
      await navigator.clipboard.writeText(url);
      toast.success('Share link copied!');
    } else {
      toast.success('Dashboard is now private');
    }
    queryClient.invalidateQueries(['dashboard', id]);
  };

  const handleExportPDF = async () => {
    if (!dashboardRef.current) return;
    toast.loading('Generating PDF...');
    try {
      const canvas = await html2canvas(dashboardRef.current, {
        scale: 1.5,
        useCORS: true,
        backgroundColor: dashboard?.theme === 'dark' ? '#141624' : '#f8fafc',
      });
      const imgData = canvas.toDataURL('image/jpeg', 0.9);
      const pdf = new jsPDF({ orientation: 'landscape', format: 'a4' });
      const w = pdf.internal.pageSize.getWidth();
      const h = (canvas.height / canvas.width) * w;
      pdf.addImage(imgData, 'JPEG', 0, 0, w, h);
      pdf.save(`${dashboard?.name || 'dashboard'}.pdf`);
      toast.dismiss();
      toast.success('PDF downloaded!');
    } catch {
      toast.dismiss();
      toast.error('PDF export failed');
    }
  };

  const handleSaveName = async () => {
    if (!dashboardName.trim()) return;
    await updateMutation.mutateAsync({ name: dashboardName });
    setEditingName(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-primary-500" size={32} />
      </div>
    );
  }

  if (!dashboard) {
    return <div className="text-center py-20 text-gray-500">Dashboard not found</div>;
  }

  const filters = suggestions?.suggestions?.filters || [];
  const filePath = dashboard.cleaned_file_path || dashboard.file_path;

  return (
    <div className="animate-fade-in">
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <button onClick={() => navigate('/dashboards')} className="btn-ghost p-2">
          <ArrowLeft size={18} />
        </button>

        {/* Dashboard name */}
        {editingName ? (
          <input
            className="input flex-1 max-w-xs h-9 text-sm font-semibold"
            value={dashboardName}
            onChange={(e) => setDashboardName(e.target.value)}
            onBlur={handleSaveName}
            onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
            autoFocus
          />
        ) : (
          <h1
            className="text-xl font-bold text-gray-900 dark:text-white cursor-pointer hover:text-primary-600 transition-colors flex items-center gap-1.5"
            onClick={() => setEditingName(true)}
          >
            {dashboard.name}
            <Edit3 size={14} className="text-gray-400" />
          </h1>
        )}

        {dashboard.dataset_name && (
          <span className="text-sm text-gray-400 hidden sm:block">— {dashboard.dataset_name}</span>
        )}

        <div className="flex-1" />

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button onClick={handleShare} className={clsx('btn-ghost flex items-center gap-1.5 text-sm', dashboard.is_public && 'text-green-600 dark:text-green-400')}>
            <Share2 size={15} />
            <span className="hidden sm:block">{dashboard.is_public ? 'Shared' : 'Share'}</span>
          </button>

          <button onClick={handleExportPDF} className="btn-ghost flex items-center gap-1.5 text-sm">
            <Download size={15} />
            <span className="hidden sm:block">PDF</span>
          </button>

          {isEditing && (
            <button onClick={() => setShowAddPanel(!showAddPanel)} className="btn-secondary flex items-center gap-1.5 text-sm">
              <Plus size={15} />
              Add Widget
            </button>
          )}

          <button
            onClick={() => setIsEditing(!isEditing)}
            className={clsx('flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg font-medium transition-all', isEditing
              ? 'bg-primary-600 text-white hover:bg-primary-700'
              : 'btn-secondary'
            )}
          >
            {isEditing ? <><Save size={15} /> Done</> : <><Edit3 size={15} /> Edit</>}
          </button>
        </div>
      </div>

      {/* Filters */}
      {filters.length > 0 && (
        <div className="mb-4">
          <DashboardFilters
            filters={filters}
            activeFilters={activeFilters}
            onFilterChange={setActiveFilters}
          />
        </div>
      )}

      {/* Dashboard grid */}
      <div ref={dashboardRef} className={clsx(dashboard.theme === 'dark' && 'dark')}>
        <div className={clsx('min-h-[400px]', isEditing && 'border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-2')}>
          <DashboardGrid
            widgets={dashboard.widgets || []}
            datasetId={dashboard.dataset_id}
            filePath={filePath}
            filters={activeFilters}
            isEditing={isEditing}
            onLayoutChange={handleLayoutChange}
            onWidgetDelete={(widgetId) => deleteWidgetMutation.mutate(widgetId)}
          />
        </div>
      </div>

      {/* Add widget panel */}
      {isEditing && showAddPanel && suggestions && (
        <AddWidgetPanel
          suggestions={suggestions}
          onAdd={(widgetData) => {
            addWidgetMutation.mutate(widgetData);
            setShowAddPanel(false);
          }}
          onClose={() => setShowAddPanel(false)}
          existingWidgets={dashboard.widgets || []}
        />
      )}
    </div>
  );
}
