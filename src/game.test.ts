import { describe, expect, it } from 'vitest'
import { advanceDistance, clampLane, rectanglesOverlap, scoreFromDistance } from './game'

describe('Volt Lane game logic', () => {
  it('keeps a left lane change on lane zero from leaving the road', () => {
    expect(clampLane(0 - 1)).toBe(0)
  })

  it('detects a crash when the player and traffic rectangles overlap', () => {
    const player = { x: 20, y: 30, width: 50, height: 90 }
    const traffic = { x: 55, y: 80, width: 48, height: 82 }

    expect(rectanglesOverlap(player, traffic)).toBe(true)
  })

  it('increases the distance score as the driver survives longer', () => {
    const shortRun = advanceDistance(0, 3, 18)
    const longRun = advanceDistance(shortRun, 3, 18)

    expect(scoreFromDistance(longRun)).toBeGreaterThan(scoreFromDistance(shortRun))
  })
})
