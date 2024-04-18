
import { Encodeable } from "@simonbackx/simple-encoding";

import { Endpoint } from "./Endpoint";
import { Request } from "./Request";
import { RequestMiddleware } from "./RequestMiddleware";
import { Response } from "./Response";

/**
 * Adds request middeware functionality to tests
 */
export class TestServer {
    requestMiddlewares: RequestMiddleware[] = []

    addRequestMiddleware(middleware: RequestMiddleware) {
        this.requestMiddlewares.push(middleware)
    }

    async test<ResponseBody extends Encodeable | Encodeable[] | string | Buffer | undefined>(endpoint: Endpoint<any, any, any, ResponseBody>, request: Request): Promise<Response<ResponseBody>> {

        // Process response middlewares
        for (const middleware of this.requestMiddlewares) {
            middleware.handleRequest(request)
        }

        let run = async () => {
            return await endpoint.test(request);
        }

        for (const middleware of this.requestMiddlewares) {
            const currentRun = run;
            const wrapRun = middleware.wrapRun
            run = wrapRun ? (async () => wrapRun(currentRun, request)) : currentRun;
        }

        return await run();
    }
}
