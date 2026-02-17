import winston from "winston";

const { combine, timestamp, colorize, printf, json } = winston.format;

// Custom format for development (human-readable)
const devFormat = combine(
  colorize(),
  timestamp({ format: "HH:mm:ss" }),
  printf(({ level, message, timestamp }) => {
    return `[${timestamp}] ${level}: ${message}`;
  }),
);

// Format for production (structured JSON for log aggregation tools)
const prodFormat = combine(timestamp(), json());

const logger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "warn" : "debug",
  format: process.env.NODE_ENV === "production" ? prodFormat : devFormat,
  transports: [
    new winston.transports.Console(),

    // Write errors to a separate file
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),

    // Write all logs to combined file
    new winston.transports.File({ filename: "logs/combined.log" }),
  ],
});

// Stream for Morgan to pipe HTTP logs through Winston
logger.stream = {
  write: (message) => logger.http(message.trim()),
};

export default logger;
