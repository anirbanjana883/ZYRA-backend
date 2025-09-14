import http from "http";
import express from "express";
import { Server } from "socket.io";
import User from "./models/user.model.js";
import Notification from "./models/notification.model.js";

const app = express();
let io;
const server = http.createServer(app);

io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
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

  if (!userId) {
    console.log("No userId provided, disconnecting socket");
    return socket.disconnect();
  }

  if (userId) {
    userSocketMap[userId] = socket.id;

    try {
      await User.findByIdAndUpdate(userId, { isOnline: true });
    } catch (err) {
      console.error("MongoDB error on connection:", err);
    }

    
    io.emit("getOnlineUsers", Object.keys(userSocketMap));

    const unreadNotifications = await Notification.find({
      receiver: userId,
      isRead: false,
    })
      .populate("sender", "name userName profileImage")
      .populate("receiver", "name userName profileImage")
      .populate("post")
      .populate("loop")
      .sort({ createdAt: -1 });

    if (unreadNotifications.length > 0) {
      socket.emit("receiveOfflineNotifications", unreadNotifications);
    }
  }

  socket.on("messageSent", (data) => {
    io.to(socket.id).emit("messageStatusUpdate", {
      messageId: data.messageId,
      status: data.status || "sent",
    });
  });

  socket.on("updatePrevChatUser", (data) => {
    io.to(getSocketId(data.userId))?.emit("updatePrevChatUser", data);
  });

  socket.on("disconnect", async () => {
    if (userId) {
      delete userSocketMap[userId];

      try {
        await User.findByIdAndUpdate(userId, {
          isOnline: false,
          lastSeen: new Date(),
        });
      } catch (err) {
        console.error("MongoDB error on connection:", err);
      }

      io.emit("getOnlineUsers", Object.keys(userSocketMap));
    }
  });

  socket.on("sendNotification", async (data) => {
    // data = { receiverId, notification }
    const receiverSocketId = userSocketMap[data.receiverId];
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("receiveNotification", data.notification);
    }
  });
});

export const getSocket = () => {
  if (!io) throw new Error("Socket.io not initialized!");
  return io;
};

export { app, io, server };
