import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { PostsProvider } from './context/PostsContext.jsx'
import { CavesProvider } from './context/CavesContext.jsx'
import { DmsProvider } from './context/DmsContext.jsx'
import { DmCallsProvider } from './context/DmCallsContext.jsx'
import { PlaylistPlaybackProvider } from './context/PlaylistPlaybackContext.jsx'
import DmCallOverlay from './components/dms/DmCallOverlay.jsx'
import { NotificationsProvider } from './context/NotificationsContext.jsx'
import './index.css'
import { ensureOwlLetterFonts } from './lib/owlLetterFonts'

ensureOwlLetterFonts()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <NotificationsProvider>
          <PostsProvider>
            <CavesProvider>
              <DmsProvider>
                <DmCallsProvider>
                  <PlaylistPlaybackProvider>
                    <App />
                    <DmCallOverlay />
                  </PlaylistPlaybackProvider>
                </DmCallsProvider>
              </DmsProvider>
            </CavesProvider>
          </PostsProvider>
        </NotificationsProvider>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>,
)
