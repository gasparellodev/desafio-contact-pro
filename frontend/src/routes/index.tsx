import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'

import { RouteFallbackSkeleton } from '@/components/Skeletons'

import { RootLayout } from './root'

// Code splitting por rota: bundle inicial fica menor (somente shell + react-router
// + tanstack query + socket). Conversations/NotFound viram chunks lazy.
const ConversationsPage = lazy(() =>
  import('./conversations').then((m) => ({ default: m.ConversationsPage }))
)
const NotFoundPage = lazy(() =>
  import('./not-found').then((m) => ({ default: m.NotFoundPage }))
)

function withSuspense(node: React.ReactNode) {
  return <Suspense fallback={<RouteFallbackSkeleton />}>{node}</Suspense>
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <Navigate to="/conversations" replace /> },
      { path: 'conversations', element: withSuspense(<ConversationsPage />) },
      { path: 'conversations/:id', element: withSuspense(<ConversationsPage />) },
    ],
  },
  { path: '*', element: withSuspense(<NotFoundPage />) },
])
