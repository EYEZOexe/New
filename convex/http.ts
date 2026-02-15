import { httpRouter } from "convex/server";
import { auth } from "./auth";

const http = httpRouter();

// Convex Auth HTTP endpoints (sign-in, sign-out, etc).
auth.addHttpRoutes(http);

export default http;

