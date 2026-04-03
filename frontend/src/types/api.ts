export interface Tax {
    name: string;
    amount: number;
}

export interface Discount {
    name: string;
    amount: number;
}

export interface Item {
    id: string
    name: string
    quantity: number;
    unit_price: number;
    price: number;
    discounted_price?: number;
    inclusive_price: number;
    applied_taxes: string[];
    applied_discounts: string[];
}

export interface ReceiptData {
    error: string;
    items: Item[];
    taxes: Tax[];
    discounts: Discount[];
    scraped_total: number;
}
