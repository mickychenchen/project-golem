"use client";

import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertTriangle, X, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastType = "success" | "error" | "warning";

interface ToastProps {
    message: string;
    type: ToastType;
    isVisible: boolean;
    onClose: () => void;
    duration?: number;
}

export function Toast({ message, type, isVisible, onClose, duration = 5000 }: ToastProps) {
    useEffect(() => {
        if (isVisible && duration > 0) {
            const timer = setTimeout(onClose, duration);
            return () => clearTimeout(timer);
        }
    }, [isVisible, duration, onClose]);

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, y: 50, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                    className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] min-w-[320px] max-w-md"
                >
                    <div className={cn(
                        "relative overflow-hidden rounded-2xl border p-4 shadow-2xl backdrop-blur-xl",
                        type === "success" && "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
                        type === "error" && "bg-destructive/10 border-destructive/20 text-destructive",
                        type === "warning" && "bg-amber-500/10 border-amber-500/20 text-amber-500"
                    )}>
                        {/* Progress Bar Animation */}
                        <motion.div 
                            initial={{ width: "100%" }}
                            animate={{ width: "0%" }}
                            transition={{ duration: duration / 1000, ease: "linear" }}
                            className={cn(
                                "absolute bottom-0 left-0 h-1",
                                type === "success" && "bg-emerald-500/30",
                                type === "error" && "bg-destructive/30",
                                type === "warning" && "bg-amber-500/30"
                            )}
                        />

                        <div className="flex items-start gap-3">
                            <div className="mt-0.5">
                                {type === "success" && <CheckCircle2 className="w-5 h-5" />}
                                {type === "error" && <AlertTriangle className="w-5 h-5" />}
                                {type === "warning" && <RefreshCw className="w-5 h-5" />}
                            </div>
                            
                            <div className="flex-1 pr-4">
                                <p className="text-sm font-bold leading-tight">
                                    {type === "success" ? "操作成功" : type === "error" ? "發生錯誤" : "需要注意"}
                                </p>
                                <p className="text-xs mt-1 text-foreground/80 leading-relaxed">
                                    {message}
                                </p>
                            </div>

                            <button 
                                onClick={onClose}
                                className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <X className="w-4 h-4 opacity-50 hover:opacity-100" />
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
