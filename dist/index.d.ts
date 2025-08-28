export interface IssueUpdateOptions {
    notifier?: string;
    [key: string]: any;
}
/**
 * Sends issue updates to your backend webhook.
 * @param apiKey - The user's API key
 * @param event - The event name, e.g. "checkout.calculateTotals"
 * @param err - Error object or message
 * @param data - Extra data like { notifier: "discord" }
 */
export declare function issueUpdate(apiKey: string, event: string, err: Error | string, data?: IssueUpdateOptions): Promise<any>;
