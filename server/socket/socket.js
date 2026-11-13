import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createRedisPubSubClients } from '../services/redis.js';
import { logger } from '../services/logger.js';

let io;

export const initializeSocket = async (httpServer, allowedOrigins) => {
  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    socket.on('join:show', (showId) => {
      if (!showId) {
        return;
      }
      socket.join(`show:${showId}`);
    });

    socket.on('leave:show', (showId) => {
      if (!showId) {
        return;
      }
      socket.leave(`show:${showId}`);
    });
  });

  try {
    const clients = await createRedisPubSubClients();
    if (clients) {
      io.adapter(createAdapter(clients.pubClient, clients.subClient));
      logger.info('Socket.IO Redis adapter enabled');
    }
  } catch (error) {
    logger.error({ error }, 'Failed to enable Socket.IO Redis adapter');
  }

  return io;
};

export const emitSeatUpdate = ({ showId, occupiedSeats }) => {
  if (!io || !showId) {
    return;
  }

  io.to(`show:${showId}`).emit('seats:updated', {
    showId,
    occupiedSeats,
    updatedAt: new Date().toISOString(),
  });
};

export const emitSeatEvent = ({ showId, event, payload }) => {
  if (!io || !showId) {
    return;
  }

  io.to(`show:${showId}`).emit(event, {
    showId,
    ...payload,
    updatedAt: new Date().toISOString(),
  });
};
