import { EncodedResponse } from "./EncodedResponse";
import { Request } from "./Request";

export interface ResponseMiddleware {
    /**
     * Here you can make changes to the response before it is send to the client
     */
    handleResponse(request: Request, response: EncodedResponse, error?: Error);
}