export interface IssueUpdateOptions {
    notifier?: string;
    [key: string]: any;
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
declare class ErrorMonitor {
    private apiKey;
    private options;
    private originalHandlers;
    private isActive;
    constructor(apiKey: string, options?: MonitorOptions);
    /**
     * Start monitoring for errors globally
     */
    start(): void;
    /**
     * Stop monitoring and restore original handlers
     */
    stop(): void;
    /**
     * Manually report an error
     */
    reportError(event: string, err: Error | string, errorType?: 'uncaught' | 'promise' | 'manual'): Promise<void>;
    /**
     * Wrap a function to automatically catch and report errors
     */
    wrapFunction<T extends (...args: any[]) => any>(fn: T, functionName?: string): T;
    /**
     * Wrap all methods of an object/class
     */
    wrapObject<T extends Record<string, any>>(obj: T, objectName?: string): T;
}
/**
 * Initialize global error monitoring with a single line
 * @param apiKey - Your API key
 * @param options - Configuration options
 */
export declare function monitor(apiKey: string, options?: MonitorOptions): ErrorMonitor;
/**
 * Stop global monitoring
 */
export declare function stopMonitoring(): void;
/**
 * Get the current monitor instance
 */
export declare function getMonitor(): ErrorMonitor | null;
/**
 * Manually report an error (for backward compatibility)
 */
export declare function issueUpdate(apiKey: string, event: string, err: Error | string, data?: IssueUpdateOptions): Promise<any>;
/**
 * Decorator for automatic error monitoring (TypeScript/ES6+)
 */
export declare function monitored(target: any, propertyName: string, descriptor: PropertyDescriptor): PropertyDescriptor;
export { ErrorMonitor };
