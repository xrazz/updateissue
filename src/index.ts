import fetch from "cross-fetch";

export interface IssueUpdateOptions {
  notifier?: string;
  [key: string]: any; // allow extra fields
}

export interface MonitorOptions extends IssueUpdateOptions {
  endpoint?: string;
  enableConsoleErrors?: boolean;
  enablePromiseRejections?: boolean;
  enableFunctionWrapping?: boolean;
  enableFetchMonitoring?: boolean;
  monitorHttpErrors?: boolean;
  httpErrorCodes?: number[];
}

interface ErrorPayload {
  event: string;
  error: string;
  stack?: string;
  file?: string;
  function?: string;
  line?: string;
  col?: string;
  data: any;
  timestamp: string;
  errorType: 'uncaught' | 'promise' | 'manual';
}

class ErrorMonitor {
  private apiKey: string;
  private options: MonitorOptions;
  private originalHandlers: Map<string, any> = new Map();
  private isActive = false;

  constructor(apiKey: string, options: MonitorOptions = {}) {
    this.apiKey = apiKey;
    this.options = {
      endpoint: "https://your-backend.com/webhook",
      enableConsoleErrors: true,
      enablePromiseRejections: true,
      enableFunctionWrapping: true,
      enableFetchMonitoring: true,
      monitorHttpErrors: true,
      httpErrorCodes: [400, 401, 403, 404, 429, 500, 502, 503, 504],
      ...options
    };
  }

  /**
   * Start monitoring for errors globally
   */
  public start(): void {
    if (this.isActive) return;
    
    this.isActive = true;

    // Monitor uncaught exceptions (Node.js)
    if (typeof process !== 'undefined' && process.on) {
      const uncaughtHandler = (error: Error) => {
        this.reportError('uncaught_exception', error, 'uncaught');
      };
      process.on('uncaughtException', uncaughtHandler);
      this.originalHandlers.set('uncaughtException', uncaughtHandler);
    }

    // Monitor unhandled promise rejections
    if (this.options.enablePromiseRejections) {
      if (typeof window !== 'undefined') {
        // Browser environment
        const rejectionHandler = (event: PromiseRejectionEvent) => {
          const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
          this.reportError('unhandled_promise_rejection', error, 'promise');
        };
        window.addEventListener('unhandledrejection', rejectionHandler);
        this.originalHandlers.set('unhandledrejection', rejectionHandler);
      } else if (typeof process !== 'undefined' && process.on) {
        // Node.js environment
        const rejectionHandler = (reason: any, promise: Promise<any>) => {
          const error = reason instanceof Error ? reason : new Error(String(reason));
          this.reportError('unhandled_promise_rejection', error, 'promise');
        };
        process.on('unhandledRejection', rejectionHandler);
        this.originalHandlers.set('unhandledRejection', rejectionHandler);
      }
    }

    // Monitor console.error calls
    if (this.options.enableConsoleErrors && typeof console !== 'undefined') {
      const originalError = console.error;
      console.error = (...args: any[]) => {
        // Call original console.error first
        originalError.apply(console, args);
        
        // Report if first argument looks like an error
        if (args.length > 0) {
          const firstArg = args[0];
          if (firstArg instanceof Error) {
            this.reportError('console_error', firstArg, 'manual');
          } else if (typeof firstArg === 'string' && args.length > 1 && args[1] instanceof Error) {
            this.reportError(firstArg, args[1], 'manual');
          }
        }
      };
      this.originalHandlers.set('console.error', originalError);
    }

    // Browser-specific error handler
    if (typeof window !== 'undefined') {
      const errorHandler = (event: ErrorEvent) => {
        const error = event.error || new Error(event.message);
        this.reportError('global_error', error, 'uncaught');
      };
      window.addEventListener('error', errorHandler);
      this.originalHandlers.set('error', errorHandler);
    }

    // Monitor fetch requests for HTTP errors
    if (this.options.enableFetchMonitoring && typeof window !== 'undefined' && window.fetch) {
      const originalFetch = window.fetch;
      const monitor = this;
      
      window.fetch = async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
        try {
          const response = await originalFetch(input, init);
          
          // Check if we should monitor this HTTP status
          if (monitor.options.monitorHttpErrors && 
              monitor.options.httpErrorCodes?.includes(response.status)) {
            
            const url = typeof input === 'string' ? input : input.toString();
            const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
            
            // Try to get response body for more context
            let responseBody = '';
            try {
              const clone = response.clone();
              responseBody = await clone.text();
            } catch (e) {
              // Ignore if we can't read the body
            }
            
            monitor.reportError(
              `fetch_${response.status}`, 
              error, 
              'manual'
            );
          }
          
          return response;
        } catch (fetchError) {
          // Network errors, timeouts, etc.
          const url = typeof input === 'string' ? input : input.toString();
          monitor.reportError('fetch_network_error', fetchError as Error, 'manual');
          throw fetchError;
        }
      };
      
      this.originalHandlers.set('fetch', originalFetch);
    }

    // Monitor fetch in Node.js environment (if using node-fetch or similar)
    if (this.options.enableFetchMonitoring && typeof global !== 'undefined' && global.fetch) {
      const originalFetch = global.fetch;
      const monitor = this;
      
      global.fetch = async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
        try {
          const response = await originalFetch(input, init);
          
          if (monitor.options.monitorHttpErrors && 
              monitor.options.httpErrorCodes?.includes(response.status)) {
            
            const url = typeof input === 'string' ? input : input.toString();
            const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
            
            monitor.reportError(
              `fetch_${response.status}`, 
              error, 
              'manual'
            );
          }
          
          return response;
        } catch (fetchError) {
          const url = typeof input === 'string' ? input : input.toString();
          monitor.reportError('fetch_network_error', fetchError as Error, 'manual');
          throw fetchError;
        }
      };
      
      this.originalHandlers.set('global.fetch', originalFetch);
    }
  }

  /**
   * Stop monitoring and restore original handlers
   */
  public stop(): void {
    if (!this.isActive) return;
    
    this.isActive = false;

    // Restore original handlers
    if (typeof process !== 'undefined' && process.removeListener) {
      const uncaughtHandler = this.originalHandlers.get('uncaughtException');
      const rejectionHandler = this.originalHandlers.get('unhandledRejection');
      
      if (uncaughtHandler) process.removeListener('uncaughtException', uncaughtHandler);
      if (rejectionHandler) process.removeListener('unhandledRejection', rejectionHandler);
    }

    if (typeof window !== 'undefined') {
      const rejectionHandler = this.originalHandlers.get('unhandledrejection');
      const errorHandler = this.originalHandlers.get('error');
      
      if (rejectionHandler) window.removeEventListener('unhandledrejection', rejectionHandler);
      if (errorHandler) window.removeEventListener('error', errorHandler);
    }

    // Restore console.error
    const originalError = this.originalHandlers.get('console.error');
    if (originalError && typeof console !== 'undefined') {
      console.error = originalError;
    }

    // Restore fetch
    const originalFetch = this.originalHandlers.get('fetch');
    if (originalFetch && typeof window !== 'undefined') {
      window.fetch = originalFetch;
    }

    const originalGlobalFetch = this.originalHandlers.get('global.fetch');
    if (originalGlobalFetch && typeof global !== 'undefined') {
      global.fetch = originalGlobalFetch;
    }

    this.originalHandlers.clear();
  }

  /**
   * Manually report an error
   */
  public async reportError(
    event: string, 
    err: Error | string, 
    errorType: 'uncaught' | 'promise' | 'manual' = 'manual'
  ): Promise<void> {
    try {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      const stackLines = (errorObj.stack || "").split("\n");

      // Extract caller info from stack trace
      let functionName: string | undefined = undefined,
          fileName: string | undefined = undefined,
          line: string | undefined = undefined,
          col: string | undefined = undefined;

      // Look for the first meaningful stack frame (skip the first line which is just the error)
      for (let i = 1; i < stackLines.length; i++) {
        const stackLine = stackLines[i];
        
        // Try different stack trace formats
        let match = stackLine.match(/\s*at\s+(.*?)\s+\((.*):(\d+):(\d+)\)/);
        if (!match) {
          match = stackLine.match(/\s*at\s+(.*):(\d+):(\d+)/);
          if (match) {
            fileName = match[1];
            line = match[2];
            col = match[3];
          }
        } else {
          functionName = match[1];
          fileName = match[2];
          line = match[3];
          col = match[4];
        }

        // Skip internal Node.js or browser frames
        if (fileName && !fileName.includes('node_modules') && !fileName.includes('internal/')) {
          break;
        }
      }

      const payload: ErrorPayload = {
        event,
        error: errorObj.message,
        stack: errorObj.stack,
        file: fileName,
        function: functionName,
        line,
        col,
        data: this.options,
        timestamp: new Date().toISOString(),
        errorType
      };

      console.log("🚨 Error Monitor - Reporting issue:", payload);

      const response = await fetch(this.options.endpoint!, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Error reporting failed with status ${response.status}`);
      }

    } catch (reportErr) {
      console.error("🚨 Error Monitor - Failed to report error:", reportErr);
      // Don't throw to avoid infinite loops
    }
  }

  /**
   * Wrap a function to automatically catch and report errors
   */
  public wrapFunction<T extends (...args: any[]) => any>(
    fn: T, 
    functionName?: string
  ): T {
    const monitor = this;
    const wrappedFunction = function(this: any, ...args: any[]) {
      try {
        const result = fn.apply(this, args);
        
        // Handle promise returns
        if (result && typeof result.then === 'function') {
          return result.catch((error: any) => {
            monitor.reportError(functionName || fn.name || 'anonymous_async_function', error, 'manual');
            throw error; // Re-throw to maintain original behavior
          });
        }
        
        return result;
      } catch (error) {
        monitor.reportError(functionName || fn.name || 'anonymous_function', error as Error, 'manual');
        throw error; // Re-throw to maintain original behavior
      }
    } as T;

    // Preserve function properties
    Object.defineProperty(wrappedFunction, 'name', { value: fn.name });
    return wrappedFunction;
  }

  /**
   * Wrap all methods of an object/class
   */
  public wrapObject<T extends Record<string, any>>(obj: T, objectName?: string): T {
    const monitor = this;
    
    Object.getOwnPropertyNames(obj).forEach(prop => {
      const descriptor = Object.getOwnPropertyDescriptor(obj, prop);
      if (descriptor && typeof descriptor.value === 'function') {
        const originalMethod = descriptor.value;
        const methodName = `${objectName || 'Object'}.${prop}`;
        
        // Use type assertion to tell TypeScript this is safe
        (obj as any)[prop] = monitor.wrapFunction(originalMethod, methodName);
      }
    });

    return obj;
  }
}

// Global monitor instance
let globalMonitor: ErrorMonitor | null = null;

/**
 * Initialize global error monitoring with a single line
 * @param apiKey - Your API key
 * @param options - Configuration options
 */
export function monitor(apiKey: string, options: MonitorOptions = {}): ErrorMonitor {
  if (globalMonitor) {
    globalMonitor.stop();
  }
  
  globalMonitor = new ErrorMonitor(apiKey, options);
  globalMonitor.start();
  
  return globalMonitor;
}

/**
 * Stop global monitoring
 */
export function stopMonitoring(): void {
  if (globalMonitor) {
    globalMonitor.stop();
    globalMonitor = null;
  }
}

/**
 * Get the current monitor instance
 */
export function getMonitor(): ErrorMonitor | null {
  return globalMonitor;
}

/**
 * Manually report an error (for backward compatibility)
 */
export async function issueUpdate(
  apiKey: string,
  event: string,
  err: Error | string,
  data: IssueUpdateOptions = {}
): Promise<any> {
  if (globalMonitor) {
    return globalMonitor.reportError(event, err, 'manual');
  }
  
  // Fallback to direct reporting if no global monitor
  const tempMonitor = new ErrorMonitor(apiKey, data);
  return tempMonitor.reportError(event, err, 'manual');
}

/**
 * Decorator for automatic error monitoring (TypeScript/ES6+)
 */
export function monitored(target: any, propertyName: string, descriptor: PropertyDescriptor) {
  if (!globalMonitor) {
    console.warn('Error monitor not initialized. Call monitor() first.');
    return descriptor;
  }

  const method = descriptor.value;
  descriptor.value = globalMonitor.wrapFunction(method, `${target.constructor.name}.${propertyName}`);
  return descriptor;
}

// Export the ErrorMonitor class for advanced usage
export { ErrorMonitor };