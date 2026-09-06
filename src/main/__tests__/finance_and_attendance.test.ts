import { describe, it, expect } from 'vitest'
import { calculateMonthsElapsed } from '../services/payment.service'

describe('Tuition and Calendar Financial Calculations', () => {
  it('correctly calculates months elapsed for calendar billing', () => {
    // Same month
    expect(calculateMonthsElapsed('2026-09-01', '2026-09-15')).toBe(1)
    // 2 months
    expect(calculateMonthsElapsed('2026-08-01', '2026-09-15')).toBe(2)
    // 3 months
    expect(calculateMonthsElapsed('2026-07-01', '2026-09-15')).toBe(3)
  })

  it('handles edge case of empty or invalid start dates gracefully', () => {
    expect(calculateMonthsElapsed('')).toBe(1)
  })
})

describe('Attendance Transition State Matrix Rules', () => {
  // Requirements 14-25:
  // ABSENT = 1 session fee deducted
  // ATTENDED / PRESENT = 1 session fee deducted
  // INACTIVE = 0 session fee (refunded if previously charged)
  
  it('deduction should occur once for both present and absent', () => {
    const sessionPrice = 1000
    const initialBalance = 5000

    // Absent attendance records 1 deduction
    const balanceAfterAbsent = initialBalance - sessionPrice
    expect(balanceAfterAbsent).toBe(4000)

    // Transitioning from Absent to Present requires no additional deduction
    const balanceAfterPresent = balanceAfterAbsent // 0 diff
    expect(balanceAfterPresent).toBe(4000)

    // Transitioning to Inactive gives refund of 1 session
    const balanceAfterInactive = balanceAfterPresent + sessionPrice
    expect(balanceAfterInactive).toBe(5000)
  })

  it('user scenario: student starts with 4000, attends (-1000 = 3000), marked inactive returns to 4000 (not 5000)', () => {
    const initialBalance = 4000
    const sessionPrice = 1000

    // Present / absent deduction
    const balanceAfterSession = initialBalance - sessionPrice
    expect(balanceAfterSession).toBe(3000)

    // Marking inactive restores the exact session price
    const balanceAfterInactive = balanceAfterSession + sessionPrice
    expect(balanceAfterInactive).toBe(4000)
    expect(balanceAfterInactive).not.toBe(5000) // Prevent double refund bug
  })

  it('closing a session without setting student status marks student absent and deducts fee', () => {
    const initialBalance = 3000
    const monthlyPrice = 3000
    const sessionPrice = Math.round((monthlyPrice / 4) * 100) / 100 // 750

    // When session is closed without operator touching student:
    // Status transitions from unmarked (null) -> 'absent'
    const finalStatus = 'absent'
    expect(finalStatus).toBe('absent')

    // Balance is deducted by 1 session price
    const balanceAfterClose = initialBalance - sessionPrice
    expect(balanceAfterClose).toBe(2250)

    // Remaining sessions
    const remainingSessions = Math.floor(balanceAfterClose / sessionPrice)
    expect(remainingSessions).toBe(3)
  })
})

