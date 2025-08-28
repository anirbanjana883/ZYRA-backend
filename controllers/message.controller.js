import uploadOnCloudinary from "../config/cloudinary.js";
import Message from "../models/message.model.js";
import Conversation from "../models/conversation.model.js";

export const sendMessage = async (req, res) => {
  try {
    const senderId = req.userId;
    const receiverId = req.params.receiverId;

    const { message } = req.body;
    let image;

    if (req.file) {
      image = await uploadOnCloudinary(req.file.path);
    }

    // create new message
    const newMessage = await Message.create({
      sender: senderId,
      receiver: receiverId,
      message,
      image,
    });

    // find existing conversation
    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, receiverId] },
    });

    // if no conversation found, create new
    if (!conversation) {
      conversation = await Conversation.create({
        participants: [senderId, receiverId],
        messages: [newMessage._id],
      });
    } else {
      conversation.messages.push(newMessage._id);
      await conversation.save();
    }

    return res.status(200).json(newMessage);
  } catch (error) {
    return res.status(500).json({ message: `send message error: ${error}` });
  }
};

export const getAllMessages = async (req, res) => {
  try {
    const senderId = req.userId;
    const receiverId = req.params.receiverId;

    const conversation = await Conversation.findOne({
      participants: { $all: [senderId, receiverId] },
    })
      .populate({
        path: "messages",
        populate: { path: "sender", select: "userName profileImage name" },
      })
      .populate("participants", "userName profileImage name");

    return res.status(200).json({
      messages: conversation?.messages || [],
      participants: conversation?.participants || [],
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: `get message error: ${error.message}` });
  }
};


export const getPreviousChats = async (req, res) => {
  try {
    const currentUserId = req.userId;

    const conversations = await Conversation.find({
      participants: currentUserId,
    })
      .populate("participants")
      .populate({ path: "messages", populate: { path: "sender", select: "userName profileImage" } })
      .sort({ updatedAt: -1 })
      .lean();

    // collect all users I have chatted with
    const userMap = {};
    conversations.forEach((conv) => {
      conv.participants.forEach((user) => {
        if (user._id.toString() !== currentUserId.toString()) {
          userMap[user._id] = user;
        }
      });
    });

    const previousUsers = Object.values(userMap);
    return res.status(200).json(previousUsers);
  } catch (error) {
    return res
      .status(500)
      .json({ message: `get previous message error: ${error.message}` });
  }
};
