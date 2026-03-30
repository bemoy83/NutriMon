import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LoginPage from '../LoginPage'

const navigateMock = vi.fn()
const signInMock = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) => signInMock(...args),
    },
  },
}))

function renderPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('submits credentials and navigates to the app on success', async () => {
    signInMock.mockResolvedValue({ error: null })

    renderPage()

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => {
      expect(signInMock).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'password123',
      })
      expect(navigateMock).toHaveBeenCalledWith('/app')
    })
  })
})
