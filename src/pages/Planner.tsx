import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { Modal, Button, Progress, Badge, EmptyState, Input } from '../components/ui';
import { useAppStore } from '../store/useAppStore';
import type { Task, Subtask, TaskStatus, RepeatType } from '../services/dataService';
import useTheme from '../hooks/useTheme';
import { PRIORITY_COLORS } from '../config/themes';
import TaskPanel from '../components/TaskPanel';

// --- Types & Constants ---

type FilterTab = 'all' | 'pending' | 'in_progress' | 'completed';
type ViewMode = 'list' | 'board' | 'calendar' | 'timeline';

const FILTER_LABELS: Record<FilterTab, string> = {
  all: 'planner.views.all',
  pending: 'planner.views.pending',
  in_progress: 'planner.views.inProgress',
  completed: 'planner.views.completed',
};

const VIEW_LABELS: Record<ViewMode, string> = {
  list: 'planner.views.list',
  board: 'planner.views.kanban',
  calendar: 'planner.views.calendar',
  timeline: 'planner.views.timeline',
};

const VIEW_ICONS: Record<ViewMode, string> = {
  list: 'M3 4h10M3 8h10M3 12h10',
  board: 'M3 3h4v10H3zM9 3h4v7H9z',
  calendar: 'M3 5h10v8H3zM5 3v2M9 3v2',
  timeline: 'M2 8h12M4 5h3v6H4zM9 6h3v4H9z',
};

const REPEAT_LABELS: Record<RepeatType, string> = {
  none: 'planner.repeat.none',
  daily: 'planner.repeat.daily',
  weekly: 'planner.repeat.weekly',
  monthly: 'planner.repeat.monthly',
};

// --- Helpers ---

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtDuration(mins: number, t?: (key: string) => string): string {
  const unitMins = t ? t('common.minutes') : 'm';
  const unitHours = t ? t('common.hours') : 'h';
  if (mins <= 0) return `0${unitMins}`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h > 0) return `${h}${unitHours}${m > 0 ? ` ${m}${unitMins}` : ''}`;
  return `${m}${unitMins}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function dateStr(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00');
  const db = new Date(b + 'T00:00:00');
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

function getHeatmapBg(count: number): string {
  if (count <= 0) return 'var(--color-bg-surface-2)';
  const opacity = count === 1 ? 25 : count === 2 ? 40 : count >= 3 ? 60 : 25;
  return `color-mix(in srgb, var(--color-accent) ${opacity}%, var(--color-bg-surface-2))`;
}

// --- Form state ---

interface TaskForm {
  title: string;
  priority: 1 | 2 | 3 | 4 | 5;
  project: string;
  estimatedMinutes: number;
  dueDate: string;
  repeatType: RepeatType;
  subtasks: Subtask[];
}

const EMPTY_FORM: TaskForm = {
  title: '',
  priority: 3,
  project: '',
  estimatedMinutes: 60,
  dueDate: todayStr(),
  repeatType: 'none',
  subtasks: [],
};

// ============================================================
// Main Component
// ============================================================

export default function Planner() {
  const { t } = useTranslation();
  const { accentColor } = useTheme();

  const tasks = useAppStore((s) => s.tasks);
  const loadTasks = useAppStore((s) => s.loadTasks);
  const addTask = useAppStore((s) => s.addTask);
  const updateTask = useAppStore((s) => s.updateTask);
  const deleteTask = useAppStore((s) => s.deleteTask);
  const reorderTasks = useAppStore((s) => s.reorderTasks);
  const activities = useAppStore((s) => s.activities);

  // 计算每个任务的实际投入时间
  const taskActualTimeMap = useMemo(() => {
    const map: Record<string, number> = {};
    activities.forEach((a: any) => {
      if (a.taskId) {
        map[a.taskId] = (map[a.taskId] || 0) + (a.duration || 0);
      }
    });
    return map;
  }, [activities]);

  const habits = useAppStore((s) => s.habits);
  const loadHabits = useAppStore((s) => s.loadHabits);

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [filter, setFilter] = useState<FilterTab>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId] = useState<string | null>(null);
  const [form, setForm] = useState<TaskForm>({ ...EMPTY_FORM });
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // 快速创建相关 state
  const [quickAddTitle, setQuickAddTitle] = useState('');

  // 信息密度视图模式
  type DensityMode = 'single' | 'today' | 'all';
  const [densityMode, setDensityMode] = useState<DensityMode>('today');

  // 未来任务折叠状态
  const [showFutureTasks, setShowFutureTasks] = useState(false);

  // 共情弹窗状态
  const [showEmpathyModal, setShowEmpathyModal] = useState(false);
  const [empathyTaskId, setEmpathyTaskId] = useState<string | null>(null);

  // 庆祝动画状态
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationTaskTitle, setCelebrationTaskTitle] = useState('');

  // 统一任务面板
  const [taskPanelOpen, setTaskPanelOpen] = useState(false);
  const [taskPanelMode, setTaskPanelMode] = useState<'create' | 'view' | 'edit'>('create');
  const [taskPanelTask, setTaskPanelTask] = useState<Task | null>(null);

  // Calendar state
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState(todayStr());

  useEffect(() => {
    loadTasks();
    loadHabits();
  }, [loadTasks, loadHabits]);

  // --- 密度模式任务过滤 ---
  const densityFilteredTasks = useMemo(() => {
    const today = todayStr();

    if (densityMode === 'today') {
      // 只显示今天的任务，排除已归档
      return tasks.filter((t) => t.dueDate === today && t.status !== 'archived');
    }

    if (densityMode === 'single') {
      // 单任务模式：返回 AI 推荐的最高优先级任务
      // 优先选择进行中 > 高优先级 > 今天截止
      const pending = tasks.filter((t) => t.status !== 'completed' && t.status !== 'archived');
      if (pending.length === 0) return [];
      return [pending.sort((a, b) => b.priority - a.priority)[0]];
    }

    // All 模式：显示所有任务（排除已归档）
    return tasks.filter((t) => t.status !== 'archived');
  }, [tasks, densityMode]);

  // --- filtered tasks (for status filtering) ---
  const filtered = densityFilteredTasks.filter((t) => {
    if (filter === 'all') return true;
    return t.status === filter;
  });

  // --- Kanban columns ---
  const boardColumns = useMemo(
    () => ({
      todo: filtered.filter((t) => t.status === 'todo'),
      in_progress: filtered.filter((t) => t.status === 'in_progress'),
      paused: filtered.filter((t) => t.status === 'paused'),
      completed: filtered.filter((t) => t.status === 'completed'),
      archived: filtered.filter((t) => t.status === 'archived'),
    }),
    [filtered]
  );

  // --- Calendar grid ---
  const calendarDays = useMemo(() => {
    const firstDay = new Date(calYear, calMonth - 1, 1);
    const daysInMonth = new Date(calYear, calMonth, 0).getDate();
    let startWeekday = firstDay.getDay() - 1;
    if (startWeekday < 0) startWeekday = 6;
    const cells: (number | null)[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }, [calYear, calMonth]);

  // Tasks grouped by due date for calendar
  const tasksByDate = useMemo(() => {
    const map: Record<string, Task[]> = {};
    tasks.forEach((t) => {
      if (t.dueDate) {
        if (!map[t.dueDate]) map[t.dueDate] = [];
        map[t.dueDate].push(t);
      }
    });
    return map;
  }, [tasks]);

  // Habit checkins by date for calendar heatmap
  const habitCheckinsByDate = useMemo(() => {
    const map: Record<string, number> = {};
    habits.forEach((h) => {
      Object.entries(h.checkins).forEach(([date, count]) => {
        map[date] = (map[date] || 0) + count;
      });
    });
    return map;
  }, [habits]);

  // Get habits checked on selected date
  const checkedHabitsOnSelectedDate = useMemo(() => {
    return habits.filter((h) => h.checkins[selectedDate] > 0);
  }, [habits, selectedDate]);

  // --- Timeline range ---
  const timelineData = useMemo(() => {
    const sorted = [...tasks]
      .filter((t) => t.dueDate)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    if (sorted.length === 0)
      return { tasks: sorted, startDate: todayStr(), endDate: todayStr(), totalDays: 14 };
    const earliest = sorted.reduce((min, t) => {
      const created = t.createdAt.slice(0, 10);
      return created < min ? created : min;
    }, sorted[0].dueDate);
    const latest = sorted.reduce(
      (max, t) => (t.dueDate > max ? t.dueDate : max),
      sorted[0].dueDate
    );
    const startDate = earliest < todayStr() ? earliest : todayStr();
    const endDateRaw = latest > todayStr() ? latest : todayStr();
    // Add 2 days padding
    const endD = new Date(endDateRaw + 'T00:00:00');
    endD.setDate(endD.getDate() + 2);
    const endDate = `${endD.getFullYear()}-${pad2(endD.getMonth() + 1)}-${pad2(endD.getDate())}`;
    const totalDays = Math.max(14, daysBetween(startDate, endDate) + 1);
    return { tasks: sorted, startDate, endDate, totalDays };
  }, [tasks]);

  // --- Modal handlers ---
  const openAdd = useCallback((_presetDate?: string) => {
    setTaskPanelTask(null);
    setTaskPanelMode('create');
    setTaskPanelOpen(true);
  }, []);

  const openEdit = useCallback((task: Task) => {
    setTaskPanelTask(task);
    setTaskPanelMode('view');
    setTaskPanelOpen(true);
  }, []);

  const handleSave = useCallback(() => {
    if (!form.title.trim()) return;
    if (editingId) {
      updateTask(editingId, {
        title: form.title.trim(),
        priority: form.priority,
        project: form.project.trim(),
        estimatedMinutes: form.estimatedMinutes,
        dueDate: form.dueDate,
        repeatType: form.repeatType,
        subtasks: form.subtasks,
      });
    } else {
      addTask({
        title: form.title.trim(),
        priority: form.priority,
        status: 'todo',
        estimatedMinutes: form.estimatedMinutes,
        actualMinutes: 0,
        project: form.project.trim(),
        subtasks: form.subtasks,
        dueDate: form.dueDate,
        repeatType: form.repeatType,
        createdAt: new Date().toISOString(),
        timeLoggedMinutes: 0,
      });
    }
    setModalOpen(false);
  }, [editingId, form, addTask, updateTask]);

  const cycleStatus = useCallback(
    (task: Task) => {
      const order: TaskStatus[] = ['todo', 'in_progress', 'completed'];
      const idx = order.indexOf(task.status);
      if (idx >= 0) {
        const newStatus = order[(idx + 1) % 3];
        updateTask(task.id, { status: newStatus });
        // 触发庆祝动画
        if (newStatus === 'completed') {
          setCelebrationTaskTitle(task.title);
          setShowCelebration(true);
          setTimeout(() => setShowCelebration(false), 3000);
        }
      } else {
        // For paused or archived, cycle to todo
        updateTask(task.id, { status: 'todo' });
      }
    },
    [updateTask]
  );

  // 快速创建任务处理函数
  // 自然语言日期解析函数
  const parseDateFromText = (text: string): string => {
    const today = todayStr();
    const now = new Date();

    // 今天
    if (/今天/.test(text)) {
      return today;
    }

    // 明天
    if (/明天/.test(text)) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return dateStr(tomorrow.getFullYear(), tomorrow.getMonth() + 1, tomorrow.getDate());
    }

    // 后天
    if (/后天/.test(text)) {
      const d = new Date(now);
      d.setDate(d.getDate() + 2);
      return dateStr(d.getFullYear(), d.getMonth() + 1, d.getDate());
    }

    // 下周X
    const weekDayMatch = text.match(/下周([一二三四五六日])/);
    if (weekDayMatch) {
      const weekDays: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 0 };
      const targetDay = weekDays[weekDayMatch[1]];
      const currentDay = now.getDay();
      const daysToAdd = (7 - currentDay + targetDay) % 7 || 7;
      const d = new Date(now);
      d.setDate(d.getDate() + daysToAdd);
      return dateStr(d.getFullYear(), d.getMonth() + 1, d.getDate());
    }

    // 具体日期：5-2 / 2026-05-02
    const dateMatch = text.match(
      /(\d{1,4})[-年](\d{1,2})[-月](\d{1,2})日?|(\d{1,2})[-月](\d{1,2})日?/
    );
    if (dateMatch) {
      if (dateMatch[1] && dateMatch[2] && dateMatch[3]) {
        // YYYY-MM-DD or YY-MM-DD or YYYY年M月D日
        let year = parseInt(dateMatch[1]);
        if (year < 100) year += 2000;
        return dateStr(year, parseInt(dateMatch[2]), parseInt(dateMatch[3]));
      } else if (dateMatch[4] && dateMatch[5]) {
        // MM-DD or M月D日
        return dateStr(now.getFullYear(), parseInt(dateMatch[4]), parseInt(dateMatch[5]));
      }
    }

    return today;
  };

  const handleQuickCreate = useCallback(() => {
    if (!quickAddTitle.trim()) return;

    const title = quickAddTitle.trim();
    let priority = 3;
    let estimatedMinutes = 60;
    let dueDate = todayStr();
    let firstStep = '';

    // 完整的自然语言解析
    // 1. 提取优先级 P1-P5
    const priorityMatch = title.match(/P([0-5])/i);
    if (priorityMatch) {
      priority = parseInt(priorityMatch[1]);
    }

    // 2. 提取时间（分钟）：30分钟 / 45m / 1h / 1.5小时
    const timeMatch = title.match(/(\d+(?:\.\d+)?)\s*(分钟|m|小时|h)/i);
    if (timeMatch) {
      const num = parseFloat(timeMatch[1]);
      const unit = timeMatch[2].toLowerCase();
      estimatedMinutes = Math.round(unit === 'h' || unit === '小时' ? num * 60 : num);
    }

    // 3. 提取日期
    dueDate = parseDateFromText(title);

    // 4. 提取第一步：第一步 xxx / 先 xxx
    const firstStepMatch = title.match(/(?:第一步[:：]?|先)\s*(.+)/i);
    if (firstStepMatch) {
      firstStep = firstStepMatch[1].trim();
    }

    // 清理标题中的所有解析标记
    let cleanTitle = title
      .replace(/P[0-5]/i, '')
      .replace(/(\d+(?:\.\d+)?)\s*(分钟|m|小时|h)/i, '')
      .replace(/今天|明天|后天|下周[一二三四五六日]/g, '')
      .replace(/(\d{1,4})[-年](\d{1,2})[-月](\d{1,2})日?|(\d{1,2})[-月](\d{1,2})日?/g, '')
      .replace(/(?:第一步[:：]?|先)\s*.+/i, '')
      .trim();

    // 创建任务
    addTask({
      title: cleanTitle,
      priority: priority as 1 | 2 | 3 | 4 | 5,
      status: 'todo',
      estimatedMinutes,
      dueDate,
      firstStep,
      subtasks: firstStep ? [{ id: crypto.randomUUID(), title: firstStep, completed: false }] : [],
      createdAt: new Date().toISOString(),
      timeLoggedMinutes: 0,
      actualMinutes: 0,
      project: '',
      repeatType: 'none',
      emotionalTag: undefined,
    });

    // 重置输入但保持输入框打开（方便连续创建）
    setQuickAddTitle('');
  }, [quickAddTitle, addTask, todayStr]);

  const handleDelete = useCallback(
    (id: string) => {
      deleteTask(id);
      setConfirmDeleteId(null);
    },
    [deleteTask]
  );

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Subtask form helpers
  const addFormSubtask = useCallback(() => {
    if (!newSubtaskTitle.trim()) return;
    setForm((f) => ({
      ...f,
      subtasks: [
        ...f.subtasks,
        { id: crypto.randomUUID(), title: newSubtaskTitle.trim(), completed: false },
      ],
    }));
    setNewSubtaskTitle('');
  }, [newSubtaskTitle]);

  const toggleFormSubtask = useCallback((sid: string) => {
    setForm((f) => ({
      ...f,
      subtasks: f.subtasks.map((s) => (s.id === sid ? { ...s, completed: !s.completed } : s)),
    }));
  }, []);

  const removeFormSubtask = useCallback((sid: string) => {
    setForm((f) => ({ ...f, subtasks: f.subtasks.filter((s) => s.id !== sid) }));
  }, []);

  // Calendar nav
  const prevMonth = useCallback(() => {
    if (calMonth === 1) {
      setCalMonth(12);
      setCalYear((y) => y - 1);
    } else setCalMonth((m) => m - 1);
  }, [calMonth]);

  const nextMonth = useCallback(() => {
    if (calMonth === 12) {
      setCalMonth(1);
      setCalYear((y) => y + 1);
    } else setCalMonth((m) => m + 1);
  }, [calMonth]);

  // --- DnD for task reordering in board view ---
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (_event: DragStartEvent) => {};

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      // Get full task list with correct order for the current column
      const activeStatus =
        boardColumns[active.data.current?.sortable.containerId as keyof typeof boardColumns];
      const overStatus =
        boardColumns[over.data.current?.sortable.containerId as keyof typeof boardColumns];

      if (activeStatus === overStatus) {
        // Same column reorder
        const oldIndex = activeStatus.findIndex((t) => t.id === active.id);
        const newIndex = overStatus.findIndex((t) => t.id === over.id);
        const newTasks = arrayMove(filtered, oldIndex, newIndex);
        reorderTasks(newTasks);
      }
    }
  };

  // ============================================================
  // RENDER
  // ============================================================

  // --- Sortable Task Card for DnD ---
  function SortableTaskCard({
    task,
    containerId,
    onToggleStatus,
    onEdit,
  }: {
    task: Task;
    index: number;
    containerId: string;
    onToggleStatus: (task: Task) => void;
    onEdit: (task: Task) => void;
  }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id: task.id,
      data: { containerId },
    });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.3 : 1,
      cursor: isDragging ? 'grabbing' : 'grab',
      background: 'linear-gradient(135deg, var(--color-bg-surface-1) 0%, #fef8f0 100%)',
      border: '1px solid var(--color-border-subtle)',
      borderLeft: `3px solid ${PRIORITY_COLORS[task.priority]}`,
      boxShadow: 'var(--shadow-card)',
    };

    return (
      <div
        ref={setNodeRef}
        style={style}
        className="flex flex-col items-start gap-2 px-3 py-2.5 rounded-[var(--radius-md)] cursor-pointer transition-all duration-200"
        onClick={() => onEdit(task)}
        onMouseEnter={(e) => {
          if (!isDragging) {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = 'var(--shadow-card-hover)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isDragging) {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'var(--shadow-card)';
          }
        }}
        {...attributes}
        {...listeners}
      >
        <div className="flex items-start justify-between gap-2 mb-1.5 w-full">
          <span className="text-sm font-semibold text-[var(--color-text-primary)] leading-snug">
            {task.title}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleStatus(task);
            }}
            className="cursor-pointer flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-all"
            style={{
              border: task.status === 'completed' ? 'none' : '2px solid var(--color-border-subtle)',
              background: task.status === 'completed' ? 'var(--color-accent)' : 'transparent',
            }}
          >
            {task.status === 'completed' && (
              <svg
                width="10"
                height="10"
                viewBox="0 0 12 12"
                fill="none"
                stroke="#fff"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M2 6l3 3 5-5" />
              </svg>
            )}
          </button>
        </div>
        <div className="flex items-center gap-2 flex-wrap w-full">
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ backgroundColor: PRIORITY_COLORS[task.priority] }}
          />
          {task.project && <Badge variant="accent">{task.project}</Badge>}
          {task.dueDate && (
            <span className="text-[10px] text-[var(--color-text-muted)]">{task.dueDate}</span>
          )}
        </div>
        {task.subtasks.length > 0 && (
          <div className="mt-2 flex items-center gap-1.5 w-full">
            <Progress
              value={(task.subtasks.filter((s) => s.completed).length / task.subtasks.length) * 100}
              size="sm"
              className="w-12"
            />
            <span className="text-[10px] text-[var(--color-text-muted)]">
              {task.subtasks.filter((s) => s.completed).length}/{task.subtasks.length}
            </span>
          </div>
        )}
      </div>
    );
  }

  // ============================================================
  // 今日进度统计

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      {/* ── Header - Macaron 设计风格 ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-3xl font-bold mb-1"
            style={{ color: 'var(--color-text-primary)', fontFamily: 'Quicksand, sans-serif' }}
          >
            Tasks
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {tasks.length} 个任务
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* 视图切换下拉 */}
          <div
            className="px-4 py-2.5 rounded-2xl flex items-center gap-2 cursor-pointer transition-all"
            style={{
              background: 'var(--color-bg-surface-1)',
              border: '2px solid var(--color-border-strong)',
              boxShadow: '3px 3px 0px var(--color-border-strong)',
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="var(--color-text-secondary)"
              strokeWidth="2"
            >
              <path d="M2 4h12M2 8h12M2 12h12" />
            </svg>
            <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              列表
            </span>
            <span style={{ color: 'var(--color-text-muted)' }}>▼</span>
          </div>
          {/* 添加任务按钮 */}
          <button
            onClick={() => {
              setTaskPanelTask(null);
              setTaskPanelMode('create');
              setTaskPanelOpen(true);
            }}
            className="px-5 py-2.5 rounded-2xl font-semibold text-white flex items-center gap-2 transition-all duration-200"
            style={{
              background: 'linear-gradient(135deg, var(--color-blue) 0%, var(--color-purple) 100%)',
              border: '2px solid var(--color-blue)',
              boxShadow: '3px 3px 0px rgba(59, 130, 246, 0.3)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '4px 4px 0px rgba(59, 130, 246, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '3px 3px 0px rgba(59, 130, 246, 0.3)';
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M8 3v10M3 8h10" />
            </svg>
            添加任务
          </button>
        </div>
      </div>

      {/* ── 状态筛选标签 - Macaron 风格 ── */}
      {densityMode !== 'single' && (
        <div className="flex gap-3 mb-6 flex-wrap">
          {[
            { key: 'all', label: '全部', color: 'var(--color-blue)' },
            { key: 'in_progress', label: '进行中', color: 'var(--color-lemon)' },
            { key: 'todo', label: '待办', color: 'var(--color-purple)' },
            { key: 'paused', label: '已暂停', color: 'var(--color-orange)' },
            { key: 'completed', label: '已完成', color: 'var(--color-green)' },
            { key: 'archived', label: '已归档', color: 'var(--color-text-muted)' },
          ].map(({ key, label, color }) => (
            <button
              key={key}
              onClick={() => setFilter(key as any)}
              className="px-5 py-2.5 rounded-2xl font-semibold transition-all duration-200"
              style={{
                background: filter === key ? color : 'var(--color-bg-surface-1)',
                color: filter === key ? '#fff' : 'var(--color-text-secondary)',
                border:
                  filter === key ? `2px solid ${color}` : '2px solid var(--color-border-strong)',
                boxShadow:
                  filter === key
                    ? `3px 3px 0px ${color}40`
                    : '3px 3px 0px var(--color-border-strong)',
                transform: filter === key ? 'translateY(-2px)' : 'translateY(0)',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* ── 信息密度切换器 - Single Task / Today / All ── */}
      <div className="flex items-center justify-center mb-5">
        <div
          className="inline-flex items-center gap-1 p-1 rounded-xl"
          style={{
            background: 'var(--color-bg-surface-2)',
            border: '1px solid var(--color-border-light)',
          }}
        >
          <button
            onClick={() => setDensityMode('single')}
            className="cursor-pointer inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold transition-all duration-200"
            style={{
              borderRadius: 'var(--radius-md)',
              background: densityMode === 'single' ? 'var(--color-purple)' : 'transparent',
              color: densityMode === 'single' ? '#fff' : 'var(--color-text-secondary)',
              boxShadow: densityMode === 'single' ? '0 2px 8px rgba(147, 51, 234, 0.2)' : 'none',
            }}
          >
            <span>🎯</span>
            <span>Single Task</span>
          </button>
          <button
            onClick={() => setDensityMode('today')}
            className="cursor-pointer inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold transition-all duration-200"
            style={{
              borderRadius: 'var(--radius-md)',
              background: densityMode === 'today' ? 'var(--color-blue)' : 'transparent',
              color: densityMode === 'today' ? '#fff' : 'var(--color-text-secondary)',
              boxShadow: densityMode === 'today' ? '0 2px 8px rgba(59, 130, 246, 0.2)' : 'none',
            }}
          >
            <span>📋</span>
            <span>Today</span>
          </button>
          <button
            onClick={() => setDensityMode('all')}
            className="cursor-pointer inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold transition-all duration-200"
            style={{
              borderRadius: 'var(--radius-md)',
              background: densityMode === 'all' ? 'var(--color-green)' : 'transparent',
              color: densityMode === 'all' ? '#fff' : 'var(--color-text-secondary)',
              boxShadow: densityMode === 'all' ? '0 2px 8px rgba(34, 197, 94, 0.2)' : 'none',
            }}
          >
            <span>📂</span>
            <span>All</span>
          </button>
        </div>
      </div>

      {/* ── 自然语言快速创建输入框（永久显示在顶部） ── */}
      <div
        className="mb-6 p-4 rounded-2xl transition-all duration-200 hover:shadow-md"
        style={{
          background: 'var(--color-bg-surface-1)',
          border: '2px solid var(--color-border-strong)',
          boxShadow: '4px 4px 0px var(--color-border-strong)',
        }}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">🔍</span>
          <input
            type="text"
            placeholder="今天要做什么？按回车快速创建..."
            className="flex-1 bg-transparent outline-none text-base font-medium"
            style={{ color: 'var(--color-text-primary)' }}
            value={quickAddTitle}
            onChange={(e) => setQuickAddTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleQuickCreate()}
            autoFocus
          />
        </div>
        <div className="mt-2 ml-9 text-xs" style={{ color: 'var(--color-text-muted)' }}>
          💡 试试自然语言："明天下午3点 写报告 P1 45分钟 第一步先整理资料"
        </div>
      </div>

      {/* ── View Mode Switcher (List/Board/Calendar/Timeline) ── */}
      {densityMode !== 'single' && (
        <div className="flex items-center gap-2 mb-5">
          {(Object.keys(VIEW_LABELS) as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className="cursor-pointer inline-flex items-center gap-1.5 transition-all duration-200"
              style={{
                padding: '7px 14px',
                borderRadius: 'var(--radius-md)',
                fontSize: 13,
                fontWeight: 600,
                background: viewMode === mode ? 'var(--color-accent)' : 'var(--color-bg-surface-2)',
                color: viewMode === mode ? '#fff' : 'var(--color-text-secondary)',
                boxShadow:
                  viewMode === mode
                    ? '0 2px 8px rgba(44, 24, 16, 0.15)'
                    : 'inset 0 0 0 1px var(--color-border-subtle)',
                transform: viewMode === mode ? 'scale(1.03)' : 'scale(1)',
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d={VIEW_ICONS[mode]} />
              </svg>
              {t(VIEW_LABELS[mode])}
            </button>
          ))}
        </div>
      )}

      {/* ── Filter Tabs (for list & board) ── */}
      {(viewMode === 'list' || viewMode === 'board') && (
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {(Object.keys(FILTER_LABELS) as FilterTab[]).map((key) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className="cursor-pointer whitespace-nowrap transition-all duration-200"
              style={{
                padding: '6px 18px',
                borderRadius: 9999,
                fontSize: 13,
                fontWeight: 600,
                background: filter === key ? 'var(--color-accent)' : 'var(--color-accent-soft)',
                color: filter === key ? '#fff' : 'var(--color-text-secondary)',
                boxShadow: filter === key ? '0 2px 8px rgba(44, 24, 16, 0.12)' : 'none',
                transform: filter === key ? 'scale(1.04)' : 'scale(1)',
              }}
            >
              {t(FILTER_LABELS[key])}
            </button>
          ))}
        </div>
      )}

      {/* ── SINGLE TASK MODE ── */}
      {densityMode === 'single' && (
        <>
          {filtered.length === 0 ? (
            <div
              style={{
                background: 'linear-gradient(135deg, var(--color-bg-surface-1) 0%, #fef8f0 100%)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--color-border-subtle)',
                boxShadow: 'var(--shadow-card)',
                padding: '48px 24px',
                textAlign: 'center' as const,
              }}
            >
              <EmptyState
                icon="🎯"
                title="所有任务已完成"
                description="太棒了！创建新任务或休息一下吧"
                action={
                  <button
                    onClick={() => openAdd()}
                    className="cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white transition-all duration-200 rounded-2xl"
                    style={{
                      background:
                        'linear-gradient(135deg, var(--color-blue) 0%, var(--color-purple) 100%)',
                      border: '2px solid var(--color-blue)',
                      boxShadow: '3px 3px 0px rgba(59, 130, 246, 0.3)',
                    }}
                  >
                    创建新任务
                  </button>
                }
              />
            </div>
          ) : (
            <div>
              {/* 核心单任务卡片 - 聚焦模式 */}
              {filtered.map((task) => (
                <div
                  key={task.id}
                  className="p-8 rounded-2xl transition-all duration-300"
                  style={{
                    background: 'var(--color-bg-surface-1)',
                    border: '3px solid var(--color-purple)',
                    boxShadow: '8px 8px 0px var(--color-purple-shadow)',
                  }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: PRIORITY_COLORS[task.priority] }}
                      />
                      {task.project && <Badge variant="accent">{task.project}</Badge>}
                    </div>
                    <button
                      onClick={() => openEdit(task)}
                      className="text-sm"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      编辑 →
                    </button>
                  </div>

                  <h2
                    className="text-2xl font-bold mb-4"
                    style={{
                      color: 'var(--color-text-primary)',
                      fontFamily: 'Quicksand, sans-serif',
                    }}
                  >
                    {task.title}
                  </h2>

                  {/* AI 推荐的第一步 */}
                  {(task.firstStep || task.subtasks.length > 0) && (
                    <div
                      className="p-4 mb-6 rounded-xl"
                      style={{
                        background: 'var(--color-blue-soft)',
                        border: '1px solid var(--color-blue)',
                      }}
                    >
                      <p
                        className="text-sm font-medium mb-2"
                        style={{ color: 'var(--color-blue)' }}
                      >
                        💡 AI 推荐从这里开始
                      </p>
                      <p className="text-base" style={{ color: 'var(--color-text-primary)' }}>
                        {task.firstStep ||
                          task.subtasks.find((s) => !s.completed)?.title ||
                          '开始任务的第一步'}
                      </p>
                    </div>
                  )}

                  {/* 任务元数据 */}
                  <div
                    className="flex flex-wrap gap-4 mb-6 text-sm"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    <div className="flex items-center gap-1.5">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        <path d="M8 3v5l3 3" />
                        <circle cx="8" cy="8" r="7" />
                      </svg>
                      <span>预计 {fmtDuration(task.estimatedMinutes)}</span>
                    </div>
                    {task.dueDate && (
                      <div className="flex items-center gap-1.5">
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 16 16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        >
                          <rect x="2" y="3" width="12" height="11" rx="2" />
                          <path d="M6 1v2M10 1v2" />
                        </svg>
                        <span>{task.dueDate}</span>
                      </div>
                    )}
                    {task.subtasks.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 16 16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        >
                          <path d="M2 8h12M2 12h12M2 4h12" />
                        </svg>
                        <span>
                          {task.subtasks.filter((s) => s.completed).length}/{task.subtasks.length}{' '}
                          子任务
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 行动按钮 */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => cycleStatus(task)}
                      className="flex-1 px-6 py-3 rounded-xl font-semibold text-white transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
                      style={{
                        background:
                          task.status === 'completed'
                            ? 'var(--color-green)'
                            : 'linear-gradient(135deg, var(--color-purple) 0%, var(--color-blue) 100%)',
                        boxShadow: '4px 4px 0px var(--color-border-strong)',
                      }}
                    >
                      {task.status === 'completed' ? (
                        <>✓ 已完成</>
                      ) : task.status === 'in_progress' ? (
                        <>🔥 进行中 - 点击完成</>
                      ) : (
                        <>▶️ 开始任务</>
                      )}
                    </button>
                  </div>

                  {/* 「我不想做」按钮 */}
                  <div className="mt-4 text-center">
                    <button
                      onClick={() => {
                        setEmpathyTaskId(filtered[0]?.id || null);
                        setShowEmpathyModal(true);
                      }}
                      className="text-sm transition-all hover:opacity-80"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      😔 我不想做这个...
                    </button>
                  </div>
                </div>
              ))}

              {/* 其他待办任务预览 */}
              {tasks.filter((t) => t.status !== 'completed' && t.status !== 'archived').length >
                1 && (
                <div
                  className="mt-6 p-4 rounded-xl"
                  style={{
                    background: 'var(--color-bg-surface-1)',
                    border: '1px solid var(--color-border-light)',
                  }}
                >
                  <p
                    className="text-sm font-medium mb-3"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    📋 还有{' '}
                    {tasks.filter((t) => t.status !== 'completed' && t.status !== 'archived')
                      .length - 1}{' '}
                    个任务在等待
                  </p>
                  <button
                    onClick={() => setDensityMode('today')}
                    className="text-sm font-medium transition-all hover:opacity-80"
                    style={{ color: 'var(--color-blue)' }}
                  >
                    查看全部 →
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── LIST VIEW ── */}
      {densityMode !== 'single' &&
        viewMode === 'list' &&
        (filtered.length === 0 ? (
          <div
            style={{
              background: 'linear-gradient(135deg, var(--color-bg-surface-1) 0%, #fef8f0 100%)',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--color-border-subtle)',
              boxShadow: 'var(--shadow-card)',
              padding: '48px 24px',
              textAlign: 'center' as const,
            }}
          >
            <EmptyState
              icon="📋"
              title={t('planner.noTasks')}
              description={t('planner.noTasksHint')}
              action={
                <button
                  onClick={() => openAdd()}
                  className="cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white"
                  style={{ background: 'var(--color-accent)', borderRadius: 'var(--radius-md)' }}
                >
                  {t('planner.addTask')}
                </button>
              }
            />
          </div>
        ) : (
          <div className="space-y-3">
            {/* 今天 + 逾期的任务 */}
            {filtered.filter((t) => !t.dueDate || t.dueDate <= todayStr()).length > 0 && (
              <>
                <div
                  className="text-sm font-semibold mt-2 mb-1"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  今天及之前
                </div>
                {filtered
                  .filter((t) => !t.dueDate || t.dueDate <= todayStr())
                  .map((task, idx) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      expanded={expandedIds.has(task.id)}
                      confirmDelete={confirmDeleteId === task.id}
                      onToggleStatus={() => cycleStatus(task)}
                      onEdit={() => openEdit(task)}
                      onDelete={() => setConfirmDeleteId(task.id)}
                      onConfirmDelete={() => handleDelete(task.id)}
                      onCancelDelete={() => setConfirmDeleteId(null)}
                      onToggleExpand={() => toggleExpand(task.id)}
                      onToggleSubtask={(sid) => {
                        const st = task.subtasks.map((s) =>
                          s.id === sid ? { ...s, completed: !s.completed } : s
                        );
                        updateTask(task.id, { subtasks: st });
                      }}
                      accentColor={accentColor}
                      index={idx}
                    />
                  ))}
              </>
            )}

            {/* 未来的任务 - 默认折叠 */}
            {filtered.filter((t) => t.dueDate && t.dueDate > todayStr()).length > 0 && (
              <>
                <div
                  className="text-sm font-semibold mt-4 mb-1 cursor-pointer flex items-center gap-2 select-none"
                  style={{ color: 'var(--color-text-muted)' }}
                  onClick={() => setShowFutureTasks(!showFutureTasks)}
                >
                  <span>{showFutureTasks ? '▼' : '▶'}</span>
                  以后 ({filtered.filter((t) => t.dueDate && t.dueDate > todayStr()).length} 个任务)
                </div>
                {showFutureTasks &&
                  filtered
                    .filter((t) => t.dueDate && t.dueDate > todayStr())
                    .map((task, idx) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        expanded={expandedIds.has(task.id)}
                        confirmDelete={confirmDeleteId === task.id}
                        onToggleStatus={() => cycleStatus(task)}
                        onEdit={() => openEdit(task)}
                        onDelete={() => setConfirmDeleteId(task.id)}
                        onConfirmDelete={() => handleDelete(task.id)}
                        onCancelDelete={() => setConfirmDeleteId(null)}
                        onToggleExpand={() => toggleExpand(task.id)}
                        onToggleSubtask={(sid) => {
                          const st = task.subtasks.map((s) =>
                            s.id === sid ? { ...s, completed: !s.completed } : s
                          );
                          updateTask(task.id, { subtasks: st });
                        }}
                        accentColor={accentColor}
                        index={idx}
                      />
                    ))}
              </>
            )}
          </div>
        ))}

      {/* ── BOARD VIEW ── */}
      {densityMode !== 'single' && viewMode === 'board' && (
        <DndContext
          collisionDetection={closestCenter}
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {(
              [
                { key: 'todo' as const, labelKey: 'planner.views.pending', color: '#3b82f6' },
                {
                  key: 'in_progress' as const,
                  labelKey: 'planner.views.inProgress',
                  color: '#f59e0b',
                },
                { key: 'paused' as const, labelKey: 'planner.views.paused', color: '#8b5cf6' },
                {
                  key: 'completed' as const,
                  labelKey: 'planner.views.completed',
                  color: '#22c55e',
                },
              ] as const
            ).map(({ key, labelKey, color }) => (
              <div
                key={key}
                style={{
                  background: 'var(--color-bg-surface-1)',
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: 'var(--radius-xl)',
                  padding: '16px',
                  minHeight: 200,
                }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-sm font-bold text-[var(--color-text-primary)]">
                    {t(labelKey)}
                  </span>
                  <span className="text-xs text-[var(--color-text-muted)] ml-auto">
                    {boardColumns[key].length}
                  </span>
                </div>
                {boardColumns[key].length === 0 ? (
                  <p className="text-xs text-[var(--color-text-muted)] text-center py-8">
                    {t('planner.noTasks')}
                  </p>
                ) : (
                  <SortableContext
                    id={key}
                    items={boardColumns[key].map((t) => t.id)}
                    strategy={rectSortingStrategy}
                  >
                    <div className="space-y-2.5">
                      {boardColumns[key].map((task, idx) => (
                        <SortableTaskCard
                          key={task.id}
                          task={task}
                          index={idx}
                          containerId={key}
                          onToggleStatus={cycleStatus}
                          onEdit={openEdit}
                        />
                      ))}
                    </div>
                  </SortableContext>
                )}
              </div>
            ))}
          </div>
        </DndContext>
      )}

      {/* ── CALENDAR VIEW ── */}
      {densityMode !== 'single' && viewMode === 'calendar' && (
        <div>
          {/* Month nav */}
          <div className="flex items-center gap-4 mb-5">
            <button
              onClick={prevMonth}
              className="w-9 h-9 rounded-[var(--radius-md)] flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface-2)] transition-all cursor-pointer"
              style={{ boxShadow: 'inset 0 0 0 1px var(--color-border-subtle)' }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M10 4l-4 4 4 4" />
              </svg>
            </button>
            <h2 className="text-xl font-extrabold tracking-tight text-[var(--color-text-primary)] tabular-nums min-w-[8rem] text-center select-none">
              {calYear}
              {t('planner.year')}
              {calMonth}
              {t('planner.month')}
            </h2>
            <button
              onClick={nextMonth}
              className="w-9 h-9 rounded-[var(--radius-md)] flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface-2)] transition-all cursor-pointer"
              style={{ boxShadow: 'inset 0 0 0 1px var(--color-border-subtle)' }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M6 4l4 4-4 4" />
              </svg>
            </button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const t = new Date();
                setCalYear(t.getFullYear());
                setCalMonth(t.getMonth() + 1);
                setSelectedDate(todayStr());
              }}
            >
              {t('common.today')}
            </Button>
          </div>

          {/* Calendar grid */}
          <div
            className="rounded-[var(--radius-xl)] overflow-hidden mb-5"
            style={{
              background:
                'linear-gradient(135deg, var(--color-bg-surface-1), var(--color-bg-surface-2))',
              boxShadow: 'var(--shadow-card)',
              border: '1px solid var(--color-border-subtle)',
              padding: '1.25rem',
            }}
          >
            <div className="grid grid-cols-7 gap-1.5 mb-2">
              {[
                'planner.mon.mo',
                'planner.mon.tu',
                'planner.mon.we',
                'planner.mon.th',
                'planner.mon.fr',
                'planner.mon.sa',
                'planner.mon.su',
              ].map((labelKey) => (
                <div
                  key={labelKey}
                  className="text-center text-[10px] font-semibold uppercase tracking-widest py-2"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {t(labelKey)}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {calendarDays.map((day, idx) => {
                if (day === null) return <div key={`e-${idx}`} className="aspect-square" />;
                const ds = dateStr(calYear, calMonth, day);
                const taskCount = (tasksByDate[ds] || []).length;
                const habitCheckinCount = habitCheckinsByDate[ds] || 0;
                const totalEventCount = taskCount + (habitCheckinCount > 0 ? 1 : 0);
                const isToday = ds === todayStr();
                const isSelected = ds === selectedDate;

                const cellStyle: React.CSSProperties = {
                  backgroundColor: getHeatmapBg(totalEventCount),
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                };
                if (isToday && !isSelected) {
                  cellStyle.boxShadow = 'inset 0 0 0 2px var(--color-accent)';
                  cellStyle.background =
                    'linear-gradient(135deg, var(--color-accent-soft), transparent)';
                }
                if (isSelected) {
                  cellStyle.boxShadow =
                    '0 0 0 2.5px var(--color-accent), 0 4px 12px rgba(44,24,16,0.12)';
                  cellStyle.background = 'var(--color-accent-soft)';
                }

                return (
                  <button
                    key={ds}
                    type="button"
                    onClick={() => setSelectedDate(ds)}
                    className="aspect-square rounded-[var(--radius-md)] flex flex-col items-center justify-center relative text-sm cursor-pointer hover:scale-[1.08] hover:z-10"
                    style={cellStyle}
                  >
                    <span
                      style={{
                        fontWeight: isSelected || isToday ? 700 : 500,
                        color:
                          isSelected || isToday
                            ? 'var(--color-accent)'
                            : totalEventCount > 0
                              ? 'var(--color-text-primary)'
                              : 'var(--color-text-muted)',
                      }}
                    >
                      {day}
                    </span>
                    <div className="absolute bottom-1 flex gap-0.5">
                      {taskCount > 0 && (
                        <span
                          className="w-1 h-1 rounded-full"
                          style={{ backgroundColor: 'var(--color-accent)' }}
                        />
                      )}
                      {habitCheckinCount > 0 && (
                        <span
                          className="w-1 h-1 rounded-full"
                          style={{ backgroundColor: 'var(--color-success)' }}
                        />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            {/* Legend */}
            <div
              className="flex items-center justify-end gap-2 mt-4 pt-3"
              style={{ borderTop: '1px solid var(--color-border-subtle)' }}
            >
              <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                {t('planner.few')}
              </span>
              <div className="flex gap-0.5">
                {[0, 1, 2, 3].map((c) => (
                  <div
                    key={c}
                    className="w-3 h-3 rounded-sm"
                    style={{ backgroundColor: getHeatmapBg(c) }}
                  />
                ))}
              </div>
              <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                {t('planner.many')}
              </span>
            </div>
          </div>

          {/* Selected day detail */}
          <div
            className="rounded-[var(--radius-xl)]"
            style={{
              background:
                'linear-gradient(160deg, var(--color-bg-surface-1), var(--color-bg-surface-2))',
              boxShadow: 'var(--shadow-card)',
              border: '1px solid var(--color-border-subtle)',
              padding: '1.5rem',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-[var(--color-text-primary)]">
                  {new Date(selectedDate + 'T00:00:00').toLocaleDateString(t('i18n.locale'), {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    weekday: 'long',
                  })}
                </h3>
                <span className="text-xs text-[var(--color-text-muted)]">
                  {(tasksByDate[selectedDate] || []).length} {t('planner.tasks')}
                  {checkedHabitsOnSelectedDate.length > 0
                    ? ` · ${checkedHabitsOnSelectedDate.length} ${t('habits.checkin')}`
                    : ''}
                </span>
              </div>
              <Button size="sm" onClick={() => openAdd(selectedDate)}>
                {t('planner.addTask')}
              </Button>
            </div>

            {/* Habit check-ins */}
            {checkedHabitsOnSelectedDate.length > 0 && (
              <div
                className="mb-4 pb-4 border-b"
                style={{ borderColor: 'var(--color-border-subtle)' }}
              >
                <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-2">
                  {t('habits.checkin')}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {checkedHabitsOnSelectedDate.map((habit) => (
                    <span
                      key={habit.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs"
                      style={{
                        backgroundColor: `${habit.color}20`,
                        color: habit.color,
                        border: `1px solid ${habit.color}40`,
                      }}
                    >
                      <span>{habit.icon}</span>
                      <span className="font-medium">{habit.name}</span>
                      <span className="opacity-70">{habit.checkins[selectedDate]}×</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {(tasksByDate[selectedDate] || []).length === 0 ? (
              <EmptyState
                icon="📅"
                title={t('planner.noTasksToday')}
                description={t('planner.clickAddTask')}
                action={
                  <Button size="sm" onClick={() => openAdd(selectedDate)}>
                    {t('planner.addTask')}
                  </Button>
                }
              />
            ) : (
              <div className="space-y-2">
                {(tasksByDate[selectedDate] || []).map((task) => (
                  <div
                    key={task.id}
                    onClick={() => openEdit(task)}
                    className="flex items-center gap-3 py-2.5 px-3 rounded-[var(--radius-md)] cursor-pointer transition-all duration-200"
                    style={{ borderLeft: `3px solid ${PRIORITY_COLORS[task.priority]}` }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--color-bg-surface-2)';
                      e.currentTarget.style.transform = 'translateX(2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.transform = 'translateX(0)';
                    }}
                  >
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        cycleStatus(task);
                      }}
                      className="cursor-pointer flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-all"
                      style={{
                        border:
                          task.status === 'completed'
                            ? 'none'
                            : '2px solid var(--color-border-subtle)',
                        background:
                          task.status === 'completed' ? 'var(--color-accent)' : 'transparent',
                      }}
                    >
                      {task.status === 'completed' && (
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 12 12"
                          fill="none"
                          stroke="#fff"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M2 6l3 3 5-5" />
                        </svg>
                      )}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-medium truncate ${task.status === 'completed' ? 'line-through text-[var(--color-text-muted)]' : 'text-[var(--color-text-primary)]'}`}
                        >
                          {task.title}
                        </span>
                        {task.project && <Badge variant="accent">{task.project}</Badge>}
                      </div>
                      <span className="text-xs text-[var(--color-text-muted)]">
                        P{task.priority}
                        {((taskActualTimeMap[task.id] || 0) > 0 || task.estimatedMinutes > 0) &&
                          ' · '}
                        {(taskActualTimeMap[task.id] || 0) > 0 &&
                          `已投入 ${Math.round(taskActualTimeMap[task.id])}m`}
                        {(taskActualTimeMap[task.id] || 0) > 0 &&
                          task.estimatedMinutes > 0 &&
                          ' / '}
                        {task.estimatedMinutes > 0 && `预估 ${Math.round(task.estimatedMinutes)}m`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TIMELINE VIEW ── */}
      {densityMode !== 'single' && viewMode === 'timeline' && (
        <div>
          {timelineData.tasks.length === 0 ? (
            <div
              style={{
                background: 'linear-gradient(135deg, var(--color-bg-surface-1) 0%, #fef8f0 100%)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--color-border-subtle)',
                boxShadow: 'var(--shadow-card)',
                padding: '48px 24px',
                textAlign: 'center' as const,
              }}
            >
              <EmptyState
                icon="📊"
                title={t('planner.noTasks')}
                description={t('planner.noTasksTimeline')}
                action={<Button onClick={() => openAdd()}>{t('planner.addTask')}</Button>}
              />
            </div>
          ) : (
            <div
              className="rounded-[var(--radius-xl)] overflow-hidden"
              style={{
                background: 'var(--color-bg-surface-1)',
                border: '1px solid var(--color-border-subtle)',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <div className="overflow-x-auto">
                <div style={{ minWidth: Math.max(700, timelineData.totalDays * 48) }}>
                  {/* Date headers */}
                  <div
                    className="flex border-b"
                    style={{ borderColor: 'var(--color-border-subtle)' }}
                  >
                    <div className="flex-shrink-0 w-48 p-3 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                      {t('planner.task')}
                    </div>
                    <div className="flex flex-1">
                      {Array.from({ length: timelineData.totalDays }, (_, i) => {
                        const d = new Date(timelineData.startDate + 'T00:00:00');
                        d.setDate(d.getDate() + i);
                        const ds = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
                        const isToday = ds === todayStr();
                        return (
                          <div
                            key={ds}
                            className="flex-1 min-w-[48px] text-center py-2 text-[10px] font-medium"
                            style={{
                              color: isToday ? 'var(--color-accent)' : 'var(--color-text-muted)',
                              fontWeight: isToday ? 700 : 500,
                              background: isToday ? 'var(--color-accent-soft)' : undefined,
                              borderLeft: '1px solid var(--color-border-subtle)',
                            }}
                          >
                            {d.getDate()}
                            <br />
                            {['日', '一', '二', '三', '四', '五', '六'][d.getDay()]}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Task rows */}
                  {timelineData.tasks.map((task, idx) => {
                    const createdDate = task.createdAt.slice(0, 10);
                    const startOffset = Math.max(
                      0,
                      daysBetween(timelineData.startDate, createdDate)
                    );
                    const endOffset = Math.max(
                      startOffset + 1,
                      daysBetween(timelineData.startDate, task.dueDate) + 1
                    );
                    const barLeftPct = (startOffset / timelineData.totalDays) * 100;
                    const barWidthPct = ((endOffset - startOffset) / timelineData.totalDays) * 100;

                    return (
                      <div
                        key={task.id}
                        className="flex items-center border-b"
                        style={{
                          borderColor: 'var(--color-border-subtle)',
                          minHeight: 44,
                          animation: `fadeInUp 0.3s ease ${idx * 40}ms both`,
                        }}
                      >
                        <div
                          className="flex-shrink-0 w-48 px-3 py-2 flex items-center gap-2 cursor-pointer"
                          onClick={() => openEdit(task)}
                        >
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: PRIORITY_COLORS[task.priority] }}
                          />
                          <span className="text-xs font-medium text-[var(--color-text-primary)] truncate">
                            {task.title}
                          </span>
                        </div>
                        <div className="flex-1 relative" style={{ height: 32 }}>
                          <div
                            className="absolute top-1 rounded-md cursor-pointer transition-all duration-200 flex items-center px-2"
                            onClick={() => openEdit(task)}
                            style={{
                              left: `${barLeftPct}%`,
                              width: `${Math.max(barWidthPct, 2)}%`,
                              height: 24,
                              background: `linear-gradient(90deg, ${PRIORITY_COLORS[task.priority]}cc, ${PRIORITY_COLORS[task.priority]}88)`,
                              opacity: task.status === 'completed' ? 0.5 : 1,
                              boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'scaleY(1.15)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'scaleY(1)';
                            }}
                          >
                            <span className="text-[10px] font-semibold text-white truncate">
                              {task.project || ''}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Add / Edit Modal ── */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? t('planner.editTask') : t('planner.addTask')}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={!form.title.trim()}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <Input
            label={t('planner.taskName')}
            value={form.title}
            onChange={(v) => setForm((f) => ({ ...f, title: v }))}
            placeholder={t('planner.taskNamePlaceholder')}
          />
          {/* Priority */}
          <div>
            <span className="block text-[10px] font-medium text-[var(--color-text-muted)] mb-2">
              {t('planner.priority')}
            </span>
            <div className="flex gap-2">
              {([1, 2, 3, 4, 5] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setForm((f) => ({ ...f, priority: p }))}
                  className={[
                    'w-9 h-9 rounded-full text-xs font-bold transition-all cursor-pointer',
                    form.priority === p
                      ? 'ring-2 ring-offset-2 ring-[var(--color-accent)] scale-110'
                      : 'opacity-60 hover:opacity-100',
                  ].join(' ')}
                  style={{ backgroundColor: PRIORITY_COLORS[p], color: '#fff' }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          {/* Project + time */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('planner.project')}
              value={form.project}
              onChange={(v) => setForm((f) => ({ ...f, project: v }))}
              placeholder={t('planner.projectPlaceholder')}
            />
            <Input
              label={t('planner.estimatedMinutes')}
              type="number"
              value={String(form.estimatedMinutes)}
              onChange={(v) =>
                setForm((f) => ({ ...f, estimatedMinutes: Math.max(1, Number(v) || 0) }))
              }
            />
          </div>
          {/* Due date + repeat */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="block text-[10px] font-medium text-[var(--color-text-muted)] mb-1">
                {t('planner.dueDate')}
              </span>
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                className="w-full text-sm py-2 bg-transparent border-b-2 border-[var(--color-border-subtle)]/50 focus:border-[var(--color-accent)] outline-none text-[var(--color-text-primary)] transition-colors"
              />
            </div>
            <div>
              <span className="block text-[10px] font-medium text-[var(--color-text-muted)] mb-1">
                {t('planner.repeat')}
              </span>
              <select
                value={form.repeatType}
                onChange={(e) =>
                  setForm((f) => ({ ...f, repeatType: e.target.value as RepeatType }))
                }
                className="w-full text-sm py-2 bg-transparent border-b-2 border-[var(--color-border-subtle)]/50 focus:border-[var(--color-accent)] outline-none text-[var(--color-text-primary)] transition-colors cursor-pointer"
              >
                {(Object.keys(REPEAT_LABELS) as RepeatType[]).map((r) => (
                  <option key={r} value={r}>
                    {t(REPEAT_LABELS[r])}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {/* Subtasks */}
          <div>
            <span className="block text-[10px] font-medium text-[var(--color-text-muted)] mb-2">
              {t('planner.subtasks')}
            </span>
            {form.subtasks.length > 0 && (
              <ul className="space-y-1.5 mb-3">
                {form.subtasks.map((st) => (
                  <li key={st.id} className="flex items-center gap-2 group">
                    <span
                      onClick={() => toggleFormSubtask(st.id)}
                      className="cursor-pointer flex-shrink-0 flex items-center justify-center transition-all duration-200"
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        border: st.completed ? 'none' : '2px solid var(--color-border-subtle)',
                        background: st.completed ? 'var(--color-accent)' : 'transparent',
                      }}
                    >
                      {st.completed && (
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 12 12"
                          fill="none"
                          stroke="#fff"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M2 6l3 3 5-5" />
                        </svg>
                      )}
                    </span>
                    <span
                      className={[
                        'flex-1 text-sm',
                        st.completed
                          ? 'line-through text-[var(--color-text-muted)]'
                          : 'text-[var(--color-text-primary)]',
                      ].join(' ')}
                    >
                      {st.title}
                    </span>
                    <button
                      onClick={() => removeFormSubtask(st.id)}
                      className="opacity-0 group-hover:opacity-100 text-red-500 text-xs transition-opacity cursor-pointer"
                    >
                      {t('common.delete')}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addFormSubtask()}
                placeholder={t('planner.addSubtaskPlaceholder')}
                className="flex-1 text-sm py-1.5 bg-transparent border-b border-[var(--color-border-subtle)]/40 focus:border-[var(--color-accent)] outline-none text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]/60 transition-colors"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={addFormSubtask}
                disabled={!newSubtaskTitle.trim()}
              >
                {t('common.add')}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* ── 庆祝动画覆盖层 ── */}
      {showCelebration && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
          style={{
            background: 'rgba(0, 0, 0, 0.3)',
            animation: 'fadeIn 0.3s ease-out',
          }}
        >
          <div
            className="p-12 rounded-3xl text-center"
            style={{
              background:
                'linear-gradient(135deg, var(--color-green) 0%, var(--color-blue) 50%, var(--color-purple) 100%)',
              boxShadow: '0 25px 80px rgba(0, 0, 0, 0.3)',
              animation: 'celebratePop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          >
            <div className="text-6xl mb-4">🎉</div>
            <h2
              className="text-2xl font-bold mb-2 text-white"
              style={{ fontFamily: 'Quicksand, sans-serif' }}
            >
              太棒了！
            </h2>
            <p className="text-white/90">「{celebrationTaskTitle}」完成了！</p>
            <div className="mt-4 text-4xl">✨ 🚀 🌟</div>
          </div>
        </div>
      )}

      {/* ── 「我不想做」共情弹窗 ── */}
      <Modal
        isOpen={showEmpathyModal}
        onClose={() => setShowEmpathyModal(false)}
        title="💬 没关系，我们来看看"
        size="md"
      >
        <div className="space-y-4 py-4">
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            不想做是很正常的。我们有几个选择：
          </p>

          {/* 选项 1: 只做 5 分钟 */}
          <button
            onClick={() => {
              // 标记为进行中，设置专注时间短
              if (empathyTaskId) {
                updateTask(empathyTaskId, { status: 'in_progress' });
              }
              setShowEmpathyModal(false);
            }}
            className="w-full p-4 rounded-xl text-left transition-all duration-200 hover:scale-[1.01]"
            style={{
              background: 'var(--color-green-soft)',
              border: '1px solid var(--color-green)',
            }}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">⏱️</span>
              <div>
                <p className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  只做 5 分钟就行
                </p>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  先开始，进入状态后就容易继续了
                </p>
              </div>
            </div>
          </button>

          {/* 选项 2: 找更简单的 */}
          <button
            onClick={() => {
              setDensityMode('today');
              setShowEmpathyModal(false);
            }}
            className="w-full p-4 rounded-xl text-left transition-all duration-200 hover:scale-[1.01]"
            style={{
              background: 'var(--color-blue-soft)',
              border: '1px solid var(--color-blue)',
            }}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔄</span>
              <div>
                <p className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  换个更容易的任务
                </p>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  从待办清单里挑个简单的先完成
                </p>
              </div>
            </div>
          </button>

          {/* 选项 3: 明天再说 */}
          <button
            onClick={() => {
              if (empathyTaskId) {
                const today = new Date();
                today.setDate(today.getDate() + 1);
                const tomorrow = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                updateTask(empathyTaskId, { dueDate: tomorrow });
              }
              setShowEmpathyModal(false);
            }}
            className="w-full p-4 rounded-xl text-left transition-all duration-200 hover:scale-[1.01]"
            style={{
              background: 'var(--color-purple-soft)',
              border: '1px solid var(--color-purple)',
            }}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🌙</span>
              <div>
                <p className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  明天再说
                </p>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  休息一下，状态会更好的
                </p>
              </div>
            </div>
          </button>
        </div>
      </Modal>

      {/* ── 统一任务面板 ── */}
      <TaskPanel
        isOpen={taskPanelOpen}
        onClose={() => setTaskPanelOpen(false)}
        mode={taskPanelMode}
        task={taskPanelTask}
      />

      <style>{`
        @keyframes celebratePop {
          0% { transform: scale(0.5); opacity: 0; }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ============================================================
// TaskCard sub-component (used in List & Board views)
// ============================================================

interface TaskCardProps {
  task: Task;
  expanded: boolean;
  confirmDelete: boolean;
  compact?: boolean;
  onToggleStatus: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onToggleExpand: () => void;
  onToggleSubtask: (sid: string) => void;
  accentColor: string;
  index: number;
}

function TaskCard({
  task,
  expanded,
  confirmDelete,
  onToggleStatus,
  onEdit,
  onDelete,
  onConfirmDelete,
  onCancelDelete,
  onToggleExpand,
  onToggleSubtask,
  index,
}: TaskCardProps) {
  const { t } = useTranslation();
  const isDone = task.status === 'completed';
  const completedSubs = task.subtasks.filter((s) => s.completed).length;
  const totalSubs = task.subtasks.length;
  const subProgress = totalSubs > 0 ? (completedSubs / totalSubs) * 100 : 0;

  return (
    <div
      style={{
        animationDelay: `${index * 50}ms`,
        animationName: 'fadeInUp',
        animationDuration: '0.35s',
        animationTimingFunction: 'ease-out',
        animationFillMode: 'both',
        background: isDone
          ? 'var(--color-bg-surface-1)'
          : 'linear-gradient(135deg, var(--color-bg-surface-1) 0%, #fef8f0 100%)',
        border: '1px solid var(--color-border-subtle)',
        borderLeft: `3px solid ${PRIORITY_COLORS[task.priority]}`,
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-card)',
        padding: '16px',
        opacity: isDone ? 0.6 : 1,
        transition: 'box-shadow 200ms ease, transform 200ms ease',
      }}
      onMouseEnter={(e) => {
        if (!isDone) {
          e.currentTarget.style.boxShadow = 'var(--shadow-card-hover)';
          e.currentTarget.style.transform = 'translateY(-2px)';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'var(--shadow-card)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div className="flex items-start gap-3">
        {/* checkbox */}
        <span
          onClick={onToggleStatus}
          className="cursor-pointer flex-shrink-0 flex items-center justify-center mt-0.5 transition-all duration-200"
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            border: isDone ? 'none' : '2px solid var(--color-border-subtle)',
            background: isDone ? 'var(--color-accent)' : 'transparent',
            transform: isDone ? 'scale(1.08)' : 'scale(1)',
            boxShadow: isDone ? '0 2px 6px rgba(44, 24, 16, 0.12)' : 'none',
          }}
        >
          {isDone && (
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              stroke="#fff"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 6l3 3 5-5" />
            </svg>
          )}
        </span>
        {/* content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={[
                'font-semibold text-[var(--color-text-primary)]',
                isDone ? 'line-through text-[var(--color-text-muted)]' : '',
              ].join(' ')}
            >
              {task.title}
            </span>
            {task.project && <Badge variant="accent">{task.project}</Badge>}
            {task.repeatType !== 'none' && (
              <Badge variant="warning">{t(REPEAT_LABELS[task.repeatType])}</Badge>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <span className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: PRIORITY_COLORS[task.priority] }}
              />
              P{task.priority}
            </span>
            {totalSubs > 0 && (
              <span className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                <Progress value={subProgress} size="sm" className="w-16" />
                <span className="metric-value">
                  {completedSubs}/{totalSubs}
                </span>
              </span>
            )}
            <span className="text-xs text-[var(--color-text-muted)]">
              <span className="metric-value">{fmtDuration(task.actualMinutes, t)}</span>
              {' / '}
              {fmtDuration(task.estimatedMinutes, t)}
            </span>
            {task.dueDate && (
              <span className="text-xs text-[var(--color-text-muted)]">{task.dueDate}</span>
            )}
          </div>
        </div>
        {/* actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {totalSubs > 0 && (
            <button
              onClick={onToggleExpand}
              className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface-2)] transition-all duration-200 cursor-pointer"
              style={{ borderRadius: 'var(--radius-md)' }}
              title={t('planner.expandSubtasks')}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className={`transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
              >
                <path d="M6 4l4 4-4 4" />
              </svg>
            </button>
          )}
          <button
            onClick={onEdit}
            className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent-soft)] transition-all duration-200 cursor-pointer"
            style={{ borderRadius: 'var(--radius-md)' }}
            title={t('common.edit')}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M11.5 2.5l2 2L5 13H3v-2l8.5-8.5z" />
            </svg>
          </button>
          {confirmDelete ? (
            <span className="flex items-center gap-1">
              <Button size="sm" variant="danger" onClick={onConfirmDelete}>
                {t('common.confirm')}
              </Button>
              <Button size="sm" variant="ghost" onClick={onCancelDelete}>
                {t('common.cancel')}
              </Button>
            </span>
          ) : (
            <button
              onClick={onDelete}
              className="p-1.5 text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-all duration-200 cursor-pointer"
              style={{ borderRadius: 'var(--radius-md)' }}
              title={t('common.delete')}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1m2 0v9a1 1 0 01-1 1H5a1 1 0 01-1-1V4h8z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Expanded subtasks */}
      {expanded && totalSubs > 0 && (
        <div
          className="mt-3 ml-8 pl-4 space-y-2"
          style={{ borderLeft: '2px solid var(--color-accent-soft)' }}
        >
          {task.subtasks.map((st, stIdx) => (
            <label
              key={st.id}
              className="flex items-center gap-2.5 cursor-pointer py-0.5"
              style={{
                animationDelay: `${stIdx * 30}ms`,
                animationName: 'fadeInUp',
                animationDuration: '0.25s',
                animationTimingFunction: 'ease-out',
                animationFillMode: 'both',
              }}
            >
              <span
                onClick={(e) => {
                  e.preventDefault();
                  onToggleSubtask(st.id);
                }}
                className="flex-shrink-0 flex items-center justify-center transition-all duration-200"
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  border: st.completed ? 'none' : '2px solid var(--color-border-subtle)',
                  background: st.completed ? 'var(--color-accent)' : 'transparent',
                }}
              >
                {st.completed && (
                  <svg
                    width="8"
                    height="8"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="#fff"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M2 6l3 3 5-5" />
                  </svg>
                )}
              </span>
              <span
                className={[
                  'text-sm transition-colors duration-150',
                  st.completed
                    ? 'line-through text-[var(--color-text-muted)]'
                    : 'text-[var(--color-text-primary)]',
                ].join(' ')}
              >
                {st.title}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
