import http from "http";
import express from "express";
import { Server } from "socket.io";
import User from "./models/user.model.js";


const app = express();
let io;
const server = http.createServer(app);

 io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // adjust if your frontend URL differs
    methods: ["GET", "POST"],
  },
});

// userId : socketId map
const userSocketMap = {};

export const getSocketId = (receiverId) => {
  return userSocketMap[receiverId];
};

io.on("connection", async (socket) => {
  const userId = socket.handshake.query.userId;

  if (userId) {
    // map user -> socket
    userSocketMap[userId] = socket.id;

    // update DB: user online
    await User.findByIdAndUpdate(userId, { isOnline: true });

    // send updated online users to everyone
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  }

  // 💬 message send confirmation (optional, if you want socket to handle instead of controller)
  socket.on("messageSent", (data) => {
    // sender already gets confirmation from controller
    io.to(socket.id).emit("messageStatusUpdate", {
      messageId: data.messageId,
      status: data.status || "sent",
    });
  });

  // 🟢 update previous chat list (last message + time)
  socket.on("updatePrevChatUser", (data) => {
    // data = { userId, lastMessage, lastMessageTime }
    io.to(getSocketId(data.userId))?.emit("updatePrevChatUser", data);
  });

  // 🔴 disconnect
  socket.on("disconnect", async () => {
    if (userId) {
      delete userSocketMap[userId];

      // update DB: user offline + lastSeen
      await User.findByIdAndUpdate(userId, {
        isOnline: false,
        lastSeen: new Date(),
      });

      // send updated online users to everyone
      io.emit("getOnlineUsers", Object.keys(userSocketMap));
    }
  });
});

// Getter for io instance
export const getSocket = () => {
  if (!io) throw new Error("Socket.io not initialized!");
  return io;
};


export { app, io, server };
