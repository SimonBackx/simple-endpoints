import { Request } from "./Request";

export interface RequestMiddleware {
    /**
     * Here you can make changes to a request, or throw an error to block requests
     */
    handleRequest(request: Request);
}