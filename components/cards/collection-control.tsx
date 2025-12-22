"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Import CollectionData type
interface CollectionUpdateData {
    quantity?: number;
    quantity_foil?: number;
}

interface CollectionControlProps {
    cardId: string;
    userId: string;
    initialNormal?: number;
    initialFoil?: number;
    className?: string;
    showNormal?: boolean;
    showFoil?: boolean;
    compact?: boolean;
    onUpdate?: (cardId: string, data: CollectionUpdateData) => void;
}

export function CollectionControl({
    cardId,
    userId,
    initialNormal = 0,
    initialFoil = 0,
    className,
    showNormal = true,
    showFoil = true,
    compact = false,
    onUpdate
}: CollectionControlProps) {
    const [normal, setNormal] = useState(initialNormal);
    const [foil, setFoil] = useState(initialFoil);
    const [isSaving, setIsSaving] = useState(false);
    const normalRef = useRef(normal);
    const foilRef = useRef(foil);
    // Track the last saved values to avoid duplicate saves
    const lastSavedNormalRef = useRef(initialNormal);
    const lastSavedFoilRef = useRef(initialFoil);
    // Track if user has modified this card (to prevent prop-driven resets)
    const userModifiedRef = useRef(false);
    // Track previous cardId to detect card changes
    const prevCardIdRef = useRef(cardId);
    const supabase = createClient();

    // Keep refs in sync with state
    normalRef.current = normal;
    foilRef.current = foil;

    // Only reset state when cardId changes (new card) OR on initial mount
    // Don't reset when props change due to parent re-render (stale data race condition)
    useEffect(() => {
        // If cardId changed, this is a new card - reset everything
        if (prevCardIdRef.current !== cardId) {
            setNormal(initialNormal);
            setFoil(initialFoil);
            lastSavedNormalRef.current = initialNormal;
            lastSavedFoilRef.current = initialFoil;
            userModifiedRef.current = false;
            prevCardIdRef.current = cardId;
            return;
        }

        // If user hasn't modified yet, accept prop updates (initial data loading)
        if (!userModifiedRef.current) {
            setNormal(initialNormal);
            setFoil(initialFoil);
            lastSavedNormalRef.current = initialNormal;
            lastSavedFoilRef.current = initialFoil;
        }
        // If user HAS modified, ignore prop updates to preserve their changes
    }, [cardId, initialNormal, initialFoil]);

    // Immediate save function - saves directly to database without debounce
    // This ensures data is persisted even if user refreshes immediately after changing
    const saveToDatabase = useCallback(async (newNormal: number, newFoil: number) => {
        console.log('[CollectionControl] saveToDatabase called:', { cardId, userId, newNormal, newFoil });

        // Skip if values haven't changed from last saved values
        if (newNormal === lastSavedNormalRef.current && newFoil === lastSavedFoilRef.current) {
            console.log('[CollectionControl] Skipping save - values unchanged');
            return;
        }

        setIsSaving(true);
        try {
            console.log('[CollectionControl] Upserting to user_collections...');
            const { error, data } = await supabase
                .from("user_collections")
                .upsert({
                    user_id: userId,
                    card_id: cardId,
                    quantity: newNormal,
                    quantity_foil: newFoil,
                    owned: newNormal > 0 || newFoil > 0
                }, { onConflict: 'user_id, card_id' })
                .select();

            console.log('[CollectionControl] Upsert result:', { error, data });

            if (error) throw error;

            // Update last saved values on success
            lastSavedNormalRef.current = newNormal;
            lastSavedFoilRef.current = newFoil;
            console.log('[CollectionControl] Save successful!');
        } catch (error) {
            console.error("[CollectionControl] Error saving collection:", error);
            toast.error("Erreur lors de la mise à jour");
        } finally {
            setIsSaving(false);
        }
    }, [supabase, userId, cardId]);

    const handleNormalChange = (value: number) => {
        const newValue = Math.max(0, value);
        setNormal(newValue);
        // Mark as user-modified to prevent prop-driven resets
        userModifiedRef.current = true;
        // Save immediately
        saveToDatabase(newValue, foilRef.current);
        // Notify parent to update local state
        onUpdate?.(cardId, { quantity: newValue, quantity_foil: foilRef.current });
    };

    const handleFoilChange = (value: number) => {
        const newValue = Math.max(0, value);
        setFoil(newValue);
        // Mark as user-modified to prevent prop-driven resets
        userModifiedRef.current = true;
        // Save immediately
        saveToDatabase(normalRef.current, newValue);
        // Notify parent to update local state
        onUpdate?.(cardId, { quantity: normalRef.current, quantity_foil: newValue });
    };

    // Compact mode for list view
    if (compact) {
        return (
            <div className={cn("flex items-center gap-2", className)}>
                {/* Normal Control - Compact */}
                {showNormal && (
                    <div className="flex items-center bg-slate-800/80 rounded-full p-0.5">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 rounded-full hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                            onClick={(e) => { e.preventDefault(); handleNormalChange(normal - 1); }}
                        >
                            <Minus className="h-2.5 w-2.5" />
                        </Button>
                        <span className="w-6 text-center text-xs font-bold text-white">{normal}</span>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 rounded-full hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                            onClick={(e) => { e.preventDefault(); handleNormalChange(normal + 1); }}
                        >
                            <Plus className="h-2.5 w-2.5" />
                        </Button>
                    </div>
                )}

                {/* Foil Control - Compact */}
                {showFoil && (
                    <div className="flex items-center bg-[linear-gradient(to_right,rgba(234,88,12,0.6),rgba(202,138,4,0.6),rgba(22,163,74,0.6),rgba(37,99,235,0.6))] rounded-full p-0.5">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 rounded-full hover:bg-white/20 text-white transition-colors"
                            onClick={(e) => { e.preventDefault(); handleFoilChange(foil - 1); }}
                        >
                            <Minus className="h-2.5 w-2.5" />
                        </Button>
                        <span className="w-6 text-center text-xs font-bold text-white">{foil}</span>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 rounded-full hover:bg-white/20 text-white transition-colors"
                            onClick={(e) => { e.preventDefault(); handleFoilChange(foil + 1); }}
                        >
                            <Plus className="h-2.5 w-2.5" />
                        </Button>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className={cn("flex items-center justify-center gap-3", className)}>
            {/* Normal Control */}
            {showNormal && (
                <div className="flex items-center bg-slate-800/90 backdrop-blur-sm rounded-full p-0.5 shadow-lg border border-slate-700">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-full hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                        onClick={(e) => { e.preventDefault(); handleNormalChange(normal - 1); }}
                    >
                        <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <Input
                        type="number"
                        min={0}
                        value={normal}
                        onChange={(e) => handleNormalChange(parseInt(e.target.value) || 0)}
                        className="w-10 h-7 p-0 text-center bg-transparent border-none text-sm font-bold text-white focus-visible:ring-0 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-full hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                        onClick={(e) => { e.preventDefault(); handleNormalChange(normal + 1); }}
                    >
                        <Plus className="h-3.5 w-3.5" />
                    </Button>
                </div>
            )}

            {/* Foil Control */}
            {showFoil && (
                <div className="relative group">
                    <div className="absolute -inset-0.5 bg-[linear-gradient(to_right,#ea580c,#ca8a04,#16a34a,#2563eb)] rounded-full opacity-30 group-hover:opacity-50 blur transition duration-200"></div>
                    <div className="relative flex items-center bg-[linear-gradient(to_right,rgba(234,88,12,0.6),rgba(202,138,4,0.6),rgba(22,163,74,0.6),rgba(37,99,235,0.6))] backdrop-blur-sm rounded-full p-0.5 shadow-lg border border-white/20">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-full hover:bg-white/20 text-white transition-colors"
                            onClick={(e) => { e.preventDefault(); handleFoilChange(foil - 1); }}
                        >
                            <Minus className="h-3.5 w-3.5" />
                        </Button>
                        <Input
                            type="number"
                            min={0}
                            value={foil}
                            onChange={(e) => handleFoilChange(parseInt(e.target.value) || 0)}
                            className="w-10 h-7 p-0 text-center bg-transparent border-none text-sm font-bold text-white focus-visible:ring-0 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-full hover:bg-white/20 text-white transition-colors"
                            onClick={(e) => { e.preventDefault(); handleFoilChange(foil + 1); }}
                        >
                            <Plus className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
