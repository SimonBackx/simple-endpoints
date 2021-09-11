import { isSimpleError, isSimpleErrors, SimpleError, SimpleErrors } from "@simonbackx/simple-errors";
import http from "http";
import https from "https";

import { EncodedResponse } from "./EncodedResponse";
import { Request } from "./Request";
import { ResponseMiddleware } from "./ResponseMiddleware";
import { Router } from "./Router";

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

    responseMiddlewares: ResponseMiddleware[] = []

    constructor(router: Router, option: HttpsOptions | null = null) {
        this.router = router;
        this.httpsOptions = option;
    }

    addResponseMiddleware(middleware: ResponseMiddleware) {
        this.responseMiddlewares.push(middleware)
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

                // Process response middlewares
                for (const middleware of this.responseMiddlewares) {
                    middleware.handleResponse(request, response)
                }
                
                // Write to client
                res.writeHead(response.status, response.headers);
                res.end(response.body);

                // Write to logs
                if (this.verbose) {
                    console.log({
                        headers: response.headers,
                        body: response.body,
                    });
                }
            } catch (e) {
                const headers = {
                    "Content-Type": "application/json",
                    "Cache-Control": "no-cache",
                };
                Object.assign(headers, this.defaultHeaders);

                let response: EncodedResponse

                // Todo: implement special errors to send custom status codes
                if (isSimpleError(e)) {
                    response = new EncodedResponse(e.statusCode ?? 400, headers, JSON.stringify(new SimpleErrors(e)))
                    console.error(new SimpleErrors(e));
                } else if (isSimpleErrors(e)) {
                    response = new EncodedResponse(e.statusCode ?? 400, headers, JSON.stringify(e))
                    console.error(JSON.stringify(e));
                } else {
                    console.error(e);
                    response = new EncodedResponse(500, headers, JSON.stringify(new SimpleErrors(new SimpleError({
                        code: "internal_error",
                        message: e.message
                    }))))
                }
                
                // Process response middlewares
                for (const middleware of this.responseMiddlewares) {
                    middleware.handleResponse(request, response)
                }

                // Write to client
                res.writeHead(response.status, response.headers);
                res.end(response.body);

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
