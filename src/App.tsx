import { ToastProvider } from './components/Toast'
import { AccountsProvider } from './features/accounts/AccountsContext'
import { StudyBrowser } from './features/browser/StudyBrowser'
import { FOCUS_MODE_CLASS, useFocusMode } from './features/focus/focusMode'
import { MusicProvider } from './features/music/MusicContext'
import { MusicPanel } from './features/music/MusicPanel'
import { AppearanceProvider } from './features/settings/AppearanceContext'
import { TaskList } from './features/tasks/TaskList'
import { FocusTimer } from './features/timer/FocusTimer'
import { TimerProvider } from './features/timer/TimerContext'
import { TimerPrompt } from './features/timer/TimerPrompt'
import { TopBar } from './TopBar'

export default function App() {
  const focusMode = useFocusMode()
  return (
    <AppearanceProvider>
      <ToastProvider>
        <AccountsProvider>
          <TimerProvider>
            <MusicProvider>
              <div className="app">
                <TopBar />
                <main className={focusMode.on ? `layout ${FOCUS_MODE_CLASS}` : 'layout'}>
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
              </div>
              <TimerPrompt />
            </MusicProvider>
          </TimerProvider>
        </AccountsProvider>
      </ToastProvider>
    </AppearanceProvider>
  )
}
