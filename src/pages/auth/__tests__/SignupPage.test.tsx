import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SignupPage from '../SignupPage'

const navigateMock = vi.fn()
const signUpMock = vi.fn()

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
      signUp: (...args: unknown[]) => signUpMock(...args),
    },
  },
}))

function renderPage() {
  return render(
    <MemoryRouter>
      <SignupPage />
    </MemoryRouter>,
  )
}

describe('SignupPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('routes directly to onboarding when signup returns an active session', async () => {
    signUpMock.mockResolvedValue({
      data: { session: { access_token: 'token' } },
      error: null,
    })

    renderPage()

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() => {
      expect(signUpMock).toHaveBeenCalled()
      expect(navigateMock).toHaveBeenCalledWith('/onboarding')
    })
  })

  it('routes to the pending page when signup succeeds without a session', async () => {
    signUpMock.mockResolvedValue({
      data: { session: null },
      error: null,
    })

    renderPage()

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() => {
      expect(signUpMock).toHaveBeenCalled()
      expect(navigateMock).toHaveBeenCalledWith('/signup/pending', {
        state: { email: 'user@example.com' },
      })
    })
  })
})
