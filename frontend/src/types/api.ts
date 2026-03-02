export interface Item {
    id: string
    name: string
    price: number
}

export interface ReceiptData {
    items: Item[]
    tax: number
    scraped_total: number
}
