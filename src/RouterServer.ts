import { isSimpleError, isSimpleErrors, SimpleError, SimpleErrors } from "@simonbackx/simple-errors";
import http from "http";
import https from "https";

import { EncodedResponse } from "./EncodedResponse";
import { Request } from "./Request";
import { RequestMiddleware } from "./RequestMiddleware";
import { ResponseMiddleware } from "./ResponseMiddleware";
import { Router } from "./Router";
import { isReadableStream } from "./isReadableStream";

type HttpsOptions = {
    key: Buffer;
    cert: Buffer;
}

export class RouterServer {
    router: Router;
    server?: http.Server;
    defaultHeaders: http.OutgoingHttpHeaders = {};
    verbose = false;
    httpsOptions: HttpsOptions | null;

    requestMiddlewares: RequestMiddleware[] = []
    responseMiddlewares: ResponseMiddleware[] = []

    constructor(router: Router, option: HttpsOptions | null = null) {
        this.router = router;
        this.httpsOptions = option;
    }

    addResponseMiddleware(middleware: ResponseMiddleware) {
        this.responseMiddlewares.push(middleware)
    }

    addRequestMiddleware(middleware: RequestMiddleware) {
        this.requestMiddlewares.push(middleware)
    }

    errorToResponse(e: Error): EncodedResponse {
        const headers = {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
        };
        Object.assign(headers, this.defaultHeaders);

        // Todo: implement special errors to send custom status codes
        if (isSimpleError(e)) {
            return new EncodedResponse(e.statusCode ?? 400, headers, JSON.stringify(new SimpleErrors(e)))
        } else if (isSimpleErrors(e)) {
            return new EncodedResponse(e.statusCode ?? 400, headers, JSON.stringify(e))
        }
        return new EncodedResponse(500, headers, JSON.stringify(new SimpleErrors(new SimpleError({
            code: "internal_error",
            message: "An internal error occurred",
        }))))
    }

    processError(res: http.ServerResponse, e: Error, request: Request) {
        const response = this.errorToResponse(e);
        
        // Process response middlewares
        try {
            for (const middleware of this.responseMiddlewares) {
                middleware.handleResponse(request, response, e)
            }
        } catch (ee) {
            console.error('Error in response middlewares', ee);
        }

        // Make sure we hang up
        try {
            if (res.headersSent) {
                console.error('Headers already sent, cannot send error to client');
                
                // Somehow indicate to the client that something went wrong - since we already wrote the status code
                res.end()
            } else {
                this.setHead(res, response);

                if (isReadableStream(response.body)) {
                    console.error('Cannot use Readable streams for error responses');
                    res.end()
                } else {
                    res.end(response.body);
                }
            }
        } catch (e) {
            console.error('Failed to end error response', e);
        }
    }

    /**
     * Same as res.writeHead(response.status, response.headers), but without sending it to the client directly
     * allowing the server to delay setting the status code, if there are any errors, we can still update the status code
     */
    setHead(res: http.ServerResponse, response: EncodedResponse) {
        res.statusCode = response.status;
        
        // Removea all headers that were set already
        for (const header in res.getHeaders()) {
            res.removeHeader(header);
        }

        for (const [key, value] of Object.entries(response.headers)) {
            if (value === undefined) {
                continue;
            }

            res.setHeader(key, value);
        }
    }

    async requestListener(req: http.IncomingMessage, res: http.ServerResponse) {
        try {
            let request: Request;
            try {
                request = Request.fromHttp(req);
            } catch (e) {
                console.error(e);
                res.end();
                return;
            }

            try {
                if (this.verbose) {
                    console.log({
                        headers: request.headers,
                        body: request.body,
                    });
                }

                // Process response middlewares
                for (const middleware of this.requestMiddlewares) {
                    middleware.handleRequest(request)
                }

                let run = async () => {
                    let response = await this.router.run(request, res);

                    if (!response) {
                        // Create a new response
                        response = new EncodedResponse(404, {}, "Endpoint not found.")
                    }

                    // Add default headers
                    for (const header in this.defaultHeaders) {
                        if (this.defaultHeaders.hasOwnProperty(header) && !response.headers.hasOwnProperty(header)) {
                            response.headers[header] = this.defaultHeaders[header];
                        }
                    }

                    // Add cache control no cache
                    if (!response.headers["Cache-Control"]) response.headers["Cache-Control"] = "no-cache";

                    if (isReadableStream(response.body)) {
                        console.log('Streaming data to client');
                        response.body.on('close', () => {
                            console.log('Stream closed');
                        });

                        response.body.on('error', (e) => {
                            console.error('Stream error', e);
                            this.processError(res, e, request);
                        });
                    }

                    return response;
                }

                for (const middleware of this.requestMiddlewares) {
                    const currentRun = run;
                    const wrapRun = middleware.wrapRun
                    run = wrapRun ? (async () => wrapRun(currentRun, request)) : currentRun;
                }

                const response = await run();

                // Process response middlewares
                for (const middleware of this.responseMiddlewares) {
                    middleware.handleResponse(request, response)
                }
                
                // Write to client
                this.setHead(res, response);

                if (isReadableStream(response.body)) {
                    response.body.pipe(res);
                } else {
                    res.end(response.body);
                }

                // Write to logs
                if (this.verbose) {
                    console.log({
                        headers: response.headers,
                        body: response.body,
                    });
                }
            } catch (e) {
                this.processError(res, e, request);
                return;
            }
        } catch (e2) {
            // Catch errors in error logic
            console.error(e2);
        }
    }

    listen(port: number) {
        if (this.server) {
            throw new Error("Already listening.");
        }
        if (this.httpsOptions) {
            this.server = https.createServer(this.httpsOptions, this.requestListener.bind(this));
        } else {
            this.server = http.createServer(this.requestListener.bind(this));
        }
        this.server.timeout = 10000;

        this.server.listen(port, "0.0.0.0", () => {
            console.log(`Server running at ${this.httpsOptions ? 'https' : 'http'}://0.0.0.0:${port}`);
        });
    }

    async close(): Promise<void> {
        console.log(`Stoppping ${this.httpsOptions ? 'HTTPS' : 'HTTP'} server...`);
        return new Promise((resolve, reject) => {
            if (!this.server) {
                reject(new Error("Already stopped."));
                return
            }
            this.server.close((err) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve();
            });
            this.server = undefined;
        });
    }
}
