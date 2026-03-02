import { expect, test, describe } from 'vitest'
import { calculateShares, SplitInstance } from './calculations'
import { ReceiptData } from '@/types/api'

describe('calculateShares', () => {
    test('calculates correct split with proportional tax', () => {
        const receiptData: ReceiptData = {
            items: [
                { id: '1', name: 'Pizza', price: 20 },
                { id: '2', name: 'Drinks', price: 10 }
            ],
            tax: 3, // 10% tax (3 / 30 subtotal)
            scraped_total: 33
        }

        // Alice and Bob share the Pizza. Alice pays for Drinks herself.
        const instances: SplitInstance[] = [
            { id: 'alice', name: 'Alice', itemIds: ['1', '2'] },
            { id: 'bob', name: 'Bob', itemIds: ['1'] }
        ]

        const shares = calculateShares(receiptData, instances)

        const aliceShare = shares.find(s => s.id === 'alice')
        const bobShare = shares.find(s => s.id === 'bob')

        expect(aliceShare?.subtotalOwed).toBe(20) // 10 (half pizza) + 10 (drinks)
        expect(aliceShare?.taxOwed).toBe(2) // 10% of 20
        expect(aliceShare?.totalOwed).toBe(22)

        expect(bobShare?.subtotalOwed).toBe(10) // 10 (half pizza)
        expect(bobShare?.taxOwed).toBe(1) // 10% of 10
        expect(bobShare?.totalOwed).toBe(11)
    })

    test('returns empty array if no receipt', () => {
        const shares = calculateShares(null, [])
        expect(shares).toEqual([])
    })

    test('handles zero tax gracefully', () => {
        const receiptData: ReceiptData = {
            items: [
                { id: '1', name: 'Salad', price: 15 },
            ],
            tax: 0,
            scraped_total: 15
        }
        const instances: SplitInstance[] = [
            { id: 'charlie', name: 'Charlie', itemIds: ['1'] },
        ]

        const shares = calculateShares(receiptData, instances)
        expect(shares[0].taxOwed).toBe(0)
        expect(shares[0].totalOwed).toBe(15)
    })
})
