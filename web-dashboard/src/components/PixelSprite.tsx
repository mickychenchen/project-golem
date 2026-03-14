"use client";

import { useEffect, useRef, CSSProperties } from "react";

interface PixelSpriteProps {
    /** Path to the spritesheet image */
    src: string;
    /** Width of a single frame in pixels */
    frameWidth: number;
    /** Height of a single frame in pixels */
    frameHeight: number;
    /** Total number of frames in the spritesheet */
    frameCount: number;
    /** Number of columns in the sprite grid */
    cols: number;
    /** Playback speed in frames per second (default: 12) */
    fps?: number;
    /** Scale factor (default: 1) */
    scale?: number;
    /** Whether the animation is playing (default: true) */
    isPlaying?: boolean;
    /** Whether to loop the animation (default: true) */
    loop?: boolean;
    /** Starting frame index (default: 0) */
    startFrame?: number;
    /** Additional CSS class names for the outer wrapper */
    className?: string;
    style?: CSSProperties;
}

/**
 * PixelSprite — CSS-driven sprite sheet animation component.
 *
 * Renders a single frame from a sprite grid and uses requestAnimationFrame
 * to advance frames at the target FPS. This avoids injecting global <style>
 * tags and works cleanly with React's rendering model.
 */
export function PixelSprite({
    src,
    frameWidth,
    frameHeight,
    frameCount,
    cols,
    fps = 12,
    scale = 1,
    isPlaying = true,
    loop = true,
    startFrame = 0,
    className,
    style,
}: PixelSpriteProps) {
    const displayW = Math.round(frameWidth * scale);
    const displayH = Math.round(frameHeight * scale);

    // Number of rows in the spritesheet
    const rows = Math.ceil(frameCount / cols);

    // For a grid-based spritesheet, we need two steps:
    // 1. Horizontal movement (cols)
    // 2. Vertical movement (rows)
    // However, CSS steps() for a grid is complex via just background-position.
    // The most stable way for a grid is using animation-timing-function: steps().
    // But since it's a grid, we'll use a single-axis step if possible, 
    // or keep the Canvas but FIX the clearing/doubling issue.
    
    // Actually, looking at the user's "repeated" glitch, it's likely a Canvas scaling issue 
    // combined with the browser's high DPI. 
    // Let's use a pure CSS implementation for SINGLE STRIPS or a solid Canvas fix.
    
    // DECISION: Many grid sprites prefer Canvas. Let's fix the Canvas implementation 
    // by using integer-only coordinates and ensuring the context is stable.
    
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imgRef = useRef<HTMLImageElement | null>(null);
    const frameRef = useRef(startFrame);
    const lastTimeRef = useRef(0);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d", { alpha: true });
        if (!ctx) return;

        let rafId: number;
        const img = new Image();
        imgRef.current = img;

        const draw = (frame: number) => {
            const col = frame % cols;
            const row = Math.floor(frame / cols);
            
            ctx.clearRect(0, 0, frameWidth, frameHeight);
            ctx.imageSmoothingEnabled = false;
            
            ctx.drawImage(
                img,
                col * frameWidth,
                row * frameHeight,
                frameWidth,
                frameHeight,
                0,
                0,
                frameWidth,
                frameHeight
            );
        };

        const tick = (timestamp: number) => {
            if (!isPlaying) {
                rafId = requestAnimationFrame(tick);
                return;
            }

            const interval = 1000 / fps;
            if (timestamp - lastTimeRef.current >= interval) {
                lastTimeRef.current = timestamp;
                draw(frameRef.current);
                
                frameRef.current++;
                if (frameRef.current >= frameCount) {
                    if (loop) frameRef.current = 0;
                    else {
                        frameRef.current = frameCount - 1;
                        return;
                    }
                }
            }
            rafId = requestAnimationFrame(tick);
        };

        img.onload = () => {
            draw(frameRef.current);
            rafId = requestAnimationFrame(tick);
        };
        img.src = src;

        return () => cancelAnimationFrame(rafId);
    }, [src, frameWidth, frameHeight, frameCount, cols, fps, isPlaying, loop]);

    return (
        <div
            className={className}
            style={{
                width: displayW,
                height: displayH,
                overflow: "hidden", // CRITICAL: Prevent bleeding
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                imageRendering: "pixelated",
                ...style,
            }}
        >
            <canvas
                ref={canvasRef}
                width={frameWidth}
                height={frameHeight}
                style={{
                    width: displayW,
                    height: displayH,
                    imageRendering: "pixelated",
                }}
            />
        </div>
    );
}
