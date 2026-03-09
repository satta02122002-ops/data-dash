import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { User, Briefcase, Shield, Sun, Moon, Loader2, UserPlus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { workspaceApi } from '../services/api';
import api from '../services/api';
import useAuthStore from '../store/authStore';
import useThemeStore from '../store/themeStore';

export default function SettingsPage() {
  const { user, currentWorkspaceId, updateUser } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const [name, setName] = useState(user?.name || '');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const queryClient = useQueryClient();

  const { data: workspace } = useQuery(
    ['workspace', currentWorkspaceId],
    () => workspaceApi.get(currentWorkspaceId).then((r) => r.data),
    { enabled: !!currentWorkspaceId }
  );

  const { data: stats } = useQuery(
    ['workspaceStats', currentWorkspaceId],
    () => workspaceApi.stats(currentWorkspaceId).then((r) => r.data),
    { enabled: !!currentWorkspaceId }
  );

  const updateProfileMutation = useMutation(
    (data) => api.patch('/auth/me', data),
    {
      onSuccess: (res) => {
        updateUser(res.data);
        toast.success('Profile updated');
      },
      onError: () => toast.error('Failed to update profile'),
    }
  );

  const inviteMutation = useMutation(
    (data) => workspaceApi.inviteMember(currentWorkspaceId, data),
    {
      onSuccess: () => {
        toast.success('Member invited');
        setInviteEmail('');
        queryClient.invalidateQueries(['workspace', currentWorkspaceId]);
      },
      onError: (err) => toast.error(err.response?.data?.error || 'Failed to invite'),
    }
  );

  const removeMemberMutation = useMutation(
    (userId) => workspaceApi.removeMember(currentWorkspaceId, userId),
    {
      onSuccess: () => {
        toast.success('Member removed');
        queryClient.invalidateQueries(['workspace', currentWorkspaceId]);
      },
    }
  );

  return (
    <div className="max-w-2xl animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-gray-500 text-sm mt-0.5">Manage your account and workspace settings</p>
      </div>

      {/* Profile */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-5">
          <User size={18} className="text-primary-500" />
          <h2 className="font-semibold text-gray-900 dark:text-white">Profile</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="label">Display Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input opacity-60 cursor-not-allowed" value={user?.email} disabled />
          </div>
          <div>
            <label className="label">Plan</label>
            <span className="badge bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 capitalize">
              {user?.plan || 'Free'}
            </span>
          </div>
          <button
            onClick={() => updateProfileMutation.mutate({ name })}
            disabled={updateProfileMutation.isLoading || name === user?.name}
            className="btn-primary flex items-center gap-2"
          >
            {updateProfileMutation.isLoading && <Loader2 size={14} className="animate-spin" />}
            Save Changes
          </button>
        </div>
      </div>

      {/* Appearance */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-5">
          <Sun size={18} className="text-primary-500" />
          <h2 className="font-semibold text-gray-900 dark:text-white">Appearance</h2>
        </div>
        <div className="flex gap-3">
          {['light', 'dark'].map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 text-sm font-medium transition-all capitalize ${
                theme === t ? 'border-primary-500 text-primary-600 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400'
              }`}
            >
              {t === 'light' ? <Sun size={15} /> : <Moon size={15} />}
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Workspace stats */}
      {stats && (
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-5">
            <Briefcase size={18} className="text-primary-500" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Workspace Overview</h2>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Datasets', value: stats.datasets },
              { label: 'Dashboards', value: stats.dashboards },
              { label: 'Members', value: stats.members },
            ].map(({ label, value }) => (
              <div key={label} className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Team members */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-5">
          <Shield size={18} className="text-primary-500" />
          <h2 className="font-semibold text-gray-900 dark:text-white">Team Members</h2>
        </div>

        {/* Invite */}
        <div className="flex gap-2 mb-4">
          <input
            className="input flex-1"
            placeholder="Email address"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            type="email"
          />
          <select className="input w-28" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
          </select>
          <button
            onClick={() => inviteMutation.mutate({ email: inviteEmail, role: inviteRole })}
            disabled={!inviteEmail || inviteMutation.isLoading}
            className="btn-primary flex items-center gap-1.5 text-sm whitespace-nowrap"
          >
            <UserPlus size={14} />
            Invite
          </button>
        </div>

        {/* Members list */}
        <div className="space-y-2">
          {workspace?.members?.filter(m => m.user_id).map((member) => (
            <div key={member.user_id} className="flex items-center gap-3 py-2">
              <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                <span className="text-primary-700 dark:text-primary-400 text-xs font-semibold">
                  {member.name?.charAt(0)?.toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{member.name}</p>
                <p className="text-xs text-gray-400 truncate">{member.email}</p>
              </div>
              <span className="badge bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 capitalize text-xs">
                {member.role}
              </span>
              {member.user_id !== user.id && member.role !== 'owner' && (
                <button
                  onClick={() => removeMemberMutation.mutate(member.user_id)}
                  className="btn-ghost p-1.5 text-gray-400 hover:text-red-500"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
