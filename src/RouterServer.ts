import { isSimpleError, isSimpleErrors,SimpleError, SimpleErrors } from "@simonbackx/simple-errors";
import http from "http";

import { Request } from "./Request";
import { Router } from "./Router";

export class RouterServer {
    router: Router;
    server?: http.Server;
    defaultHeaders: http.OutgoingHttpHeaders = {};
    verbose = false;

    constructor(router: Router) {
        this.router = router;
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

                const response = await this.router.run(request, res);

                if (!response) {
                    const headers = {};

                    // Add default headers
                    Object.assign(headers, this.defaultHeaders);
                    res.writeHead(404, headers);
                    res.end("Endpoint not found.");
                } else {
                    for (const header in this.defaultHeaders) {
                        if (this.defaultHeaders.hasOwnProperty(header) && !response.headers.hasOwnProperty(header)) {
                            response.headers[header] = this.defaultHeaders[header];
                        }
                    }

                    if (!response.headers["Cache-Control"]) response.headers["Cache-Control"] = "no-cache";
                    res.writeHead(response.status, response.headers);
                    res.end(response.body);

                    if (this.verbose) {
                        console.log({
                            headers: response.headers,
                            body: response.body,
                        });
                    }
                }
            } catch (e) {
                const headers = {
                    "Content-Type": "application/json",
                    "Cache-Control": "no-cache",
                };
                Object.assign(headers, this.defaultHeaders);

                // Todo: implement special errors to send custom status codes
                if (isSimpleError(e)) {
                    res.writeHead(e.statusCode ?? 400, headers);
                    res.end(JSON.stringify(new SimpleErrors(e)));
                    console.error(new SimpleErrors(e));
                } else if (isSimpleErrors(e)) {
                    res.writeHead(e.statusCode ?? 400, headers);
                    res.end(JSON.stringify(e));

                    console.error(JSON.stringify(e));
                } else {
                    res.writeHead(500, headers);
                    // Todo: hide information if not running in development mode
                    res.end(
                        JSON.stringify({
                            errors: [
                                {
                                    code: "internal_error",
                                    message: e.message,
                                },
                            ],
                        })
                    );

                    console.error(e);
                }

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
        console.log("Starting server...");
        this.server = http.createServer(this.requestListener.bind(this));
        this.server.timeout = 10000;

        this.server.listen(port, "0.0.0.0", () => {
            console.log("Server running at http://0.0.0.0:" + port);
        });
    }

    async close(): Promise<Error | undefined> {
        console.log("Stoppping server...");
        return new Promise((resolve, reject) => {
            if (!this.server) {
                throw new Error("Already stopped.");
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
