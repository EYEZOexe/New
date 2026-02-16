import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { mountConnectorRoutes } from "./httpConnectors";
import { mountIngestRoutes } from "./httpIngest";
import { mountPaymentRoutes } from "./httpPayments";

const http = httpRouter();

auth.addHttpRoutes(http);
mountConnectorRoutes(http);
mountIngestRoutes(http);
mountPaymentRoutes(http);

export default http;
