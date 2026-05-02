/**
 * Medical Lab Analysis Service
 *
 * This Cloud Run service handles:
 * - Analyzing medical test results
 * - Comparing results against normal ranges
 * - Generating health recommendations
 * - Storing analysis results in Firestore
 *
 * Factor Compliance:
 * - Factor 3: Configuration via environment variables
 * - Factor 6: Stateless processes
 * - Factor 7: Port binding (self-contained HTTP server)
 * - Factor 9: Disposability (fast startup, graceful shutdown)
 * - Factor 11: Logs to stdout
 */

const express = require("express");
const { Firestore } = require("@google-cloud/firestore");
const { Storage } = require("@google-cloud/storage");
const logger = require("./src/utils/logger");
const analyzer = require("./src/analyzer/analyzer");

// ==============================================================================
// Configuration (Factor 3: Config in environment)
// ==============================================================================

const PORT = process.env.PORT || 8080;
const PROJECT_ID = process.env.PROJECT_ID;
const BUCKET_NAME = process.env.BUCKET_NAME;
const NODE_ENV = process.env.NODE_ENV || "development";

if (!PROJECT_ID) {
  logger.error("Missing required environment variable: PROJECT_ID");
  process.exit(1);
}

// ==============================================================================
// Initialize GCP Clients
// ==============================================================================

const firestore = new Firestore({ projectId: PROJECT_ID });
const storage = new Storage({ projectId: PROJECT_ID });

const analysesCollection = firestore.collection("analyses");
const reportsCollection = firestore.collection("reports");

// ==============================================================================
// Express Application Setup
// ==============================================================================

const app = express();

// CORS - allow browser requests from any origin
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// Middleware
app.use(express.json({ limit: "10mb" }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info("Incoming request", {
    method: req.method,
    path: req.path,
    ip: req.ip,
  });
  next();
});

// ==============================================================================
// Health Check Endpoints (Factor 14: Telemetry)
// ==============================================================================

// Liveness probe
app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy", service: "analysis-service" });
});

// Readiness probe
app.get("/ready", async (req, res) => {
  try {
    // Check Firestore connectivity
    await firestore
      .collection("_health")
      .doc("check")
      .set({ timestamp: new Date() });

    res.status(200).json({
      status: "ready",
      firestore: "connected",
    });
  } catch (error) {
    logger.error("Readiness check failed", { error: error.message });
    res.status(503).json({ status: "not ready", error: error.message });
  }
});

// ==============================================================================
// API Endpoints
// ==============================================================================

/**
 * POST /analyze
 * Analyze medical test results
 *
 * Body:
 * {
 *   reportId: string,
 *   userId: string,
 *   patientInfo: {
 *     age: number,
 *     gender: 'male' | 'female'
 *   },
 *   testResults: {
 *     testName: value,
 *     ...
 *   }
 * }
 */

/**
 * POST /pubsub/push
 * Receives analysis requests from Pub/Sub push subscription
 */
app.post("/pubsub/push", async (req, res) => {
  try {
    const message = req.body?.message;

    if (!message || !message.data) {
      return res.status(400).json({ error: "Invalid Pub/Sub message" });
    }

    // Decode base64 Pub/Sub message
    const data = JSON.parse(Buffer.from(message.data, "base64").toString());
    const { reportId, userId, testResults, patientInfo } = data;

    if (!reportId || !userId || !testResults || !patientInfo) {
      return res.status(400).json({ error: "Missing fields in Pub/Sub message" });
    }

    logger.info("Received analysis request from Pub/Sub", { reportId, userId });

    // Run analysis
    const analysisResults = analyzer.analyzeBloodTest(testResults, patientInfo);

    // Save to Firestore
    const analysisData = {
      reportId,
      userId,
      patientInfo,
      testResults,
      analysis: analysisResults,
      analyzedAt: Firestore.Timestamp.now(),
      version: "1.0",
    };

    const analysisRef = await analysesCollection.add(analysisData);

    // Update report status — triggers Firestore onSnapshot on WS service
    await reportsCollection.doc(reportId).set({
      analysisId: analysisRef.id,
      analyzed: true,
      status: "analyzed",
      analyzedAt: Firestore.Timestamp.now(),
    }, { merge: true });

    logger.info("Analysis completed via Pub/Sub", {
      analysisId: analysisRef.id,
      reportId,
    });

    // 204 = success, Pub/Sub won't retry
    res.status(204).send();

  } catch (error) {
    logger.error("Error processing Pub/Sub message", { error: error.message });
    // 500 = Pub/Sub will retry
    res.status(500).json({ error: "Processing failed", details: error.message });
  }
});

/**
 * GET /analyze/:analysisId
 * Get analysis results by ID
 */
app.get("/analyze/:analysisId", async (req, res) => {
  try {
    const { analysisId } = req.params;

    const doc = await analysesCollection.doc(analysisId).get();

    if (!doc.exists) {
      return res.status(404).json({ error: "Analysis not found" });
    }

    const data = doc.data();

    res.status(200).json({
      analysisId: doc.id,
      ...data,
      analyzedAt: data.analyzedAt?.toDate(),
    });
  } catch (error) {
    logger.error("Error retrieving analysis", {
      error: error.message,
      analysisId: req.params.analysisId,
    });
    res
      .status(500)
      .json({ error: "Failed to retrieve analysis", details: error.message });
  }
});

/**
 * GET /analyze/report/:reportId
 * Get latest analysis for a report
 */
app.get("/analyze/report/:reportId", async (req, res) => {
  try {
    const { reportId } = req.params;

    // Query for analyses of this report
    const snapshot = await analysesCollection
      .where("reportId", "==", reportId)
      .orderBy("analyzedAt", "desc")
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res
        .status(404)
        .json({ error: "No analysis found for this report" });
    }

    const doc = snapshot.docs[0];
    const data = doc.data();

    res.status(200).json({
      analysisId: doc.id,
      ...data,
      analyzedAt: data.analyzedAt?.toDate(),
    });
  } catch (error) {
    logger.error("Error retrieving analysis for report", {
      error: error.message,
      reportId: req.params.reportId,
    });
    res
      .status(500)
      .json({ error: "Failed to retrieve analysis", details: error.message });
  }
});

// ==============================================================================
// Error Handling
// ==============================================================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error("Unhandled error", { error: err.message, stack: err.stack });
  res.status(500).json({ error: "Internal server error" });
});

// ==============================================================================
// Server Lifecycle (Factor 9: Disposability)
// ==============================================================================

let server;

function startServer() {
  server = app.listen(PORT, () => {
    logger.info(`Analysis Service started`, {
      port: PORT,
      environment: NODE_ENV,
      projectId: PROJECT_ID,
    });
  });
}

// Graceful shutdown handler
async function gracefulShutdown(signal) {
  logger.info(`${signal} received, starting graceful shutdown`);

  if (server) {
    server.close(() => {
      logger.info("HTTP server closed");

      // Close Firestore connection
      firestore.terminate().then(() => {
        logger.info("Firestore connection closed");
        process.exit(0);
      });
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      logger.warn("Forcing shutdown after timeout");
      process.exit(1);
    }, 10000);
  }
}

// Handle termination signals
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Start the server
startServer();
