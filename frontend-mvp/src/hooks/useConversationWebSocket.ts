/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
//@ts-nocheck
import { useEffect, useRef, useState, useCallback } from "react";

interface ProgressUpdate {
  status: string;
  message: string;
  progress: number;
  timestamp: string;
  data?: any;
}

export const useConversationWebSocket = (
  sessionId: string | null,
  onProgress?: (update: ProgressUpdate) => void,
  onComplete?: (results: any) => void,
  onError?: (error: string) => void
) => {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttemptsRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 5;

  const connect = useCallback(() => {
    if (!sessionId) return;

    const token = localStorage.getItem("token");
    const wsUrl = `${
      process.env.NEXT_PUBLIC_WS_BASE_URL || "ws://localhost:8000"
    }/session/${sessionId}?token=${token}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("🔌 WebSocket connected for session:", sessionId);
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const update = JSON.parse(event.data);
          console.log("📨 WebSocket update:", update);

          if (update.action === "progress_update" && update.data) {
            onProgress?.(update.data);

            if (update.data.status === "completed") {
              onComplete?.(update.data.data);
            } else if (update.data.status === "error") {
              onError?.(update.data.message);
            }
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      ws.onerror = (error) => {
        console.error("❌ WebSocket error:", error);
        setIsConnected(false);
      };

      ws.onclose = () => {
        console.log("🔌 WebSocket disconnected");
        setIsConnected(false);

        // Attempt reconnection
        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttemptsRef.current++;
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log(
              `🔄 Reconnecting... Attempt ${reconnectAttemptsRef.current}`
            );
            connect();
          }, 2000 * reconnectAttemptsRef.current);
        }
      };
    } catch (error) {
      console.error("Failed to create WebSocket:", error);
      setIsConnected(false);
    }
  }, [sessionId, onProgress, onComplete, onError]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  useEffect(() => {
    connect();
    return disconnect;
  }, [connect, disconnect]);

  return { isConnected, disconnect, reconnect: connect };
};
