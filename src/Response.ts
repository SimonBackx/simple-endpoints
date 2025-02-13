import { Encodeable } from "@simonbackx/simple-encoding";
import http from "http";
import { Readable } from "node:stream";

export type SupportedResponseBodyTypes = Encodeable | Encodeable[] | string | Buffer | Uint8Array | Readable | undefined;

export class Response<Body extends SupportedResponseBodyTypes = SupportedResponseBodyTypes> {
    status = 200;
    headers: http.OutgoingHttpHeaders = {};
    body: Body;

    constructor(body: Body, status = 200, headers: http.OutgoingHttpHeaders = {}) {
        this.body = body;
        this.status = status;
        this.headers = headers;
    }
}
