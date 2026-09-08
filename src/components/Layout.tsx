import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import QuickAddButton from './QuickAddButton'

const TITLES: Record<string, string> = {
  '/': 'Farmacia',
  '/cepa': 'Cepa',
  '/engorde': 'Engorde',
  '/alimento': 'Alimento',
  '/ajustes': 'Ajustes',
}

export default function Layout() {
  const { theme, toggle } = useTheme()
  const { pathname } = useLocation()
  const title = TITLES[pathname] ?? 'Programa de gestión'

  return (
    <div className="mx-auto flex min-h-svh max-w-6xl flex-col px-4 py-4 md:px-6">
      <header className="surface mb-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl px-4 py-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-[var(--muted)] uppercase">
            Programa de gestión
          </p>
          <h1 className="font-display text-2xl md:text-3xl">{title}</h1>
        </div>
        <nav className="flex flex-wrap items-center gap-1">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `rounded-full px-3 py-1.5 text-sm font-semibold ${
                isActive ? 'nav-active bg-[var(--moss)]' : 'text-[var(--muted)] hover:bg-[var(--bg-muted)]'
              }`
            }
          >
            Farmacia
          </NavLink>
          <NavLink
            to="/cepa"
            className={({ isActive }) =>
              `rounded-full px-3 py-1.5 text-sm font-semibold ${
                isActive ? 'nav-active bg-[var(--moss)]' : 'text-[var(--muted)] hover:bg-[var(--bg-muted)]'
              }`
            }
          >
            Cepa
          </NavLink>
          <NavLink
            to="/engorde"
            className={({ isActive }) =>
              `rounded-full px-3 py-1.5 text-sm font-semibold ${
                isActive ? 'nav-active bg-[var(--moss)]' : 'text-[var(--muted)] hover:bg-[var(--bg-muted)]'
              }`
            }
          >
            Engorde
          </NavLink>
          <NavLink
            to="/alimento"
            className={({ isActive }) =>
              `rounded-full px-3 py-1.5 text-sm font-semibold ${
                isActive ? 'nav-active bg-[var(--moss)]' : 'text-[var(--muted)] hover:bg-[var(--bg-muted)]'
              }`
            }
          >
            Alimento
          </NavLink>
          <NavLink
            to="/ajustes"
            aria-label="Ajustes"
            title="Ajustes"
            className={({ isActive }) =>
              `btn btn-ghost btn-icon ml-1 ${isActive ? 'bg-[var(--bg-muted)] text-[var(--ink)]' : ''}`
            }
          >
            <GearIcon />
          </NavLink>
          <button className="btn btn-ghost ml-1" onClick={toggle} type="button">
            {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          </button>
        </nav>
      </header>
      <main className="flex-1 pb-24">
        <Outlet />
      </main>
      <QuickAddButton />
    </div>
  )
}

function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.6.9 1 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  )
}
