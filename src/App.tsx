import { RouterProvider } from 'react-router-dom'
import { AuthProvider } from '@/app/providers/AuthProvider'
import { DevModeProvider } from '@/app/providers/DevModeProvider'
import { QueryProvider } from '@/app/providers/QueryProvider'
import { router } from '@/app/router'

export default function App() {
  return (
    <QueryProvider>
      <AuthProvider>
        <DevModeProvider>
          <RouterProvider router={router} />
        </DevModeProvider>
      </AuthProvider>
    </QueryProvider>
  )
}
