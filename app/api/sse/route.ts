import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

// Verify JWT token from request
function verifyToken(token: string | null): { userId: string; companyId: string } | null {
  if (!token) return null;
  
  try {
    const secret = process.env.JWT_SECRET || 'secret';
    const decoded = jwt.verify(token, secret) as { sub: string; companyId?: string };
    return {
      userId: decoded.sub,
      companyId: decoded.companyId || '',
    };
  } catch (error) {
    return null;
  }
}

export async function GET(request: NextRequest) {
  // Verify authentication
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '') || null;
  
  const user = verifyToken(token);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const encoder = new TextEncoder();
    let intervalId: NodeJS.Timeout | null = null;
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const sendEvent = (data: any) => {
            try {
              const message = `data: ${JSON.stringify(data)}\n\n`;
              controller.enqueue(encoder.encode(message));
            } catch (error) {
              console.error('SSE: Failed to send event:', error);
              // Don't close stream on individual event errors
            }
          };

          // Send initial connection
          sendEvent({ type: 'connected', timestamp: new Date().toISOString() });

          // Simulate real-time updates (bug67 - handle errors)
          intervalId = setInterval(() => {
            try {
              // Send periodic updates
              sendEvent({
                type: 'stats_update',
                data: {
                  timestamp: new Date().toISOString(),
                },
              });
            } catch (error) {
              console.error('SSE: Error in interval handler:', error);
              // Clear interval on error to prevent memory leak
              if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
              }
            }
          }, 5000); // Update every 5 seconds

          // Keep connection alive (bug67 - ensure cleanup)
          request.signal.addEventListener('abort', () => {
            if (intervalId) {
              clearInterval(intervalId);
              intervalId = null;
            }
            try {
              controller.close();
            } catch (error) {
              console.error('SSE: Error closing controller:', error);
            }
          });
        } catch (error) {
          console.error('SSE: Error in stream start:', error);
          // Cleanup on error
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
          try {
            controller.close();
          } catch (closeError) {
            console.error('SSE: Error closing controller on error:', closeError);
          }
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    console.error('SSE: Failed to create stream:', error);
    return new Response(JSON.stringify({ error: 'Failed to create SSE stream' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

