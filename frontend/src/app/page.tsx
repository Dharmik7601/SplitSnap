"use client"

import { useState } from "react"
import { UploadCloud, FileText, ChevronRight, Loader2, RefreshCcw, Trash2, ArrowRight, AlertTriangle, CheckCircle2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ReceiptData, Item } from "@/types/api"
import { calculateShares, SplitInstance } from "@/utils/calculations"

export default function Home() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null)

  // Step 3 state
  const [isAssigning, setIsAssigning] = useState(false)
  const [instances, setInstances] = useState<SplitInstance[]>([
    { id: "payer", name: "Payer (You)", itemIds: [] } // default instance
  ])
  const [newInstanceName, setNewInstanceName] = useState("")
  const [assignError, setAssignError] = useState<string | null>(null)

  const [currency, setCurrency] = useState("USD")
  const currencySymbols: Record<string, string> = { USD: "$", INR: "₹", EUR: "€" }
  const curr = currencySymbols[currency] || "$"

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]
      setFile(selectedFile)
      setError(null)

      const reader = new FileReader()
      reader.onloadend = () => {
        setPreview(reader.result as string)
      }
      reader.readAsDataURL(selectedFile)
    }
  }

  const handleUpload = async () => {
    if (!file) return;

    setIsLoading(true)
    setError(null)

    const formData = new FormData()
    formData.append("file", file)

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
    try {
      const response = await fetch(`${apiUrl}/api/receipt/process`, {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.detail || "Failed to process receipt")
      }

      const data: ReceiptData = await response.json()
      setReceiptData(data)
    } catch (err: any) {
      console.error(err)
      setError(err.message || "An unexpected error occurred.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdateItem = (id: string, field: "name" | "price", value: string) => {
    if (!receiptData) return;
    if (field === "name") setAssignError(null); // clear validation error on typing

    setReceiptData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map(item =>
          item.id === id
            ? { ...item, [field]: field === "price" ? parseFloat(value) || 0 : value }
            : item
        )
      }
    })
  }

  const handleDeleteItem = (id: string) => {
    if (!receiptData) return;
    setReceiptData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.filter(item => item.id !== id)
      }
    })
  }

  const handleAddBlankItem = () => {
    if (!receiptData) return;
    setAssignError(null);
    setReceiptData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        items: [...prev.items, { id: `new-${Date.now()}`, name: "", price: 0 }]
      }
    })
  }

  const handleUpdateTax = (val: string) => {
    if (!receiptData) return;
    setReceiptData(prev => prev ? { ...prev, tax: parseFloat(val) || 0 } : prev);
  }

  const handleAddInstance = () => {
    if (!newInstanceName.trim()) return;
    setInstances(prev => [
      ...prev,
      { id: Math.random().toString(36).substr(2, 9), name: newInstanceName.trim(), itemIds: [] }
    ])
    setNewInstanceName("")
  }

  const handleRemoveInstance = (id: string) => {
    if (id === "payer") return;
    setInstances(prev => prev.filter(i => i.id !== id))
  }

  const toggleItemAssignment = (instanceId: string, itemId: string) => {
    setInstances(prev => prev.map(inst => {
      if (inst.id === instanceId) {
        const hasItem = inst.itemIds.includes(itemId);
        return {
          ...inst,
          itemIds: hasItem
            ? inst.itemIds.filter(id => id !== itemId)
            : [...inst.itemIds, itemId]
        }
      }
      return inst;
    }))
  }

  const handleProceedToAssign = () => {
    if (!receiptData) return;

    // Strict guardrail: Prevent assigning if any item name is completely blank
    const hasEmptyNames = receiptData.items.some(item => !item.name || item.name.trim() === "");
    if (hasEmptyNames) {
      setAssignError("Cannot proceed: Please enter a valid item name for all items.");
      return;
    }

    setAssignError(null);
    setIsAssigning(true);
  }

  if (receiptData) {
    const calculatedSubtotal = receiptData.items.reduce((sum, item) => sum + item.price, 0);
    const calculatedTotal = calculatedSubtotal + receiptData.tax;
    const difference = Math.abs(calculatedTotal - receiptData.scraped_total);
    const isMatched = difference < 0.05; // tiny tolerance for float math

    if (isAssigning) {
      const shares = calculateShares(receiptData, instances);

      // Find unassigned items and auto-assign to payer
      const allAssignedItemIds = new Set(instances.flatMap(i => i.itemIds));
      const unassignedItems = receiptData.items.filter(item => !allAssignedItemIds.has(item.id));

      return (
        <div className="container mx-auto max-w-5xl px-4 py-8 md:py-16 fade-in">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-extrabold text-primary tracking-tight">Assign Items</h1>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsAssigning(false)}>
                <ChevronRight className="mr-2 h-4 w-4 rotate-180" /> Back to Edit
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Left Column: People/Instances */}
            <div className="lg:col-span-1 space-y-4">
              <Card className="shadow-sm">
                <CardHeader className="p-4 bg-muted/30 flex items-center justify-center border-b">
                  <CardTitle className="text-lg">Add Friends</CardTitle>
                </CardHeader>
                <CardContent className="pt-4 flex flex-col gap-4 w-full">
                  <div className="flex items-center gap-2 w-full">
                    <Input
                      placeholder="Name (e.g. Alice)"
                      value={newInstanceName}
                      onChange={(e) => setNewInstanceName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddInstance()}
                    />
                    <Button onClick={handleAddInstance} size="icon" className="shrink-0">+</Button>
                  </div>
                  <div className="space-y-2">
                    {instances.map(inst => (
                      <div key={inst.id} className="flex justify-between items-center p-2 rounded-md bg-secondary/10 border border-secondary/20">
                        <span className="font-medium text-sm truncate">{inst.name}</span>
                        {inst.id !== "payer" && (
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0" onClick={() => handleRemoveInstance(inst.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Middle Column: Items Checklist */}
            <div className="lg:col-span-3 space-y-4">
              <Card className="shadow-sm">
                <CardHeader className="pb-3 border-b">
                  <CardTitle className="text-xl">Bill Items</CardTitle>
                  <CardDescription>Tap an item to assign it to people. Multiple selections perfectly split the cost.</CardDescription>
                </CardHeader>
                <CardContent className="p-0 max-h-[50vh] overflow-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead>Item Name</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-center">Assigned To</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {receiptData.items.map((item) => {
                        const assignedTo = instances.filter(i => i.itemIds.includes(item.id));
                        return (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell className="text-right">{curr}{item.price.toFixed(2)}</TableCell>
                            <TableCell>
                              <div className="flex gap-2 flex-wrap justify-center">
                                {instances.map(inst => {
                                  const isSelected = inst.itemIds.includes(item.id);
                                  return (
                                    <button
                                      key={inst.id}
                                      onClick={() => toggleItemAssignment(inst.id, item.id)}
                                      className={`text-xs px-2 py-1 rounded-full border transition-all ${isSelected
                                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                        : 'bg-background text-muted-foreground border-input hover:border-primary/50 hover:bg-primary/10'
                                        }`}
                                    >
                                      {inst.name.split(' ')[0]}
                                    </button>
                                  )
                                })}
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Final Summary Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                {shares.map(share => (
                  <Card key={share.id} className={`border-l-4 ${share.id === 'payer' ? 'border-l-secondary' : 'border-l-primary'} shadow-sm`}>
                    <div className="p-4 flex justify-between items-center">
                      <div>
                        <h3 className="font-bold text-lg">{share.name}</h3>
                        <p className="text-xs text-muted-foreground">
                          Subtotal: {curr}{share.subtotalOwed.toFixed(2)} + Tax: {curr}{share.taxOwed.toFixed(2)}
                        </p>
                      </div>
                      <div className="text-2xl font-extrabold flex items-start text-secondary">
                        <span className="text-sm mt-1 mr-1">{curr}</span>
                        {share.totalOwed.toFixed(2)}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {unassignedItems.length > 0 && (
                <div className="bg-destructive/10 text-destructive text-sm p-4 rounded-xl border border-destructive/20 mt-4 font-medium flex gap-2">
                  <AlertTriangle className="h-5 w-5 shrink-0" />
                  <div>
                    You have {unassignedItems.length} unassigned items. In a real scenario, you can auto-dump these into the Payer's tab, or assign them manually above.
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="container mx-auto max-w-4xl px-4 py-8 md:py-16 fade-in">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-extrabold text-primary tracking-tight">Review Items</h1>
          <Button variant="secondary" size="sm" onClick={() => setReceiptData(null)}>
            <RefreshCcw className="mr-2 h-4 w-4" /> Start Over
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Card className="shadow-sm">
              <CardHeader className="p-4 border-b bg-muted/30 flex flex-col items-start w-full">
                <CardTitle className="text-xl">Receipt Details</CardTitle>
                <CardDescription>Edit names, fix prices, or remove incorrect items.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[60%]">Item Name</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receiptData.items.map((item) => (
                      <TableRow key={item.id} className="group transition-all">
                        <TableCell className="p-3">
                          <Input
                            value={item.name}
                            onChange={(e) => handleUpdateItem(item.id, "name", e.target.value)}
                            className="h-8 shadow-none focus-visible:ring-1 border-transparent hover:border-input focus-visible:border-input bg-transparent"
                          />
                        </TableCell>
                        <TableCell className="p-3">
                          <div className="flex items-center justify-end">
                            <span className="text-xs text-muted-foreground mr-1">{curr}</span>
                            <Input
                              type="number"
                              step="0.01"
                              value={item.price || ""}
                              onChange={(e) => handleUpdateItem(item.id, "price", e.target.value)}
                              className="h-8 shadow-none text-right w-24 focus-visible:ring-1 border-transparent hover:border-input focus-visible:border-input bg-transparent"
                            />
                          </div>
                        </TableCell>
                        <TableCell className="p-3 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleDeleteItem(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={3} className="p-2 text-center">
                        <Button variant="ghost" size="sm" onClick={handleAddBlankItem} className="text-secondary hover:text-secondary hover:bg-secondary/10 w-full border border-dashed border-secondary/50">
                          + Add Item
                        </Button>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
              <CardFooter className="bg-muted/30 border-t p-4 flex justify-between items-center rounded-b-xl">
                <div className="text-sm font-medium text-muted-foreground">Subtotal</div>
                <div className="font-semibold">${calculatedSubtotal.toFixed(2)}</div>
              </CardFooter>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="shadow-sm border-primary/20 sticky top-24">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Calculations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Tax Amount</Label>
                  <div className="flex items-center">
                    <span className="text-sm font-semibold mr-2">{curr}</span>
                    <Input
                      type="number"
                      step="0.01"
                      value={receiptData.tax || ""}
                      onChange={(e) => handleUpdateTax(e.target.value)}
                      className="h-9"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="font-semibold">Calculated Total</span>
                  <span className="font-bold text-lg text-primary">{curr}{calculatedTotal.toFixed(2)}</span>
                </div>

                <div className="flex justify-between items-center pt-2 text-muted-foreground">
                  <span className="text-sm">Scraped Total</span>
                  <span className="text-sm">{curr}{receiptData.scraped_total.toFixed(2)}</span>
                </div>

                {!isMatched && (
                  <div className="bg-destructive/10 text-destructive text-xs p-3 rounded-lg border border-destructive/20 mt-4 font-medium flex gap-2">
                    <AlertTriangle className="h-6 w-6 shrink-0 mt-0.5" />
                    <div>
                      Totals do not match. Difference: {curr}{difference.toFixed(2)}. Please check all items and prices carefully. The Calculated Total will be used for further process.
                    </div>
                  </div>
                )}

                {isMatched && (
                  <div className="bg-green-500/10 text-green-600 dark:text-green-400 text-xs p-3 rounded-lg border border-green-500/20 mt-4 font-medium flex gap-2 items-center">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    Receipt balances perfectly.
                  </div>
                )}

                {assignError && (
                  <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg border border-destructive/20 mt-4 font-medium flex gap-2 animate-in slide-in-from-bottom-2">
                    <AlertTriangle className="h-5 w-5 shrink-0" />
                    <div>{assignError}</div>
                  </div>
                )}
              </CardContent>
              <CardFooter className="pt-2">
                <Button className="w-full group" size="lg" onClick={handleProceedToAssign}>
                  Assign Items
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8 md:py-16">
      <div className="mb-8 text-center">
        <h1 className="mb-2 text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl text-primary">
          Snap, Split, Settle!
        </h1>
        <p className="text-lg text-muted-foreground md:text-xl mb-4">
          Upload your receipt and let AI extract the items. Splitting bills among friends has never been this easy.
        </p>

        <div className="flex justify-center items-center gap-2 mb-4">
          <Label className="text-sm font-medium text-muted-foreground">Currency:</Label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="bg-background border rounded-md px-3 py-1.5 text-sm font-medium focus:ring-1 focus:ring-primary focus:border-primary border-input cursor-pointer"
          >
            <option value="USD">USD ($)</option>
            <option value="INR">INR (₹)</option>
            <option value="EUR">EUR (€)</option>
          </select>
        </div>
      </div>

      <Card className="border-2 border-dashed shadow-sm">
        <CardHeader className="text-center pb-4">
          <CardTitle className="text-2xl">Upload Receipt</CardTitle>
          <CardDescription>
            Select a clear photo of your total bill showing the items and tax.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-6">
          {error && (
            <div className="w-full bg-destructive/10 text-destructive text-sm p-3 rounded-md border border-destructive/20 text-center">
              {error}
            </div>
          )}
          {preview ? (
            <div className="relative w-full max-w-sm rounded-xl overflow-hidden shadow-lg border">
              <img src={preview} alt="Receipt Preview" className="w-full h-auto max-h-[60vh] object-cover" />
              {!isLoading && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => { setFile(null); setPreview(null); setError(null); }}
                >
                  Clear
                </Button>
              )}
              {isLoading && (
                <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-10 w-10 text-primary animate-spin" />
                    <p className="font-semibold text-primary drop-shadow-md bg-background/80 px-3 py-1 rounded-full">Analyzing Receipt...</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-56 w-full max-w-sm flex-col items-center justify-center rounded-xl border border-dashed border-primary/50 bg-primary/5 px-4 text-center transition-all hover:bg-primary/10">
              <UploadCloud className="mb-4 h-12 w-12 text-primary" />
              <Label htmlFor="receipt-upload" className="cursor-pointer text-sm font-semibold hover:underline">
                Click to browse
                <Input
                  id="receipt-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </Label>
              <p className="mt-2 text-xs text-muted-foreground">Supported formats: JPEG, PNG, WEBP</p>
            </div>
          )}
        </CardContent>
        {preview && (
          <CardFooter className="flex flex-col sm:flex-row justify-between items-center bg-muted/30 p-4 rounded-b-xl border-t gap-4">
            {/* File Truncation box */}
            <div className="flex items-center gap-2 text-sm font-medium text-foreground min-w-0 max-w-full sm:max-w-[15rem]">
              <FileText className="h-4 w-4 shrink-0 text-secondary" />
              <div className="truncate px-1" title={file?.name}>
                {file?.name}
              </div>
            </div>
            <Button onClick={handleUpload} disabled={isLoading} variant="secondary" className="group transition-all w-full sm:w-auto shrink-0">
              {isLoading ? "Extracting Data" : "Process Image"}
              {isLoading ? (
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              ) : (
                <ChevronRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              )}
            </Button>
          </CardFooter>
        )}
      </Card>

      {!preview && (
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
          <div className="p-4 rounded-xl bg-card border shadow-sm flex flex-col items-center transition-all hover:border-primary/50">
            <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center mb-4 text-xl font-bold text-primary">1</div>
            <h3 className="font-semibold mb-2">Upload Image</h3>
            <p className="text-sm text-muted-foreground">Snap a photo of the restaurant or grocery bill.</p>
          </div>
          <div className="p-4 rounded-xl bg-card border shadow-sm flex flex-col items-center transition-all hover:border-secondary/50">
            <div className="h-12 w-12 rounded-full bg-secondary/20 flex items-center justify-center mb-4 text-xl font-bold text-secondary">2</div>
            <h3 className="font-semibold mb-2">AI Extraction</h3>
            <p className="text-sm text-muted-foreground">Gemini reads items and prices from the receipt automatically.</p>
          </div>
          <div className="p-4 rounded-xl bg-card border shadow-sm flex flex-col items-center transition-all hover:border-primary/50">
            <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center mb-4 text-xl font-bold text-primary">3</div>
            <h3 className="font-semibold mb-2">Assign & Split</h3>
            <p className="text-sm text-muted-foreground">Assign items to people and get exact totals ready for Splitwise.</p>
          </div>
        </div>
      )}
    </div>
  )
}
