import { ToastProvider } from './components/Toast'
import { StudyBrowser } from './features/browser/StudyBrowser'
import { MusicProvider } from './features/music/MusicContext'
import { MusicPanel } from './features/music/MusicPanel'
import { TaskList } from './features/tasks/TaskList'
import { FocusTimer } from './features/timer/FocusTimer'
import { TimerProvider } from './features/timer/TimerContext'
import { TimerPrompt } from './features/timer/TimerPrompt'
import { TopBar } from './TopBar'

export default function App() {
  return (
    <ToastProvider>
      <TimerProvider>
        <MusicProvider>
          <div className="app">
            <TopBar />
            <main className="layout">
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
    </ToastProvider>
  )
}
