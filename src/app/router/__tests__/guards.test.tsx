import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppIndexRedirect, RequireOnboarding } from '../guards'

const useAuthMock = vi.fn()
const useProfileSummaryMock = vi.fn()
const getTodayInTimezoneMock = vi.fn()
const guessTimezoneMock = vi.fn()

function RedirectTarget() {
  const { date } = useParams<{ date: string }>()
  return <div>{date}</div>
}

vi.mock('@/app/providers/auth', () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock('@/features/profile/useProfileSummary', () => ({
  useProfileSummary: () => useProfileSummaryMock(),
}))

vi.mock('@/lib/date', () => ({
  getTodayInTimezone: (...args: unknown[]) => getTodayInTimezoneMock(...args),
  guessTimezone: (...args: unknown[]) => guessTimezoneMock(...args),
}))

describe('router guards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthMock.mockReturnValue({
      user: { id: 'user-1', email: 'user@example.com' },
      loading: false,
    })
    useProfileSummaryMock.mockReturnValue({
      data: {
        timezone: 'UTC',
        calorieTarget: 2000,
        onboardingCompletedAt: '2026-01-01T00:00:00.000Z',
      },
      isLoading: false,
    })
    guessTimezoneMock.mockReturnValue('Europe/Oslo')
    getTodayInTimezoneMock.mockReturnValue('2026-01-05')
  })

  it('redirects /app using the guessed timezone when the profile timezone is missing', async () => {
    useProfileSummaryMock.mockReturnValue({
      data: {
        timezone: null,
        calorieTarget: 2000,
        onboardingCompletedAt: '2026-01-01T00:00:00.000Z',
      },
      isLoading: false,
    })

    render(
      <MemoryRouter initialEntries={['/app']}>
        <Routes>
          <Route path="/app" element={<AppIndexRedirect />} />
          <Route path="/app/log/:date" element={<RedirectTarget />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('2026-01-05')).toBeInTheDocument()
    expect(guessTimezoneMock).toHaveBeenCalledTimes(1)
    expect(getTodayInTimezoneMock).toHaveBeenCalledWith('Europe/Oslo')
  })

  it('redirects incomplete onboarding flows to /onboarding', async () => {
    useProfileSummaryMock.mockReturnValue({
      data: {
        timezone: 'UTC',
        calorieTarget: 2000,
        onboardingCompletedAt: null,
      },
      isLoading: false,
    })

    render(
      <MemoryRouter initialEntries={['/app/creature']}>
        <Routes>
          <Route element={<RequireOnboarding />}>
            <Route path="/app/creature" element={<div>protected-creature</div>} />
          </Route>
          <Route path="/onboarding" element={<div>onboarding-page</div>} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('onboarding-page')).toBeInTheDocument()
    expect(screen.queryByText('protected-creature')).not.toBeInTheDocument()
  })
})
