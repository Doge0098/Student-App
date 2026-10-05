import { ToastProvider } from './components/Toast'
import { AccountsProvider } from './features/accounts/AccountsContext'
import { StudyBrowser } from './features/browser/StudyBrowser'
import { useFocusLayoutClass } from './features/focus/useFocusLayoutClass'
import { MusicProvider } from './features/music/MusicContext'
import { MusicPanel } from './features/music/MusicPanel'
import { AppearanceProvider } from './features/settings/AppearanceContext'
import { TaskList } from './features/tasks/TaskList'
import { FocusTimer } from './features/timer/FocusTimer'
import { TimerProvider } from './features/timer/TimerContext'
import { TimerPrompt } from './features/timer/TimerPrompt'
import { TopBar } from './TopBar'

/** Maquetación: dentro de los proveedores para saber si este reloj está en un bloque (modo foco). */
function Layout() {
  const focusClass = useFocusLayoutClass()
  return (
    <main className={focusClass ? `layout ${focusClass}` : 'layout'}>
      <div className="col col-left">
        <FocusTimer />
        <TaskList />
      </div>
      <div className="col col-main">
        <StudyBrowser />
      </div>
      <div className="col col-right">
        <MusicPanel />
      </div>
    </main>
  )
}

export default function App() {
  return (
    <AppearanceProvider>
      <ToastProvider>
        <AccountsProvider>
          <TimerProvider>
            <MusicProvider>
              <div className="app">
                <TopBar />
                <Layout />
              </div>
              <TimerPrompt />
            </MusicProvider>
          </TimerProvider>
        </AccountsProvider>
      </ToastProvider>
    </AppearanceProvider>
  )
}
