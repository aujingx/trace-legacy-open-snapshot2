import { useState, useEffect } from 'react';
import { X, Calendar, Sparkles, RefreshCw } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import type { Task } from '../services/dataService';

type PanelMode = 'create' | 'view' | 'edit';

interface TaskPanelProps {
  isOpen: boolean;
  onClose: () => void;
  mode: PanelMode;
  task?: Task | null;
}

export default function TaskPanel({ isOpen, onClose, mode, task }: TaskPanelProps) {
  const addTask = useAppStore((s) => s.addTask);
  const updateTask = useAppStore((s) => s.updateTask);

  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState(3);
  const [estimatedMinutes, setEstimatedMinutes] = useState(30);
  const [dueDate, setDueDate] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);

  // 🧠 AI 智能解析任务标题
  const parseTaskTitle = (input: string) => {
    let newTitle = input;
    let newPriority = priority;
    let newMinutes = estimatedMinutes;

    // 解析优先级：高、紧急、重要、P1、P2 等
    const priorityMatch = input.match(/(P[1-5]|优先级[1-5]|[高紧急]|重要)/i);
    if (priorityMatch) {
      const match = priorityMatch[0].toUpperCase();
      if (match === 'P1' || match === '高' || match === '紧急') newPriority = 1;
      else if (match === 'P2' || match === '重要') newPriority = 2;
      else if (match === 'P3') newPriority = 3;
      else if (match === 'P4') newPriority = 4;
      else if (match === 'P5') newPriority = 5;
      newTitle = newTitle.replace(priorityMatch[0], '').trim();
    }

    // 解析时间：30分钟、1h、2小时等
    const timeMatch = input.match(/(\d+)\s*(分钟|min|小时|h|m)/i);
    if (timeMatch) {
      const num = parseInt(timeMatch[1]);
      const unit = timeMatch[2].toLowerCase();
      if (unit === '小时' || unit === 'h') {
        newMinutes = num * 60;
      } else {
        newMinutes = num;
      }
      newTitle = newTitle.replace(timeMatch[0], '').trim();
    }

    return { title: newTitle || input, priority: newPriority, estimatedMinutes: newMinutes };
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    setTitle(input);
    // 只有创建模式才自动解析
    if (mode === 'create' && input.length > 2) {
      const parsed = parseTaskTitle(input);
      setPriority(parsed.priority);
      setEstimatedMinutes(parsed.estimatedMinutes);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false));

      if (task && (mode === 'view' || mode === 'edit')) {
        setTitle(task.title);
        setPriority(task.priority);
        setEstimatedMinutes(task.estimatedMinutes || 30);
        setDueDate(task.dueDate || '');
      } else {
        setTitle('');
        setPriority(3);
        setEstimatedMinutes(30);
        setDueDate('');
      }
    }
  }, [isOpen, task, mode]);

  const handleSave = () => {
    if (!title.trim()) return;

    const taskData = {
      title: title.trim(),
      priority: priority as 1 | 2 | 3 | 4 | 5,
      estimatedMinutes,
      dueDate,
      actualMinutes: 0,
      project: '',
      repeatType: 'none' as const,
      subtasks: [],
      status: 'todo' as const,
      createdAt: new Date().toISOString(),
    };

    if (mode === 'create') {
      addTask(taskData);
    } else if (task) {
      updateTask(task.id, taskData);
    }

    onClose();
  };

  const quickDurations = [15, 30, 60, 120];
  const priorityLabels = ['', '低', '中', '高', '紧急', '非常紧急'];
  const priorityColors = [
    '',
    'var(--color-green)',
    'var(--color-blue)',
    'var(--color-lemon)',
    'var(--color-orange)',
    'var(--color-red)',
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 transition-opacity duration-300"
        style={{
          background: 'rgba(0, 0, 0, 0.3)',
          opacity: isAnimating ? 0 : 1,
        }}
        onClick={onClose}
      />

      {/* 面板主体 */}
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl transition-all duration-300"
        style={{
          background: 'var(--color-bg-surface-1)',
          border: '3px solid var(--color-border-strong)',
          boxShadow: '8px 8px 0px var(--color-border-strong)',
          transform: isAnimating ? 'scale(0.95) translateY(20px)' : 'scale(1) translateY(0)',
          opacity: isAnimating ? 0 : 1,
        }}
      >
        {/* 头部 */}
        <div
          className="sticky top-0 z-10 flex items-center justify-between p-6 pb-4"
          style={{ background: 'var(--color-bg-surface-1)' }}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">✏️</span>
            <h2
              className="text-xl font-bold"
              style={{ color: 'var(--color-text-primary)', fontFamily: 'Quicksand, sans-serif' }}
            >
              {mode === 'create' ? '新任务' : mode === 'edit' ? '编辑任务' : '任务详情'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl transition-all hover:bg-opacity-10"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-6 pb-6 space-y-5">
          {/* 任务标题 */}
          <div>
            <input
              type="text"
              placeholder="输入任务，如：写报告 P1 2h"
              className="w-full px-4 py-3 rounded-xl text-base font-medium outline-none transition-all"
              style={{
                background: 'var(--color-bg-elevated)',
                border: '1px solid var(--color-border-light)',
                color: 'var(--color-text-primary)',
              }}
              value={title}
              onChange={handleTitleChange}
              autoFocus
            />
          </div>

          {/* 优先级 + 截止日期 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                优先级
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((p) => (
                  <button
                    key={p}
                    onClick={() => setPriority(p)}
                    className="flex-1 py-2 rounded-xl text-sm font-medium transition-all"
                    style={{
                      background: priority === p ? priorityColors[p] : 'var(--color-bg-elevated)',
                      color: priority === p ? '#fff' : 'var(--color-text-secondary)',
                      border:
                        priority === p
                          ? `2px solid ${priorityColors[p]}`
                          : '1px solid var(--color-border-light)',
                      boxShadow: priority === p ? `0 2px 8px ${priorityColors[p]}40` : 'none',
                      transform: priority === p ? 'scale(1.05)' : 'scale(1)',
                    }}
                  >
                    {priorityLabels[p]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                <Calendar size={14} className="inline mr-1" /> 截止日期
              </label>
              <input
                type="date"
                className="w-full px-4 py-2.5 rounded-xl outline-none transition-all"
                style={{
                  background: 'var(--color-bg-elevated)',
                  border: '1px solid var(--color-border-light)',
                  color: 'var(--color-text-primary)',
                }}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          {/* 预计时长 */}
          <div>
            <label
              className="block text-sm font-medium mb-2"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              预计时长
            </label>
            <div className="flex items-center gap-3">
              <div className="flex-1 flex items-center">
                <input
                  type="number"
                  className="w-full px-4 py-2.5 rounded-xl outline-none transition-all text-base"
                  style={{
                    background: 'var(--color-bg-elevated)',
                    border: '1px solid var(--color-border-light)',
                    color: 'var(--color-text-primary)',
                  }}
                  value={estimatedMinutes}
                  onChange={(e) => setEstimatedMinutes(parseInt(e.target.value) || 0)}
                />
                <span className="ml-3 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  分钟
                </span>
              </div>
              <div className="flex gap-2">
                {quickDurations.map((mins) => (
                  <button
                    key={mins}
                    onClick={() => setEstimatedMinutes(mins)}
                    className="px-3 py-2 rounded-xl text-sm font-medium transition-all"
                    style={{
                      background:
                        estimatedMinutes === mins
                          ? 'var(--color-blue)'
                          : 'var(--color-bg-elevated)',
                      color: estimatedMinutes === mins ? '#fff' : 'var(--color-text-secondary)',
                      border:
                        estimatedMinutes === mins
                          ? '1px solid var(--color-blue)'
                          : '1px solid var(--color-border-light)',
                    }}
                  >
                    {mins >= 60 ? `${mins / 60}h` : `${mins}m`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 底部按钮 */}
        <div
          className="sticky bottom-0 flex items-center justify-end gap-3 p-6 pt-4"
          style={{ background: 'var(--color-bg-surface-1)' }}
        >
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl font-medium transition-all"
            style={{
              background: 'var(--color-bg-elevated)',
              color: 'var(--color-text-secondary)',
            }}
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim()}
            className="px-6 py-2.5 rounded-xl font-semibold transition-all flex items-center gap-2"
            style={{
              background: title.trim()
                ? 'linear-gradient(135deg, var(--color-blue) 0%, var(--color-purple) 100%)'
                : 'var(--color-border-light)',
              color: '#fff',
              boxShadow: title.trim() ? '0 4px 12px rgba(59, 130, 246, 0.3)' : 'none',
              cursor: title.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            {mode === 'create' ? (
              <>
                <Sparkles size={16} />
                创建任务
              </>
            ) : (
              <>
                <RefreshCw size={16} />
                保存修改
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
