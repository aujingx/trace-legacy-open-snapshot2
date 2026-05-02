import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, Sparkles, TrendingUp } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import NowEngineCard from '../components/NowEngineCard'
import MorningRitual from '../components/MorningRitual'

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// 根据时间返回不同的打招呼语
function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return '早上好 ☀️'
  if (hour >= 12 && hour < 14) return '中午好 🌤️'
  if (hour >= 14 && hour < 18) return '下午好 🌅'
  if (hour >= 18 && hour < 22) return '晚上好 🌙'
  return '夜深了 ✨'
}

// 鼓励语
function getEncouragement(goalProgress: number): string {
  if (goalProgress >= 100) return '太棒了！今日目标已达成 🎉'
  if (goalProgress >= 70) return '做得很好！继续保持 💪'
  if (goalProgress >= 40) return '状态不错，加油前进 🚀'
  if (goalProgress > 0) return '已开始专注，循序渐进 ⭐'
  return '准备好开始新的一天了吗？'
}

export default function Dashboard() {
  const navigate = useNavigate()

  const activities = useAppStore((s) => s.activities)
  const loadActivities = useAppStore((s) => s.loadActivities)
  const tasks = useAppStore((s) => s.tasks)
  const loadTasks = useAppStore((s) => s.loadTasks)
  const categories = useAppStore((s) => s.categories)
  const dailyGoalMinutes = useAppStore((s) => s.dailyGoalMinutes)
  const guardianSettings = useAppStore((s) => s.guardianSettings)
  const focusState = useAppStore((s) => s.focusState)
  const [loading, setLoading] = useState(true)

  // Guardian modal states
  const [showMorningRitual, setShowMorningRitual] = useState(false)

  const today = todayStr()
  const todayActivities = activities.filter((a) => a.startTime.slice(0, 10) === today)
  const todayMinutes = Math.round(todayActivities.reduce((sum, a) => sum + (a.duration || 0), 0))
  const goalProgress = dailyGoalMinutes > 0 ? Math.min(100, Math.round((todayMinutes / dailyGoalMinutes) * 100)) : 0

  // 计算今日各分类时间分布
  const categoryTimeMap = todayActivities.reduce((acc, a) => {
    const catName = a.category || '其他'
    acc[catName] = (acc[catName] || 0) + (a.duration || 0)
    return acc
  }, {} as Record<string, number>)

  const categoryTimeList = Object.entries(categoryTimeMap)
    .map(([catName, mins]) => {
      const category = categories.find((c: any) => c.name === catName)
      return {
        category: category || {
          id: 'uncategorized',
          name: catName,
          color: 'var(--color-border-strong)',
        },
        minutes: Math.round(mins),
        percentage: todayMinutes > 0 ? Math.round((mins / todayMinutes) * 100) : 0,
      }
    })
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 5)

  const isFocusing = focusState === 'working'
  const completedTasks = tasks.filter((t) => t.status === 'completed').length
  const pendingTasks = tasks.filter((t) => t.status !== 'completed' && t.status !== 'archived').length

  useEffect(() => {
    Promise.all([loadActivities(), loadTasks()]).finally(() => setLoading(false))
  }, [loadActivities, loadTasks])

  // Auto-trigger Morning Ritual and Daily Review
  const lastMorningRitualDate = useAppStore((s) => s.lastMorningRitualDate)

  useEffect(() => {
    if (loading) return

    const today = todayStr()
    const currentHour = new Date().getHours()

    // Check Morning Ritual: 5:00 - 18:00, and not done today
    if (
      guardianSettings.morningRitualEnabled &&
      currentHour >= 5 &&
      currentHour < 18 &&
      lastMorningRitualDate !== today
    ) {
      // Delay 1 second to not overwhelm user on page load
      const timer = setTimeout(() => setShowMorningRitual(true), 1000)
      return () => clearTimeout(timer)
    }

  }, [loading, guardianSettings, lastMorningRitualDate])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-bg-base)' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[var(--color-accent)] border-t-transparent animate-spin" />
          <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading...</span>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Guardian Modals */}
      <MorningRitual
        isOpen={showMorningRitual}
        onComplete={() => setShowMorningRitual(false)}
      />

      <div className="min-h-screen px-8 py-8" style={{ background: 'var(--color-bg-base)' }}>
        {/* 🎯 Page Header - 用日期 + 打招呼，去掉 Dashboard */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-1" style={{ color: 'var(--color-text-primary)', fontFamily: 'Quicksand, sans-serif' }}>
            {getGreeting()}
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}
          </p>
        </div>

        {/* 📊 核心数据概览 - 更丰富的设计 */}
        <div
          onClick={() => navigate('/analytics')}
          className="mb-5 cursor-pointer transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
        >
          <div className="grid grid-cols-3 gap-3">
            {/* 今日专注卡片 */}
            <div
              className="p-5 rounded-2xl transition-all duration-200 hover:shadow-md"
              style={{
                background: 'var(--color-bg-surface-1)',
                border: '2px solid var(--color-blue)',
                boxShadow: '4px 4px 0px var(--color-blue-shadow)',
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2.5 mb-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: isFocusing ? 'var(--color-green-soft)' : 'var(--color-blue-soft)' }}
                    >
                      <Sparkles size={20} style={{ color: isFocusing ? 'var(--color-green)' : 'var(--color-blue)' }} />
                    </div>
                    <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                      今日专注
                    </span>
                  </div>
                  <div className="text-3xl font-bold mb-1" style={{ color: 'var(--color-text-primary)', fontFamily: 'Quicksand, sans-serif' }}>
                    {Math.floor(todayMinutes / 60)}h {todayMinutes % 60}m
                  </div>
                  {isFocusing ? (
                    <div className="text-xs font-medium" style={{ color: 'var(--color-green)' }}>
                      🔥 正在专注中...
                    </div>
                  ) : (
                    <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      目标 {dailyGoalMinutes} 分钟
                    </div>
                  )}
                </div>
                {/* 垂直进度条装饰 */}
                <div className="relative w-3 h-14 flex-shrink-0">
                  <div className="w-full h-full rounded-full" style={{ background: 'var(--color-border-light)' }} />
                  <div
                    className="absolute bottom-0 w-full rounded-full transition-all duration-500"
                    style={{
                      height: `${Math.min(100, goalProgress)}%`,
                      background: isFocusing
                        ? 'linear-gradient(0deg, var(--color-green) 0%, var(--color-blue) 100%)'
                        : 'var(--color-blue-gradient)',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* 目标进度卡片 */}
            <div
              className="p-5 rounded-2xl transition-all duration-200 hover:shadow-md"
              style={{
                background: 'var(--color-bg-surface-1)',
                border: '2px solid var(--color-lemon)',
                boxShadow: '4px 4px 0px var(--color-lemon-shadow)',
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2.5 mb-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: goalProgress >= 100 ? 'var(--color-green-soft)' : 'var(--color-lemon-soft)' }}
                    >
                      <TrendingUp size={20} style={{ color: goalProgress >= 100 ? 'var(--color-green)' : 'var(--color-lemon)' }} />
                    </div>
                    <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                      目标进度
                    </span>
                  </div>
                  <div className="text-3xl font-bold mb-1" style={{ color: 'var(--color-text-primary)', fontFamily: 'Quicksand, sans-serif' }}>
                    {goalProgress}%
                  </div>
                  <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {goalProgress >= 100 ? '🎉 目标达成' : `还需 ${Math.max(0, dailyGoalMinutes - todayMinutes)} 分钟`}
                  </div>
                </div>
                {/* 小圆环进度指示器 */}
                <div className="relative w-12 h-12 flex-shrink-0">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="24"
                      cy="24"
                      r="20"
                      strokeWidth="3"
                      fill="none"
                      style={{ stroke: 'var(--color-border-light)' }}
                    />
                    <circle
                      cx="24"
                      cy="24"
                      r="20"
                      strokeWidth="3"
                      fill="none"
                      strokeDasharray={`${Math.min(100, goalProgress) * 1.26} 126`}
                      style={{
                        stroke: goalProgress >= 100
                          ? 'var(--color-green-gradient)'
                          : 'var(--color-lemon-gradient)',
                        strokeLinecap: 'round',
                      }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs" style={{ color: 'var(--color-text-primary)' }}>
                      {goalProgress >= 100 ? '✓' : '💪'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 任务完成卡片 */}
            <div
              className="p-5 rounded-2xl transition-all duration-200 hover:shadow-md"
              style={{
                background: 'var(--color-bg-surface-1)',
                border: '2px solid var(--color-purple)',
                boxShadow: '4px 4px 0px var(--color-purple-shadow)',
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2.5 mb-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: 'var(--color-purple-soft)' }}
                    >
                      <Calendar size={20} style={{ color: 'var(--color-purple)' }} />
                    </div>
                    <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                      任务完成
                    </span>
                  </div>
                  <div className="text-3xl font-bold mb-1" style={{ color: 'var(--color-text-primary)', fontFamily: 'Quicksand, sans-serif' }}>
                    {completedTasks} / {tasks.length}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {pendingTasks > 0 ? `${pendingTasks} 个待完成` : '✨ 全部完成'}
                  </div>
                </div>
                {/* 已完成任务头像堆叠预览 */}
                {completedTasks > 0 && (
                  <div className="flex -space-x-2 flex-shrink-0">
                    {[...Array(Math.min(2, completedTasks))].map((_, i) => (
                      <div
                        key={i}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{
                          background: `linear-gradient(135deg, var(--color-purple) 0%, var(--color-blue) 100%)`,
                          color: 'white',
                          border: '2px solid var(--color-bg-surface-1)',
                        }}
                      >
                        ✓
                      </div>
                    ))}
                    {completedTasks > 2 && (
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{
                          background: 'var(--color-bg-surface-2)',
                          color: 'var(--color-text-secondary)',
                          border: '2px solid var(--color-bg-surface-1)',
                        }}
                      >
                        +{completedTasks - 2}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 鼓励语只在专注时显示 */}
        {isFocusing && (
          <div className="mb-4 text-center">
            <p
              className="text-sm font-medium px-4 py-2 rounded-xl inline-block"
              style={{
                background: 'linear-gradient(135deg, var(--color-green-soft) 0%, var(--color-blue-soft) 100%)',
                color: 'var(--color-success-strong)',
              }}
            >
              🔥 正在专注 · {getEncouragement(goalProgress)}
            </p>
          </div>
        )}

        {/* 🕒 今日时间轴 - 可视化一天的时间块 */}
        <div
          className="mb-5 p-5 rounded-2xl transition-all duration-200"
          style={{
            background: 'var(--color-bg-surface-1)',
            border: '2px solid var(--color-border-strong)',
            boxShadow: '4px 4px 0px var(--color-border-strong)',
          }}
        >
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
            今日时间轴
          </h3>
          <div className="relative">
            {/* 小时刻度 */}
            <div className="flex justify-between mb-1">
              {[0, 3, 6, 9, 12, 15, 18, 21].map((h) => (
                <span
                  key={h}
                  className="text-xs"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {h}:00
                </span>
              ))}
            </div>
            {/* 时间轴背景 */}
            <div
              className="w-full h-8 rounded-lg overflow-hidden relative"
              style={{ background: 'var(--color-border-light)' }}
            >
              {/* 当前时间指示线 */}
              <div
                className="absolute top-0 bottom-0 w-0.5 z-10"
                style={{
                  left: `${(new Date().getHours() + new Date().getMinutes() / 60) / 24 * 100}%`,
                  background: 'var(--color-red)',
                  boxShadow: '0 0 4px var(--color-red)',
                }}
              />
              {/* 渲染活动时间块 - 简化版，显示今日各分类的总时间占比 */}
              {(() => {
                let left = 0
                // 从 6:00 开始显示，对应 25% 位置
                return categoryTimeList.map((item, index) => {
                  const width = (item.minutes / (24 * 60)) * 100
                  const result = (
                    <div
                      key={index}
                      className="absolute h-full transition-all duration-500"
                      style={{
                        left: `${left + 25}%`,
                        width: `${Math.min(width, 100 - left)}%`,
                        background: item.category.color,
                      }}
                    />
                  )
                  left += width
                  return result
                })
              })()}
            </div>
            {/* 时间轴图例 */}
            <div className="flex flex-wrap gap-3 mt-3">
              {categoryTimeList.slice(0, 4).map((item, index) => (
                <div key={index} className="flex items-center gap-1.5">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: item.category.color }}
                  />
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {item.category.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 🌟 NowEngine - 页面核心 */}
        <NowEngineCard />

        {/* 📊 今日时间分布 */}
        {categoryTimeList.length > 0 && (
          <div
            className="mt-4 p-5 rounded-2xl transition-all duration-200 hover:scale-[1.01]"
            style={{
              background: 'var(--color-bg-surface-1)',
              border: '2px solid var(--color-border-strong)',
              boxShadow: '4px 4px 0px var(--color-border-strong)',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                今日时间分布
              </h3>
              <button
                onClick={() => navigate('/analytics')}
                className="text-xs font-medium transition-all hover:opacity-80"
                style={{ color: 'var(--color-blue)' }}
              >
                查看详情 →
              </button>
            </div>

            {/* 进度条总览 */}
            <div className="w-full h-3 rounded-full overflow-hidden flex mb-4" style={{ background: 'var(--color-border-light)' }}>
              {categoryTimeList.map((item, index) => (
                <div
                  key={index}
                  className="h-full transition-all duration-500"
                  style={{
                    width: `${item.percentage}%`,
                    background: item.category.color,
                  }}
                />
              ))}
            </div>

            {/* 分类列表 */}
            <div className="space-y-2">
              {categoryTimeList.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ background: item.category.color }}
                    />
                    <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      {item.category.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {Math.floor(item.minutes / 60)}h {item.minutes % 60}m
                    </span>
                    <span className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>
                      {item.percentage}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
