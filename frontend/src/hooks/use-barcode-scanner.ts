"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * Detects barcode scanner input by distinguishing rapid keystroke sequences
 * from normal human typing. USB/Bluetooth barcode scanners emulate a keyboard
 * and "type" the barcode value followed by Enter, typically in under 100ms total.
 *
 * @param onScan - Callback fired with the scanned barcode string
 * @param options - Configuration options
 * @param options.maxDelay - Max ms between keystrokes to consider it a scan (default: 50)
 * @param options.minLength - Minimum characters for a valid scan (default: 3)
 * @param options.enabled - Whether the scanner listener is active (default: true)
 */
export function useBarcodeScanner(
  onScan: (code: string) => void,
  options?: {
    maxDelay?: number;
    minLength?: number;
    enabled?: boolean;
  }
) {
  const { maxDelay = 50, minLength = 3, enabled = true } = options ?? {};

  const bufferRef = useRef<string>("");
  const lastKeystrokeRef = useRef<number>(0);
  const onScanRef = useRef(onScan);

  // Keep callback ref current without re-registering the listener
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea (we handle that separately in the POS page)
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      const now = Date.now();
      const timeSinceLastKey = now - lastKeystrokeRef.current;

      if (event.key === "Enter") {
        // Check if buffer looks like a scan (fast input, sufficient length)
        if (bufferRef.current.length >= minLength) {
          event.preventDefault();
          onScanRef.current(bufferRef.current);
        }
        bufferRef.current = "";
        lastKeystrokeRef.current = 0;
        return;
      }

      // Only buffer printable single characters
      if (event.key.length !== 1) return;

      // If too much time has passed since last keystroke, reset buffer
      if (timeSinceLastKey > maxDelay && bufferRef.current.length > 0) {
        bufferRef.current = "";
      }

      bufferRef.current += event.key;
      lastKeystrokeRef.current = now;
    },
    [maxDelay, minLength]
  );

  useEffect(() => {
    if (!enabled) return;

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown, enabled]);
}
