import { useState } from 'react'
import { Clock } from 'lucide-react'
import TimeBlock from './TimeBlock'

export interface TimeBlockData {
  id: string
  title: string
  category: string
  color: string
  startHour: number
  endHour: number
  status?: 'confirmed' | 'auto' | 'planned'
}

interface DayColumnProps {
  date: Date
  dateStr: string
  blocks: TimeBlockData[]
  hourHeight?: number
  isToday?: boolean
  selectedBlockId?: string | null
  onBlockSelect?: (blockId: string | null) => void
  onBlockDrag?: (blockId: string, newStartHour: number, newEndHour: number) => void
  onBlockResize?: (blockId: string, newStartHour: number, newEndHour: number) => void
  onBlockEdit?: (blockId: string) => void
  onBlockDelete?: (blockId: string) => void
}

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const DEFAULT_HOUR_HEIGHT = 80

export default function DayColumn({
  date,
  dateStr,
  blocks,
  hourHeight = DEFAULT_HOUR_HEIGHT,
  isToday = false,
  selectedBlockId,
  onBlockSelect,
  onBlockDrag,
  onBlockResize,
  onBlockEdit,
  onBlockDelete,
}: DayColumnProps) {
  const [currentTime] = useState(() => {
    const now = new Date()
    return now.getHours() + now.getMinutes() / 60
  })

  const weekday = date.toLocaleDateString('zh-CN', { weekday: 'short' })
  const day = date.getDate()

  return (
    <div className="flex-1 min-w-0">
      {/* 日期头部 */}
      <div className="text-center py-3 sticky top-0 z-20" style={{ background: 'var(--color-bg-base)' }}>
        <p className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
          {weekday}
        </p>
        <p
          className={`text-lg font-bold ${isToday ? 'text-white' : ''}`}
          style={{
            color: isToday ? undefined : 'var(--color-text-primary)',
            background: isToday ? 'linear-gradient(135deg, var(--color-blue) 0%, var(--color-purple) 100%)' : undefined,
            borderRadius: isToday ? '12px' : undefined,
            padding: isToday ? '4px 12px' : undefined,
            display: 'inline-block',
          }}
        >
          {day}
        </p>
      </div>

      {/* 时间轴容器 */}
      <div className="relative" style={{ height: `${HOURS.length * hourHeight}px` }}>
        {/* 小时刻度 */}
        {HOURS.map((hour) => (
          <div
            key={hour}
            className="absolute left-0 right-0 flex items-start gap-2"
            style={{ top: `${hour * hourHeight}px` }}
          >
            <span
              className="text-xs w-10 text-right pr-2 flex-shrink-0"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {String(hour).padStart(2, '0')}:00
            </span>
            <div
              className="flex-1 border-t"
              style={{
                borderColor: hour === 0 ? 'var(--color-border-strong)' : 'var(--color-border-light)',
              }}
            />
          </div>
        ))}

        {/* 当前时间指示线 */}
        {isToday && (
          <div
            className="absolute left-0 right-0 z-30 pointer-events-none"
            style={{ top: `${currentTime * hourHeight}px` }}
          >
            <div className="flex items-center gap-1">
              <div
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ background: 'var(--color-red)' }}
              />
              <div className="flex-1 h-0.5" style={{ background: 'var(--color-red)' }} />
              <span
                className="text-xs font-medium px-1.5 py-0.5 rounded"
                style={{
                  background: 'var(--color-red)',
                  color: 'white',
                }}
              >
                <Clock size={10} className="inline mr-0.5" />
                现在
              </span>
            </div>
          </div>
        )}

        {/* 时间块 */}
        {blocks.map((block) => (
          <TimeBlock
            key={block.id}
            block={block}
            hourHeight={hourHeight}
            isSelected={selectedBlockId === block.id}
            onSelect={() => onBlockSelect?.(block.id)}
            onDragStart={(e) => console.log('drag start', block.id)}
            onResizeStart={(e, dir) => console.log('resize start', block.id, dir)}
            onEdit={() => onBlockEdit?.(block.id)}
            onDelete={() => onBlockDelete?.(block.id)}
          />
        ))}
      </div>
    </div>
  )
}
