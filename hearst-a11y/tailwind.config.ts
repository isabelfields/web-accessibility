import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#edf4fc',
          100: '#d0e4f7',
          400: '#5b9bd6',
          500: '#3B7EC8',
          600: '#2f6ab0',
          700: '#2d63a0',
          900: '#1a3a5c',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
