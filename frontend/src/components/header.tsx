import { ModeToggle } from "@/components/mode-toggle";
import { ReceiptText } from "lucide-react";

export function Header() {
    return (
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container mx-auto flex h-16 items-center justify-between px-4">
                <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                    <ReceiptText className="h-6 w-6 text-primary" />
                    <span className="text-xl font-bold tracking-tight">SplitSnap</span>
                </a>
                <ModeToggle />
            </div>
        </header>
    );
}
