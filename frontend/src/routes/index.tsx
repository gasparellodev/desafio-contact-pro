import { createBrowserRouter, Navigate } from 'react-router-dom'

import { ConversationsPage } from './conversations'
import { NotFoundPage } from './not-found'
import { RootLayout } from './root'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      // / e /conversations apontam pra mesma página; /conversations/:id também,
      // o ID vem via useParams. Mantemos numa rota só por simplicidade —
      // separar em outlet aninhado entra na Phase 3 quando o mobile precisar
      // de telas distintas.
      { index: true, element: <Navigate to="/conversations" replace /> },
      { path: 'conversations', element: <ConversationsPage /> },
      { path: 'conversations/:id', element: <ConversationsPage /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
