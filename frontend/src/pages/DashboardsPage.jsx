import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from 'react-query';
import { LayoutDashboard, Plus, Loader2, BarChart2, Clock, Share2, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { dashboardApi } from '../services/api';
import useAuthStore from '../store/authStore';

export default function DashboardsPage() {
  const { currentWorkspaceId } = useAuthStore();
  const navigate = useNavigate();

  const { data, isLoading, refetch } = useQuery(
    ['dashboards', currentWorkspaceId],
    () => dashboardApi.list(currentWorkspaceId).then((r) => r.data),
    { enabled: !!currentWorkspaceId }
  );

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Delete this dashboard?')) return;
    try {
      await dashboardApi.delete(id);
      toast.success('Dashboard deleted');
      refetch();
    } catch {
      toast.error('Failed to delete dashboard');
    }
  };

  const handleShare = async (id, isPublic, e) => {
    e.stopPropagation();
    try {
      const { data: result } = await dashboardApi.share(id, !isPublic);
      if (result.is_public && result.share_token) {
        const url = `${window.location.origin}/share/${result.share_token}`;
        await navigator.clipboard.writeText(url);
        toast.success('Share link copied to clipboard!');
      } else {
        toast.success('Dashboard made private');
      }
      refetch();
    } catch {
      toast.error('Failed to update sharing');
    }
  };

  if (!currentWorkspaceId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400 text-sm">Setting up your workspace...</p>
          <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">If this persists, try logging out and back in.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-primary-500" size={32} />
      </div>
    );
  }

  const dashboards = data?.dashboards || [];

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboards</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
            {dashboards.length} dashboard{dashboards.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => navigate('/datasets/upload')}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          <Plus size={16} />
          New Dashboard
        </button>
      </div>

      {/* Empty state */}
      {dashboards.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center mb-4">
            <LayoutDashboard size={36} className="text-primary-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No dashboards yet</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-6 max-w-sm">
            Upload an Excel or CSV file and we'll help you create an interactive dashboard in minutes.
          </p>
          <button onClick={() => navigate('/datasets/upload')} className="btn-primary flex items-center gap-2">
            <Plus size={16} />
            Upload Your First File
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {dashboards.map((dashboard) => (
            <div
              key={dashboard.id}
              onClick={() => navigate(`/dashboards/${dashboard.id}/edit`)}
              className="card p-5 cursor-pointer hover:shadow-card-hover transition-all duration-200 group"
            >
              {/* Preview placeholder */}
              <div className="w-full h-28 rounded-lg bg-gradient-to-br from-primary-50 to-blue-100 dark:from-primary-900/20 dark:to-blue-900/20 mb-4 flex items-center justify-center relative overflow-hidden">
                <BarChart2 size={40} className="text-primary-300 dark:text-primary-700" />
                <div className="absolute inset-0 flex items-end justify-end p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex gap-1">
                    <button
                      onClick={(e) => handleShare(dashboard.id, dashboard.is_public, e)}
                      className="w-7 h-7 bg-white dark:bg-gray-800 rounded-lg flex items-center justify-center shadow text-gray-600 hover:text-primary-600"
                      title={dashboard.is_public ? 'Make private' : 'Share'}
                    >
                      <Share2 size={13} />
                    </button>
                    <button
                      onClick={(e) => handleDelete(dashboard.id, e)}
                      className="w-7 h-7 bg-white dark:bg-gray-800 rounded-lg flex items-center justify-center shadow text-gray-600 hover:text-red-500"
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>

              <h3 className="font-semibold text-gray-900 dark:text-white text-sm truncate">{dashboard.name}</h3>
              {dashboard.dataset_name && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{dashboard.dataset_name}</p>
              )}

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <Clock size={11} />
                  {formatDistanceToNow(new Date(dashboard.updated_at), { addSuffix: true })}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{dashboard.widget_count} widget{dashboard.widget_count !== 1 ? 's' : ''}</span>
                  {dashboard.is_public && (
                    <span className="badge bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400">
                      Public
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
