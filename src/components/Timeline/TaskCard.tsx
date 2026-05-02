import { Play, Clock, Flag } from 'lucide-react'
import type { Task } from '../../services/dataService'
import { getPriorityConfig, EMOTIONAL_EMOJIS, RADII, SHADOWS, ANIMATIONS } from '../../constants/task'

interface TaskCardProps {
  task: Task
  priority?: 'high' | 'normal'
  onClick?: () => void
  onStartTimer?: () => void
}

export default function TaskCard({ task, onClick, onStartTimer }: TaskCardProps) {
  const priorityConfig = getPriorityConfig(task.priority)
  const isCompleted = task.status === 'completed'

  return (
    <div
      className="p-3 rounded-xl flex items-center gap-3 transition-all hover:translate-x-1 cursor-pointer"
      style={{
        background: 'var(--color-bg-surface-1)',
        border: `1px solid var(--color-border-light)`,
        borderRadius: RADII.lg,
        boxShadow: SHADOWS.cardSmall,
        opacity: isCompleted ? 0.6 : 1,
        transition: `all ${ANIMATIONS.normal}`,
      }}
      onClick={onClick}
    >
      {/* 左侧优先级指示点 */}
      <div
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: priorityConfig.bg }}
      />

      {/* 主内容 */}
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-medium truncate"
          style={{
            color: 'var(--color-text-primary)',
            textDecoration: isCompleted ? 'line-through' : 'none'
          }}
        >
          {task.title}
        </p>

        {/* 元信息行 - 紧凑版 */}
        <div className="flex items-center gap-2 mt-1">
          {/* 优先级徽章 */}
          <span
            className="px-1.5 py-0.5 rounded text-xs font-semibold flex items-center gap-1"
            style={{ background: priorityConfig.bg, color: priorityConfig.text }}
          >
            <Flag size={8} />
            P{task.priority}
          </span>

          {/* 情绪标签 */}
          {task.emotionalTag && (
            <span className="text-xs">{EMOTIONAL_EMOJIS[task.emotionalTag]}</span>
          )}

          {/* 截止日期 */}
          {task.dueDate && (
            <span className="text-xs flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
              <Clock size={8} />
              {task.dueDate}
            </span>
          )}

          {/* 预估时间 */}
          {task.estimatedMinutes > 0 && !isCompleted && (
            <span className="text-xs flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
              ⏱️ {task.estimatedMinutes}分钟
            </span>
          )}
        </div>
      </div>

      {/* 开始专注按钮 - 悬停显示 */}
      {!isCompleted && onStartTimer && (
        <button
          onClick={(e) => { e.stopPropagation(); onStartTimer() }}
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-105 opacity-0 hover:opacity-100"
          style={{ background: 'var(--color-accent)20' }}
          title="开始专注"
        >
          <Play size={14} style={{ color: 'var(--color-accent)' }} />
        </button>
      )}
    </div>
  )
}
