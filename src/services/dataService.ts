// Trace Data Service
// - Desktop: Activities still use native JSON persistence; other domains use Tauri-backed storage
// - Web demo: Falls back to localStorage for demo mode
// All localStorage keys prefixed with 'trace-'
//
// Architecture:
// - src/services/ipc/ - Tauri IPC bridge layer for each domain
// - This file: maintains backward compatibility + localStorage fallback for web demo

// ============================================================
// Utility functions
// ============================================================

/** 获取今天、昨天、明天的日期字符串数组 */
function getNearbyDays(): string[] {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  return [yesterday, today, tomorrow];
}

/** 获取过去 daysAgo 天到未来 daysAgo 天的日期字符串数组 */
function getDateRange(daysAgo: number): string[] {
  const days: string[] = [];
  for (let i = -daysAgo; i <= daysAgo; i++) {
    const date = new Date(Date.now() + i * 86400000).toISOString().slice(0, 10);
    days.push(date);
  }
  return days;
}

// ============================================================
// Types (re-exported for consumers)
// ============================================================

export type ActivityCategory =
  | '开发'
  | '工作'
  | '学习'
  | '会议'
  | '休息'
  | '娱乐'
  | '运动'
  | '阅读'
  | '其他';

export interface Activity {
  id: string;
  name: string;
  category: ActivityCategory;
  startTime: string;
  endTime: string;
  duration: number; // minutes
  isManual: boolean;
  isAiClassified?: boolean; // Whether this activity was classified by AI
  aiApproved?: boolean | null; // User approval status: true = approved, false = rejected, null = not reviewed
  taskId?: string; // Associated task ID, if any
}

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export type TaskStatus = 'todo' | 'in_progress' | 'paused' | 'completed' | 'archived';
export type RepeatType = 'none' | 'daily' | 'weekly' | 'monthly';
export type EmotionalTag = 'easy' | 'neutral' | 'resist';

export interface Task {
  id: string;
  title: string;
  priority: 1 | 2 | 3 | 4 | 5;
  status: TaskStatus;
  estimatedMinutes: number;
  actualMinutes: number;
  project: string;
  subtasks: Subtask[];
  dueDate: string;
  repeatType: RepeatType;
  createdAt: string;
  // Scheduled time on Timeline
  scheduledStartTime?: string; // ISO string: when this task is scheduled to start
  scheduledEndTime?: string; // ISO string: when this task is scheduled to end
  scheduledDate?: string; // YYYY-MM-DD: which day this task is scheduled for
  // Guardian Beta fields
  firstStep?: string;
  emotionalTag?: EmotionalTag;
  // Description/Notes
  description?: string;
  // Task timer tracking
  timeLoggedMinutes?: number; // Total time logged via time blocks
}

export type HabitCategory = 'health' | 'learning' | 'fitness' | 'mindfulness' | 'other';

export interface Habit {
  id: string;
  name: string;
  icon: string;
  targetMinutes: number;
  targetCount: number; // daily target check-in count (default 1)
  color: string;
  streak: number;
  reminders: string[]; // array of HH:mm times
  category: HabitCategory;
  checkins: Record<string, number>; // date string -> count (multi-check) or minutes
  createdAt: string;
}

export type FocusType = 'work' | 'break' | 'longBreak';

export interface FocusSession {
  id: string;
  startTime: string;
  endTime: string | null;
  duration: number;
  type: FocusType;
  completed: boolean;
}

export interface Pet {
  name: string;
  type: string;
  level: number;
  xp: number;
  hunger: number;
  mood: number;
  coins: number;
  lastFed: string;
  lastInteracted: string;
  decoration: string;
}

export interface BlockedPattern {
  id: string;
  pattern: string; // domain or app name pattern to match
  type: 'domain' | 'app';
  enabled: boolean;
}

export interface AppSettings {
  theme: string;
  colorTheme: string;
  backgroundSkin: string;
  featureFlags: Record<string, boolean>;
  dailyGoalMinutes: number;
  language: string;
  // AI provider settings
  aiApiKey?: string;
  aiProvider?:
    | 'ernie'
    | 'doubao'
    | 'qwen'
    | 'glm'
    | 'openai'
    | 'claude'
    | 'gemini'
    | 'deepseek'
    | 'xai';
  autoStartOnBoot?: boolean;
  ignoredApplications?: string[];
  // Privacy settings
  privacy_sync_mode?: 'full' | 'summary_only' | 'local_only';
  privacy_cloud_encryption?: boolean;
  privacy_retain_raw_local?: boolean;
  privacy_auto_delete_days?: number;
  // Distraction blocking
  blockedPatterns?: BlockedPattern[];
  blockingScheduleMode?: 'focusOnly' | 'always' | 'custom';
  blockingScheduleStart?: string; // HH:mm
  blockingScheduleEnd?: string; // HH:mm
  // Custom AI classification rules
  customAiClassificationRules?: string;
  // Calendar sync
  calendarSyncEnabled?: boolean;
  calendarSyncAutoCreateActivities?: boolean;
  calendarSyncDefaultCategory?: ActivityCategory;
  // Only sync events containing certain keywords (optional)
  calendarSyncKeywordFilter?: string;
  // AI personalized break reminders based on work patterns
  adaptiveBreakReminders?: boolean;
  adaptiveBreakMinInterval?: number;
  adaptiveBreakMaxInterval?: number;
  adaptiveBreakUrgentThreshold?: number;
}

export type TimeBlockSource = 'auto' | 'manual' | 'confirmed';

export interface TimeBlock {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  category: ActivityCategory;
  date: string;
  completed: boolean;
  source: TimeBlockSource;
  description?: string;
  status?: 'pending' | 'approved' | 'rejected';
  categoryId?: string;
  taskId?: string;
  isTaskTimer?: boolean; // Flag indicating this was created from a task timer
}

export interface DailyStat {
  date: string;
  totalMinutes: number;
  totalActivityCount: number;
  categories: Record<string, number>;
}

// ============================================================
// Imports from IPC layer
// ============================================================

import * as activityIpc from './ipc/activityIpc';
import * as taskIpc from './ipc/taskIpc';
import * as habitIpc from './ipc/habitIpc';
import * as focusIpc from './ipc/focusIpc';
import * as timeBlockIpc from './ipc/timeBlockIpc';
import * as settingsIpc from './ipc/settingsIpc';
import * as petIpc from './ipc/petIpc';

// ============================================================
// Storage helpers (fallback for web demo mode)
// ============================================================

const KEYS = {
  activities: 'trace-activities',
  tasks: 'trace-tasks',
  habits: 'trace-habits',
  focusSessions: 'trace-focus-sessions',
  pet: 'trace-pet',
  settings: 'trace-settings',
  timeBlocks: 'trace-time-blocks',
  seeded: 'trace-seeded',
} as const;

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, data: T): void {
  localStorage.setItem(key, JSON.stringify(data));
}

function uid(): string {
  return crypto.randomUUID();
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isDesktop(): boolean {
  return activityIpc.isDesktop();
}

// ============================================================
// Default export: combined service with dual-mode support
// ============================================================

const DataService = {
  // ============================================================
  // Activities
  // ============================================================
  getActivities: async (date?: string): Promise<Activity[]> => {
    if (isDesktop()) {
      if (date) {
        return activityIpc.getActivities(date);
      }
      // If no date specified, return today's activities
      return activityIpc.getTodayActivities();
    }
    return load<Activity[]>(KEYS.activities, []);
  },

  getActivitiesRange: async (startDate: string, endDate: string): Promise<Activity[]> => {
    if (isDesktop()) {
      return activityIpc.getActivitiesRange(startDate, endDate);
    }
    const all = load<Activity[]>(KEYS.activities, []);
    return all.filter((a) => {
      const date = a.startTime.slice(0, 10);
      return date >= startDate && date <= endDate;
    });
  },

  addActivity: async (activity: Omit<Activity, 'id'>): Promise<Activity> => {
    if (isDesktop()) {
      return activityIpc.addActivity(activity);
    }
    const newActivity = { ...activity, id: uid() } as Activity;
    const existing = load<Activity[]>(KEYS.activities, []);
    existing.push(newActivity);
    save(KEYS.activities, existing);
    return newActivity;
  },

  updateActivity: async (id: string, update: Partial<Activity>): Promise<void> => {
    if (isDesktop()) {
      await activityIpc.updateActivity(id, update);
    } else {
      const existing = load<Activity[]>(KEYS.activities, []);
      const idx = existing.findIndex((a) => a.id === id);
      if (idx >= 0) {
        existing[idx] = { ...existing[idx], ...update };
        save(KEYS.activities, existing);
      }
    }
  },

  deleteActivity: async (id: string): Promise<void> => {
    if (isDesktop()) {
      await activityIpc.deleteActivity(id);
    } else {
      const existing = load<Activity[]>(KEYS.activities, []);
      save(
        KEYS.activities,
        existing.filter((a) => a.id !== id)
      );
    }
  },

  deleteActivities: async (ids: string[]): Promise<void> => {
    if (isDesktop()) {
      await activityIpc.deleteActivities(ids);
    } else {
      const existing = load<Activity[]>(KEYS.activities, []);
      save(
        KEYS.activities,
        existing.filter((a) => !ids.includes(a.id))
      );
    }
  },

  getDailyStats: async (
    date: string
  ): Promise<{
    totalMinutes: number;
    categories: Record<string, number>;
  }> => {
    if (isDesktop()) {
      return activityIpc.getDailyStats(date);
    }
    const activities = await DataService.getActivities(date);
    const totalMinutes = activities.reduce((sum, a) => sum + a.duration, 0);
    const categories: Record<string, number> = {};
    activities.forEach((a) => {
      categories[a.category] = (categories[a.category] || 0) + a.duration;
    });
    return { totalMinutes, categories };
  },

  // ============================================================
  // Tasks
  // ============================================================
  getTasks: async (date?: string): Promise<Task[]> => {
    if (isDesktop()) {
      return taskIpc.getTasks(date);
    }
    return load<Task[]>(KEYS.tasks, []);
  },

  addTask: async (task: Omit<Task, 'id'>): Promise<Task> => {
    const newTask = { ...task, id: uid() } as Task;
    if (isDesktop()) {
      return taskIpc.createTask(newTask);
    } else {
      const existing = load<Task[]>(KEYS.tasks, []);
      existing.push(newTask);
      save(KEYS.tasks, existing);
      return newTask;
    }
  },

  updateTask: async (id: string, update: Partial<Task>): Promise<void> => {
    if (isDesktop()) {
      // 🎯 P1: 统一 Timeline 前台任务条模型收敛
      // 当设置 scheduledStartTime 时，如果没有对应的 time_block，自动创建一个
      // 当设置 scheduledEndTime 时，同步更新已有 block 的 endTime
      if (update.scheduledStartTime || update.scheduledEndTime) {
        try {
          // 用于查找 block 的日期范围
          const daysToCheck = getNearbyDays();
          if (update.scheduledStartTime) {
            daysToCheck.push(update.scheduledStartTime.slice(0, 10));
          }

          // ✅ 并行查询所有日期，性能优化
          const allBlocks = await Promise.all(daysToCheck.map(d => timeBlockIpc.getTimeBlocks(d)));
          const existingTaskBlocks = allBlocks.flat().filter((b: TimeBlock) => b.taskId === id);

          if (update.scheduledStartTime) {
            const newDate = update.scheduledStartTime.slice(0, 10);

            // Step 1: 删除旧日期的所有该任务的 time_block（处理跨天情况）
            // ✅ keepTaskSchedule = true: 只是移动位置，不解除任务排期
            for (const block of existingTaskBlocks) {
              if (block.startTime.slice(0, 10) !== newDate) {
                // 直接调用 IPC 层删除，options 参数由 dataService 自身处理，不传给 IPC
                await timeBlockIpc.deleteTimeBlock(block.id);
              }
            }

            // Step 2: 检查新日期是否已有 block，如果没有则创建
            const blocksForNewDate = await timeBlockIpc.getTimeBlocks(newDate);
            const hasExistingBlockInNewDate = blocksForNewDate.some((b: TimeBlock) => b.taskId === id);

            if (!hasExistingBlockInNewDate) {
              // 获取任务完整信息
              const allTasks = await taskIpc.getTasks();
              const task = allTasks.find((t: Task) => t.id === id);
              if (task) {
                const startDate = new Date(update.scheduledStartTime);
                // 优先使用 update 中的 scheduledEndTime，其次用任务已有的 scheduledEndTime，最后用 estimatedMinutes 计算
                const endTimeStr = update.scheduledEndTime || task.scheduledEndTime;
                const endDate = endTimeStr
                  ? new Date(endTimeStr)
                  : new Date(startDate.getTime() + (task.estimatedMinutes || 60) * 60000);
                const durationMinutes = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60));
                const validCategories: Array<string> = ['开发', '工作', '学习', '会议', '休息', '娱乐', '运动', '阅读', '其他'];
                const category = (task.project && validCategories.includes(task.project)) ? task.project : '工作';

                const newBlock: Omit<TimeBlock, 'id'> = {
                  title: task.title,
                  startTime: startDate.toISOString(),
                  endTime: endDate.toISOString(),
                  durationMinutes,
                  category: category as any,
                  date: update.scheduledStartTime.slice(0, 10),
                  completed: false,
                  source: 'manual',
                  taskId: id,
                };
                await timeBlockIpc.addTimeBlock(newBlock);
              }
            }
          } else if (update.scheduledEndTime && existingTaskBlocks.length > 0) {
            // 只有 scheduledEndTime 更新：同步到已有的 block
            const block = existingTaskBlocks[0];
            await timeBlockIpc.updateTimeBlock(block.id, {
              endTime: update.scheduledEndTime,
              durationMinutes: Math.round(
                (new Date(update.scheduledEndTime).getTime() - new Date(block.startTime).getTime()) / (1000 * 60)
              ),
            });
          }
        } catch (err) {
          // 如果自动创建/更新 time_block 失败，至少要保证任务本身能更新成功
          console.error('Failed to sync task with time block:', err);
        }
      }
      await taskIpc.updateTask(id, update);
    } else {
      // 🚨 数据一致性（Web 分支）：scheduledStartTime/EndTime 与 time_block 双向同步
      if (update.scheduledStartTime || update.scheduledEndTime) {
        const allBlocks = load<TimeBlock[]>(KEYS.timeBlocks, []);
        const existingTaskBlocks = allBlocks.filter((b) => b.taskId === id);

        if (update.scheduledStartTime) {
          const newDate = update.scheduledStartTime.slice(0, 10);

          // Step 1: 删除旧日期的所有该任务的 time_block
          for (const block of existingTaskBlocks) {
            if (block.startTime.slice(0, 10) !== newDate) {
              save(KEYS.timeBlocks, allBlocks.filter((b) => b.id !== block.id));
            }
          }

          // Step 2: 检查新日期是否已有 block，如果没有则创建
          const blocksForNewDate = allBlocks.filter((b) => b.startTime.slice(0, 10) === newDate);
          const hasExistingBlockInNewDate = blocksForNewDate.some((b) => b.taskId === id);

          if (!hasExistingBlockInNewDate) {
            const allTasks = load<Task[]>(KEYS.tasks, []);
            const task = allTasks.find((t) => t.id === id);
            if (task) {
              const startDate = new Date(update.scheduledStartTime);
              const endTimeStr = update.scheduledEndTime || task.scheduledEndTime;
              const endDate = endTimeStr
                ? new Date(endTimeStr)
                : new Date(startDate.getTime() + (task.estimatedMinutes || 60) * 60000);
              const durationMinutes = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60));
              const validCategories: Array<string> = ['开发', '工作', '学习', '会议', '休息', '娱乐', '运动', '阅读', '其他'];
              const category = (task.project && validCategories.includes(task.project)) ? task.project : '工作';

              const newBlock: TimeBlock = {
                id: uid(),
                title: task.title,
                startTime: startDate.toISOString(),
                endTime: endDate.toISOString(),
                durationMinutes,
                category: category as any,
                date: update.scheduledStartTime.slice(0, 10),
                completed: false,
                source: 'manual',
                taskId: id,
              };
              save(KEYS.timeBlocks, [...allBlocks, newBlock]);
            }
          }
        } else if (update.scheduledEndTime && existingTaskBlocks.length > 0) {
          // 只有 scheduledEndTime 更新：同步到已有的 block
          const block = existingTaskBlocks[0];
          const updatedBlocks = allBlocks.map((b) =>
            b.id === block.id
              ? {
                  ...b,
                  endTime: update.scheduledEndTime!,
                  durationMinutes: Math.round(
                    (new Date(update.scheduledEndTime!).getTime() - new Date(b.startTime).getTime()) / (1000 * 60)
                  ),
                }
              : b
          );
          save(KEYS.timeBlocks, updatedBlocks);
        }
      }

      const existing = load<Task[]>(KEYS.tasks, []);
      const idx = existing.findIndex((t) => t.id === id);
      if (idx >= 0) {
        existing[idx] = { ...existing[idx], ...update };
        save(KEYS.tasks, existing);
      }
    }
  },

  deleteTask: async (id: string): Promise<void> => {
    if (isDesktop()) {
      // 🚨 数据一致性：删除任务时，先级联删除所有关联的 time_blocks
      // 避免删除任务后，Timeline 中还留有指向不存在 taskId 的块
      try {
        // 查过去7天 + 未来7天，确保覆盖所有可能有该任务 block 的日期
        const daysToCheck = getDateRange(7);

        // ✅ 并行查询所有日期，性能优化
        const allBlocks = await Promise.all(daysToCheck.map(d => timeBlockIpc.getTimeBlocks(d)));
        const taskBlocks = allBlocks.flat().filter((b: TimeBlock) => b.taskId === id);

        // ✅ keepTaskSchedule = true: 任务本身就要被删除了，不需要再更新任务的 scheduled 字段
        for (const block of taskBlocks) {
          // 直接调用 IPC 层删除，options 参数由 dataService 自身处理，不传给 IPC
          await timeBlockIpc.deleteTimeBlock(block.id);
        }
      } catch (err) {
        console.error('Failed to cascade delete time blocks for task:', err);
      }
      await taskIpc.deleteTask(id);
    } else {
      // Delete associated time blocks first (cascade delete)
      const allTimeBlocks = load<TimeBlock[]>(KEYS.timeBlocks, []);
      const taskTimeBlockIds = new Set(allTimeBlocks.filter((b) => b.taskId === id).map(b => b.id));

      // ✅ 只 save 一次，而不是循环中多次 save
      save(
        KEYS.timeBlocks,
        allTimeBlocks.filter((b) => !taskTimeBlockIds.has(b.id))
      );

      // Then delete the task itself
      const existing = load<Task[]>(KEYS.tasks, []);
      save(
        KEYS.tasks,
        existing.filter((t) => t.id !== id)
      );
    }
  },

  // ============================================================
  // Habits
  // ============================================================
  getAllHabits: async (): Promise<Habit[]> => {
    if (isDesktop()) {
      return habitIpc.getAllHabits();
    }
    return load<Habit[]>(KEYS.habits, []);
  },

  createHabit: async (
    habit: Omit<Habit, 'id' | 'streak' | 'checkins' | 'createdAt'>
  ): Promise<Habit> => {
    const newHabit: Habit = {
      ...habit,
      id: uid(),
      streak: 0,
      checkins: {},
      createdAt: new Date().toISOString(),
    };
    if (isDesktop()) {
      return habitIpc.createHabit(newHabit);
    } else {
      const existing = load<Habit[]>(KEYS.habits, []);
      existing.push(newHabit);
      save(KEYS.habits, existing);
      return newHabit;
    }
  },

  updateHabit: async (id: string, update: Partial<Habit>): Promise<void> => {
    if (isDesktop()) {
      await habitIpc.updateHabit(id, update);
    } else {
      const existing = load<Habit[]>(KEYS.habits, []);
      const idx = existing.findIndex((h) => h.id === id);
      if (idx >= 0) {
        existing[idx] = { ...existing[idx], ...update };
        save(KEYS.habits, existing);
      }
    }
  },

  deleteHabit: async (id: string): Promise<void> => {
    if (isDesktop()) {
      await habitIpc.deleteHabit(id);
    } else {
      // Delete the habit itself
      const existing = load<Habit[]>(KEYS.habits, []);
      save(
        KEYS.habits,
        existing.filter((h) => h.id !== id)
      );
    }
  },

  recordCheckin: async (habitId: string, date: string, value: number): Promise<void> => {
    if (isDesktop()) {
      await habitIpc.recordCheckin(habitId, date, value);
    } else {
      const existing = load<Habit[]>(KEYS.habits, []);
      const idx = existing.findIndex((h) => h.id === habitId);
      if (idx >= 0) {
        existing[idx].checkins[date] = value;
        save(KEYS.habits, existing);
      }
    }
  },

  // ============================================================
  // Focus Sessions
  // ============================================================
  getFocusSessions: async (date: string): Promise<FocusSession[]> => {
    if (isDesktop()) {
      return focusIpc.getFocusSessions(date);
    }
    return load<FocusSession[]>(KEYS.focusSessions, []).filter(
      (s) => s.startTime.slice(0, 10) === date
    );
  },

  getAllFocusSessions: async (): Promise<FocusSession[]> => {
    if (isDesktop()) {
      return focusIpc.getAllFocusSessions();
    }
    return load<FocusSession[]>(KEYS.focusSessions, []);
  },

  createFocusSession: async (session: Omit<FocusSession, 'id'>): Promise<FocusSession> => {
    const newSession = { ...session, id: uid() } as FocusSession;
    if (isDesktop()) {
      return focusIpc.createFocusSession(newSession);
    } else {
      const existing = load<FocusSession[]>(KEYS.focusSessions, []);
      existing.push(newSession);
      save(KEYS.focusSessions, existing);
      return newSession;
    }
  },

  updateFocusSession: async (id: string, update: Partial<FocusSession>): Promise<void> => {
    if (isDesktop()) {
      await focusIpc.updateFocusSession(id, update);
    } else {
      const existing = load<FocusSession[]>(KEYS.focusSessions, []);
      const idx = existing.findIndex((s) => s.id === id);
      if (idx >= 0) {
        existing[idx] = { ...existing[idx], ...update };
        save(KEYS.focusSessions, existing);
      }
    }
  },

  deleteFocusSession: async (id: string): Promise<void> => {
    if (isDesktop()) {
      await focusIpc.deleteFocusSession(id);
    } else {
      const existing = load<FocusSession[]>(KEYS.focusSessions, []);
      save(
        KEYS.focusSessions,
        existing.filter((s) => s.id !== id)
      );
    }
  },

  // ============================================================
  // Time Blocks
  // ============================================================
  getTimeBlocks: async (date: string): Promise<TimeBlock[]> => {
    if (isDesktop()) {
      return timeBlockIpc.getTimeBlocks(date);
    }
    return load<TimeBlock[]>(KEYS.timeBlocks, []).filter((b) => b.date === date);
  },

  addTimeBlock: async (block: Omit<TimeBlock, 'id'>): Promise<TimeBlock> => {
    const newBlock = { ...block, id: uid() } as TimeBlock;
    if (isDesktop()) {
      return timeBlockIpc.addTimeBlock(newBlock);
    } else {
      const existing = load<TimeBlock[]>(KEYS.timeBlocks, []);
      existing.push(newBlock);
      save(KEYS.timeBlocks, existing);
      return newBlock;
    }
  },

  updateTimeBlock: async (id: string, update: Partial<TimeBlock>): Promise<void> => {
    if (isDesktop()) {
      // 数据一致性：如果修改了 startTime 或 endTime，且该 block 关联了任务，同步更新任务
      if (update.startTime || update.endTime) {
        try {
          // 需要先查询 block 以获取 taskId（因为如果只改 endTime 我们无法从 update 推断日期）
          // 先尝试从 update.startTime 查，没有则用当前时间作为基准查当天+前后一天
          let block: TimeBlock | undefined;

          if (update.startTime) {
            const date = update.startTime.slice(0, 10);
            const blocksForDate = await timeBlockIpc.getTimeBlocks(date);
            block = blocksForDate.find((b: TimeBlock) => b.id === id);
          } else {
            // 只有 endTime 更新：查今天，昨天，明天以找到该 block
            const daysToCheck = getNearbyDays();
            const allBlocks = await Promise.all(daysToCheck.map(d => timeBlockIpc.getTimeBlocks(d)));
            block = allBlocks.flat().find((b: TimeBlock) => b.id === id);
          }

          if (block && block.taskId) {
            const taskUpdate: Partial<Task> = {};
            if (update.startTime) {
              taskUpdate.scheduledStartTime = update.startTime;
              taskUpdate.scheduledDate = update.startTime.slice(0, 10);
            }
            if (update.endTime) {
              taskUpdate.scheduledEndTime = update.endTime;
            }
            await taskIpc.updateTask(block.taskId, taskUpdate);
          }
        } catch (err) {
          console.error('Failed to sync task scheduled time:', err);
        }
      }
      await timeBlockIpc.updateTimeBlock(id, update);
    } else {
      const existingBlocks = load<TimeBlock[]>(KEYS.timeBlocks, []);
      const idx = existingBlocks.findIndex((b) => b.id === id);
      if (idx >= 0) {
        // 🚨 数据一致性（Web 分支）：如果修改了 startTime 或 endTime，且该 block 关联了任务，同步更新任务
        if ((update.startTime || update.endTime) && existingBlocks[idx].taskId) {
          const existingTasks = load<Task[]>(KEYS.tasks, []);
          const taskIdx = existingTasks.findIndex((t) => t.id === existingBlocks[idx].taskId);
          if (taskIdx >= 0) {
            if (update.startTime) {
              existingTasks[taskIdx] = {
                ...existingTasks[taskIdx],
                scheduledStartTime: update.startTime,
                scheduledDate: update.startTime.slice(0, 10),
              };
            }
            if (update.endTime) {
              existingTasks[taskIdx] = {
                ...existingTasks[taskIdx],
                scheduledEndTime: update.endTime,
              };
            }
            save(KEYS.tasks, existingTasks);
          }
        }
        existingBlocks[idx] = { ...existingBlocks[idx], ...update };
        save(KEYS.timeBlocks, existingBlocks);
      }
    }
  },

  deleteTimeBlock: async (
    id: string,
    options?: { taskId?: string; keepTaskSchedule?: boolean }
  ): Promise<void> => {
    if (isDesktop()) {
      // 🚨 数据一致性：如果有关联的任务且不是分割/合并操作，清除其 scheduled 字段
      // keepTaskSchedule = true 用于分割/合并等内部操作，此时只是重建 block 而不是真正解除任务排期
      if (options?.taskId && !options?.keepTaskSchedule) {
        try {
          await taskIpc.updateTask(options.taskId, {
            scheduledStartTime: undefined,
            scheduledEndTime: undefined,
            scheduledDate: undefined,
          } as any);
        } catch (err) {
          console.error('Failed to clear task scheduled time:', err);
        }
      }
      await timeBlockIpc.deleteTimeBlock(id);
    } else {
      // 🚨 数据一致性（Web 分支）：如果有关联的任务且不是分割/合并操作，清除其 scheduled 字段
      if (options?.taskId && !options?.keepTaskSchedule) {
        const existingTasks = load<Task[]>(KEYS.tasks, []);
        const taskIdx = existingTasks.findIndex((t) => t.id === options.taskId);
        if (taskIdx >= 0) {
          existingTasks[taskIdx] = {
            ...existingTasks[taskIdx],
            scheduledStartTime: undefined,
            scheduledEndTime: undefined,
            scheduledDate: undefined,
          };
          save(KEYS.tasks, existingTasks);
        }
      }
      const existing = load<TimeBlock[]>(KEYS.timeBlocks, []);
      save(
        KEYS.timeBlocks,
        existing.filter((b) => b.id !== id)
      );
    }
  },

  // ============================================================
  // Pet
  // ============================================================
  getPet: async (): Promise<Pet | null> => {
    if (isDesktop()) {
      return petIpc.getPet();
    }
    return load<Pet | null>(KEYS.pet, null);
  },

  savePet: async (pet: Pet): Promise<void> => {
    if (isDesktop()) {
      await petIpc.savePet(pet);
    } else {
      save(KEYS.pet, pet);
    }
  },

  // ============================================================
  // Settings
  // ============================================================
  getSettings: async (): Promise<AppSettings> => {
    if (isDesktop()) {
      return settingsIpc.getSettings();
    }
    return load<AppSettings>(KEYS.settings, {
      theme: 'system',
      colorTheme: 'blue',
      backgroundSkin: 'solid',
      featureFlags: {},
      dailyGoalMinutes: 240,
      language: 'zh-CN',
    });
  },

  updateSettings: async (settings: Partial<AppSettings>): Promise<void> => {
    if (isDesktop()) {
      await settingsIpc.updateSettings(settings);
    } else {
      const current = await DataService.getSettings();
      save(KEYS.settings, { ...current, ...settings });
    }
  },

  // ============================================================
  // Demo seeding (only used for web demo)
  // ============================================================
  ensureSeeded: (): void => {
    const seeded = load<boolean>(KEYS.seeded, false);
    if (seeded) return;

    // Seed demo data
    // This is for web demo purposes only
    const activities = (() => {
      const result: Activity[] = [];
      const now = new Date();
      const activityTemplates: {
        name: string;
        category: ActivityCategory;
        minDur: number;
        maxDur: number;
      }[] = [
        { name: '前端开发 - React组件', category: '开发', minDur: 40, maxDur: 120 },
        { name: 'API接口开发', category: '开发', minDur: 30, maxDur: 90 },
        { name: 'Bug修复', category: '开发', minDur: 15, maxDur: 60 },
        { name: '代码审查', category: '工作', minDur: 20, maxDur: 45 },
        { name: '需求分析', category: '工作', minDur: 30, maxDur: 60 },
        { name: '文档编写', category: '工作', minDur: 20, maxDur: 50 },
        { name: '在线课程 - TypeScript', category: '学习', minDur: 25, maxDur: 60 },
        { name: '阅读技术博客', category: '学习', minDur: 15, maxDur: 40 },
        { name: '算法练习', category: '学习', minDur: 30, maxDur: 60 },
        { name: '站会', category: '会议', minDur: 10, maxDur: 20 },
        { name: '周例会', category: '会议', minDur: 30, maxDur: 60 },
        { name: '产品评审', category: '会议', minDur: 30, maxDur: 90 },
        { name: '午休', category: '休息', minDur: 30, maxDur: 60 },
        { name: '下午茶歇', category: '休息', minDur: 10, maxDur: 20 },
        { name: '看视频', category: '娱乐', minDur: 20, maxDur: 45 },
        { name: '打游戏', category: '娱乐', minDur: 30, maxDur: 60 },
        { name: '跑步', category: '运动', minDur: 20, maxDur: 45 },
        { name: '健身', category: '运动', minDur: 30, maxDur: 60 },
        { name: '阅读 - 《代码整洁之道》', category: '阅读', minDur: 20, maxDur: 50 },
        { name: '阅读 - 技术周刊', category: '阅读', minDur: 10, maxDur: 30 },
      ];

      let seed = 42;
      function rand(): number {
        seed = (seed * 16807 + 0) % 2147483647;
        return (seed - 1) / 2147483647;
      }
      function randInt(min: number, max: number): number {
        return Math.floor(rand() * (max - min + 1)) + min;
      }
      function pick<T>(arr: T[]): T {
        return arr[Math.floor(rand() * arr.length)];
      }

      for (let dayOffset = 13; dayOffset >= 0; dayOffset--) {
        const day = new Date(now);
        day.setDate(day.getDate() - dayOffset);
        const dateStr = toDateStr(day);
        const isWeekend = day.getDay() === 0 || day.getDay() === 6;

        const count = randInt(6, 10);
        let currentHour = isWeekend ? randInt(9, 10) : randInt(8, 9);
        let currentMin = randInt(0, 3) * 15;

        for (let i = 0; i < count; i++) {
          let template: (typeof activityTemplates)[number];
          if (currentHour >= 12 && currentHour < 13 && !isWeekend) {
            template = activityTemplates.find((t) => t.name === '午休')!;
          } else if (currentHour >= 15 && currentHour < 16 && rand() > 0.6 && !isWeekend) {
            template = activityTemplates.find((t) => t.name === '下午茶歇')!;
          } else if (isWeekend) {
            const weekendPool = activityTemplates.filter((t) =>
              ['开发', '工作', '会议', '学习', '娱乐', '运动', '阅读', '休息'].includes(t.category)
            );
            template = pick(weekendPool);
          } else if (currentHour < 10) {
            const morningPool = activityTemplates.filter((t) =>
              ['开发', '工作', '会议', '学习'].includes(t.category)
            );
            template = pick(morningPool);
          } else if (currentHour >= 18) {
            const eveningPool = activityTemplates.filter((t) =>
              ['学习', '娱乐', '运动', '阅读', '休息'].includes(t.category)
            );
            template = pick(eveningPool);
          } else {
            template = pick(activityTemplates);
          }

          const duration = randInt(template.minDur, template.maxDur);
          const startTime = `${dateStr}T${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}:00`;
          const endDate = new Date(startTime);
          endDate.setMinutes(endDate.getMinutes() + duration);
          const endTime = endDate.toISOString().replace('Z', '').split('.')[0];

          result.push({
            id: uid(),
            name: template.name,
            category: template.category,
            startTime,
            endTime,
            duration,
            isManual: rand() > 0.7,
          });

          currentMin += duration + randInt(5, 20);
          currentHour += Math.floor(currentMin / 60);
          currentMin = currentMin % 60;

          if (currentHour >= 22) break;
        }
      }

      return result;
    })();

    save(KEYS.activities, activities);
    save(
      KEYS.tasks,
      (() => {
        const now = new Date();
        const templates: Omit<Task, 'id' | 'createdAt'>[] = [
          {
            title: '完成用户登录页面重构',
            priority: 4,
            status: 'in_progress',
            estimatedMinutes: 180,
            actualMinutes: 95,
            project: '前端重构',
            subtasks: [
              { id: uid(), title: '设计新UI', completed: true },
              { id: uid(), title: '实现表单验证', completed: true },
              { id: uid(), title: '接入OAuth', completed: false },
            ],
            dueDate: toDateStr(new Date(now.getTime() + 2 * 86400000)),
            repeatType: 'none',
            firstStep: '打开Figma查看设计稿',
            emotionalTag: 'neutral',
          },
          {
            title: '编写单元测试 - 数据服务',
            priority: 3,
            status: 'todo',
            estimatedMinutes: 120,
            actualMinutes: 0,
            project: '前端重构',
            subtasks: [],
            dueDate: toDateStr(new Date(now.getTime() + 5 * 86400000)),
            repeatType: 'none',
            firstStep: '创建test文件',
            emotionalTag: 'resist',
          },
          {
            title: '每日站会',
            priority: 2,
            status: 'completed',
            estimatedMinutes: 15,
            actualMinutes: 12,
            project: '团队管理',
            subtasks: [],
            dueDate: toDateStr(now),
            repeatType: 'daily',
            firstStep: '准备昨日工作总结',
            emotionalTag: 'easy',
          },
          {
            title: '准备周五技术分享',
            priority: 3,
            status: 'in_progress',
            estimatedMinutes: 240,
            actualMinutes: 60,
            project: '个人成长',
            subtasks: [
              { id: uid(), title: '选定主题', completed: true },
              { id: uid(), title: '制作PPT', completed: false },
              { id: uid(), title: '准备Demo', completed: false },
            ],
            dueDate: toDateStr(new Date(now.getTime() + 4 * 86400000)),
            repeatType: 'none',
            firstStep: '确定分享主题',
            emotionalTag: 'neutral',
          },
          {
            title: '优化首页加载性能',
            priority: 5,
            status: 'todo',
            estimatedMinutes: 300,
            actualMinutes: 0,
            project: '前端重构',
            subtasks: [
              { id: uid(), title: '分析性能瓶颈', completed: false },
              { id: uid(), title: '实现代码分割', completed: false },
              { id: uid(), title: '图片懒加载', completed: false },
              { id: uid(), title: '性能测试', completed: false },
            ],
            dueDate: toDateStr(new Date(now.getTime() + 7 * 86400000)),
            repeatType: 'none',
            firstStep: '运行Lighthouse分析',
            emotionalTag: 'resist',
          },
          {
            title: '阅读《设计模式》第5章',
            priority: 2,
            status: 'todo',
            estimatedMinutes: 60,
            actualMinutes: 0,
            project: '个人成长',
            subtasks: [],
            dueDate: toDateStr(new Date(now.getTime() + 1 * 86400000)),
            repeatType: 'none',
            firstStep: '翻到第5章',
            emotionalTag: 'easy',
          },
          {
            title: '整理Jira看板',
            priority: 1,
            status: 'completed',
            estimatedMinutes: 30,
            actualMinutes: 25,
            project: '团队管理',
            subtasks: [],
            dueDate: toDateStr(now),
            repeatType: 'weekly',
            firstStep: '打开Jira页面',
            emotionalTag: 'easy',
          },
          {
            title: '修复移动端样式问题',
            priority: 4,
            status: 'in_progress',
            estimatedMinutes: 90,
            actualMinutes: 40,
            project: '前端重构',
            subtasks: [
              { id: uid(), title: '导航栏适配', completed: true },
              { id: uid(), title: '表格响应式', completed: false },
            ],
            dueDate: toDateStr(new Date(now.getTime() + 1 * 86400000)),
            repeatType: 'none',
            firstStep: '用Chrome开发者工具模拟手机',
            emotionalTag: 'neutral',
          },
          {
            title: '更新项目文档',
            priority: 2,
            status: 'todo',
            estimatedMinutes: 60,
            actualMinutes: 0,
            project: '前端重构',
            subtasks: [],
            dueDate: toDateStr(new Date(now.getTime() + 3 * 86400000)),
            repeatType: 'none',
            firstStep: '找到README.md位置',
            emotionalTag: 'easy',
          },
          {
            title: '复习英语单词',
            priority: 2,
            status: 'todo',
            estimatedMinutes: 30,
            actualMinutes: 0,
            project: '个人成长',
            subtasks: [],
            dueDate: toDateStr(now),
            repeatType: 'daily',
            firstStep: '打开背单词APP',
            emotionalTag: 'easy',
          },
          {
            title: '代码审查 - 用户模块',
            priority: 3,
            status: 'paused',
            estimatedMinutes: 45,
            actualMinutes: 15,
            project: '团队管理',
            subtasks: [],
            dueDate: toDateStr(new Date(now.getTime() + 3 * 86400000)),
            repeatType: 'none',
            firstStep: '找到PR链接',
            emotionalTag: 'neutral',
          },
          {
            title: '数据库架构设计评审',
            priority: 4,
            status: 'archived',
            estimatedMinutes: 120,
            actualMinutes: 90,
            project: '后端开发',
            subtasks: [],
            dueDate: toDateStr(new Date(now.getTime() - 5 * 86400000)),
            repeatType: 'none',
            emotionalTag: 'neutral',
          },
        ];

        return templates.map((t, i) => ({
          ...t,
          id: uid(),
          createdAt: new Date(new Date(now).getTime() - 14 * 86400000 + i * 86400000).toISOString(),
        }));
      })()
    );

    // Seed time blocks with task associations for today
    save(
      KEYS.timeBlocks,
      (() => {
        const now = new Date();
        const today = toDateStr(now);
        const tasks = load<Task[]>(KEYS.tasks, []);
        const blocks: TimeBlock[] = [];

        // Add a task time block for the first 2 tasks (scheduled for today)
        if (tasks.length >= 2) {
          // Task 1: 10:00 - 11:30
          blocks.push({
            id: uid(),
            title: tasks[0].title,
            category: '工作',
            startTime: `${today}T10:00:00`,
            endTime: `${today}T11:30:00`,
            durationMinutes: 90,
            date: today,
            completed: true,
            source: 'confirmed',
            taskId: tasks[0].id,
            isTaskTimer: true,
          });

          // Task 2: 14:00 - 15:00
          blocks.push({
            id: uid(),
            title: tasks[1].title,
            category: '开发',
            startTime: `${today}T14:00:00`,
            endTime: `${today}T15:00:00`,
            durationMinutes: 60,
            date: today,
            completed: false,
            source: 'confirmed',
            taskId: tasks[1].id,
            isTaskTimer: true,
          });

          // Update tasks to have scheduled times
          tasks[0].scheduledStartTime = `${today}T10:00:00`;
          tasks[0].scheduledDate = today;
          tasks[1].scheduledStartTime = `${today}T14:00:00`;
          tasks[1].scheduledDate = today;
          save(KEYS.tasks, tasks);
        }

        return blocks;
      })()
    );

    save(KEYS.seeded, true);
  },

  clearAllData: async (): Promise<void> => {
    // Clear all localStorage data (web demo mode)
    Object.values(KEYS).forEach((key) => localStorage.removeItem(key));

    // Desktop mode: nothing extra needed as data lives in localStorage for now
    // Native SQLite clearing would be implemented later if needed
  },
};

export default DataService;
