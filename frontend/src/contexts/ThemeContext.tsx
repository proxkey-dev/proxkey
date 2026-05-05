import React, { createContext, useContext, useState, useEffect } from 'react'

type Theme = 'default' | '80s' | 'galaxy' | 'minimal' | 'cyberpunk'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  isDark: boolean
  toggleDarkMode: () => void
  themeConfigs: typeof themeConfigs
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

interface ThemeProviderProps {
  children: React.ReactNode
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>('default')
  const [isDark, setIsDark] = useState(true)

  useEffect(() => {
    // Load theme from localStorage
    const savedTheme = localStorage.getItem('proxkey-theme') as Theme
    const savedDarkMode = localStorage.getItem('proxkey-dark-mode') === 'true'

    if (savedTheme) {
      setTheme(savedTheme)
    }
    if (savedDarkMode !== null) {
      setIsDark(savedDarkMode)
    }
  }, [])

  useEffect(() => {
    // Apply theme to document
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.classList.toggle('dark', isDark)

    // Save to localStorage
    localStorage.setItem('proxkey-theme', theme)
    localStorage.setItem('proxkey-dark-mode', isDark.toString())
  }, [theme, isDark])

  const toggleDarkMode = () => {
    setIsDark(!isDark)
  }

  const value = {
    theme,
    setTheme,
    isDark,
    toggleDarkMode,
    themeConfigs,
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

// Theme configurations
export const themeConfigs = {
  default: {
    name: 'ProxKey Default',
    description: 'The classic ProxKey experience',
    colors: {
      primary: '#00f5ff',
      secondary: '#39ff14',
      accent: '#8b5cf6',
    },
    className: 'theme-default',
  },
  '80s': {
    name: '80s Retro',
    description: 'Neon lights and synthwave vibes',
    colors: {
      primary: '#ff0080',
      secondary: '#00ff80',
      accent: '#ffff00',
    },
    className: 'theme-80s',
  },
  galaxy: {
    name: 'Galaxy Explorer',
    description: 'Journey through the cosmos',
    colors: {
      primary: '#6c5ce7',
      secondary: '#a29bfe',
      accent: '#fd79a8',
    },
    className: 'theme-galaxy',
  },
  minimal: {
    name: 'Minimalist',
    description: 'Clean and simple design',
    colors: {
      primary: '#2d3748',
      secondary: '#4a5568',
      accent: '#718096',
    },
    className: 'theme-minimal',
  },
  cyberpunk: {
    name: 'Cyberpunk',
    description: 'High-tech, low-life aesthetic',
    colors: {
      primary: '#00ff41',
      secondary: '#ff073a',
      accent: '#00d4ff',
    },
    className: 'theme-cyberpunk',
  },
}
