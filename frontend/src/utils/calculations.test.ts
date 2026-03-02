import { expect, test, describe } from 'vitest'
import { calculateShares, SplitInstance, recalculateInclusivePrices } from './calculations'
import { ReceiptData } from '@/types/api'

describe('calculateShares', () => {
    test('calculates correct split with proportional tax', () => {
        const receiptData: ReceiptData = {
            error: "",
            items: [
                { id: '1', name: 'Pizza', price: 20, inclusive_price: 22, applied_taxes: ['VAT'] },
                { id: '2', name: 'Drinks', price: 10, inclusive_price: 11, applied_taxes: ['VAT'] }
            ],
            taxes: [{ name: 'VAT', amount: 3 }], // 10% tax (3 / 30 subtotal)
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
            error: "",
            items: [
                { id: '1', name: 'Salad', price: 15, inclusive_price: 15, applied_taxes: [] },
            ],
            taxes: [],
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

describe('recalculateInclusivePrices', () => {
    test('accurately distributes specific tax across tagged items only', () => {
        const payload: ReceiptData = {
            error: "",
            items: [
                { id: '1', name: 'Taxed Item', price: 100, inclusive_price: 100, applied_taxes: ['City Tax'] },
                { id: '2', name: 'Non-Taxed Item', price: 50, inclusive_price: 50, applied_taxes: [] },
                { id: '3', name: 'Another Taxed', price: 100, inclusive_price: 100, applied_taxes: ['City Tax'] }
            ],
            taxes: [
                { name: 'City Tax', amount: 20 }
            ],
            scraped_total: 270
        };

        const result = recalculateInclusivePrices(payload);

        // The $20 tax should only apply to the $200 pool of items tagged "City Tax" (effectively 10% rate)
        expect(result.items[0].inclusive_price).toBe(110);
        expect(result.items[1].inclusive_price).toBe(50); // Unchanged
        expect(result.items[2].inclusive_price).toBe(110);
    });

    test('handles multiple overlapping taxes on a single item', () => {
        const payload: ReceiptData = {
            error: "",
            items: [
                { id: '1', name: 'Luxury Wine', price: 100, inclusive_price: 100, applied_taxes: ['VAT', 'Liquor Tax'] },
                { id: '2', name: 'Bread', price: 10, inclusive_price: 10, applied_taxes: [] }
            ],
            taxes: [
                { name: 'VAT', amount: 5 }, // 5% rate on the $100 base
                { name: 'Liquor Tax', amount: 15 } // 15% rate on the $100 base
            ],
            scraped_total: 130
        };

        const result = recalculateInclusivePrices(payload);

        // The wine should aggregate both tax multipliers: 1 + 0.05 + 0.15 = 1.2 * 100 = 120
        expect(result.items[0].inclusive_price).toBe(120);
        expect(result.items[1].inclusive_price).toBe(10);
    });
})
