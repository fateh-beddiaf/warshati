/** @type {import('tailwindcss').Config} */

// `hsl(var(--x) / <alpha-value>)` lets utilities such as `bg-primary/10` work with the CSS-variable tokens.
const token = (name) => `hsl(var(--${name}) / <alpha-value>)`

// A semantic colour family: solid + text-on-solid + tinted surface + text-on-tinted-surface
const family = (name) => ({
  DEFAULT: token(name),
  foreground: token(`${name}-foreground`),
  soft: token(`${name}-soft`),
  'soft-foreground': token(`${name}-soft-foreground`)
})

module.exports = {
  darkMode: 'class',
  content: ['./src/renderer/index.html', './src/renderer/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        border: token('border'),
        input: token('input'),
        ring: token('ring'),
        background: token('background'),
        foreground: token('foreground'),
        primary: {
          DEFAULT: token('primary'),
          foreground: token('primary-foreground'),
          hover: token('primary-hover'),
          to: token('primary-to')
        },
        secondary: {
          DEFAULT: token('secondary'),
          foreground: token('secondary-foreground')
        },
        destructive: {
          DEFAULT: token('destructive'),
          foreground: token('destructive-foreground')
        },
        muted: {
          DEFAULT: token('muted'),
          foreground: token('muted-foreground')
        },
        accent: {
          DEFAULT: token('accent'),
          foreground: token('accent-foreground')
        },
        card: {
          DEFAULT: token('card'),
          foreground: token('card-foreground')
        },
        popover: {
          DEFAULT: token('popover'),
          foreground: token('popover-foreground')
        },
        overlay: token('overlay'),
        success: family('success'),
        warning: family('warning'),
        danger: family('danger'),
        'status-in-progress': family('status-in-progress'),
        'status-ready': family('status-ready'),
        'status-delivered': family('status-delivered'),
        'status-overdue': family('status-overdue'),
        sidebar: {
          DEFAULT: token('sidebar'),
          foreground: token('sidebar-foreground'),
          muted: token('sidebar-muted'),
          border: token('sidebar-border'),
          accent: token('sidebar-accent')
        }
      },
      borderRadius: {
        xl: 'calc(var(--radius) + 4px)',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      boxShadow: {
        soft: '0 1px 2px hsl(var(--shadow-color) / 0.06), 0 1px 3px hsl(var(--shadow-color) / 0.08)',
        card: '0 1px 2px hsl(var(--shadow-color) / 0.05), 0 4px 12px -2px hsl(var(--shadow-color) / 0.08)',
        pop: '0 10px 30px -6px hsl(var(--shadow-color) / 0.25), 0 4px 10px -4px hsl(var(--shadow-color) / 0.15)'
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary-to)) 100%)',
        'gradient-header':
          'linear-gradient(135deg, hsl(var(--primary) / 0.12) 0%, hsl(var(--primary-to) / 0.06) 60%, transparent 100%)'
      },
      fontFamily: {
        sans: ['"IBM Plex Sans Arabic"', '"Segoe UI"', 'Tahoma', 'Geneva', 'Verdana', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Consolas', '"Liberation Mono"', 'monospace']
      },
      keyframes: {
        'skeleton-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' }
        }
      },
      animation: {
        'skeleton-pulse': 'skeleton-pulse 1.6s ease-in-out infinite'
      }
    }
  },
  plugins: [require('tailwindcss-animate')]
}
