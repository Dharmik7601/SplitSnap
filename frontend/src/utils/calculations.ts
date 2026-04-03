import { ReceiptData, Item } from "@/types/api"

export interface SplitInstance {
    id: string;
    name: string;
    itemIds: Record<string, number>; // itemId -> claimed quantity (allows fractional or multi-item splits)
}

export interface SharedItemBreakdown {
    id: string;
    name: string;
    fraction: number;
    claimedCount: number;
    sharedCount: number;
    subtotalOwed: number;
    totalOwed: number;
}

export interface ShareResult extends SplitInstance {
    itemsBreakdown: SharedItemBreakdown[];
    subtotalOwed: number;
    taxOwed: number;
    discountOwed: number;
    totalOwed: number;
}

export const calculateShares = (receiptData: ReceiptData | null, instances: SplitInstance[]): ShareResult[] => {
    if (!receiptData) return [];

    return instances.map(inst => {
        let instanceSubtotal = 0;
        let instanceTax = 0;
        let instanceDiscount = 0;
        let instanceTotal = 0;
        const itemsBreakdown: SharedItemBreakdown[] = [];

        Object.keys(inst.itemIds).forEach(itemId => {
            const claimedQuantity = inst.itemIds[itemId];
            if (claimedQuantity <= 0) return;

            const item = receiptData.items.find((i: Item) => i.id === itemId);
            if (item) {
                const totalClaimedQuantity = instances.reduce((sum, currentInst) => {
                    return sum + (currentInst.itemIds[itemId] || 0);
                }, 0);

                const fraction = claimedQuantity / (totalClaimedQuantity || 1);
                
                const itemBaseSubtotal = item.price * fraction;
                const itemDiscount = (item.price - (item.discounted_price ?? item.price)) * fraction;
                const itemTax = (item.inclusive_price - (item.discounted_price ?? item.price)) * fraction;
                const itemTotal = itemBaseSubtotal - itemDiscount + itemTax;

                instanceSubtotal += itemBaseSubtotal;
                instanceDiscount += itemDiscount;
                instanceTax += itemTax;
                instanceTotal += itemTotal;

                itemsBreakdown.push({
                    id: item.id,
                    name: item.name,
                    fraction,
                    claimedCount: claimedQuantity,
                    sharedCount: totalClaimedQuantity,
                    subtotalOwed: itemBaseSubtotal,
                    totalOwed: itemTotal
                });
            }
        });

        let flatEqualTax = 0;
        receiptData.taxes?.forEach(tax => {
            const isMapped = receiptData.items.some(i => i.applied_taxes?.includes(tax.name));
            if (!isMapped) {
                flatEqualTax += (tax.amount / (instances.length || 1));
            }
        });

        let flatEqualDiscount = 0;
        receiptData.discounts?.forEach(discount => {
            const isMapped = receiptData.items.some(i => i.applied_discounts?.includes(discount.name));
            if (!isMapped) {
                flatEqualDiscount += (discount.amount / (instances.length || 1));
            }
        });

        const finalTaxForInstance = instanceTax + flatEqualTax;
        const finalDiscountForInstance = instanceDiscount + flatEqualDiscount;
        const finalTotalForInstance = instanceSubtotal - finalDiscountForInstance + finalTaxForInstance;

        return {
            ...inst,
            itemsBreakdown,
            subtotalOwed: instanceSubtotal,
            taxOwed: finalTaxForInstance,
            discountOwed: finalDiscountForInstance,
            totalOwed: Math.max(0, finalTotalForInstance)
        }
    })
}

export const recalculateInclusivePrices = (data: ReceiptData): ReceiptData => {
    // Calculate effective percentage rate for each specific tax, ignoring unmapped global taxes
    const taxRates: Record<string, number> = {};
    data.taxes?.forEach(tax => {
        const isMapped = data.items.some(i => i.applied_taxes?.includes(tax.name));
        if (!isMapped) return;
        const totalBaseOfTaggedItems = data.items.filter(i => i.applied_taxes?.includes(tax.name)).reduce((sum, i) => sum + i.price, 0);
        taxRates[tax.name] = totalBaseOfTaggedItems > 0 ? (tax.amount / totalBaseOfTaggedItems) : 0;
    });

    // Calculate effective percentage rate for each specific discount, ignoring unmapped global discounts
    const discountRates: Record<string, number> = {};
    data.discounts?.forEach(discount => {
        const isMapped = data.items.some(i => i.applied_discounts?.includes(discount.name));
        if (!isMapped) return;
        const totalBaseOfTaggedItems = data.items.filter(i => i.applied_discounts?.includes(discount.name)).reduce((sum, i) => sum + i.price, 0);
        discountRates[discount.name] = totalBaseOfTaggedItems > 0 ? (discount.amount / totalBaseOfTaggedItems) : 0;
    });

    return {
        ...data,
        items: data.items.map(item => {
            let taxMultiplier = 1;
            item.applied_taxes?.forEach(taxName => {
                if (taxRates[taxName]) {
                    taxMultiplier += taxRates[taxName];
                }
            });

            let discountMultiplier = 0;
            item.applied_discounts?.forEach(discountName => {
                if (discountRates[discountName]) {
                    discountMultiplier += discountRates[discountName];
                }
            });

            // Map absolute offsets mathematically to exactly reconstruct bounded constraints
            const absoluteTaxContribution = item.price * (taxMultiplier - 1);
            const absoluteDiscountContribution = item.price * discountMultiplier;
            
            const discountedPrice = Math.max(0, item.price - absoluteDiscountContribution);
            const inclusive = Math.max(0, discountedPrice + absoluteTaxContribution);

            return {
                ...item,
                discounted_price: discountedPrice,
                inclusive_price: inclusive
            };
        })
    };
};
