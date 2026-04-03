"use client"

import { useState } from "react"
import { UploadCloud, FileText, ChevronRight, Loader2, RefreshCcw, Trash2, ArrowRight, AlertTriangle, CheckCircle2, Copy, Check, AlertCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ReceiptData, Item } from "@/types/api"
import { calculateShares, SplitInstance, recalculateInclusivePrices, ShareResult } from "@/utils/calculations"

export default function Home() {
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null)

  // Step 3 state
  const [isAssigning, setIsAssigning] = useState(false)
  const [instances, setInstances] = useState<SplitInstance[]>([
    { id: "payer", name: "Payer (You)", itemIds: {} } // default instance
  ])
  const [newInstanceName, setNewInstanceName] = useState("")
  const [assignError, setAssignError] = useState<string | null>(null)
  const [copiedShareId, setCopiedShareId] = useState<string | null>(null)
  const [copiedAll, setCopiedAll] = useState(false)

  const [currency, setCurrency] = useState("USD")
  const currencySymbols: Record<string, string> = { USD: "$", INR: "₹", EUR: "€" }
  const curr = currencySymbols[currency] || "$"

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      if (e.target.files.length > 3) {
        setError("You can only upload up to 3 images at a time.");
        // clear any existing selections if they pick too many
        setFiles([]);
        setPreviews([]);
        return;
      }
      const selectedFiles = Array.from(e.target.files);
      setFiles(selectedFiles);
      setError(null);

      const newPreviews: string[] = [];
      selectedFiles.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          newPreviews.push(reader.result as string);
          if (newPreviews.length === selectedFiles.length) {
            setPreviews(newPreviews);
          }
        }
        reader.readAsDataURL(file);
      });
    }
  }

  const handleUpload = async () => {
    if (files.length === 0) return;

    setIsLoading(true)
    setError(null)

    const formData = new FormData()
    files.forEach(file => {
      formData.append("files", file)
    });

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

  const handleUpdateItem = (id: string, field: "name" | "price" | "quantity" | "unit_price", value: string) => {
    if (!receiptData) return;
    if (field === "name") setAssignError(null);

    setReceiptData(prev => {
      if (!prev) return prev;
      const newData = {
        ...prev,
        items: prev.items.map(item => {
          if (item.id === id) {
             const updated = { ...item };
             if (field === "name") {
                updated.name = value;
             } else {
                const numVal = parseFloat(value) || 0;
                updated[field] = numVal;
                // Auto sync
                if (field === "quantity" || field === "unit_price") {
                    updated.price = updated.quantity * updated.unit_price;
                }
             }
             return updated;
          }
          return item;
        })
      };
      return (field !== 'name') ? recalculateInclusivePrices(newData) : newData;
    })
  }

  const handleDeleteItem = (id: string) => {
    if (!receiptData) return;
    setReceiptData(prev => {
      if (!prev) return prev;
      return recalculateInclusivePrices({
        ...prev,
        items: prev.items.filter(item => item.id !== id)
      });
    })
  }

  const handleAddBlankItem = () => {
    if (!receiptData) return;
    setAssignError(null);
    setReceiptData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        items: [...prev.items, { id: `new-${Date.now()}`, name: "", quantity: 1, unit_price: 0, price: 0, inclusive_price: 0, applied_taxes: [], applied_discounts: [] }]
      }
    })
  }

  const handleToggleItemTax = (itemId: string, taxName: string) => {
    if (!receiptData) return;
    setReceiptData(prev => {
      if (!prev) return prev;
      const newData = {
        ...prev,
        items: prev.items.map(item => {
          if (item.id === itemId) {
            const currentTaxes = item.applied_taxes || [];
            const newTaxes = currentTaxes.includes(taxName)
              ? currentTaxes.filter(t => t !== taxName)
              : [...currentTaxes, taxName];
            return { ...item, applied_taxes: newTaxes };
          }
          return item;
        })
      };
      return recalculateInclusivePrices(newData);
    });
  }

  const handleUpdateTax = (id: number, val: string) => {
    if (!receiptData) return;
    setReceiptData(prev => {
      if (!prev) return prev;
      const newTaxes = [...(prev.taxes || [])];
      if (newTaxes[id]) {
        newTaxes[id].amount = parseFloat(val) || 0;
      }
      return recalculateInclusivePrices({ ...prev, taxes: newTaxes });
    });
  }

  const handleAddManualTax = () => {
    if (!receiptData) return;
    const customName = prompt("Enter a name for the new tax/fee (e.g. 'City Tax'):");
    if (!customName || customName.trim() === "") return;

    setReceiptData(prev => {
      if (!prev) return prev;
      if (prev.taxes?.some(t => t.name.toLowerCase() === customName.trim().toLowerCase())) return prev;

      const newTaxes = [...(prev.taxes || []), { name: customName.trim(), amount: 0 }];
      return recalculateInclusivePrices({ ...prev, taxes: newTaxes });
    });
  }

  const handleDeleteTax = (index: number) => {
    if (!receiptData) return;
    setReceiptData(prev => {
      if (!prev) return prev;
      const targetTax = prev.taxes[index]?.name;
      const newTaxes = prev.taxes.filter((_, i) => i !== index);
      const cleanedItems = prev.items.map(item => ({
        ...item,
        applied_taxes: item.applied_taxes?.filter(t => t !== targetTax) || []
      }));
      return recalculateInclusivePrices({ ...prev, taxes: newTaxes, items: cleanedItems });
    });
  }

  const handleToggleItemDiscount = (itemId: string, discountName: string) => {
    if (!receiptData) return;
    setReceiptData(prev => {
      if (!prev) return prev;
      const newData = {
        ...prev,
        items: prev.items.map(item => {
          if (item.id === itemId) {
            const currentDiscounts = item.applied_discounts || [];
            const newDiscounts = currentDiscounts.includes(discountName)
              ? currentDiscounts.filter(d => d !== discountName)
              : [...currentDiscounts, discountName];
            return { ...item, applied_discounts: newDiscounts };
          }
          return item;
        })
      };
      return recalculateInclusivePrices(newData);
    });
  }

  const handleUpdateDiscount = (id: number, val: string) => {
    if (!receiptData) return;
    setReceiptData(prev => {
      if (!prev) return prev;
      const newDiscounts = [...(prev.discounts || [])];
      if (newDiscounts[id]) {
        newDiscounts[id].amount = parseFloat(val) || 0;
      }
      return recalculateInclusivePrices({ ...prev, discounts: newDiscounts });
    });
  }

  const handleAddManualDiscount = () => {
    if (!receiptData) return;
    const customName = prompt("Enter a name for the discount (e.g. 'Coupon 20%'):");
    if (!customName || customName.trim() === "") return;

    setReceiptData(prev => {
      if (!prev) return prev;
      if (prev.discounts?.some(d => d.name.toLowerCase() === customName.trim().toLowerCase())) return prev;

      const newDiscounts = [...(prev.discounts || []), { name: customName.trim(), amount: 0 }];
      return recalculateInclusivePrices({ ...prev, discounts: newDiscounts });
    });
  }

  const handleDeleteDiscount = (index: number) => {
    if (!receiptData) return;
    setReceiptData(prev => {
      if (!prev) return prev;
      const targetDiscount = prev.discounts[index]?.name;
      const newDiscounts = prev.discounts.filter((_, i) => i !== index);
      const cleanedItems = prev.items.map(item => ({
        ...item,
        applied_discounts: item.applied_discounts?.filter(d => d !== targetDiscount) || []
      }));
      return recalculateInclusivePrices({ ...prev, discounts: newDiscounts, items: cleanedItems });
    });
  }


  const handleAddInstance = () => {
    if (!newInstanceName.trim()) return;
    setInstances(prev => [
      ...prev,
      { id: Math.random().toString(36).substr(2, 9), name: newInstanceName.trim(), itemIds: {} }
    ])
    setNewInstanceName("")
  }

  const handleRemoveInstance = (id: string) => {
    if (id === "payer") return;
    setInstances(prev => prev.filter(i => i.id !== id))
  }

  const updateItemAssignment = (instanceId: string, itemId: string, delta: number) => {
    setInstances(prev => prev.map(inst => {
      if (inst.id === instanceId) {
        const currentQty = inst.itemIds[itemId] || 0;
        const newQty = Math.max(0, currentQty + delta);
        
        const newItems = { ...inst.itemIds };
        if (newQty === 0) {
           delete newItems[itemId];
        } else {
           newItems[itemId] = newQty;
        }

        return { ...inst, itemIds: newItems };
      }
      return inst;
    }))
  }

  const handleCopyShare = (share: ShareResult) => {
    let text = `${share.name}'s Share:\n`;
    const discountText = receiptData?.discounts && receiptData.discounts.length > 0
      ? ` - Discount: ${curr}${(share.discountOwed || 0).toFixed(2)}`
      : '';
    text += `Subtotal: ${curr}${share.subtotalOwed.toFixed(2)} + Tax/Fees: ${curr}${share.taxOwed.toFixed(2)}${discountText}\n`;
    text += `Total: ${curr}${share.totalOwed.toFixed(2)}\n\n`;
    
    if (share.itemsBreakdown && share.itemsBreakdown.length > 0) {
      text += `Items:\n`;
      share.itemsBreakdown.forEach(item => {
        text += `- ${item.name}`;
        if (item.sharedCount > 1 && item.claimedCount < item.sharedCount) {
           text += ` (${item.claimedCount}/${item.sharedCount} share)`;
        } else if (item.claimedCount > 1) {
           text += ` (Qty: ${item.claimedCount})`;
        }
        text += `: ${curr}${item.totalOwed.toFixed(2)}\n`;
      });
    }

    navigator.clipboard.writeText(text);
    setCopiedShareId(share.id);
    setTimeout(() => {
      setCopiedShareId(null);
    }, 2000);
  }

  const handleCopyAllShares = (shares: ShareResult[]) => {
    let fullText = "Bill Split Summary\n===================\n\n";
    
    shares.forEach(share => {
      fullText += `${share.name}'s Share:\n`;
      const discountText = receiptData?.discounts && receiptData.discounts.length > 0
        ? ` - Discount: ${curr}${(share.discountOwed || 0).toFixed(2)}`
        : '';
      fullText += `Subtotal: ${curr}${share.subtotalOwed.toFixed(2)} + Tax/Fees: ${curr}${share.taxOwed.toFixed(2)}${discountText}\n`;
      fullText += `Total: ${curr}${share.totalOwed.toFixed(2)}\n`;
      
      if (share.itemsBreakdown && share.itemsBreakdown.length > 0) {
        fullText += `Items:\n`;
        share.itemsBreakdown.forEach(item => {
          fullText += `- ${item.name}`;
          if (item.sharedCount > 1 && item.claimedCount < item.sharedCount) {
             fullText += ` (${item.claimedCount}/${item.sharedCount} share)`;
          } else if (item.claimedCount > 1) {
             fullText += ` (Qty: ${item.claimedCount})`;
          }
          fullText += `: ${curr}${item.totalOwed.toFixed(2)}\n`;
        });
      }
      fullText += "\n-------------------\n\n";
    });

    navigator.clipboard.writeText(fullText.trim());
    setCopiedAll(true);
    setTimeout(() => {
      setCopiedAll(false);
    }, 2000);
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
    const calculatedTotal = calculatedSubtotal + (receiptData.taxes?.reduce((sum, t) => sum + t.amount, 0) || 0) - (receiptData.discounts?.reduce((sum, d) => sum + d.amount, 0) || 0);
    const difference = Math.abs(calculatedTotal - receiptData.scraped_total);
    const isMatched = difference < 0.05; // tiny tolerance for float math

    if (isAssigning) {
      const shares = calculateShares(receiptData, instances);

      // Find unassigned items that have not had their full quantity claimed
      const unassignedItems = receiptData.items.filter(item => {
        const totalClaimed = instances.reduce((sum, inst) => sum + (inst.itemIds[item.id] || 0), 0);
        return totalClaimed < item.quantity;
      });

      return (
        <div className="w-full px-4 md:px-8 py-8 md:py-16 fade-in">
          <div className="flex justify-between items-center mb-6 max-w-[2000px] mx-auto">
            <h1 className="text-3xl font-extrabold text-primary tracking-tight">Assign Items</h1>
            <div className="flex gap-2">
              <Button onClick={() => handleCopyAllShares(shares)} className="gap-2">
                {copiedAll ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copiedAll ? "Copied All!" : "Copy Summary"}
              </Button>
              <Button variant="outline" onClick={() => setIsAssigning(false)}>
                <ChevronRight className="mr-2 h-4 w-4 rotate-180" /> Back to Edit
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 max-w-[2000px] mx-auto">
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

              <div className={`p-4 rounded-lg border flex flex-col gap-1.5 shadow-sm transition-colors ${Math.abs(calculatedTotal - shares.reduce((sum, s) => sum + s.totalOwed, 0)) < 0.05 ? 'bg-green-500/10 border-green-500/20' : 'bg-destructive/10 border-destructive/20'}`}>
                {Math.abs(calculatedTotal - shares.reduce((sum, s) => sum + s.totalOwed, 0)) < 0.05 ? (
                  <>
                    <div className="flex items-center gap-2 text-green-600">
                      <Check className="h-4 w-4 shrink-0" />
                      <h4 className="font-semibold text-sm">Perfect Split</h4>
                    </div>
                    <p className="text-xs text-green-600/80">
                      Assigned shares match calculated total exactly ({curr}{calculatedTotal.toFixed(2)}).
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 text-destructive">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <h4 className="font-semibold text-sm">Mismatch Detected</h4>
                    </div>
                    <p className="text-xs text-destructive/80">
                      Assigned ({curr}{shares.reduce((sum, s) => sum + s.totalOwed, 0).toFixed(2)}) out of ({curr}{calculatedTotal.toFixed(2)}). Please assign remaining items completely.
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Middle Column: Items Checklist */}
            <div className="lg:col-span-3 space-y-4">
              <Card className="shadow-sm">
                <CardHeader className="pb-3 border-b">
                  <CardTitle className="text-xl">Bill Items</CardTitle>
                  <CardDescription>Tap an item to assign it to people. Multiple selections perfectly split the cost.</CardDescription>
                </CardHeader>
                <CardContent className="p-0 max-h-[50vh] overflow-y-auto">
                  <div className="overflow-x-auto w-full pb-2">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background z-10 w-full min-w-[500px]">
                        <TableRow>
                          <TableHead>Item Name</TableHead>
                          <TableHead className="text-right">Price</TableHead>
                          <TableHead className="text-center">Assigned To</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {receiptData.items.map((item) => {
                          const itemTotalClaimed = instances.reduce((sum, inst) => sum + (inst.itemIds[item.id] || 0), 0);
                          return (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">
                                 {item.name}
                                 {item.quantity > 1 && <span className="ml-2 text-[10px] uppercase font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Qty: {item.quantity}</span>}
                              </TableCell>
                              <TableCell className="text-right">
                                <span className="font-medium">{curr}{item.price.toFixed(2)}</span>
                                {item.inclusive_price > item.price && (
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    w/ tax/fees: {curr}{item.inclusive_price.toFixed(2)}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-2 flex-wrap justify-center">
                                  {instances.map(inst => {
                                    const claimedCount = inst.itemIds[item.id] || 0;
                                    return (
                                        <div key={inst.id} className={`flex items-center p-1 rounded-md border transition-all ${claimedCount > 0 ? 'bg-primary/5 border-primary shadow-sm' : 'bg-background border-transparent hover:border-input'}`}>
                                            <button 
                                                onClick={() => {
                                                    const remainingQty = Math.max(0, item.quantity - itemTotalClaimed);
                                                    if (remainingQty > 0) updateItemAssignment(inst.id, item.id, remainingQty);
                                                }}
                                                className="text-sm font-semibold px-2 py-1 hover:bg-muted/50 rounded-sm transition-colors"
                                                title="Assign remaining quantities"
                                            >
                                                {inst.name}
                                            </button>
                                            <div className="flex items-center bg-background rounded-sm border shadow-sm ml-2">
                                                <button onClick={() => updateItemAssignment(inst.id, item.id, -1)} className="px-3 py-1.5 text-base font-bold text-muted-foreground hover:bg-muted hover:text-foreground rounded-l-sm transition-colors" disabled={claimedCount === 0}>-</button>
                                                <span className={`px-2 text-sm font-extrabold tabular-nums border-x min-w-[2rem] text-center ${claimedCount > 0 ? 'text-primary' : 'text-muted-foreground'}`}>{claimedCount}</span>
                                                <button onClick={() => updateItemAssignment(inst.id, item.id, 1)} className="px-3 py-1.5 text-base font-bold text-muted-foreground hover:bg-muted hover:text-foreground rounded-r-sm transition-colors">+</button>
                                            </div>
                                        </div>
                                    )
                                  })}
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Final Summary Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                {shares.map(share => (
                  <Card key={share.id} className={`border-l-4 ${share.id === 'payer' ? 'border-l-secondary' : 'border-l-primary'} shadow-sm flex flex-col overflow-hidden`}>
                    <div className="p-4 flex justify-between items-center bg-background z-10">
                      <div>
                        <h3 className="font-bold text-lg flex items-center gap-2">
                          {share.name}
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 text-muted-foreground hover:text-primary transition-colors" 
                            onClick={() => handleCopyShare(share)}
                            title="Copy to clipboard"
                          >
                            {copiedShareId === share.id ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                          </Button>
                        </h3>
                        <p className="text-xs text-muted-foreground flex flex-wrap max-w-full truncate">
                          Subtotal:&nbsp;<span className="font-medium text-foreground">{curr}{share.subtotalOwed.toFixed(2)}</span>
                          <span className="mx-1 text-muted-foreground/50">|</span> 
                          Tax/Fees:&nbsp;<span className="font-medium text-foreground">{curr}{share.taxOwed.toFixed(2)}</span>
                          {(receiptData.discounts && receiptData.discounts.length > 0) && (
                            <>
                              <span className="mx-1 text-muted-foreground/50">|</span> 
                              Discount:&nbsp;<span className="font-medium text-green-600">-{curr}{(share.discountOwed || 0).toFixed(2)}</span>
                            </>
                          )}
                        </p>
                      </div>
                      <div className="text-2xl font-extrabold flex items-start text-secondary">
                        <span className="text-sm mt-1 mr-1">{curr}</span>
                        {share.totalOwed.toFixed(2)}
                      </div>
                    </div>
                    {share.itemsBreakdown && share.itemsBreakdown.length > 0 && (
                      <div className="p-4 bg-muted/30 border-t text-sm space-y-2 flex-1">
                        <h4 className="font-semibold text-[10px] tracking-wider uppercase text-muted-foreground mb-3">Item Breakdown</h4>
                        <div className="space-y-1.5">
                          {share.itemsBreakdown.map(item => (
                            <div key={item.id} className="flex justify-between items-start">
                              <span className="text-muted-foreground pr-2 text-xs font-medium leading-tight">
                                {item.name} 
                                {item.sharedCount > 1 && item.claimedCount < item.sharedCount ? (
                                  <span className="text-[9px] bg-primary/10 text-primary border border-primary/20 px-1 py-0.5 rounded ml-1.5 font-bold tracking-tight inline-block translate-y-[-1px]">
                                    {item.claimedCount}/{item.sharedCount} share
                                  </span>
                                ) : item.claimedCount > 1 ? (
                                  <span className="text-[9px] bg-muted/50 text-muted-foreground border border-muted-foreground/20 px-1 py-0.5 rounded ml-1.5 font-bold tracking-tight inline-block translate-y-[-1px]">
                                    Qty: {item.claimedCount}
                                  </span>
                                ) : null}
                              </span>
                              <span className="font-semibold text-xs tabular-nums shrink-0">
                                {curr}{item.totalOwed.toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
              
              {unassignedItems.length === 0 && Math.abs(calculatedTotal - shares.reduce((sum, s) => sum + s.totalOwed, 0)) > 0.05 && (
                  <div className="mb-4 bg-destructive/10 border-l-4 border-destructive p-4 rounded-r-md flex items-start gap-3 shadow-sm fade-in mt-4">
                    <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                    <div>
                      <h4 className="font-semibold text-destructive">Mathematical Mismatch Detected</h4>
                      <p className="text-sm text-destructive/80 mt-1">
                        All items are assigned, but the sum of everyone's split shares ({curr}{shares.reduce((sum, s) => sum + s.totalOwed, 0).toFixed(2)}) 
                        does not perfectly match the calculated receipt total ({curr}{calculatedTotal.toFixed(2)}). 
                        This is usually caused by unmapped taxes not set to divide equally, or manual overrides.
                      </p>
                    </div>
                  </div>
              )}

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
      <div className="w-full px-4 md:px-8 py-8 md:py-16 fade-in">
        <div className="flex justify-between items-center mb-6 max-w-[2000px] mx-auto">
          <h1 className="text-3xl font-extrabold text-primary tracking-tight">Review Items</h1>
          <Button variant="secondary" size="sm" onClick={() => setReceiptData(null)}>
            <RefreshCcw className="mr-2 h-4 w-4" /> Start Over
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-[2000px] mx-auto">
          <div className="lg:col-span-2 xl:col-span-3 space-y-4">
            <Card className="shadow-sm">
              <CardHeader className="p-4 border-b bg-muted/30 flex flex-col items-start w-full">
                <CardTitle className="text-xl">Receipt Details</CardTitle>
                <CardDescription>Edit names, fix prices, or remove incorrect items.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto w-full pb-2">
                  <Table className="min-w-[600px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[45%]">Item Name</TableHead>
                        <TableHead className="w-16 text-center">Qty</TableHead>
                        <TableHead className="w-24 text-right">Unit {curr}</TableHead>
                        <TableHead className="text-right">Total</TableHead>
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
                              className="h-8 shadow-none font-medium focus-visible:ring-1 border-transparent hover:border-input focus-visible:border-input bg-transparent"
                            />
                            <div className="px-3 pb-2 flex flex-wrap gap-2 items-center mt-2">
                              <span className="text-xs font-semibold text-muted-foreground mr-1">Taxes/Fees:</span>
                              {item.applied_taxes?.map(tax => (
                                <button key={tax} onClick={() => handleToggleItemTax(item.id, tax)} className="px-2 py-1 rounded text-xs bg-primary/20 text-primary font-bold hover:bg-destructive/20 hover:text-destructive hover:line-through shadow-sm transition-all">
                                  {tax}
                                </button>
                              ))}
                              {receiptData.taxes?.filter(t => !item.applied_taxes?.includes(t.name)).map(tax => (
                                <button key={tax.name} onClick={() => handleToggleItemTax(item.id, tax.name)} className="px-2 py-1 rounded text-xs bg-secondary/10 text-secondary font-medium border border-secondary/20 hover:bg-secondary/30 transition-all">
                                  + {tax.name}
                                </button>
                              ))}
                              <div className="w-full h-0"></div>
                              <span className="text-xs font-semibold text-muted-foreground mr-1">Discounts:</span>
                              {item.applied_discounts?.map(discount => (
                                <button key={discount} onClick={() => handleToggleItemDiscount(item.id, discount)} className="px-2 py-1 rounded text-xs bg-primary/20 text-primary font-bold hover:bg-destructive/20 hover:text-destructive hover:line-through shadow-sm transition-all">
                                  {discount}
                                </button>
                              ))}
                              {receiptData.discounts?.filter(d => !item.applied_discounts?.includes(d.name)).map(discount => (
                                <button key={discount.name} onClick={() => handleToggleItemDiscount(item.id, discount.name)} className="px-2 py-1 rounded text-xs bg-secondary/10 text-secondary font-medium border border-secondary/20 hover:bg-secondary/30 transition-all">
                                  + {discount.name}
                                </button>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="p-3 align-top pt-4 text-center">
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity || 1}
                              onChange={(e) => handleUpdateItem(item.id, "quantity", e.target.value)}
                              className="h-8 shadow-none text-center font-medium focus-visible:ring-1 border-transparent hover:border-input focus-visible:border-input bg-transparent px-1"
                            />
                          </TableCell>
                          
                          <TableCell className="p-3 align-top pt-4">
                            <Input
                              type="number"
                              step="0.01"
                              value={item.unit_price || ""}
                              onChange={(e) => handleUpdateItem(item.id, "unit_price", e.target.value)}
                              className="h-8 shadow-none text-right font-medium focus-visible:ring-1 border-transparent hover:border-input focus-visible:border-input bg-transparent px-1"
                            />
                          </TableCell>

                          <TableCell className="p-3 align-top pt-4 w-28">
                            <div className="flex flex-col items-end justify-start h-full mt-1.5">
                              {item.discounted_price !== undefined && item.discounted_price < item.price ? (
                                <>
                                  <span className="font-bold text-[10px] flex items-center line-through text-muted-foreground mr-1">{curr}{(item.price || 0).toFixed(2)}</span>
                                  <span className="font-bold text-sm flex items-center text-primary">{curr}{(item.discounted_price).toFixed(2)}</span>
                                </>
                              ) : (
                                <span className="font-bold text-sm flex items-center">{curr}{(item.price || 0).toFixed(2)}</span>
                              )}
                              
                              {item.inclusive_price > (item.discounted_price ?? item.price) && (
                                <div className="text-[10px] text-muted-foreground mt-1.5 font-semibold flex items-center bg-secondary/10 px-1.5 py-0.5 rounded whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
                                  Incl: {curr}{item.inclusive_price.toFixed(2)}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="p-3 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                              onClick={() => handleDeleteItem(item.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell colSpan={5} className="p-2 text-center">
                          <Button variant="ghost" size="sm" onClick={handleAddBlankItem} className="text-secondary hover:text-secondary hover:bg-secondary/10 w-full border border-dashed border-secondary/50">
                            + Add Item
                          </Button>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
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
                <div className="space-y-3">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Taxes/Fees Applied</Label>
                  {receiptData.taxes && receiptData.taxes.map((tax, idx) => {
                    const isAppliedToItems = receiptData.items.some(i => i.applied_taxes?.includes(tax.name));
                    return (
                        <div key={idx} className="flex flex-col bg-muted/20 p-2 rounded-md border gap-2">
                           <div className="flex justify-between items-center w-full">
                               <span className="text-sm font-medium truncate flex-1">{tax.name}</span>
                               <div className="flex items-center gap-1 shrink-0">
                                   <span className="text-sm font-semibold">{curr}</span>
                                   <Input
                                       type="number"
                                       step="0.01"
                                       value={tax.amount || ""}
                                       onChange={(e) => handleUpdateTax(idx, e.target.value)}
                                       className="h-7 w-20 text-right bg-background border-input shadow-sm"
                                   />
                                   <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => handleDeleteTax(idx)}>
                                       <Trash2 className="h-3 w-3" />
                                   </Button>
                               </div>
                           </div>
                           <div className="bg-background border rounded px-2 py-1.5 flex items-center justify-center min-h-[30px]">
                               {isAppliedToItems ? (
                                   <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Applied to specific items</span>
                               ) : (
                                   <span className="text-[10px] text-primary font-bold uppercase tracking-wide">Divided equally among all people</span>
                               )}
                           </div>
                        </div>
                    )
                  })}
                  {(!receiptData.taxes || receiptData.taxes.length === 0) && (
                    <div className="text-sm text-muted-foreground">No taxes/fees detected.</div>
                  )}
                  <Button variant="outline" size="sm" onClick={handleAddManualTax} className="w-full mt-2 text-xs border-dashed">
                    + Add New Tax/Fee
                  </Button>
                </div>

                <div className="space-y-3 pt-4 border-t">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Discounts / Promotions</Label>
                  {receiptData.discounts && receiptData.discounts.map((discount, idx) => {
                    const isAppliedToItems = receiptData.items.some(i => i.applied_discounts?.includes(discount.name));
                    return (
                        <div key={idx} className="flex flex-col bg-muted/20 p-2 rounded-md border gap-2">
                           <div className="flex justify-between items-center w-full">
                               <span className="text-sm font-medium truncate flex-1">{discount.name}</span>
                               <div className="flex items-center gap-1 shrink-0">
                                   <span className="text-sm font-semibold">{curr}</span>
                                   <Input
                                       type="number"
                                       step="0.01"
                                       value={discount.amount || ""}
                                       onChange={(e) => handleUpdateDiscount(idx, e.target.value)}
                                       className="h-7 w-20 text-right bg-background border-input shadow-sm"
                                   />
                                   <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => handleDeleteDiscount(idx)}>
                                       <Trash2 className="h-3 w-3" />
                                   </Button>
                               </div>
                           </div>
                           <div className="bg-background border rounded px-2 py-1.5 flex items-center justify-center min-h-[30px]">
                               {isAppliedToItems ? (
                                   <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Applied to specific items</span>
                               ) : (
                                   <span className="text-[10px] text-primary font-bold uppercase tracking-wide">Divided equally among all people</span>
                               )}
                           </div>
                        </div>
                    )
                  })}
                  {(!receiptData.discounts || receiptData.discounts.length === 0) && (
                    <div className="text-sm text-muted-foreground">No discounts detected.</div>
                  )}
                  <Button variant="outline" size="sm" onClick={handleAddManualDiscount} className="w-full mt-2 text-xs border-dashed">
                    + Add New Discount
                  </Button>
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
            Select a clear photo of your total bill showing the items and tax/fees.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-6">
          {error && (
            <div className="w-full bg-destructive/10 text-destructive text-sm p-3 rounded-md border border-destructive/20 text-center">
              {error}
            </div>
          )}
          {previews.length > 0 ? (
            <div className="relative w-full max-w-sm rounded-xl overflow-hidden shadow-lg border flex flex-col items-center justify-center p-2 gap-2 bg-muted/10">
              <div className="flex flex-wrap gap-2 justify-center w-full max-h-[60vh] overflow-auto">
                {previews.map((p, i) => (
                  <img key={i} src={p} alt={`Receipt Preview ${i + 1}`} className="w-full h-auto object-cover rounded shadow-sm border max-w-[45%]" />
                ))}
              </div>
              {!isLoading && (
                <Button
                  variant="destructive"
                  className="w-full mt-2"
                  onClick={() => { setFiles([]); setPreviews([]); setError(null); }}
                >
                  Clear Files
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
                Click to browse (Up to 3 images)
                <Input
                  id="receipt-upload"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                />
              </Label>
              <p className="mt-2 text-xs text-muted-foreground">Supported formats: JPEG, PNG, WEBP</p>
            </div>
          )}
        </CardContent>
        {previews.length > 0 && (
          <CardFooter className="flex flex-col sm:flex-row justify-between items-center bg-muted/30 p-4 rounded-b-xl border-t gap-4">
            {/* File Truncation box */}
            <div className="flex items-center gap-2 text-sm font-medium text-foreground min-w-0 max-w-full sm:max-w-[15rem]">
              <FileText className="h-4 w-4 shrink-0 text-secondary" />
              <div className="truncate px-1" title={files.map(f => f.name).join(', ')}>
                {files.length} images selected
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

      {!previews.length && (
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
