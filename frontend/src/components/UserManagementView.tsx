import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, ShieldCheck, UserPlus, Users2 } from 'lucide-react';

import { createUserApi, fetchUsersApi } from '../services/api';
import { UserAccount, UserRole } from '../types';

export const UserManagementView: React.FC = () => {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'employee'>('employee');

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      setUsers(await fetchUsersApi());
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to load users.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const handleCreateUser = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!name.trim() || !email.trim() || !password) {
      setErrorMessage('Please fill in all user fields.');
      return;
    }

    setIsCreating(true);
    setErrorMessage('');

    try {
      await createUserApi({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        role: role as UserRole,
      });
      setName('');
      setEmail('');
      setPassword('');
      setRole('employee');
      setShowCreateForm(false);
      await loadUsers();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to create user.'
      );
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="p-6 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-indigo-400 font-semibold">
            Administration
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mt-2">
            User Management
          </h1>
          <p className="text-sm text-slate-400 mt-2">
            View registered users and create administrator or employee accounts.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void loadUsers()}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-700 bg-slate-900 text-slate-200 text-xs font-semibold hover:bg-slate-800 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => {
              setErrorMessage('');
              setShowCreateForm((previous) => !previous);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500"
          >
            <UserPlus className="w-4 h-4" />
            Add User
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          {errorMessage}
        </div>
      )}

      {showCreateForm && (
        <form
          onSubmit={handleCreateUser}
          className="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-4"
        >
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-indigo-400" />
            <h2 className="font-semibold text-white">Create User</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Full name"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500"
            />
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email address"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500"
            />
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password (minimum 8 characters)"
              minLength={8}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500"
            />
            <select
              value={role}
              onChange={(event) =>
                setRole(event.target.value as 'admin' | 'employee')
              }
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-indigo-500"
            >
              <option value="employee">Employee</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isCreating}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 disabled:opacity-50"
            >
              {isCreating ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      )}

      <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users2 className="w-5 h-5 text-indigo-400" />
            <h2 className="font-semibold text-white">Registered Users</h2>
          </div>
          <span className="text-xs text-slate-400">
            {users.length} user{users.length === 1 ? '' : 's'}
          </span>
        </div>

        {isLoading ? (
          <div className="p-10 text-center text-sm text-slate-400">
            Loading users...
          </div>
        ) : users.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-400">
            No users found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-950/70">
                <tr className="text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3 font-semibold">Name</th>
                  <th className="px-5 py-3 font-semibold">Email</th>
                  <th className="px-5 py-3 font-semibold">Role</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={String(user.id ?? user.email)}
                    className="border-t border-slate-800"
                  >
                    <td className="px-5 py-4 text-sm text-white">
                      {user.name || user.full_name || user.username || 'Unnamed user'}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-300">
                      {user.email}
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 text-xs text-indigo-300">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        {String(user.role)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs">
                      <span className={user.is_active === false ? 'text-rose-300' : 'text-emerald-300'}>
                        {user.is_active === false ? 'Inactive' : 'Active'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
