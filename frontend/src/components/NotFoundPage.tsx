import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'

interface Brick {
  x: number
  y: number
  width: number
  height: number
  alive: boolean
}

interface Ball {
  x: number
  y: number
  dx: number
  dy: number
  radius: number
}

interface Paddle {
  x: number
  y: number
  width: number
  height: number
}

export const NotFoundPage: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [gameStarted, setGameStarted] = useState(false)
  const [gameWon, setGameWon] = useState(false)
  const [bricksDestroyed, setBricksDestroyed] = useState(0)
  const [totalBricks, setTotalBricks] = useState(0)

  // Game state refs (to avoid re-renders during game loop)
  const ballRef = useRef<Ball>({ x: 0, y: 0, dx: 4, dy: -4, radius: 8 })
  const paddleRef = useRef<Paddle>({ x: 0, y: 0, width: 80, height: 12 })
  const bricksRef = useRef<Brick[]>([])
  const animationFrameRef = useRef<number>(0)
  const keysRef = useRef<{ left: boolean; right: boolean }>({ left: false, right: false })

  const initGame = useCallback((canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Initialize paddle
    paddleRef.current = {
      x: canvas.width / 2 - 40,
      y: canvas.height - 40,
      width: 80,
      height: 12,
    }

    // Initialize ball
    ballRef.current = {
      x: canvas.width / 2,
      y: canvas.height - 60,
      dx: 4,
      dy: -4,
      radius: 8,
    }

    // Create bricks that form "404"
    const bricks: Brick[] = []
    const brickWidth = 20
    const brickHeight = 10
    const startX = canvas.width / 2 - 150
    const startY = 100

    // 4 pattern (first digit)
    const four1 = [
      [0, 0, 0, 1],
      [0, 0, 1, 1],
      [0, 1, 0, 1],
      [1, 1, 1, 1],
      [0, 0, 0, 1],
      [0, 0, 0, 1],
    ]

    // 0 pattern
    const zero = [
      [1, 1, 1, 1],
      [1, 0, 0, 1],
      [1, 0, 0, 1],
      [1, 0, 0, 1],
      [1, 0, 0, 1],
      [1, 1, 1, 1],
    ]

    // 4 pattern (last digit)
    const four2 = [
      [0, 0, 0, 1],
      [0, 0, 1, 1],
      [0, 1, 0, 1],
      [1, 1, 1, 1],
      [0, 0, 0, 1],
      [0, 0, 0, 1],
    ]

    const patterns = [four1, zero, four2]
    const gap = 20

    patterns.forEach((pattern, pIndex) => {
      const offsetX = startX + pIndex * (4 * brickWidth + gap)
      pattern.forEach((row, rowIndex) => {
        row.forEach((cell, colIndex) => {
          if (cell === 1) {
            bricks.push({
              x: offsetX + colIndex * brickWidth,
              y: startY + rowIndex * brickHeight * 1.5,
              width: brickWidth - 2,
              height: brickHeight,
              alive: true,
            })
          }
        })
      })
    })

    // Add some bug sprites scattered around
    const bugPositions = [
      { x: canvas.width - 80, y: 120 },
      { x: 60, y: 200 },
      { x: canvas.width - 120, y: 280 },
      { x: 100, y: 350 },
      { x: canvas.width - 60, y: 180 },
    ]

    bugPositions.forEach((pos) => {
      bricks.push({
        x: pos.x,
        y: pos.y,
        width: 16,
        height: 16,
        alive: true,
      })
    })

    bricksRef.current = bricks
    setTotalBricks(bricks.length)
    setBricksDestroyed(0)
    setGameWon(false)
  }, [])

  const drawGame = useCallback((canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.fillStyle = '#1a0a0a'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw radial gradient background
    const gradient = ctx.createRadialGradient(
      canvas.width / 2,
      canvas.height / 2,
      0,
      canvas.width / 2,
      canvas.height / 2,
      canvas.width / 2,
    )
    gradient.addColorStop(0, 'rgba(139, 69, 69, 0.3)')
    gradient.addColorStop(1, 'rgba(26, 10, 10, 1)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw bricks
    bricksRef.current.forEach((brick, index) => {
      if (brick.alive) {
        // Check if it's a bug (last 5 bricks)
        const isBug = index >= bricksRef.current.length - 5

        if (isBug) {
          // Draw pixel bug/invader
          ctx.fillStyle = '#fff'
          ctx.font = '16px monospace'
          ctx.fillText('👾', brick.x, brick.y + 14)
        } else {
          // Draw regular brick with pixel style
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
          ctx.fillRect(brick.x, brick.y, brick.width, brick.height)

          // Pixel edge effect
          ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
          ctx.fillRect(brick.x + brick.width - 2, brick.y, 2, brick.height)
          ctx.fillRect(brick.x, brick.y + brick.height - 2, brick.width, 2)
        }
      }
    })

    // Draw paddle
    ctx.fillStyle = '#fff'
    ctx.fillRect(
      paddleRef.current.x,
      paddleRef.current.y,
      paddleRef.current.width,
      paddleRef.current.height,
    )

    // Draw ball
    ctx.beginPath()
    ctx.arc(ballRef.current.x, ballRef.current.y, ballRef.current.radius, 0, Math.PI * 2)
    ctx.fillStyle = '#fff'
    ctx.fill()
    ctx.closePath()
  }, [])

  const updateGame = useCallback((canvas: HTMLCanvasElement) => {
    const ball = ballRef.current
    const paddle = paddleRef.current

    // Move paddle
    if (keysRef.current.left && paddle.x > 0) {
      paddle.x -= 8
    }
    if (keysRef.current.right && paddle.x < canvas.width - paddle.width) {
      paddle.x += 8
    }

    // Move ball
    ball.x += ball.dx
    ball.y += ball.dy

    // Wall collision
    if (ball.x + ball.radius > canvas.width || ball.x - ball.radius < 0) {
      ball.dx = -ball.dx
    }
    if (ball.y - ball.radius < 0) {
      ball.dy = -ball.dy
    }

    // Bottom - reset ball
    if (ball.y + ball.radius > canvas.height) {
      ball.x = canvas.width / 2
      ball.y = canvas.height - 60
      ball.dx = 4 * (Math.random() > 0.5 ? 1 : -1)
      ball.dy = -4
    }

    // Paddle collision
    if (
      ball.y + ball.radius > paddle.y &&
      ball.y - ball.radius < paddle.y + paddle.height &&
      ball.x > paddle.x &&
      ball.x < paddle.x + paddle.width
    ) {
      ball.dy = -Math.abs(ball.dy)
      // Adjust angle based on where ball hits paddle
      const hitPos = (ball.x - paddle.x) / paddle.width
      ball.dx = 8 * (hitPos - 0.5)
    }

    // Brick collision
    let destroyed = 0
    bricksRef.current.forEach((brick) => {
      if (brick.alive) {
        if (
          ball.x + ball.radius > brick.x &&
          ball.x - ball.radius < brick.x + brick.width &&
          ball.y + ball.radius > brick.y &&
          ball.y - ball.radius < brick.y + brick.height
        ) {
          brick.alive = false
          ball.dy = -ball.dy
          destroyed++
        }
      } else {
        destroyed++
      }
    })

    setBricksDestroyed(destroyed)

    // Check win condition
    if (destroyed === bricksRef.current.length && bricksRef.current.length > 0) {
      setGameWon(true)
    }
  }, [])

  const gameLoop = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !gameStarted || gameWon) return

    updateGame(canvas)
    drawGame(canvas)
    animationFrameRef.current = requestAnimationFrame(gameLoop)
  }, [gameStarted, gameWon, updateGame, drawGame])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Set canvas size
    canvas.width = Math.min(600, window.innerWidth - 40)
    canvas.height = 500

    initGame(canvas)
    drawGame(canvas)

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') keysRef.current.left = true
      if (e.key === 'ArrowRight' || e.key === 'd') keysRef.current.right = true
      if (e.key === ' ' && !gameStarted) setGameStarted(true)
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') keysRef.current.left = false
      if (e.key === 'ArrowRight' || e.key === 'd') keysRef.current.right = false
    }

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      paddleRef.current.x = Math.max(
        0,
        Math.min(canvas.width - paddleRef.current.width, mouseX - paddleRef.current.width / 2),
      )
    }

    const handleClick = () => {
      if (!gameStarted) setGameStarted(true)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('click', handleClick)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      canvas.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('click', handleClick)
      cancelAnimationFrame(animationFrameRef.current)
    }
  }, [initGame, drawGame, gameStarted])

  useEffect(() => {
    if (gameStarted && !gameWon) {
      gameLoop()
    }
    return () => cancelAnimationFrame(animationFrameRef.current)
  }, [gameStarted, gameWon, gameLoop])

  return (
    <div className="min-h-screen bg-[#1a0a0a] flex flex-col items-center justify-center px-4 py-8">
      {/* Header text */}
      <div className="text-center mb-6">
        <p className="text-white/60 font-mono text-sm mb-2">Oops, something went wrong.</p>
        <p className="text-white/60 font-mono text-sm">Defeat the Bugs to return home.</p>
      </div>

      {/* Game canvas */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          className="rounded-lg cursor-pointer"
          style={{
            background: 'linear-gradient(180deg, #2d1515 0%, #1a0a0a 100%)',
            boxShadow: '0 0 60px rgba(139, 69, 69, 0.3)',
          }}
        />

        {/* Start overlay */}
        {!gameStarted && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
            <div className="text-center">
              <p className="text-white text-lg font-medium mb-2">Click or press Space to start</p>
              <p className="text-white/60 text-sm">Use arrow keys or mouse to move</p>
            </div>
          </div>
        )}

        {/* Win overlay */}
        {gameWon && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-lg">
            <div className="text-center">
              <p className="text-white text-2xl font-bold mb-4">🎉 Bugs Defeated!</p>
              <Link
                to="/"
                className="inline-block px-6 py-3 bg-white text-black font-medium rounded-full hover:bg-white/90 transition-colors"
              >
                Return Home
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Progress */}
      <div className="mt-6 text-center">
        <p className="text-white/40 text-sm font-mono">
          {bricksDestroyed} / {totalBricks} destroyed
        </p>
      </div>

      {/* Skip link */}
      <Link to="/" className="mt-8 text-white/40 hover:text-white/60 text-sm transition-colors">
        Skip game and go home →
      </Link>
    </div>
  )
}
