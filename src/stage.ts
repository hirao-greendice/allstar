export type Direction = 'up' | 'right' | 'down' | 'left'

export type Position = {
  x: number
  y: number
}

export type CellType = 'floor' | 'wall'

export type PlayerState = Position & {
  facing: Direction
}

export type Piston = Position & {
  id: string
  direction: Direction
}

export type StageBlueprint = {
  width: number
  height: number
  tiles: CellType[][]
  player: PlayerState
  balls: Position[]
  pistons: Piston[]
}

export const DEFAULT_STAGE_TEMPLATE = [
  '#######',
  '#.....#',
  '#>....#',
  '#...o<#',
  '#.....#',
  '#..N..#',
  '#.....#',
  '#######',
] as const

export const EMPTY_STAGE_TEMPLATE = [
  '#######',
  '#.....#',
  '#.....#',
  '#..N..#',
  '#.....#',
  '#.....#',
  '#######',
] as const

const PLAYER_CHAR_TO_DIRECTION: Record<string, Direction> = {
  N: 'up',
  E: 'right',
  S: 'down',
  W: 'left',
}

const DIRECTION_TO_PLAYER_CHAR: Record<Direction, string> = {
  up: 'N',
  right: 'E',
  down: 'S',
  left: 'W',
}

const PISTON_CHAR_TO_DIRECTION: Record<string, Direction> = {
  '^': 'up',
  '>': 'right',
  v: 'down',
  '<': 'left',
}

const DIRECTION_TO_PISTON_CHAR: Record<Direction, string> = {
  up: '^',
  right: '>',
  down: 'v',
  left: '<',
}

export const DIRECTION_VECTORS: Record<Direction, Position> = {
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
}

const keyOf = ({ x, y }: Position) => `${x},${y}`

export const addPosition = (position: Position, direction: Direction): Position => {
  const vector = DIRECTION_VECTORS[direction]

  return {
    x: position.x + vector.x,
    y: position.y + vector.y,
  }
}

export const isInsideStage = (stage: StageBlueprint, position: Position) =>
  position.x >= 0 &&
  position.y >= 0 &&
  position.x < stage.width &&
  position.y < stage.height

export const cloneStage = (stage: StageBlueprint): StageBlueprint => ({
  width: stage.width,
  height: stage.height,
  tiles: stage.tiles.map((row) => [...row]),
  player: { ...stage.player },
  balls: stage.balls.map((ball) => ({ ...ball })),
  pistons: stage.pistons.map((piston) => ({ ...piston })),
})

const positionEquals = (a: Position, b: Position) => a.x === b.x && a.y === b.y

const findBallIndex = (stage: StageBlueprint, position: Position) =>
  stage.balls.findIndex((ball) => positionEquals(ball, position))

const findPistonIndex = (stage: StageBlueprint, position: Position) =>
  stage.pistons.findIndex((piston) => positionEquals(piston, position))

const isWall = (stage: StageBlueprint, position: Position) =>
  !isInsideStage(stage, position) || stage.tiles[position.y][position.x] === 'wall'

const hasBall = (stage: StageBlueprint, position: Position) =>
  findBallIndex(stage, position) >= 0

const hasPiston = (stage: StageBlueprint, position: Position) =>
  findPistonIndex(stage, position) >= 0

const isBlockedForPlayer = (stage: StageBlueprint, position: Position) =>
  isWall(stage, position) || hasBall(stage, position) || hasPiston(stage, position)

const canBallEnter = (
  stage: StageBlueprint,
  position: Position,
  ignoredBallIndex: number,
) => {
  if (isWall(stage, position) || hasPiston(stage, position)) {
    return false
  }

  if (positionEquals(stage.player, position)) {
    return false
  }

  return !stage.balls.some(
    (ball, index) => index !== ignoredBallIndex && positionEquals(ball, position),
  )
}

const firstAvailableFloor = (stage: StageBlueprint) => {
  for (let y = 0; y < stage.height; y += 1) {
    for (let x = 0; x < stage.width; x += 1) {
      const position = { x, y }

      if (
        stage.tiles[y][x] === 'floor' &&
        !hasBall(stage, position) &&
        !hasPiston(stage, position)
      ) {
        return position
      }
    }
  }

  return null
}

export const normalizeStage = (stage: StageBlueprint): StageBlueprint => {
  const normalized = cloneStage(stage)
  const pistonKeys = new Set<string>()
  const ballKeys = new Set<string>()

  normalized.pistons = normalized.pistons
    .filter((piston) => isInsideStage(normalized, piston))
    .filter((piston) => normalized.tiles[piston.y][piston.x] === 'floor')
    .filter((piston) => {
      const key = keyOf(piston)

      if (pistonKeys.has(key)) {
        return false
      }

      pistonKeys.add(key)
      piston.id = `piston-${piston.x}-${piston.y}`
      return true
    })

  normalized.balls = normalized.balls
    .filter((ball) => isInsideStage(normalized, ball))
    .filter((ball) => normalized.tiles[ball.y][ball.x] === 'floor')
    .filter((ball) => !pistonKeys.has(keyOf(ball)))
    .filter((ball) => {
      const key = keyOf(ball)

      if (ballKeys.has(key)) {
        return false
      }

      ballKeys.add(key)
      return true
    })

  const playerBlocked =
    isWall(normalized, normalized.player) ||
    hasBall(normalized, normalized.player) ||
    hasPiston(normalized, normalized.player)

  if (playerBlocked) {
    const fallback = firstAvailableFloor(normalized)

    if (fallback) {
      normalized.player.x = fallback.x
      normalized.player.y = fallback.y
    } else {
      normalized.tiles[0][0] = 'floor'
      normalized.player.x = 0
      normalized.player.y = 0
    }
  }

  return normalized
}

export const parseStageTemplate = (rows: readonly string[]): StageBlueprint => {
  if (rows.length === 0) {
    throw new Error('Stage template must have at least one row.')
  }

  const width = rows[0].length

  if (width === 0) {
    throw new Error('Stage template rows must not be empty.')
  }

  const tiles: CellType[][] = []
  const balls: Position[] = []
  const pistons: Piston[] = []
  let player: PlayerState | null = null

  rows.forEach((row, y) => {
    if (row.length !== width) {
      throw new Error('Every stage row must use the same width.')
    }

    const tileRow: CellType[] = []

    row.split('').forEach((character, x) => {
      if (character === '#') {
        tileRow.push('wall')
        return
      }

      tileRow.push('floor')

      if (character === '.') {
        return
      }

      if (character === 'o') {
        balls.push({ x, y })
        return
      }

      if (character in PISTON_CHAR_TO_DIRECTION) {
        pistons.push({
          id: `piston-${x}-${y}`,
          x,
          y,
          direction: PISTON_CHAR_TO_DIRECTION[character],
        })
        return
      }

      if (character in PLAYER_CHAR_TO_DIRECTION) {
        if (player) {
          throw new Error('Stage template can only contain one player.')
        }

        player = {
          x,
          y,
          facing: PLAYER_CHAR_TO_DIRECTION[character],
        }
        return
      }

      throw new Error(`Unsupported stage character: ${character}`)
    })

    tiles.push(tileRow)
  })

  if (!player) {
    throw new Error('Stage template needs one player character (N/E/S/W).')
  }

  return normalizeStage({
    width,
    height: rows.length,
    tiles,
    player,
    balls,
    pistons,
  })
}

export const serializeStageTemplate = (stage: StageBlueprint) => {
  const rows: string[][] = stage.tiles.map((row) =>
    row.map((cell) => (cell === 'wall' ? '#' : '.')),
  )

  stage.balls.forEach((ball) => {
    rows[ball.y][ball.x] = 'o'
  })

  stage.pistons.forEach((piston) => {
    rows[piston.y][piston.x] = DIRECTION_TO_PISTON_CHAR[piston.direction]
  })

  rows[stage.player.y][stage.player.x] =
    DIRECTION_TO_PLAYER_CHAR[stage.player.facing]

  return rows.map((row) => row.join(''))
}

export const getSightTrace = (stage: StageBlueprint) => {
  const cells: Position[] = []
  let current = addPosition(stage.player, stage.player.facing)

  while (isInsideStage(stage, current)) {
    cells.push(current)

    if (isWall(stage, current) || hasBall(stage, current)) {
      return {
        cells,
        piston: null,
      }
    }

    const piston = stage.pistons.find((item) => positionEquals(item, current))

    if (piston) {
      return {
        cells,
        piston,
      }
    }

    current = addPosition(current, stage.player.facing)
  }

  return {
    cells,
    piston: null,
  }
}

const activatePiston = (stage: StageBlueprint, piston: Piston) => {
  const frontPosition = addPosition(piston, piston.direction)
  const ballIndex = findBallIndex(stage, frontPosition)

  if (ballIndex < 0) {
    return
  }

  let currentPosition = { ...stage.balls[ballIndex] }

  while (true) {
    const nextPosition = addPosition(currentPosition, piston.direction)

    if (!canBallEnter(stage, nextPosition, ballIndex)) {
      break
    }

    currentPosition = nextPosition
  }

  stage.balls[ballIndex] = currentPosition
}

export const advanceStage = (
  currentStage: StageBlueprint,
  direction: Direction,
): StageBlueprint => {
  const nextStage = cloneStage(currentStage)
  nextStage.player.facing = direction

  const moveTarget = addPosition(nextStage.player, direction)

  if (!isBlockedForPlayer(nextStage, moveTarget)) {
    nextStage.player.x = moveTarget.x
    nextStage.player.y = moveTarget.y
  }

  const lookedPiston = getSightTrace(nextStage).piston

  if (lookedPiston) {
    activatePiston(nextStage, lookedPiston)
  }

  return nextStage
}
