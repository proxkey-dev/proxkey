import React from 'react'
import { motion } from 'motion/react'

interface ProxKeyLogoProps {
  size?: number
  animated?: boolean
  className?: string
}

/**
 * Abstract ProxKey logo - A geometric key/lock symbol
 * Represents: Security, Access Control, Dynamic Keys
 */
export const ProxKeyLogo: React.FC<ProxKeyLogoProps> = ({
  size = 64,
  animated = true,
  className = '',
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        {/* Gradient for the key */}
        <linearGradient id="keyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fb923c" />
          <stop offset="100%" stopColor="#ea580c" />
        </linearGradient>

        {/* Glow filter */}
        <filter id="logoGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Outer hexagon ring (access control boundary) */}
      {animated ? (
        <motion.path
          d="M32 6 L50 16 L50 36 L32 46 L14 36 L14 16 Z"
          stroke="url(#keyGradient)"
          strokeWidth="2"
          fill="none"
          filter="url(#logoGlow)"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.6 }}
          transition={{ duration: 2, ease: 'easeInOut' }}
        />
      ) : (
        <path
          d="M32 6 L50 16 L50 36 L32 46 L14 36 L14 16 Z"
          stroke="url(#keyGradient)"
          strokeWidth="2"
          fill="none"
          opacity="0.6"
        />
      )}

      {/* Central key symbol */}
      <g filter="url(#logoGlow)">
        {/* Key head (circular lock) */}
        {animated ? (
          <motion.circle
            cx="24"
            cy="26"
            r="6"
            stroke="url(#keyGradient)"
            strokeWidth="2.5"
            fill="none"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
          />
        ) : (
          <circle cx="24" cy="26" r="6" stroke="url(#keyGradient)" strokeWidth="2.5" fill="none" />
        )}

        {/* Key shaft */}
        {animated ? (
          <motion.line
            x1="30"
            y1="26"
            x2="44"
            y2="26"
            stroke="url(#keyGradient)"
            strokeWidth="2.5"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.6, delay: 0.8 }}
          />
        ) : (
          <line
            x1="30"
            y1="26"
            x2="44"
            y2="26"
            stroke="url(#keyGradient)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        )}

        {/* Key teeth (access pattern) */}
        {animated ? (
          <>
            <motion.line
              x1="38"
              y1="26"
              x2="38"
              y2="30"
              stroke="url(#keyGradient)"
              strokeWidth="2"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.3, delay: 1.1 }}
            />
            <motion.line
              x1="42"
              y1="26"
              x2="42"
              y2="32"
              stroke="url(#keyGradient)"
              strokeWidth="2"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.3, delay: 1.2 }}
            />
          </>
        ) : (
          <>
            <line
              x1="38"
              y1="26"
              x2="38"
              y2="30"
              stroke="url(#keyGradient)"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <line
              x1="42"
              y1="26"
              x2="42"
              y2="32"
              stroke="url(#keyGradient)"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </>
        )}

        {/* Center dot (dynamic indicator) */}
        {animated ? (
          <motion.circle
            cx="24"
            cy="26"
            r="2"
            fill="url(#keyGradient)"
            initial={{ scale: 0 }}
            animate={{
              scale: [0, 1.2, 1],
              opacity: [0, 1, 0.8],
            }}
            transition={{
              duration: 1,
              delay: 1.3,
            }}
          />
        ) : (
          <circle cx="24" cy="26" r="2" fill="url(#keyGradient)" opacity="0.8" />
        )}
      </g>

      {/* Corner accent marks (technical/HUD style) */}
      <g stroke="url(#keyGradient)" strokeWidth="1.5" opacity="0.4">
        <path d="M8 12 L8 8 L12 8" />
        <path d="M52 8 L56 8 L56 12" />
        <path d="M56 40 L56 44 L52 44" />
        <path d="M12 44 L8 44 L8 40" />
      </g>

      {/* Animated pulse ring */}
      {animated && (
        <motion.circle
          cx="24"
          cy="26"
          r="8"
          stroke="#fb923c"
          strokeWidth="1"
          fill="none"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{
            scale: [0.8, 1.5],
            opacity: [0.6, 0],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeOut',
          }}
        />
      )}
    </svg>
  )
}

/**
 * Exportable SVG string for use in other contexts
 */
export const ProxKeyLogoSVG = `
<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="keyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fb923c" />
      <stop offset="100%" stop-color="#ea580c" />
    </linearGradient>
  </defs>
  
  <!-- Outer hexagon ring -->
  <path d="M32 6 L50 16 L50 36 L32 46 L14 36 L14 16 Z" 
        stroke="url(#keyGradient)" 
        stroke-width="2" 
        fill="none" 
        opacity="0.6" />
  
  <!-- Key head -->
  <circle cx="24" cy="26" r="6" 
          stroke="url(#keyGradient)" 
          stroke-width="2.5" 
          fill="none" />
  
  <!-- Key shaft -->
  <line x1="30" y1="26" x2="44" y2="26" 
        stroke="url(#keyGradient)" 
        stroke-width="2.5" 
        stroke-linecap="round" />
  
  <!-- Key teeth -->
  <line x1="38" y1="26" x2="38" y2="30" 
        stroke="url(#keyGradient)" 
        stroke-width="2" 
        stroke-linecap="round" />
  <line x1="42" y1="26" x2="42" y2="32" 
        stroke="url(#keyGradient)" 
        stroke-width="2" 
        stroke-linecap="round" />
  
  <!-- Center dot -->
  <circle cx="24" cy="26" r="2" 
          fill="url(#keyGradient)" 
          opacity="0.8" />
  
  <!-- Corner accents -->
  <g stroke="url(#keyGradient)" stroke-width="1.5" opacity="0.4">
    <path d="M8 12 L8 8 L12 8" />
    <path d="M52 8 L56 8 L56 12" />
    <path d="M56 40 L56 44 L52 44" />
    <path d="M12 44 L8 44 L8 40" />
  </g>
</svg>
`
