import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import './App.css'
import playerSpriteUrl from './assets/player-scout.svg'
import {
  advanceStage,
  cloneStage,
  DEFAULT_STAGE_TEMPLATE,
  EMPTY_STAGE_TEMPLATE,
  getSightTrace,
  normalizeStage,
  parseStageTemplate,
  serializeStageTemplate,
  type Direction,
  type Position,
  type StageBlueprint,
} from './stage'

const DIRECTION_TO_ROTATION: Record<Direction, string> = {
  up: '0deg',
  right: '90deg',
  down: '180deg',
  left: '270deg',
}

const DIRECTION_LABELS: Record<Direction, string> = {
  up: 'Up',
  right: 'Right',
  down: 'Down',
  left: 'Left',
}

const PLAYER_BRUSHES = [
  { id: 'player-up', label: 'Player Up', direction: 'up' },
  { id: 'player-right', label: 'Player Right', direction: 'right' },
  { id: 'player-down', label: 'Player Down', direction: 'down' },
  { id: 'player-left', label: 'Player Left', direction: 'left' },
] as const

const PISTON_BRUSHES = [
  { id: 'piston-up', label: 'Piston Up', direction: 'up' },
  { id: 'piston-right', label: 'Piston Right', direction: 'right' },
  { id: 'piston-down', label: 'Piston Down', direction: 'down' },
  { id: 'piston-left', label: 'Piston Left', direction: 'left' },
] as const

const BRUSHES = [
  { id: 'floor', label: 'Floor', symbol: '.' },
  { id: 'wall', label: 'Wall', symbol: '#' },
  { id: 'ball', label: 'Ball', symbol: 'o' },
  ...PLAYER_BRUSHES.map((brush) => ({
    id: brush.id,
    label: brush.label,
    symbol:
      brush.direction === 'up'
        ? 'N'
        : brush.direction === 'right'
          ? 'E'
          : brush.direction === 'down'
            ? 'S'
            : 'W',
  })),
  ...PISTON_BRUSHES.map((brush) => ({
    id: brush.id,
    label: brush.label,
    symbol:
      brush.direction === 'up'
        ? '^'
        : brush.direction === 'right'
          ? '>'
          : brush.direction === 'down'
            ? 'v'
            : '<',
  })),
] as const

type Brush = (typeof BRUSHES)[number]['id']

type BoardProps = {
  stage: StageBlueprint
  spriteUrl: string
  onCellClick?: (position: Position) => void
  sightCells?: Position[]
  lookedPistonId?: string | null
}

const positionKey = ({ x, y }: Position) => `${x}-${y}`

const resettableTags = new Set(['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT'])

const createStageFromTemplate = (rows: readonly string[]) => parseStageTemplate(rows)

const buildSnippet = (stage: StageBlueprint) =>
  ['const CUSTOM_STAGE = [', ...serializeStageTemplate(stage).map((row) => `  '${row}',`), '] as const'].join('\n')

const applyBrush = (
  stage: StageBlueprint,
  position: Position,
  brush: Brush,
): StageBlueprint => {
  const nextStage = cloneStage(stage)
  const { x, y } = position

  nextStage.tiles[y][x] = brush === 'wall' ? 'wall' : 'floor'
  nextStage.balls = nextStage.balls.filter((ball) => !(ball.x === x && ball.y === y))
  nextStage.pistons = nextStage.pistons.filter(
    (piston) => !(piston.x === x && piston.y === y),
  )

  if (brush === 'ball') {
    nextStage.balls.push({ x, y })
    return normalizeStage(nextStage)
  }

  const playerBrush = PLAYER_BRUSHES.find((item) => item.id === brush)

  if (playerBrush) {
    nextStage.player = {
      x,
      y,
      facing: playerBrush.direction,
    }
    return normalizeStage(nextStage)
  }

  const pistonBrush = PISTON_BRUSHES.find((item) => item.id === brush)

  if (pistonBrush) {
    nextStage.pistons.push({
      id: `piston-${x}-${y}`,
      x,
      y,
      direction: pistonBrush.direction,
    })
  }

  return normalizeStage(nextStage)
}

function Board({
  stage,
  spriteUrl,
  onCellClick,
  sightCells = [],
  lookedPistonId,
}: BoardProps) {
  const sightKeys = new Set(sightCells.map(positionKey))
  const boardStyle = {
    '--board-columns': stage.width,
    '--board-rows': stage.height,
    '--player-sprite': `url("${spriteUrl}")`,
  } as CSSProperties

  return (
    <div className="board" style={boardStyle}>
      <div className="board__cells">
        {stage.tiles.flatMap((row, y) =>
          row.map((cell, x) => {
            const isSight = sightKeys.has(positionKey({ x, y }))
            const cellClassName = [
              'board__cell',
              cell === 'wall' ? 'board__cell--wall' : 'board__cell--floor',
              isSight ? 'board__cell--sight' : '',
              onCellClick ? 'board__cell--editable' : '',
            ]
              .filter(Boolean)
              .join(' ')

            if (onCellClick) {
              return (
                <button
                  key={`${x}-${y}`}
                  aria-label={`Cell ${x + 1}, ${y + 1}`}
                  className={cellClassName}
                  onClick={() => onCellClick({ x, y })}
                  type="button"
                />
              )
            }

            return <div key={`${x}-${y}`} className={cellClassName} />
          }),
        )}
      </div>

      {stage.balls.map((ball) => (
        <div
          key={`ball-${ball.x}-${ball.y}`}
          className="board__entity board__entity--ball"
          style={
            {
              '--x': ball.x,
              '--y': ball.y,
            } as CSSProperties
          }
        />
      ))}

      {stage.pistons.map((piston) => (
        <div
          key={piston.id}
          className={[
            'board__entity',
            'board__entity--piston',
            lookedPistonId === piston.id ? 'board__entity--active' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={
            {
              '--x': piston.x,
              '--y': piston.y,
              '--rotation': DIRECTION_TO_ROTATION[piston.direction],
            } as CSSProperties
          }
        />
      ))}

      <div
        className="board__entity board__entity--player"
        style={
          {
            '--x': stage.player.x,
            '--y': stage.player.y,
            '--rotation': DIRECTION_TO_ROTATION[stage.player.facing],
          } as CSSProperties
        }
      />
    </div>
  )
}

export default function App() {
  const [draftStage, setDraftStage] = useState(() =>
    createStageFromTemplate(DEFAULT_STAGE_TEMPLATE),
  )
  const [gameStage, setGameStage] = useState(() => cloneStage(draftStage))
  const [selectedBrush, setSelectedBrush] = useState<Brush>('wall')
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle')

  const sight = getSightTrace(gameStage)
  const stageSnippet = buildSnippet(draftStage)

  const resetGame = (stage: StageBlueprint) => {
    setGameStage(cloneStage(stage))
  }

  const loadTemplate = (template: readonly string[]) => {
    const nextStage = createStageFromTemplate(template)
    setDraftStage(nextStage)
    resetGame(nextStage)
  }

  const handleMove = (direction: Direction) => {
    setGameStage((currentStage) => advanceStage(currentStage, direction))
  }

  const handleEditorClick = (position: Position) => {
    setDraftStage((currentStage) => {
      const nextStage = applyBrush(currentStage, position, selectedBrush)
      resetGame(nextStage)
      return nextStage
    })
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(stageSnippet)
      setCopyStatus('copied')
      window.setTimeout(() => setCopyStatus('idle'), 1600)
    } catch {
      setCopyStatus('failed')
      window.setTimeout(() => setCopyStatus('idle'), 2200)
    }
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLElement &&
        resettableTags.has(event.target.tagName)
      ) {
        return
      }

      const directionByKey: Record<string, Direction> = {
        ArrowUp: 'up',
        ArrowRight: 'right',
        ArrowDown: 'down',
        ArrowLeft: 'left',
        w: 'up',
        W: 'up',
        d: 'right',
        D: 'right',
        s: 'down',
        S: 'down',
        a: 'left',
        A: 'left',
      }

      if (event.key in directionByKey) {
        event.preventDefault()
        handleMove(directionByKey[event.key])
        return
      }

      if (event.key === 'r' || event.key === 'R') {
        event.preventDefault()
        resetGame(draftStage)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [draftStage])

  return (
    <main className="app">
      <section className="hero">
        <div className="hero__copy">
          <p className="eyebrow">Reference Look</p>
          <h1>Board visuals rebuilt around your sample image</h1>
          <p className="hero__text">
            The playfield now uses a white tile grid, heavy dark walls, red
            pistons, a bronze ball, and a small character sprite in the center.
          </p>
        </div>

        <div className="hero__rules">
          <p>
            Move with arrow keys or <code>WASD</code>. The player faces the last
            input direction.
          </p>
          <p>
            A piston activates only when it is directly visible in that line of
            sight. Balls slide until a wall or another blocker stops them.
          </p>
        </div>
      </section>

      <section className="workspace">
        <article className="panel">
          <div className="panel__header">
            <div>
              <p className="panel__eyebrow">Play Board</p>
              <h2>Live Test Stage</h2>
            </div>
            <button className="ghost-button" onClick={() => resetGame(draftStage)} type="button">
              Reset
            </button>
          </div>

          <Board
            stage={gameStage}
            spriteUrl={playerSpriteUrl}
            sightCells={sight.cells}
            lookedPistonId={sight.piston?.id ?? null}
          />

          <div className="status">
            <p>
              Facing <strong>{DIRECTION_LABELS[gameStage.player.facing]}</strong>
            </p>
            <p>
              Visible piston{' '}
              <strong>
                {sight.piston ? `${sight.piston.x + 1}, ${sight.piston.y + 1}` : 'None'}
              </strong>
            </p>
            <p>
              Quick reset <strong>R</strong>
            </p>
          </div>

          <div className="controls">
            <button onClick={() => handleMove('up')} type="button">
              Up
            </button>
            <button onClick={() => handleMove('left')} type="button">
              Left
            </button>
            <button onClick={() => handleMove('down')} type="button">
              Down
            </button>
            <button onClick={() => handleMove('right')} type="button">
              Right
            </button>
          </div>
        </article>

        <article className="panel">
          <div className="panel__header">
            <div>
              <p className="panel__eyebrow">Stage Builder</p>
              <h2>Editable Layout</h2>
            </div>
            <div className="template-actions">
              <button
                className="ghost-button"
                onClick={() => loadTemplate(DEFAULT_STAGE_TEMPLATE)}
                type="button"
              >
                Sample
              </button>
              <button
                className="ghost-button"
                onClick={() => loadTemplate(EMPTY_STAGE_TEMPLATE)}
                type="button"
              >
                Blank
              </button>
            </div>
          </div>

          <Board
            stage={draftStage}
            spriteUrl={playerSpriteUrl}
            onCellClick={handleEditorClick}
          />

          <div className="brushes">
            {BRUSHES.map((brush) => (
              <button
                key={brush.id}
                className={[
                  'brush',
                  selectedBrush === brush.id ? 'brush--selected' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => setSelectedBrush(brush.id)}
                type="button"
              >
                <span className="brush__symbol">{brush.symbol}</span>
                <span>{brush.label}</span>
              </button>
            ))}
          </div>

          <div className="export">
            <div className="export__header">
              <h3>Template Export</h3>
              <button className="ghost-button" onClick={handleCopy} type="button">
                {copyStatus === 'copied'
                  ? 'Copied'
                  : copyStatus === 'failed'
                    ? 'Failed'
                    : 'Copy'}
              </button>
            </div>
            <textarea readOnly spellCheck={false} value={stageSnippet} />
          </div>
        </article>
      </section>
    </main>
  )
}
