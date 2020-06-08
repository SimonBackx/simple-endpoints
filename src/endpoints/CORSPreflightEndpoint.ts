import { Request } from "../Request";
import { DecodedRequest } from "../DecodedRequest";
import { Response } from "../Response";
import { Endpoint } from "../Endpoint";

type Params = {};
type Query = undefined;
type Body = undefined;
type ResponseBody = undefined;

export class CORSPreflightEndpoint extends Endpoint<Params, Query, Body, ResponseBody> {
    protected doesMatch(request: Request): [true, Params] | [false] {
        if (request.method != "OPTIONS") {
            return [false];
        }

        return [true, {}];
    }

    async handle(request: DecodedRequest<Params, Query, Body>) {
        // todo: improve this a bit
        const response = new Response(undefined);
        response.headers["Access-Control-Allow-Origin"] = "*";
        response.headers["Access-Control-Allow-Methods"] = "*";
        response.headers["Access-Control-Allow-Headers"] = request.headers["access-control-request-headers"] ?? "*";
        response.headers["Access-Control-Max-Age"] = "86400"; // Cache 24h

        return Promise.resolve(response);
    }
}
