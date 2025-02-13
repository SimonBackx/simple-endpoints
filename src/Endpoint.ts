import { Decoder, Encodeable } from '@simonbackx/simple-encoding';
import http from 'http';
import { Readable } from 'node:stream';

import { DecodedRequest } from './DecodedRequest';
import { EncodedResponse } from './EncodedResponse';
import { Request } from './Request';
import { Response } from './Response';

export abstract class Endpoint<Params, Query, RequestBody, ResponseBody extends Encodeable | Encodeable[] | string | Buffer | Uint8Array | Readable | undefined> {
    protected queryDecoder: Decoder<Query> | undefined;
    protected bodyDecoder: Decoder<RequestBody> | undefined;

    protected abstract doesMatch(request: Request, response?: http.ServerResponse): [true, Params] | [false];
    abstract handle(request: DecodedRequest<Params, Query, RequestBody>): Promise<Response<ResponseBody>>;

    async getResponse(request: Request, params: Params): Promise<Response<ResponseBody>> {
        const decodedRequest = await DecodedRequest.fromRequest(request, params, this.queryDecoder, this.bodyDecoder);
        return await this.handle(decodedRequest);
    }

    // Build for testing
    // it emulates some extra parts of the request to check if everything works
    async test(request: Request): Promise<Response<ResponseBody>> {
        const [match, params] = this.doesMatch(request);
        if (match) {
            if (!params) {
                throw new Error("Compiler doesn't optimize for this, but this should not be able to run");
            }
            const response = await this.getResponse(request, params);

            // Check if encoding works (ignoring the response)
            EncodedResponse.encode(response, request);

            return response;
        }
        throw new Error('Route is not matching');
    }

    /**
     * Checks whether the request matches this endpoint and returns the decoded request if it does.
     * Next you'll need to pass this to the handle method to get a response.
     */
    async decode(request: Request, response?: http.ServerResponse): Promise<DecodedRequest<Params, Query, RequestBody> | null> {
        const [match, params] = this.doesMatch(request, response);
        if (match) {
            if (!params) {
                throw new Error("Compiler doesn't optimize for this, but this should not be able to run");
            }
            return await DecodedRequest.fromRequest(request, params, this.queryDecoder, this.bodyDecoder);
        }
        return null;
    }

    /*
    async run(request: Request, response?: http.ServerResponse): Promise<Response<ResponseBody> | null> {
        const [match, params] = this.doesMatch(request, response);
        if (match) {
            if (!params) {
                throw new Error("Compiler doesn't optimize for this, but this should not be able to run");
            }
            return await this.getResponse(request, params);
        }
        return null;
    } */

    static parseParameters<Keys extends string>(
        url: string,
        template: string,
        params: Record<Keys, NumberConstructor | StringConstructor>,
    ): Record<Keys, number | string> | undefined {
        const parts = url.split('/');
        const templateParts = template.split('/');

        if (parts.length != templateParts.length) {
            // No match
            return;
        }

        const resultParams = {} as any;

        for (let index = 0; index < parts.length; index++) {
            const part = parts[index];

            const templatePart = templateParts[index];
            if (templatePart != part) {
                const param = templatePart.substr(1);
                if (params[param]) {
                    // Found a param
                    resultParams[param] = params[param](part);

                    if (typeof resultParams[param] === 'number') {
                        // Force integers
                        if (!Number.isInteger(resultParams[param])) {
                            return;
                        }
                    }
                    continue;
                }
                // no match
                return;
            }
        }

        return resultParams;
    }
}
