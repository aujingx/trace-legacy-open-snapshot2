// Tauri IPC invocations for activities
// 活动数据 - Tauri 桥接层

import { invoke } from '@tauri-apps/api/core';
import type { Activity, ActivityCategory } from '../dataService';

/**
 * Check if we're running in Tauri desktop environment
 */
export function isDesktop(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

function enumerateDates(startDate: string, endDate: string): string[] {
  const result: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  while (cursor <= end) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, '0');
    const d = String(cursor.getDate()).padStart(2, '0');
    result.push(`${y}-${m}-${d}`);
    cursor.setDate(cursor.getDate() + 1);
  }

  return result;
}

// Backend Activity structure (from Rust)
interface BackendActivity {
  id: string;
  name: string;
  window_title: string;
  category: string | null;
  task_id: string | null;
  start_time_ms: number;
  duration_minutes: number;
}

// Convert backend format to frontend format
function toFrontendActivity(backend: BackendActivity): Activity {
  const startDate = new Date(backend.start_time_ms);
  const endDate = new Date(backend.start_time_ms + backend.duration_minutes * 60 * 1000);

  return {
    id: backend.id,
    name: backend.name,
    category: (backend.category || '其他') as ActivityCategory,
    startTime: startDate.toISOString().replace('Z', '').split('.')[0],
    endTime: endDate.toISOString().replace('Z', '').split('.')[0],
    duration: backend.duration_minutes,
    isManual: false,
    isAiClassified: !!backend.category,
    aiApproved: backend.category ? null : null,
    taskId: backend.task_id || undefined,
  };
}

// Convert frontend format to backend format
function toBackendActivity(frontend: Activity): BackendActivity {
  const startTimeMs = new Date(frontend.startTime).getTime();

  return {
    id: frontend.id,
    name: frontend.name,
    window_title: frontend.name,
    category: frontend.category || null,
    task_id: null,
    start_time_ms: startTimeMs,
    duration_minutes: frontend.duration,
  };
}

/**
 * Get today's activities
 */
export async function getTodayActivities(): Promise<Activity[]> {
  if (!isDesktop()) {
    throw new Error('Not in desktop environment');
  }
  const result = await invoke<BackendActivity[]>('get_today_activities');
  return result.map(toFrontendActivity);
}

/**
 * Get all activities for a specific date
 */
export async function getActivities(date: string): Promise<Activity[]> {
  if (!isDesktop()) {
    throw new Error('Not in desktop environment');
  }
  const result = await invoke<BackendActivity[]>('get_activities_by_date', { dateStr: date });
  return result.map(toFrontendActivity);
}

/**
 * Get activities in date range
 */
export async function getActivitiesRange(startDate: string, endDate: string): Promise<Activity[]> {
  if (!isDesktop()) {
    throw new Error('Not in desktop environment');
  }
  const dates = enumerateDates(startDate, endDate);
  const results = await Promise.all(dates.map((date) => getActivities(date)));
  return results.flat();
}

/**
 * Add a new activity
 */
export async function addActivity(activity: Omit<Activity, 'id'>): Promise<Activity> {
  if (!isDesktop()) {
    throw new Error('Not in desktop environment');
  }
  const backend = toBackendActivity({ ...activity, id: '' } as Activity);
  const result = await invoke<BackendActivity>('create_activity', {
    name: backend.name,
    window_title: backend.window_title,
    category: backend.category,
    start_time_ms: backend.start_time_ms,
    duration_minutes: backend.duration_minutes,
  });
  return toFrontendActivity(result);
}

/**
 * Update an existing activity
 */
export async function updateActivity(id: string, update: Partial<Activity>): Promise<void> {
  if (!isDesktop()) {
    throw new Error('Not in desktop environment');
  }
  // Map frontend fields to backend command parameters
  const params: Record<string, unknown> = { id };
  if (update.name !== undefined) params.name = update.name;
  if (update.category !== undefined) params.category = update.category;
  if (update.duration !== undefined) params.duration_minutes = update.duration;
  if (update.startTime !== undefined) {
    params.start_time_ms = new Date(update.startTime).getTime();
  }

  await invoke('update_activity', params);
}

/**
 * Delete an activity
 */
export async function deleteActivity(id: string): Promise<void> {
  if (!isDesktop()) {
    throw new Error('Not in desktop environment');
  }
  await invoke('delete_activity', { id });
}

/**
 * Delete multiple activities
 */
export async function deleteActivities(ids: string[]): Promise<void> {
  if (!isDesktop()) {
    throw new Error('Not in desktop environment');
  }
  // Backend doesn't have bulk delete, delete one by one
  for (const id of ids) {
    await deleteActivity(id);
  }
}

/**
 * Update activity category
 */
export async function updateActivityCategory(id: string, category: string): Promise<void> {
  if (!isDesktop()) {
    throw new Error('Not in desktop environment');
  }
  await invoke('update_activity_category', { id, category });
}

/**
 * Manually match an activity to a task
 */
export async function matchActivityToTask(activityId: string, taskId: string): Promise<void> {
  if (!isDesktop()) {
    throw new Error('Not in desktop environment');
  }
  await invoke('match_activity_to_task', { activity_id: activityId, task_id: taskId });
}

/**
 * Get daily statistics
 */
export async function getDailyStats(date: string): Promise<{
  totalMinutes: number;
  categories: Record<string, number>;
}> {
  if (!isDesktop()) {
    throw new Error('Not in desktop environment');
  }
  const stats = await invoke<{
    total_focus_minutes: number;
    total_categories: number;
    top_category: string;
  }>('get_daily_stats_by_date', { dateStr: date });
  const activities = await getActivities(date);
  const categories: Record<string, number> = {};
  activities.forEach((activity) => {
    categories[activity.category] = (categories[activity.category] || 0) + activity.duration;
  });

  return {
    totalMinutes: stats.total_focus_minutes,
    categories,
  };
}

/**
 * Get monthly statistics
 */
export async function getMonthlyStats(
  year: number,
  month: number
): Promise<Array<{ day: number; total_minutes: number }>> {
  if (!isDesktop()) {
    throw new Error('Not in desktop environment');
  }
  return invoke('get_monthly_stats', { year, month });
}

/**
 * Get weekly statistics
 */
export async function getWeeklyStats(): Promise<
  Array<{ category: string; duration: number; percentage: number }>
> {
  if (!isDesktop()) {
    throw new Error('Not in desktop environment');
  }
  return invoke('get_weekly_stats');
}

/**
 * Get all activities for export
 */
export async function getAllActivitiesExport(): Promise<Activity[]> {
  if (!isDesktop()) {
    throw new Error('Not in desktop environment');
  }
  const result = await invoke<BackendActivity[]>('get_all_activities_export');
  return result.map(toFrontendActivity);
}

/**
 * Classify activity using AI
 */
export async function classifyActivity(appName: string, windowTitle: string): Promise<string> {
  if (!isDesktop()) {
    throw new Error('Not in desktop environment');
  }
  return invoke<string>('classify_activity', { app_name: appName, window_title: windowTitle });
}
