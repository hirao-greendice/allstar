import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, TouchEvent } from 'react'
import './App.css'

const AREA_COLUMNS = 2
const AREA_ROWS = 3
const AREA_SIZE = 7
const VISIBLE_TILES = 10

const STAGE_COLUMNS = AREA_COLUMNS * AREA_SIZE
const STAGE_ROWS = AREA_ROWS * AREA_SIZE
const INITIAL_PLAYER = { x: 3, y: 10 }

type Position = {
  x: number
  y: number
}

type SwipePoint = {
  x: number
  y: number
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

const getAreaFromPosition = (position: Position) => ({
  column: Math.floor(position.x / AREA_SIZE),
  row: Math.floor(position.y / AREA_SIZE),
})

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
  const swipeStartRef = useRef<SwipePoint | null>(null)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const nextPosition = moveByKey(event.key, playerPosition)

      if (
        nextPosition.x === playerPosition.x &&
        nextPosition.y === playerPosition.y
      ) {
        return
      }

      event.preventDefault()
      setPlayerPosition(nextPosition)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [playerPosition])

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

  const currentArea = getAreaFromPosition(playerPosition)
  const focusX = currentArea.column * AREA_SIZE + AREA_SIZE / 2
  const focusY = currentArea.row * AREA_SIZE + AREA_SIZE / 2

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
          '--focus-x': focusX,
          '--focus-y': focusY,
          '--player-x': playerPosition.x,
          '--player-y': playerPosition.y,
        } as CSSProperties
      }
    >
      <div className="viewport">
        <div className="stage">
          <div className="tiles">{tiles}</div>
          <div className="player" />
        </div>
      </div>
    </main>
  )
}
