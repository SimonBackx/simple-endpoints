import { Decoder, ObjectData } from "@simonbackx/simple-encoding";
import http from "http";

import { HttpMethod, Request } from "./Request";
import { EndpointError } from "./EndpointError";

export class DecodedRequest<Params, Query, Body> {
    method: HttpMethod;
    url: string;
    host: string;
    headers: http.IncomingHttpHeaders;
    params: Params;
    body: Body;
    query: Query;

    /**
     * Reference to not yet decoded request (usefull for uploads and special request bodies)
     */
    request: Request;

    static async fromRequest<Params, Query, Body>(
        request: Request,
        params: Params,
        queryDecoder: Decoder<Query> | undefined,
        bodyDecoder: Decoder<Body> | undefined
    ): Promise<DecodedRequest<Params, Query, Body>> {
        const r = new DecodedRequest<Params, Query, Body>();
        r.method = request.method;
        r.url = request.url;
        r.host = request.host;
        r.headers = request.headers;
        r.request = request;
        r.params = params;

        if (queryDecoder !== undefined || bodyDecoder !== undefined) {
            // Only require version if we have to decode something
            const version = request.getVersion();

            const query = queryDecoder !== undefined ? queryDecoder.decode(new ObjectData(request.query, { version })) : undefined;
            const body = bodyDecoder !== undefined ? bodyDecoder.decode(new ObjectData(JSON.parse(await request.body), { version })) : undefined;
            r.query = query as Query;
            r.body = body as Body;
        }

        return r;
    }
}
