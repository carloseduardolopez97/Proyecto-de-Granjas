import { NavLink, Outlet } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'

export default function Layout() {
  const { theme, toggle } = useTheme()

  return (
    <div className="mx-auto flex min-h-svh max-w-6xl flex-col px-4 py-4 md:px-6">
      <header className="surface mb-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl px-4 py-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-[var(--muted)] uppercase">
            Programa de gestión
          </p>
          <h1 className="font-display text-2xl md:text-3xl">Farmacia</h1>
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
          <button className="btn btn-ghost ml-1" onClick={toggle} type="button">
            {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          </button>
        </nav>
      </header>
      <main className="flex-1 pb-10">
        <Outlet />
      </main>
    </div>
  )
}
