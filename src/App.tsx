import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, TouchEvent } from 'react'
import './App.css'

const AREA_COLUMNS = 2
const AREA_ROWS = 3
const AREA_SIZE = 7
const VIEW_MARGIN_TILES = 0.5
const STAGE_EDGE_TILES = 0.5
const VISIBLE_TILES = AREA_SIZE + VIEW_MARGIN_TILES * 2
const DEADZONE_RADIUS = 1.25

const STAGE_COLUMNS = AREA_COLUMNS * AREA_SIZE
const STAGE_ROWS = AREA_ROWS * AREA_SIZE
const INITIAL_PLAYER = { x: 3, y: 10 }
const TOTAL_STAGE_COLUMNS = STAGE_COLUMNS + STAGE_EDGE_TILES * 2
const TOTAL_STAGE_ROWS = STAGE_ROWS + STAGE_EDGE_TILES * 2

const CAMERA_OPTIONS = [
  { id: 'area', label: 'エリア', duration: 960 },
  { id: 'player', label: '中央', duration: 220 },
  { id: 'deadzone', label: 'デッド', duration: 320 },
] as const

type Position = {
  x: number
  y: number
}

type SwipePoint = {
  x: number
  y: number
}

type CameraMode = (typeof CAMERA_OPTIONS)[number]['id']

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

const getAreaFromPosition = (position: Position) => ({
  column: Math.floor(position.x / AREA_SIZE),
  row: Math.floor(position.y / AREA_SIZE),
})

const clampCameraFocus = (focus: Position) => ({
  x: clamp(focus.x, VISIBLE_TILES / 2, TOTAL_STAGE_COLUMNS - VISIBLE_TILES / 2),
  y: clamp(focus.y, VISIBLE_TILES / 2, TOTAL_STAGE_ROWS - VISIBLE_TILES / 2),
})

const getPlayerFocus = (position: Position) =>
  clampCameraFocus({
    x: position.x + 0.5 + STAGE_EDGE_TILES,
    y: position.y + 0.5 + STAGE_EDGE_TILES,
  })

const getAreaFocus = (position: Position) => {
  const area = getAreaFromPosition(position)

  return clampCameraFocus({
    x: area.column * AREA_SIZE + AREA_SIZE / 2 + STAGE_EDGE_TILES,
    y: area.row * AREA_SIZE + AREA_SIZE / 2 + STAGE_EDGE_TILES,
  })
}

const isMovementKey = (key: string) =>
  ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'W', 'a', 'A', 's', 'S', 'd', 'D'].includes(
    key,
  )

const moveByKey = (key: string, position: Position): Position => {
  switch (key) {
    case 'ArrowUp':
    case 'w':
    case 'W':
      return { x: position.x, y: clamp(position.y - 1, 0, STAGE_ROWS - 1) }
    case 'ArrowDown':
    case 's':
    case 'S':
      return { x: position.x, y: clamp(position.y + 1, 0, STAGE_ROWS - 1) }
    case 'ArrowLeft':
    case 'a':
    case 'A':
      return { x: clamp(position.x - 1, 0, STAGE_COLUMNS - 1), y: position.y }
    case 'ArrowRight':
    case 'd':
    case 'D':
      return { x: clamp(position.x + 1, 0, STAGE_COLUMNS - 1), y: position.y }
    default:
      return position
  }
}

const moveByDirection = (
  direction: 'up' | 'down' | 'left' | 'right',
  position: Position,
): Position => {
  switch (direction) {
    case 'up':
      return { x: position.x, y: clamp(position.y - 1, 0, STAGE_ROWS - 1) }
    case 'down':
      return { x: position.x, y: clamp(position.y + 1, 0, STAGE_ROWS - 1) }
    case 'left':
      return { x: clamp(position.x - 1, 0, STAGE_COLUMNS - 1), y: position.y }
    case 'right':
      return { x: clamp(position.x + 1, 0, STAGE_COLUMNS - 1), y: position.y }
  }
}

export default function App() {
  const [playerPosition, setPlayerPosition] = useState(INITIAL_PLAYER)
  const [cameraMode, setCameraMode] = useState<CameraMode>('area')
  const [deadzoneFocus, setDeadzoneFocus] = useState(() =>
    getPlayerFocus(INITIAL_PLAYER),
  )
  const swipeStartRef = useRef<SwipePoint | null>(null)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isMovementKey(event.key)) {
        return
      }

      event.preventDefault()
      setPlayerPosition((currentPosition) => moveByKey(event.key, currentPosition))
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.changedTouches[0]

    swipeStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
    }
  }

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const swipeStart = swipeStartRef.current

    if (!swipeStart) {
      return
    }

    const touch = event.changedTouches[0]
    const deltaX = touch.clientX - swipeStart.x
    const deltaY = touch.clientY - swipeStart.y
    const minimumSwipeDistance = 24

    swipeStartRef.current = null

    if (
      Math.abs(deltaX) < minimumSwipeDistance &&
      Math.abs(deltaY) < minimumSwipeDistance
    ) {
      return
    }

    const direction =
      Math.abs(deltaX) > Math.abs(deltaY)
        ? deltaX > 0
          ? 'right'
          : 'left'
        : deltaY > 0
          ? 'down'
          : 'up'

    setPlayerPosition((currentPosition) =>
      moveByDirection(direction, currentPosition),
    )
  }

  useEffect(() => {
    if (cameraMode !== 'deadzone') {
      return
    }

    const playerFocus = getPlayerFocus(playerPosition)

    setDeadzoneFocus((currentFocus) => {
      const nextFocus = { ...currentFocus }

      if (playerFocus.x < currentFocus.x - DEADZONE_RADIUS) {
        nextFocus.x = playerFocus.x + DEADZONE_RADIUS
      } else if (playerFocus.x > currentFocus.x + DEADZONE_RADIUS) {
        nextFocus.x = playerFocus.x - DEADZONE_RADIUS
      }

      if (playerFocus.y < currentFocus.y - DEADZONE_RADIUS) {
        nextFocus.y = playerFocus.y + DEADZONE_RADIUS
      } else if (playerFocus.y > currentFocus.y + DEADZONE_RADIUS) {
        nextFocus.y = playerFocus.y - DEADZONE_RADIUS
      }

      const clampedFocus = clampCameraFocus(nextFocus)

      if (
        clampedFocus.x === currentFocus.x &&
        clampedFocus.y === currentFocus.y
      ) {
        return currentFocus
      }

      return clampedFocus
    })
  }, [cameraMode, playerPosition])

  const currentArea = getAreaFromPosition(playerPosition)
  const playerFocus = getPlayerFocus(playerPosition)
  const areaFocus = getAreaFocus(playerPosition)
  const cameraFocus =
    cameraMode === 'player'
      ? playerFocus
      : cameraMode === 'deadzone'
        ? deadzoneFocus
        : areaFocus
  const currentCamera = CAMERA_OPTIONS.find((option) => option.id === cameraMode)!

  const tiles = Array.from({ length: STAGE_ROWS * STAGE_COLUMNS }, (_, index) => {
    const column = index % STAGE_COLUMNS
    const row = Math.floor(index / STAGE_COLUMNS)
    const areaColumn = Math.floor(column / AREA_SIZE)
    const areaRow = Math.floor(row / AREA_SIZE)
    const isCurrentArea =
      areaColumn === currentArea.column && areaRow === currentArea.row

    const classes = ['tile']

    classes.push((areaColumn + areaRow) % 2 === 0 ? 'tile--a' : 'tile--b')

    if (isCurrentArea) {
      classes.push('tile--current')
    }

    if (column % AREA_SIZE === AREA_SIZE - 1) {
      classes.push('tile--area-right')
    }

    if (row % AREA_SIZE === AREA_SIZE - 1) {
      classes.push('tile--area-bottom')
    }

    return <div key={`${column}-${row}`} className={classes.join(' ')} />
  })

  return (
    <main
      className="app"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={
        {
          '--grid-cols': STAGE_COLUMNS,
          '--grid-rows': STAGE_ROWS,
          '--visible-tiles': VISIBLE_TILES,
          '--stage-edge': STAGE_EDGE_TILES,
          '--focus-x': cameraFocus.x,
          '--focus-y': cameraFocus.y,
          '--player-x': playerPosition.x,
          '--player-y': playerPosition.y,
          '--camera-duration': `${currentCamera.duration}ms`,
        } as CSSProperties
      }
    >
      <div className="scene">
        <div className="viewport">
          <div className="stage">
            <div className="tiles">{tiles}</div>
            <div className="player" />
          </div>
          {cameraMode === 'deadzone' ? <div className="deadzone" /> : null}
        </div>

        <div className="camera-picker">
          {CAMERA_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={option.id === cameraMode ? 'camera-chip is-active' : 'camera-chip'}
              onClick={() => {
                if (option.id === 'deadzone') {
                  setDeadzoneFocus(getPlayerFocus(playerPosition))
                }

                setCameraMode(option.id)
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </main>
  )
}
