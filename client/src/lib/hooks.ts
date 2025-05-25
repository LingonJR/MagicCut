import { useState, useEffect, useCallback, useRef } from 'react';

// Custom hook for WebSocket connections
export function useWebSocket<T>(
  endpoint: string, 
  onMessage: (data: T) => void,
  enabled: boolean = true
) {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  
  // Update the ref when onMessage changes
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const connect = useCallback(() => {
    // Create WebSocket URL
    // Use secure connection when on HTTPS
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}${endpoint}`;
    
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log(`WebSocket connected: ${wsUrl}`);
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // Use the ref to avoid dependency issues
        onMessageRef.current(data);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    ws.onclose = () => {
      console.log('WebSocket disconnected');
      // Attempt to reconnect after a delay, but only if still enabled
      if (enabled) {
        const reconnectTimer = setTimeout(() => {
          // Only reconnect if we're still enabled
          if (enabled) {
            connect();
          }
        }, 5000); // Longer delay to prevent rapid reconnection attempts
        
        return () => clearTimeout(reconnectTimer);
      }
    };
    
    setSocket(ws);
    
    return ws;
  }, [endpoint, enabled]);
  
  // Connect on mount and cleanup on unmount
  useEffect(() => {
    let ws: WebSocket | null = null;
    
    if (enabled) {
      ws = connect();
    }
    
    // Cleanup function
    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [connect, enabled]);
  
  // Function to send messages through the socket
  const sendMessage = useCallback((data: any) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(data));
    } else {
      console.error('WebSocket is not connected');
    }
  }, [socket]);
  
  return { sendMessage };
}
