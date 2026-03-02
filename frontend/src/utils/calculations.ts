import { ReceiptData, Item } from "@/types/api"

export interface SplitInstance {
    id: string;
    name: string;
    itemIds: string[]; // which items they are helping to pay for
}

export interface ShareResult extends SplitInstance {
    subtotalOwed: number;
    taxOwed: number;
    totalOwed: number;
}

export const calculateShares = (receiptData: ReceiptData | null, instances: SplitInstance[]): ShareResult[] => {
    if (!receiptData) return [];

    return instances.map(inst => {
        let instanceSubtotal = 0;
        let instanceTotal = 0;

        inst.itemIds.forEach(itemId => {
            const item = receiptData.items.find((i: Item) => i.id === itemId);
            if (item) {
                // Find how many people share this item
                const sharedCount = instances.filter(i => i.itemIds.includes(itemId)).length;

                // Add the strict fraction of base price
                instanceSubtotal += (item.price / (sharedCount || 1));

                // Add the strict fraction of the inclusive price
                instanceTotal += ((item.inclusive_price || item.price) / (sharedCount || 1));
            }
        });

        const instanceTax = instanceTotal - instanceSubtotal;

        return {
            ...inst,
            subtotalOwed: instanceSubtotal,
            taxOwed: Math.max(0, instanceTax),
            totalOwed: instanceTotal
        }
    })
}

export const recalculateInclusivePrices = (data: ReceiptData): ReceiptData => {
    // Calculate effective percentage rate for each specific tax
    const taxRates: Record<string, number> = {};
    data.taxes?.forEach(tax => {
        const totalBaseOfTaggedItems = data.items.filter(i => i.applied_taxes?.includes(tax.name)).reduce((sum, i) => sum + i.price, 0);
        taxRates[tax.name] = totalBaseOfTaggedItems > 0 ? (tax.amount / totalBaseOfTaggedItems) : 0;
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
            return {
                ...item,
                inclusive_price: item.price * taxMultiplier
            };
        })
    };
};
