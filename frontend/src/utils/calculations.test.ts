import { expect, test, describe } from 'vitest'
import { calculateShares, SplitInstance, recalculateInclusivePrices } from './calculations'
import { ReceiptData } from '@/types/api'

describe('calculateShares', () => {
    test('calculates correct split with proportional tax', () => {
        const receiptData: ReceiptData = {
            error: "",
            items: [
                { id: '1', name: 'Pizza', quantity: 1, unit_price: 20, price: 20, inclusive_price: 22, applied_taxes: ['VAT'] },
                { id: '2', name: 'Drinks', quantity: 1, unit_price: 10, price: 10, inclusive_price: 11, applied_taxes: ['VAT'] }
            ],
            taxes: [{ name: 'VAT', amount: 3 }], // 10% tax (3 / 30 subtotal)
            scraped_total: 33
        }

        // Alice and Bob share the Pizza. Alice pays for Drinks herself.
        const instances: SplitInstance[] = [
            { id: 'alice', name: 'Alice', itemIds: { '1': 1, '2': 1 } },
            { id: 'bob', name: 'Bob', itemIds: { '1': 1 } }
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
                { id: '1', name: 'Salad', quantity: 1, unit_price: 15, price: 15, inclusive_price: 15, applied_taxes: [] },
            ],
            taxes: [],
            scraped_total: 15
        }
        const instances: SplitInstance[] = [
            { id: 'charlie', name: 'Charlie', itemIds: { '1': 1 } },
        ]

        const shares = calculateShares(receiptData, instances)
        expect(shares[0].taxOwed).toBe(0)
        expect(shares[0].totalOwed).toBe(15)
    })

    test('accurately handles numeric quantity-based fractional breakdowns', () => {
        const receiptData: ReceiptData = {
            error: "",
            items: [
                { id: '1', name: 'Garlic Cloves', quantity: 3, unit_price: 3, price: 9, inclusive_price: 9, applied_taxes: [] },
                { id: '2', name: 'Milk', quantity: 1, unit_price: 5, price: 5, inclusive_price: 5, applied_taxes: [] }
            ],
            taxes: [],
            scraped_total: 14
        }

        // Alice claims 2/3 Garlic. Bob claims 1/3 Garlic. Alice claims Milk completely.
        const instances: SplitInstance[] = [
            { id: 'alice', name: 'Alice', itemIds: { '1': 2, '2': 1 } },
            { id: 'bob', name: 'Bob', itemIds: { '1': 1 } }
        ]

        const shares = calculateShares(receiptData, instances)
        
        const aliceShare = shares.find(s => s.id === 'alice')!
        const bobShare = shares.find(s => s.id === 'bob')!

        // Alice (Garlic)
        const aliceGarlic = aliceShare.itemsBreakdown.find(i => i.id === '1')!
        expect(aliceGarlic.claimedCount).toBe(2)
        expect(aliceGarlic.sharedCount).toBe(3)
        expect(aliceGarlic.fraction).toBeCloseTo(0.6666, 3)

        // Bob (Garlic)
        const bobGarlic = bobShare.itemsBreakdown.find(i => i.id === '1')!
        expect(bobGarlic.claimedCount).toBe(1)
        expect(bobGarlic.sharedCount).toBe(3)
        expect(bobGarlic.fraction).toBeCloseTo(0.3333, 3)
        
        // Milk (Full ownership)
        const aliceMilk = aliceShare.itemsBreakdown.find(i => i.id === '2')!
        expect(aliceMilk.claimedCount).toBe(1)
        expect(aliceMilk.sharedCount).toBe(1)
        expect(aliceMilk.fraction).toBe(1)
    })
})

describe('recalculateInclusivePrices', () => {
    test('accurately distributes specific tax across tagged items only', () => {
        const payload: ReceiptData = {
            error: "",
            items: [
                { id: '1', name: 'Taxed Item', quantity: 1, unit_price: 100, price: 100, inclusive_price: 100, applied_taxes: ['City Tax'] },
                { id: '2', name: 'Non-Taxed Item', quantity: 1, unit_price: 50, price: 50, inclusive_price: 50, applied_taxes: [] },
                { id: '3', name: 'Another Taxed', quantity: 1, unit_price: 100, price: 100, inclusive_price: 100, applied_taxes: ['City Tax'] }
            ],
            taxes: [
                { name: 'City Tax', amount: 20 }
            ],
            scraped_total: 270
        };

        const result = recalculateInclusivePrices(payload);

        // The $20 tax should only apply to the $200 pool of items tagged "City Tax" (effectively 10% rate)
        expect(result.items[0].inclusive_price).toBeCloseTo(110);
        expect(result.items[1].inclusive_price).toBeCloseTo(50); // Unchanged
        expect(result.items[2].inclusive_price).toBeCloseTo(110);
    });

    test('handles multiple overlapping taxes on a single item', () => {
        const payload: ReceiptData = {
            error: "",
            items: [
                { id: '1', name: 'Luxury Wine', quantity: 1, unit_price: 100, price: 100, inclusive_price: 100, applied_taxes: ['VAT', 'Liquor Tax'] },
                { id: '2', name: 'Bread', quantity: 1, unit_price: 10, price: 10, inclusive_price: 10, applied_taxes: [] }
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
