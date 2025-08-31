"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorMonitor = void 0;
exports.monitor = monitor;
exports.stopMonitoring = stopMonitoring;
exports.getMonitor = getMonitor;
exports.issueUpdate = issueUpdate;
exports.monitored = monitored;
const cross_fetch_1 = __importDefault(require("cross-fetch"));
class ErrorMonitor {
    constructor(apiKey, options = {}) {
        this.originalHandlers = new Map();
        this.isActive = false;
        this.apiKey = apiKey;
        this.options = Object.assign({ endpoint: "https://your-backend.com/webhook", enableConsoleErrors: true, enablePromiseRejections: true, enableFunctionWrapping: true, enableFetchMonitoring: true, monitorHttpErrors: true, httpErrorCodes: [400, 401, 403, 404, 429, 500, 502, 503, 504], silent: false, debugMode: false }, options);
    }
    /**
     * Start monitoring for errors globally
     */
    start() {
        if (this.isActive)
            return;
        this.isActive = true;
        if (!this.options.silent) {
            console.log('🛡️  UpdateIssue SDK - Error monitoring started');
            console.log('📡 Endpoint:', this.options.endpoint);
            console.log('🔔 Notifier:', this.options.notifier || 'default');
            console.log('📋 Monitoring:', {
                consoleErrors: this.options.enableConsoleErrors,
                promiseRejections: this.options.enablePromiseRejections,
                fetchRequests: this.options.enableFetchMonitoring,
                httpErrorCodes: this.options.httpErrorCodes
            });
        }
        // Monitor uncaught exceptions (Node.js)
        if (typeof process !== 'undefined' && process.on) {
            const uncaughtHandler = (error) => {
                if (!this.options.silent) {
                    console.log('🚨 UpdateIssue - Caught uncaught exception:', error.message);
                }
                this.reportError('uncaught_exception', error, 'uncaught');
            };
            if (!this.options.silent) {
                console.log('🛡️  UpdateIssue SDK - Error monitoring stopped');
            }
            process.on('uncaughtException', uncaughtHandler);
            this.originalHandlers.set('uncaughtException', uncaughtHandler);
        }
        // Monitor unhandled promise rejections
        if (this.options.enablePromiseRejections) {
            if (typeof window !== 'undefined') {
                // Browser environment
                const rejectionHandler = (event) => {
                    const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
                    if (!this.options.silent) {
                        console.log('🚨 UpdateIssue - Caught unhandled promise rejection:', error.message);
                    }
                    this.reportError('unhandled_promise_rejection', error, 'promise');
                };
                window.addEventListener('unhandledrejection', rejectionHandler);
                this.originalHandlers.set('unhandledrejection', rejectionHandler);
            }
            else if (typeof process !== 'undefined' && process.on) {
                // Node.js environment
                const rejectionHandler = (reason, promise) => {
                    const error = reason instanceof Error ? reason : new Error(String(reason));
                    if (!this.options.silent) {
                        console.log('🚨 UpdateIssue - Caught unhandled promise rejection:', error.message);
                    }
                    this.reportError('unhandled_promise_rejection', error, 'promise');
                };
                process.on('unhandledRejection', rejectionHandler);
                this.originalHandlers.set('unhandledRejection', rejectionHandler);
            }
        }
        // Monitor console.error calls
        if (this.options.enableConsoleErrors && typeof console !== 'undefined') {
            const originalError = console.error;
            console.error = (...args) => {
                // Call original console.error first
                originalError.apply(console, args);
                // Report if first argument looks like an error
                if (args.length > 0) {
                    const firstArg = args[0];
                    if (firstArg instanceof Error) {
                        if (!this.options.silent) {
                            console.log('🚨 UpdateIssue - Caught console.error with Error object:', firstArg.message);
                        }
                        this.reportError('console_error', firstArg, 'manual');
                    }
                    else if (typeof firstArg === 'string' && args.length > 1 && args[1] instanceof Error) {
                        if (!this.options.silent) {
                            console.log('🚨 UpdateIssue - Caught console.error:', firstArg);
                        }
                        this.reportError(firstArg, args[1], 'manual');
                    }
                }
            };
            this.originalHandlers.set('console.error', originalError);
        }
        // Browser-specific error handler
        if (typeof window !== 'undefined') {
            const errorHandler = (event) => {
                const error = event.error || new Error(event.message);
                if (!this.options.silent) {
                    console.log('🚨 UpdateIssue - Caught global window error:', error.message);
                }
                this.reportError('global_error', error, 'uncaught');
            };
            window.addEventListener('error', errorHandler);
            this.originalHandlers.set('error', errorHandler);
        }
        // Monitor fetch requests for HTTP errors
        if (this.options.enableFetchMonitoring && typeof window !== 'undefined' && window.fetch) {
            const originalFetch = window.fetch;
            const monitor = this;
            window.fetch = async function (input, init) {
                var _a;
                try {
                    const response = await originalFetch(input, init);
                    // Check if we should monitor this HTTP status
                    if (monitor.options.monitorHttpErrors &&
                        ((_a = monitor.options.httpErrorCodes) === null || _a === void 0 ? void 0 : _a.includes(response.status))) {
                        const url = typeof input === 'string' ? input : input.toString();
                        const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
                        if (!monitor.options.silent) {
                            console.log(`🚨 UpdateIssue - Caught HTTP ${response.status} error:`, url);
                        }
                        // Try to get response body for more context
                        let responseBody = '';
                        try {
                            const clone = response.clone();
                            responseBody = await clone.text();
                        }
                        catch (e) {
                            // Ignore if we can't read the body
                        }
                        monitor.reportError(`fetch_${response.status}`, error, 'manual');
                    }
                    return response;
                }
                catch (fetchError) {
                    // Network errors, timeouts, etc.
                    const url = typeof input === 'string' ? input : input.toString();
                    if (!monitor.options.silent) {
                        console.log('🚨 UpdateIssue - Caught fetch network error:', url, fetchError.message);
                    }
                    monitor.reportError('fetch_network_error', fetchError, 'manual');
                    throw fetchError;
                }
            };
            this.originalHandlers.set('fetch', originalFetch);
        }
        // Monitor fetch in Node.js environment (if using node-fetch or similar)
        if (this.options.enableFetchMonitoring && typeof global !== 'undefined' && global.fetch) {
            const originalFetch = global.fetch;
            const monitor = this;
            global.fetch = async function (input, init) {
                var _a;
                try {
                    const response = await originalFetch(input, init);
                    if (monitor.options.monitorHttpErrors &&
                        ((_a = monitor.options.httpErrorCodes) === null || _a === void 0 ? void 0 : _a.includes(response.status))) {
                        const url = typeof input === 'string' ? input : input.toString();
                        const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
                        if (!monitor.options.silent) {
                            console.log(`🚨 UpdateIssue - Caught HTTP ${response.status} error (Node.js):`, url);
                        }
                        monitor.reportError(`fetch_${response.status}`, error, 'manual');
                    }
                    return response;
                }
                catch (fetchError) {
                    const url = typeof input === 'string' ? input : input.toString();
                    if (!monitor.options.silent) {
                        console.log('🚨 UpdateIssue - Caught fetch network error (Node.js):', url, fetchError.message);
                    }
                    monitor.reportError('fetch_network_error', fetchError, 'manual');
                    throw fetchError;
                }
            };
            this.originalHandlers.set('global.fetch', originalFetch);
        }
    }
    /**
     * Stop monitoring and restore original handlers
     */
    stop() {
        if (!this.isActive)
            return;
        this.isActive = false;
        // Restore original handlers
        if (typeof process !== 'undefined' && process.removeListener) {
            const uncaughtHandler = this.originalHandlers.get('uncaughtException');
            const rejectionHandler = this.originalHandlers.get('unhandledRejection');
            if (uncaughtHandler)
                process.removeListener('uncaughtException', uncaughtHandler);
            if (rejectionHandler)
                process.removeListener('unhandledRejection', rejectionHandler);
        }
        if (typeof window !== 'undefined') {
            const rejectionHandler = this.originalHandlers.get('unhandledrejection');
            const errorHandler = this.originalHandlers.get('error');
            if (rejectionHandler)
                window.removeEventListener('unhandledrejection', rejectionHandler);
            if (errorHandler)
                window.removeEventListener('error', errorHandler);
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
    async reportError(event, err, errorType = 'manual') {
        try {
            const errorObj = err instanceof Error ? err : new Error(String(err));
            const stackLines = (errorObj.stack || "").split("\n");
            // Extract caller info from stack trace
            let functionName = undefined, fileName = undefined, line = undefined, col = undefined;
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
                }
                else {
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
            const payload = {
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
            if (!this.options.silent) {
                console.log('📤 UpdateIssue - Reporting error:', {
                    event: payload.event,
                    error: payload.error,
                    file: payload.file,
                    function: payload.function,
                    line: payload.line,
                    errorType: payload.errorType
                });
                if (this.options.debugMode) {
                    console.log('🔍 UpdateIssue - Full payload:', payload);
                }
            }
            const response = await (0, cross_fetch_1.default)(this.options.endpoint, {
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
            if (!this.options.silent) {
                console.log('✅ UpdateIssue - Error reported successfully');
            }
        }
        catch (reportErr) {
            if (!this.options.silent) {
                console.error("❌ UpdateIssue - Failed to report error:", reportErr);
            }
            // Don't throw to avoid infinite loops
        }
    }
    /**
     * Wrap a function to automatically catch and report errors
     */
    wrapFunction(fn, functionName) {
        const monitor = this;
        const wrappedFunction = function (...args) {
            try {
                const result = fn.apply(this, args);
                // Handle promise returns
                if (result && typeof result.then === 'function') {
                    return result.catch((error) => {
                        monitor.reportError(functionName || fn.name || 'anonymous_async_function', error, 'manual');
                        throw error; // Re-throw to maintain original behavior
                    });
                }
                return result;
            }
            catch (error) {
                monitor.reportError(functionName || fn.name || 'anonymous_function', error, 'manual');
                throw error; // Re-throw to maintain original behavior
            }
        };
        // Preserve function properties
        Object.defineProperty(wrappedFunction, 'name', { value: fn.name });
        return wrappedFunction;
    }
    /**
     * Wrap all methods of an object/class
     */
    wrapObject(obj, objectName) {
        const monitor = this;
        Object.getOwnPropertyNames(obj).forEach(prop => {
            const descriptor = Object.getOwnPropertyDescriptor(obj, prop);
            if (descriptor && typeof descriptor.value === 'function') {
                const originalMethod = descriptor.value;
                const methodName = `${objectName || 'Object'}.${prop}`;
                // Use type assertion to tell TypeScript this is safe
                obj[prop] = monitor.wrapFunction(originalMethod, methodName);
            }
        });
        return obj;
    }
}
exports.ErrorMonitor = ErrorMonitor;
// Global monitor instance
let globalMonitor = null;
/**
 * Initialize global error monitoring with a single line
 * @param apiKey - Your API key
 * @param options - Configuration options
 */
function monitor(apiKey, options = {}) {
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
function stopMonitoring() {
    if (globalMonitor) {
        globalMonitor.stop();
        globalMonitor = null;
    }
}
/**
 * Get the current monitor instance
 */
function getMonitor() {
    return globalMonitor;
}
/**
 * Manually report an error (for backward compatibility)
 */
async function issueUpdate(apiKey, event, err, data = {}) {
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
function monitored(target, propertyName, descriptor) {
    if (!globalMonitor) {
        console.warn('Error monitor not initialized. Call monitor() first.');
        return descriptor;
    }
    const method = descriptor.value;
    descriptor.value = globalMonitor.wrapFunction(method, `${target.constructor.name}.${propertyName}`);
    return descriptor;
}
