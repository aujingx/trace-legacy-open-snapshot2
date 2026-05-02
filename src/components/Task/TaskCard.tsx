import { useState } from 'react'
import { Play, Pause, Clock, Flag } from 'lucide-react'
import type { Task, TaskStatus } from '../../services/dataService'
import { getPriorityConfig, getStatusConfig, EMOTIONAL_EMOJIS, SHADOWS, RADII, ANIMATIONS } from '../../constants/task'

interface TaskCardProps {
  task: Task
  selected?: boolean
  onSelect?: () => void
  onClick?: () => void
  onStartTimer?: () => void
  onStatusChange?: (status: TaskStatus) => void
  onDontWantToDo?: () => void
}

export default function TaskCard({
  task,
  selected = false,

  onClick,
  onStartTimer,
  onStatusChange,
  onDontWantToDo,
}: TaskCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const statusConfig = getStatusConfig(task.status)
  const priorityConfig = getPriorityConfig(task.priority)

  const progress = task.estimatedMinutes > 0
    ? Math.min(100, Math.round(((task.timeLoggedMinutes || task.actualMinutes || 0) / task.estimatedMinutes) * 100))
    : 0

  // AI 推荐理由标签
  const recommendationTags = getRecommendationTags(task)

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    const newStatus: TaskStatus = task.status === 'completed' ? 'todo' : 'completed'
    onStatusChange?.(newStatus)
  }

  const handleStartTimer = (e: React.MouseEvent) => {
    e.stopPropagation()
    onStartTimer?.()
  }

  const handleDontWantToDo = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDontWantToDo?.()
  }

  const handleCardClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onClick?.()
  }

  return (
    <div
      data-testid="task-item"
      className={`p-4 cursor-pointer transition-all duration-200 ${selected ? 'ring-2 ring-offset-2' : ''}`}
      style={{
        borderRadius: RADII.lg,
        background: 'var(--color-bg-surface-1)',
        border: `2px solid ${selected ? 'var(--color-blue)' : isHovered ? '#C8C5C0' : 'var(--color-border-light)'}`,
        boxShadow: isHovered ? SHADOWS.card : SHADOWS.cardSmall,
        opacity: task.status === 'archived' ? 0.6 : 1,
        transform: isHovered ? 'translateX(2px)' : 'translateX(0)',
        transition: `all ${ANIMATIONS.normal}`,
        '--tw-ring-color': 'var(--color-blue)',
        '--tw-ring-offset-color': '#FAF8F5',
      } as React.CSSProperties}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleCardClick}
    >
      <div className="flex items-start gap-3">
        {/* 完成复选框 - 现在只有这一个了！ */}
        <button
          data-testid="task-complete-checkbox"
          onClick={handleCheckboxClick}
          className="mt-1 w-6 h-6 rounded-md flex items-center justify-center transition-all duration-200 hover:scale-110 focus-ring flex-shrink-0"
          style={{
            background: task.status === 'completed' ? statusConfig.bg : 'transparent',
            border: `2px solid ${task.status === 'completed' ? statusConfig.border : 'var(--color-border-light)'}`,
          }}
          aria-label={task.status === 'completed' ? '标记为未完成' : '标记为已完成'}
        >
          {task.status === 'completed' && (
            <span style={{ color: statusConfig.text }} className="text-sm font-bold">✓</span>
          )}
        </button>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* 标题 + 推荐理由标签 */}
          <div className="flex items-start gap-2 flex-wrap">
            <h3
              data-testid="task-title"
              className="text-sm font-semibold line-clamp-2"
              style={{
                color: 'var(--color-text-primary)',
                textDecoration: task.status === 'completed' ? 'line-through' : 'none',
              }}
            >
              {task.title}
            </h3>

            {/* AI 推荐理由标签 */}
            {recommendationTags.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                {recommendationTags.map((tag, i) => (
                  <span
                    key={i}
                    className="px-1.5 py-0.5 rounded-full text-xs font-medium"
                    style={{
                      background: 'var(--color-accent)15',
                      color: 'var(--color-accent)',
                    }}
                  >
                    {tag.icon} {tag.label}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 第一步提示 - 更醒目 */}
          {task.firstStep && task.status !== 'completed' && (
            <div
              className="mt-2 p-2 rounded-lg"
              style={{ background: 'var(--color-blue)10' }}
            >
              <p
                className="text-xs"
                style={{ color: 'var(--color-blue)' }}
              >
                🐣 第一步：{task.firstStep}
              </p>
            </div>
          )}

          {/* Meta info row - 更紧凑 */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {/* 优先级 */}
            <span
              className="px-2 py-0.5 rounded-md text-xs font-semibold flex items-center gap-1"
              style={{
                background: priorityConfig.bg,
                color: priorityConfig.text,
              }}
            >
              <Flag size={10} />
              P{task.priority}
            </span>

            {/* 情绪标签 */}
            {task.emotionalTag && (
              <span className="text-xs" title={task.emotionalTag}>
                {EMOTIONAL_EMOJIS[task.emotionalTag]}
              </span>
            )}

            {/* 截止日期 */}
            {task.dueDate && (
              <span className="text-xs flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
                <Clock size={10} />
                {task.dueDate}
              </span>
            )}

            {/* 预估时间 */}
            {task.estimatedMinutes > 0 && task.status !== 'completed' && !(task.timeLoggedMinutes || task.actualMinutes) && (
              <span className="text-xs flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
                ⏱️ {task.estimatedMinutes}分钟
              </span>
            )}
          </div>

          {/* 进度条 */}
          {task.status !== 'completed' && (task.timeLoggedMinutes || task.actualMinutes) > 0 && (
            <div className="mt-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  已记录: {task.timeLoggedMinutes || task.actualMinutes} 分钟
                </span>
                <span className="text-xs font-medium" style={{ color: 'var(--color-blue)' }}>
                  {progress}%
                </span>
              </div>
              <div
                className="h-1.5 rounded-full overflow-hidden"
                style={{ background: '#E5E7EB' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, progress)}%`,
                    background: progress >= 100 ? '#34D399' : 'var(--color-blue)',
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* 右侧快捷操作按钮 - 悬停显示 */}
        <div
          className={`flex flex-col gap-1.5 transition-all duration-200 ${
            isHovered ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {task.status !== 'completed' && (
            <>
              <button
                onClick={handleStartTimer}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-105 focus-ring"
                style={{ background: 'var(--color-accent)20' }}
                title="开始专注"
              >
                {task.status === 'in_progress' ? (
                  <Pause size={16} style={{ color: 'var(--color-accent)' }} />
                ) : (
                  <Play size={16} style={{ color: 'var(--color-accent)' }} />
                )}
              </button>

              <button
                onClick={handleDontWantToDo}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-105 focus-ring"
                style={{ background: '#FEF3C7' }}
                title="我不想做这个"
              >
                😔
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// AI 推荐理由标签生成函数
function getRecommendationTags(task: Task): Array<{ icon: string; label: string }> {
  const tags: Array<{ icon: string; label: string }> = []

  // 高优先级
  if (task.priority <= 2) {
    tags.push({ icon: '🏷️', label: '优先级高' })
  }

  // 已逾期 - 简单判断（实际应该和今天日期比较）
  if (task.dueDate && task.dueDate < new Date().toISOString().slice(0, 10)) {
    tags.push({ icon: '⚠️', label: '已逾期' })
  }

  // 今天截止
  if (task.dueDate && task.dueDate === new Date().toISOString().slice(0, 10)) {
    tags.push({ icon: '📅', label: '今天截止' })
  }

  // 已开始（有已记录时间）
  if ((task.timeLoggedMinutes || task.actualMinutes || 0) > 0) {
    tags.push({ icon: '▶️', label: '已开始' })
  }

  // 轻松易启动
  if (task.emotionalTag === 'easy' || task.estimatedMinutes <= 15) {
    tags.push({ icon: '🐣', label: '轻松易启动' })
  }

  return tags
}
