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

    const subtotal = receiptData.items.reduce((sum: number, item: Item) => sum + item.price, 0);
    const taxRatio = subtotal > 0 ? receiptData.tax / subtotal : 0;

    return instances.map(inst => {
        let instanceSubtotal = 0;

        inst.itemIds.forEach(itemId => {
            const item = receiptData.items.find((i: Item) => i.id === itemId);
            if (item) {
                // Find how many people share this item
                const sharedCount = instances.filter(i => i.itemIds.includes(itemId)).length;
                instanceSubtotal += (item.price / (sharedCount || 1));
            }
        })

        // Add proportional tax
        const instanceTax = instanceSubtotal * taxRatio;
        const totalOwed = instanceSubtotal + instanceTax;

        return {
            ...inst,
            subtotalOwed: instanceSubtotal,
            taxOwed: instanceTax,
            totalOwed: totalOwed
        }
    })
}
