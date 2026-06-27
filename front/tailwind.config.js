/** @type {import('tailwindcss').Config} */
// Цвета вынесены в CSS-переменные (см. src/index.css) для светлой/тёмной темы.
// Утилиты вида bg-surface / text-muted / border-line ссылаются на эти переменные.
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        surface2: 'var(--surface2)',
        text: 'var(--text)',
        muted: 'var(--muted)',
        faint: 'var(--faint)',
        line: 'var(--line)',
        line2: 'var(--line2)',
        green: 'var(--green)',
        'green-d': 'var(--green-d)',
        'green-tint': 'var(--green-tint)',
        orange: 'var(--orange)',
        'orange-tint': 'var(--orange-tint)',
        ink: 'var(--ink)',
        amber: 'var(--amber)',
        'amber-tint': 'var(--amber-tint)',
        red: 'var(--red)',
        'red-tint': 'var(--red-tint)',
        gst: 'var(--gst)',
        'gst-tint': 'var(--gst-tint)',
      },
      fontFamily: {
        head: ['Oswald', 'system-ui', 'sans-serif'],
        body: ['Onest', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: 'var(--shadow)',
        'card-sm': 'var(--shadow-sm)',
      },
      keyframes: {
        fadeUp: { from: { opacity: 0, transform: 'translateY(10px)' }, to: { opacity: 1, transform: 'none' } },
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        screenIn: { from: { transform: 'translateY(9px)', opacity: 0.4 }, to: { transform: 'none', opacity: 1 } },
        pop: { '0%': { transform: 'scale(.85)', opacity: 0 }, '60%': { transform: 'scale(1.04)' }, '100%': { transform: 'scale(1)', opacity: 1 } },
        slideUp: { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
        spin: { to: { transform: 'rotate(360deg)' } },
      },
      animation: {
        fadeUp: 'fadeUp .3s ease',
        fadeIn: 'fadeIn .35s ease',
        screenIn: 'screenIn .34s cubic-bezier(.2,.7,.2,1)',
        pop: 'pop .4s ease both',
        slideUp: 'slideUp .32s cubic-bezier(.2,.8,.2,1)',
      },
    },
  },
  plugins: [],
};
