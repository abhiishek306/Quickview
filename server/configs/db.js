import mongoose from "mongoose";
import { env } from "./env.js";
import { logger } from "../services/logger.js";

const resolveMongoUri = () => {
  try {
    const parsed = new URL(env.MONGODB_URI);
    const hasDbInPath = parsed.pathname && parsed.pathname !== '/';

    if (!hasDbInPath) {
      parsed.pathname = '/quickview';
    }

    return parsed.toString();
  } catch {
    // Fallback to raw URI if parsing fails for any reason.
    return env.MONGODB_URI;
  }
};

const connectDB = async () => {
  if (env.SKIP_DB_CONNECT) {
    logger.warn('SKIP_DB_CONNECT is enabled. MongoDB connection is skipped.');
    return;
  }

  try {
    mongoose.connection.on('connected',() => logger.info('MongoDB connected successfully'));
    await mongoose.connect(resolveMongoUri());
  }
    catch (error) {
        logger.error({ error }, 'MongoDB connection failed');
        throw error;
    }
}
export default connectDB;