export interface Tax {
    name: string
    amount: number
}

export interface Item {
    id: string
    name: string
    price: number
    inclusive_price: number
    applied_taxes: string[]
}

export interface ReceiptData {
    error: string
    items: Item[]
    taxes: Tax[]
    scraped_total: number
}
