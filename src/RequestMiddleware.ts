import { DecodedRequest } from './DecodedRequest';
import { Endpoint } from './Endpoint';
import { Request } from './Request';

export interface RequestMiddleware {
    /**
     * Here you can make changes to a request, or throw an error to block requests
     */
    handleRequest?(request: Request): Promise<void> | void;
    handleDecodedRequest?(request: DecodedRequest<unknown, unknown, unknown>, endpoint: Endpoint<unknown, unknown, unknown, any>): Promise<void> | void;

    /**
     * Wrap the run function of the endpoint. E.g. if you need to add async hooks.
     */
    wrapRun?<T>(run: () => Promise<T>, request: Request): Promise<T>;
}
