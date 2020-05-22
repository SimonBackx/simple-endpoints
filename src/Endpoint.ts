import { Decoder, Encodeable } from "@simonbackx/simple-encoding";

import { DecodedRequest } from "./DecodedRequest";
import { EncodedResponse } from "./EncodedResponse";
import { EndpointError } from "./EndpointError";
import { EndpointErrors } from "./EndpointErrors";
import { Request } from "./Request";
import { Response } from "./Response";

export abstract class Endpoint<Params, Query, RequestBody, ResponseBody extends Encodeable | Encodeable[] | undefined> {
    protected queryDecoder: Decoder<Query> | undefined;
    protected bodyDecoder: Decoder<RequestBody> | undefined;

    protected abstract doesMatch(request: Request): [true, Params] | [false];
    protected abstract handle(request: DecodedRequest<Params, Query, RequestBody>): Promise<Response<ResponseBody>>;

    async getResponse(request: Request, params: Params): Promise<Response<ResponseBody>> {
        let decodedRequest: DecodedRequest<Params, Query, RequestBody>;
        try {
            decodedRequest = await DecodedRequest.fromRequest(request, params, this.queryDecoder, this.bodyDecoder);
        } catch (e) {
            if (e.code && e.message) {
                throw new EndpointError(e);
            }
            if (e.errors) {
                throw new EndpointErrors(...e.errors);
            }
            throw e;
        }
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
            if (response.body !== undefined) {
                const version = request.getVersion();
                if (Array.isArray(response.body)) {
                    for (const el of response.body) {
                        el.encode({ version });
                    }
                } else {
                    response.body.encode({ version });
                }
            }

            return response;
        }
        throw new Error("Route is not matching");
    }

    async run(request: Request): Promise<EncodedResponse | null> {
        const [match, params] = this.doesMatch(request);
        if (match) {
            if (!params) {
                throw new Error("Compiler doesn't optimize for this, but this should not be able to run");
            }
            return new EncodedResponse(await this.getResponse(request, params), request);
        }
        return null;
    }

    static parseParameters<Keys extends string>(
        url: string,
        template: string,
        params: Record<Keys, NumberConstructor | StringConstructor>
    ): Record<Keys, number | string> | undefined {
        const parts = url.split("/");
        const templateParts = template.split("/");

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

                    if (typeof resultParams[param] === "number") {
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
